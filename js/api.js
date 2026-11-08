/* ActiviCast — Open-Meteo data service, cache, normalization, demo data */
(function () {
  'use strict';
  const AC = (window.AC = window.AC || {});
  const U = AC.util;

  const WEATHER = 'https://api.open-meteo.com/v1/forecast';
  const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
  const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
  const CACHE_MS = 10 * 60 * 1000;
  const weatherVars = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation_probability',
    'precipitation', 'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_gusts_10m',
    'uv_index', 'is_day', 'dew_point_2m', 'shortwave_radiation',
  ].join(',');
  const dailyVars = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
    'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max', 'wind_speed_10m_max',
  ].join(',');

  async function fetchJson(url, timeout = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The weather service took too long to respond');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchPlaces(query) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const url = `${GEOCODE}?name=${encodeURIComponent(q)}&count=7&language=en&format=json`;
    const data = await fetchJson(url, 8000);
    return (data.results || []).map((p) => ({
      id: p.id,
      name: p.name,
      admin: p.admin1 || p.admin2 || '',
      country: p.country || '',
      cc: p.country_code || '',
      lat: p.latitude,
      lon: p.longitude,
      timezone: p.timezone,
    }));
  }

  async function reversePlace(lat, lon) {
    const url = `${REVERSE}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
    const p = await fetchJson(url, 8000);
    return {
      name: p.city || p.locality || p.principalSubdivision || 'Current location',
      admin: p.principalSubdivision || '',
      country: p.countryName || '',
      cc: p.countryCode || '',
      lat,
      lon,
    };
  }

  function idxVal(block, key, i, fallback = 0) {
    const v = block && block[key];
    return Array.isArray(v) && v[i] != null ? v[i] : fallback;
  }

  function normalize(weather, air, place, meta) {
    const aqMap = new Map();
    if (air && air.hourly && air.hourly.time) {
      air.hourly.time.forEach((t, i) => aqMap.set(t, {
        aqi: idxVal(air.hourly, 'us_aqi', i, null),
        pm25: idxVal(air.hourly, 'pm2_5', i, null),
      }));
    }
    const H = weather.hourly;
    const hours = H.time.map((time, i) => {
      const aq = aqMap.get(time) || {};
      return {
        time,
        date: time.slice(0, 10),
        temp: idxVal(H, 'temperature_2m', i),
        feels: idxVal(H, 'apparent_temperature', i),
        humidity: idxVal(H, 'relative_humidity_2m', i),
        dew: idxVal(H, 'dew_point_2m', i),
        precipProb: idxVal(H, 'precipitation_probability', i),
        precip: idxVal(H, 'precipitation', i),
        code: idxVal(H, 'weather_code', i),
        cloud: idxVal(H, 'cloud_cover', i),
        visibility: idxVal(H, 'visibility', i, 20000),
        wind: idxVal(H, 'wind_speed_10m', i),
        gust: idxVal(H, 'wind_gusts_10m', i),
        uv: idxVal(H, 'uv_index', i),
        isDay: idxVal(H, 'is_day', i) === 1,
        radiation: idxVal(H, 'shortwave_radiation', i),
        aqi: aq.aqi == null ? null : Math.round(aq.aqi),
        pm25: aq.pm25 == null ? null : U.round(aq.pm25, 1),
      };
    });
    const D = weather.daily;
    const days = D.time.map((date, i) => ({
      date,
      code: idxVal(D, 'weather_code', i),
      max: idxVal(D, 'temperature_2m_max', i),
      min: idxVal(D, 'temperature_2m_min', i),
      precip: idxVal(D, 'precipitation_sum', i),
      precipProb: idxVal(D, 'precipitation_probability_max', i),
      sunrise: idxVal(D, 'sunrise', i, null),
      sunset: idxVal(D, 'sunset', i, null),
      uvMax: idxVal(D, 'uv_index_max', i),
      windMax: idxVal(D, 'wind_speed_10m_max', i),
    }));
    const currentTime = weather.current.time.slice(0, 13) + ':00';
    let nowIndex = hours.findIndex((h) => h.time === currentTime);
    if (nowIndex < 0) nowIndex = Math.max(0, hours.findLastIndex((h) => h.time <= currentTime));
    const current = hours[nowIndex] || hours[0];
    return {
      version: 1,
      fetchedAt: Date.now(),
      source: meta && meta.source || 'live',
      stale: !!(meta && meta.stale),
      location: { ...place, lat: weather.latitude, lon: weather.longitude, timezone: weather.timezone, elevation: weather.elevation },
      timezone: weather.timezone,
      timezoneAbbr: weather.timezone_abbreviation,
      utcOffset: weather.utc_offset_seconds || 0,
      current,
      nowIndex,
      hours,
      days,
    };
  }

  function cacheKey(place) {
    return `ac_weather_v1_${Number(place.lat).toFixed(2)}_${Number(place.lon).toFixed(2)}`;
  }

  async function fetchWeather(place, opts = {}) {
    const key = cacheKey(place);
    const cached = U.store.get(key, null);
    if (!opts.force && cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      return { ...cached, source: 'cache', stale: false };
    }
    const params = new URLSearchParams({
      latitude: place.lat,
      longitude: place.lon,
      current: 'temperature_2m',
      hourly: weatherVars,
      daily: dailyVars,
      timezone: 'auto',
      forecast_days: '8',
    });
    const aqParams = new URLSearchParams({
      latitude: place.lat,
      longitude: place.lon,
      hourly: 'us_aqi,pm2_5',
      timezone: 'auto',
      forecast_days: '7',
    });
    try {
      const [weatherResult, airResult] = await Promise.allSettled([
        fetchJson(`${WEATHER}?${params}`),
        fetchJson(`${AIR}?${aqParams}`),
      ]);
      if (weatherResult.status !== 'fulfilled') throw weatherResult.reason;
      const air = airResult.status === 'fulfilled' ? airResult.value : null;
      const model = normalize(weatherResult.value, air, place, { source: 'live' });
      U.store.set(key, model);
      return model;
    } catch (err) {
      if (cached) return { ...cached, source: 'cache', stale: true, fetchError: err.message };
      throw err;
    }
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateShift(base, hours) {
    const d = new Date(base.getTime() + hours * 3600000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
  }

  function demoModel(kind = 'live') {
    const now = new Date();
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    const start = -6;
    const count = 8 * 24;
    const hours = [];
    for (let n = start; n < count + start; n++) {
      const time = dateShift(base, n);
      const H = U.parseLocal(time).h;
      const day = Math.floor((H + n - start) / 24);
      const daylight = H >= 7 && H < 18;
      const arc = daylight ? Math.sin(((H - 7) / 11) * Math.PI) : 0;
      let temp = 14 + arc * 8 + Math.sin(day * 1.7) * 2;
      let humidity = Math.round(82 - arc * 35);
      let precipProb = 8 + Math.round(Math.max(0, Math.sin(n * 0.31)) * 12);
      let precip = 0;
      let cloud = 25 + Math.round(Math.max(0, Math.sin(n * 0.23)) * 30);
      let wind = 11 + Math.round(Math.max(0, Math.sin(n * 0.19)) * 9);
      let code = cloud > 50 ? 2 : 1;
      if (kind === 'rainy') {
        const pulse = (n >= 2 && n <= 14) || (n >= 28 && n <= 35);
        if (pulse) { precipProb = 75 + (n % 4) * 6; precip = 0.8 + (n % 3) * 1.2; cloud = 96; code = n % 7 === 0 ? 95 : 63; wind += 18; }
        else { precipProb = 40; cloud = 78; code = 3; }
        temp -= 3;
      }
      if (kind === 'heatwave') {
        temp = 27 + arc * 14 + Math.sin(day) * 1.5;
        humidity = Math.round(68 - arc * 20);
        precipProb = 2; precip = 0; cloud = 8; code = 0; wind = 7 + Math.round(arc * 5);
      }
      const uv = daylight ? Math.max(0, arc * (kind === 'heatwave' ? 10.5 : 6.5)) : 0;
      const feels = temp + (kind === 'heatwave' ? arc * 4 : humidity > 75 ? -1 : 0) - (wind > 25 ? 2 : 0);
      hours.push({
        time, date: time.slice(0, 10), temp: U.round(temp, 1), feels: U.round(feels, 1), humidity,
        dew: U.round(temp - (100 - humidity) / 5, 1), precipProb, precip: U.round(precip, 1), code,
        cloud, visibility: kind === 'rainy' && precip ? 5500 : 24000, wind, gust: Math.round(wind * 1.55),
        uv: U.round(uv, 1), isDay: daylight, radiation: Math.round(arc * (kind === 'heatwave' ? 950 : 690)),
        aqi: kind === 'heatwave' ? 72 : 28, pm25: kind === 'heatwave' ? 21 : 6,
      });
    }
    const currentDate = dateShift(base, 0).slice(0, 10);
    const dates = [...new Set(hours.map((h) => h.date))].filter((date) => date >= currentDate).slice(0, 8);
    const days = dates.map((date) => {
      const hs = hours.filter((h) => h.date === date);
      const wettest = hs.reduce((a, b) => b.precipProb > a.precipProb ? b : a);
      return {
        date, code: wettest.precipProb >= 70 ? wettest.code : hs[Math.min(14, hs.length - 1)].code,
        max: Math.max(...hs.map((h) => h.temp)), min: Math.min(...hs.map((h) => h.temp)),
        precip: U.round(hs.reduce((s, h) => s + h.precip, 0), 1), precipProb: Math.max(...hs.map((h) => h.precipProb)),
        sunrise: `${date}T07:00`, sunset: `${date}T18:00`, uvMax: Math.max(...hs.map((h) => h.uv)), windMax: Math.max(...hs.map((h) => h.wind)),
      };
    });
    const nowIndex = -start;
    return {
      version: 1, fetchedAt: Date.now(), source: 'demo', stale: false,
      location: { name: kind === 'rainy' ? 'Rainport' : kind === 'heatwave' ? 'Sun City' : 'Demo City', admin: 'Interactive Test Mode', country: 'ActiviCast', cc: '', lat: 51.5, lon: -0.12, timezone: 'Local/Demo' },
      timezone: 'Local/Demo', timezoneAbbr: 'LOCAL', utcOffset: 0, current: hours[nowIndex], nowIndex, hours, days,
    };
  }

  function clearWeatherCache() {
    U.store.keys('ac_weather_v1_').forEach((k) => U.store.remove(k));
  }

  AC.api = { searchPlaces, reversePlace, fetchWeather, demoModel, clearWeatherCache, CACHE_MS };
})();
