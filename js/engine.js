/* ActiviCast — rule-based activity scoring engine (pure functions, no DOM) */
(function () {
  'use strict';
  const AC = (window.AC = window.AC || {});
  const U = AC.util;

  const gradeOf = (score) => AC.GRADES.find((g) => score >= g.min) || AC.GRADES[AC.GRADES.length - 1];

  /* ---------- Astronomy ---------- */
  const SYNODIC = 29.530588853;
  const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const MOON_NAMES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  const MOON_EMOJI = ['●', '◔', '◑', '◕', '○', '◕', '◑', '◔'];
  function moon(utcMs) {
    const days = (utcMs - REF_NEW_MOON) / 86400000;
    const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
    const phase = age / SYNODIC;
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const idx = Math.floor(phase * 8 + 0.5) % 8;
    return { phase, age, illum, name: MOON_NAMES[idx], emoji: MOON_EMOJI[idx] };
  }

  // Sunlit asphalt runs well above air temp; ~0.032 °C per W/m² matches published asphalt-vs-air measurements.
  const pavementTemp = (h) => h.temp + (h.isDay ? Math.max(0, h.radiation || 0) * 0.032 : 0);

  /* ---------- Factor helpers ---------- */
  const R = () => ({ pen: [], pros: [], na: null });
  function pen(r, key, amount, text, tip) {
    const a = Math.round(Math.max(0, amount));
    if (a >= 1) r.pen.push({ key, amount: a, text, tip: tip || '' });
  }
  const pro = (r, text) => r.pros.push(text);

  function rainAhead(hours, from, n) {
    const slice = hours.slice(Math.max(0, from), Math.max(0, from) + n);
    return {
      maxProb: slice.reduce((m, x) => Math.max(m, x.precipProb), 0),
      sum: slice.reduce((s, x) => s + x.precip, 0),
      first: slice.find((x) => x.precipProb >= 50 || x.precip >= 0.3) || null,
      storm: slice.find((x) => AC.isStorm(x.code)) || null,
      snow: slice.some((x) => AC.isSnow(x.code)),
    };
  }

  function temperature(r, feels, min, max, perDeg, cap, c, tips) {
    if (feels < min) pen(r, 'cold', Math.min(cap, (min - feels) * perDeg), `${feels <= min - 8 ? 'Cold' : 'Chilly'} — feels like ${c.fmt.t(feels)}`, tips.cold);
    else if (feels > max) pen(r, 'heat', Math.min(cap, (feels - max) * perDeg), `${feels >= max + 8 ? 'Hot' : 'Warm'} — feels like ${c.fmt.t(feels)}`, tips.hot);
    else pro(r, `Comfortable feels-like temperature (${c.fmt.t(feels)})`);
  }

  function rainNow(r, h, c, cap, tip) {
    const th = c.rainThreshold;
    const probPen = h.precipProb > th ? ((h.precipProb - th) / (100 - th)) * cap : 0;
    const mmPen = h.precip >= 0.2 ? Math.min(cap, cap * 0.45 + h.precip * cap * 0.15) : 0;
    const amount = Math.max(probPen, mmPen);
    if (amount >= 1) {
      const kind = AC.isSnow(h.code) ? 'snow' : 'rain';
      const text = h.precip >= 0.2 ? `Wet — about ${U.round(h.precip, 1)} mm of ${kind} this hour` : `${h.precipProb}% chance of ${kind}`;
      pen(r, 'rain', amount, text, tip);
    } else if (h.precipProb <= 10 && h.precip < 0.1) {
      pro(r, 'Dry — little to no chance of rain');
    }
  }

  function wind(r, h, c, max, per, cap, tip, gustLimit) {
    if (h.wind > max) pen(r, 'wind', Math.min(cap, (h.wind - max) * per), `${h.wind >= max + 20 ? 'Strong' : 'Breezy'} wind — ${c.fmt.w(h.wind)}`, tip);
    else if (h.wind <= max * 0.6) pro(r, `Light wind (${c.fmt.w(h.wind)})`);
    if (gustLimit && h.gust > gustLimit) pen(r, 'gust', Math.min(cap * 0.7, (h.gust - gustLimit) * 0.8), `Gusts up to ${c.fmt.w(h.gust)}`, 'Gusts can knock you off balance — avoid exposed routes.');
  }

  function uv(r, h, from, per, cap, tip) {
    if (h.uv >= from) pen(r, 'uv', Math.min(cap, (h.uv - from + 1) * per), `${h.uv >= 8 ? 'Very high' : 'High'} UV index (${Math.round(h.uv)})`, tip || 'Wear SPF 30+, sunglasses and a hat.');
  }

  function aqi(r, h, mult) {
    if (h.aqi == null) return;
    if (h.aqi > 150) pen(r, 'aqi', 40 * mult, `Unhealthy air quality (AQI ${h.aqi})`, 'Avoid hard exertion outdoors today.');
    else if (h.aqi > 100) pen(r, 'aqi', 22 * mult, `Poor air for sensitive groups (AQI ${h.aqi})`, 'Keep effort easy if you have asthma or allergies.');
    else if (h.aqi > 50) pen(r, 'aqi', 6 * mult, `Moderate air quality (AQI ${h.aqi})`, 'Fine for most people.');
    else pro(r, `Clean air (AQI ${h.aqi})`);
  }

  function ice(r, h, amount) {
    const freezingWet = h.temp <= 1 && (h.precip > 0.1 || AC.isWet(h.code) || AC.isSnow(h.code));
    if (freezingWet || AC.isFreezingPrecip(h.code)) pen(r, 'ice', amount, 'Icy surfaces likely', 'Paths and bridges freeze first — watch your footing.');
    else if (AC.isSnow(h.code)) pen(r, 'snow', amount * 0.6, 'Snowfall', 'Slippery underfoot — dress warm and waterproof.');
  }

  function fog(r, h, amount) {
    if (h.visibility < 1000) {
      const v = h.visibility < 200 ? 'under 200 m' : `${U.round(h.visibility / 1000, 1)} km`;
      pen(r, 'fog', amount, `Fog — visibility ${v}`, 'Use lights and high-visibility clothing.');
    }
  }

  const dark = (r, h, amount, tip) => !h.isDay && pen(r, 'dark', amount, 'After dark', tip);

  const SEVEN_SECOND = "Do the 7-second test: if you can't hold the back of your hand on the ground for 7 seconds, it's too hot for paws. Walk on grass or go early/late.";

  /* ---------- Activity scorers ---------- */
  const SCORERS = {
    run(h, i, hours, c) {
      const p = c.prefs.run;
      const r = R();
      temperature(r, h.feels, p.tMin, p.tMax, 3.5, 50, c, {
        cold: 'Layer up with gloves and a hat, and extend your warm-up.',
        hot: 'Go early or late, slow your pace and carry water.',
      });
      if (h.dew >= 18) pen(r, 'humid', Math.min(25, (h.dew - 17) * 3.5), `Muggy air (dew point ${c.fmt.t(h.dew)})`, "Sweat won't evaporate well — slow down and hydrate.");
      else if (h.dew <= 12 && h.feels >= p.tMin) pro(r, 'Low humidity — sweat evaporates easily');
      wind(r, h, c, p.maxWind, 1.2, 20, 'Start into the wind so it is behind you on the way home.', 55);
      rainNow(r, h, c, 25, 'Light rain is runnable — wear a cap and skip cotton.');
      uv(r, h, 6, 4, 20);
      aqi(r, h, 1);
      ice(r, h, 30);
      fog(r, h, 8);
      dark(r, h, 8, 'Wear reflective or lit-up gear and pick well-lit routes.');
      return r;
    },

    cycle(h, i, hours, c) {
      const p = c.prefs.cycle;
      const r = R();
      temperature(r, h.feels, p.tMin, p.tMax, 3, 45, c, {
        cold: 'Wind chill is worse on a bike — wear full gloves and a windproof layer.',
        hot: 'Ride early, carry two bottles and plan a shaded route.',
      });
      wind(r, h, c, p.maxWind, 1.8, 40, 'Ride out into the headwind and enjoy a tailwind home.', 40);
      rainNow(r, h, c, 35, 'Wet roads lengthen braking distance — mudguards and lights help.');
      uv(r, h, 7, 3, 15);
      aqi(r, h, 0.8);
      ice(r, h, 45);
      fog(r, h, 15);
      dark(r, h, 14, 'Front and rear lights are a must.');
      return r;
    },

    dog(h, i, hours, c) {
      const prof = AC.DOG_PROFILES[c.prefs.dog.profile] || AC.DOG_PROFILES.average;
      const r = R();
      if (h.feels > prof.hot) pen(r, 'heat', Math.min(60, (h.feels - prof.hot) * 5), `Heat-stress risk — feels like ${c.fmt.t(h.feels)}`, 'Keep it short and shaded, bring water, and watch for heavy panting.');
      else if (h.feels < prof.cold) pen(r, 'cold', Math.min(45, (prof.cold - h.feels) * 3), `Cold for your dog — feels like ${c.fmt.t(h.feels)}`, 'A dog coat helps; wipe paws afterwards to remove ice and salt.');
      else pro(r, `Comfortable temperature for your dog (${c.fmt.t(h.feels)})`);

      const pave = pavementTemp(h);
      if (pave >= 52) pen(r, 'paws', 55, `Pavement ≈ ${c.fmt.t(pave)} — can burn paws within a minute`, SEVEN_SECOND);
      else if (pave >= 45) pen(r, 'paws', 32, `Hot pavement ≈ ${c.fmt.t(pave)} — risk to paw pads`, SEVEN_SECOND);
      else if (pave >= 40) pen(r, 'paws', 12, `Warm pavement ≈ ${c.fmt.t(pave)}`, 'Stick to grass and shaded paths.');
      else if (h.isDay && h.temp > 15) pro(r, `Pavement is paw-safe (≈ ${c.fmt.t(pave)})`);

      const ahead = rainAhead(hours, i + 1, 3);
      if (!AC.isStorm(h.code) && ahead.storm) pen(r, 'thunder', 25, `Thunderstorms from ${c.fmt.hour(ahead.storm.time)}`, 'Thunder can frighten dogs — go now and keep it short, or wait it out.');
      rainNow(r, h, c, 20, 'Drizzle is fine for most dogs — towel off afterwards.');
      wind(r, h, c, 45, 0.8, 15, 'Strong wind can spook some dogs — use a secure harness.', null);
      ice(r, h, 25);
      aqi(r, h, 0.6);
      dark(r, h, 4, 'A light-up collar keeps your dog visible.');
      return r;
    },

    carwash(h, i, hours, c) {
      const p = c.prefs.carwash;
      const r = R();
      const ahead = rainAhead(hours, i + 1, 24);
      if (h.precip >= 0.2 || h.precipProb >= 60 || AC.isWet(h.code)) pen(r, 'rainnow', 60, 'Raining (or about to) right now', 'Wait for a dry spell.');
      if (ahead.maxProb >= 70 || ahead.sum >= 2) {
        const when = ahead.first ? c.fmt.when(ahead.first.time) : 'within 24h';
        pen(r, 'rainahead', 55, `Rain expected ${when} (${ahead.maxProb}%) — don't waste your money!`, 'Wash after the rain passes — the roads will be dirty too.');
      } else if (ahead.maxProb >= 40) {
        pen(r, 'rainahead', 25, `Possible rain within 24h (${ahead.maxProb}%)`, 'A quick rinse is fine; save the wax for a drier spell.');
      } else {
        pro(r, `Dry for the next 24 hours (max ${ahead.maxProb}% rain chance)`);
      }
      if (ahead.snow) pen(r, 'snow', 30, 'Snow and road salt on the way', 'Wash after the snow to remove corrosive salt.');
      if (h.temp < 3) pen(r, 'freeze', 40, `Near freezing (${c.fmt.t(h.temp)}) — water can freeze on locks & seals`, 'Wait for a milder day, or dry the door seals thoroughly.');
      else if (h.temp >= 30 && h.uv >= 6) pen(r, 'spots', 15, 'Hot sun dries water into spots', 'Wash in the shade or early morning / evening.');
      else if (h.temp >= 10 && h.temp <= 27) pro(r, 'Mild temperature — no water spots or freezing');
      if (h.wind > p.maxWind) pen(r, 'wind', 12, `Windy (${c.fmt.w(h.wind)}) — dust sticks to wet paint`, 'Dry quickly with a microfibre towel.');
      if (!h.isDay) pen(r, 'dark', 25, 'After dark — hard to spot missed dirt', 'Daylight reveals streaks and missed spots.');
      return r;
    },

    stargaze(h, i, hours, c) {
      const r = R();
      if (h.isDay) {
        r.na = "Daylight — stars aren't visible until after sunset";
        return r;
      }
      const sky = AC.SKY_PROFILES[c.prefs.stargaze.sky] || AC.SKY_PROFILES.suburban;
      if (sky.penalty) pen(r, 'skyglow', sky.penalty, `${sky.label.split(' (')[0]} light pollution`, 'Drive to a darker site for the Milky Way.');
      else pro(r, 'Dark-sky location');
      if (h.cloud > 10) pen(r, 'cloud', Math.min(75, (h.cloud - 10) * 0.8), `${h.cloud}% cloud cover`, 'Check again later — gaps in the cloud can open up.');
      else pro(r, `Clear sky (${h.cloud}% cloud)`);
      const m = c.moonAt(h.time);
      if (m.illum >= 0.25) pen(r, 'moon', m.illum * 30, `Bright moon — ${Math.round(m.illum * 100)}% lit (${m.name})`, 'A great night to observe the Moon itself; faint galaxies will be washed out.');
      else pro(r, `Dark sky — moon only ${Math.round(m.illum * 100)}% lit`);
      if (h.humidity >= 90) pen(r, 'haze', 8, `Humid (${h.humidity}%) — haze and dew on lenses`, 'Bring a lens heater, or keep optics capped between views.');
      if (h.visibility < 10000) pen(r, 'vis', Math.min(20, (10000 - h.visibility) / 500), `Reduced visibility (${U.round(h.visibility / 1000, 1)} km)`, 'Haze dims faint stars.');
      if (h.precipProb > 30) pen(r, 'rain', Math.min(30, (h.precipProb - 30) * 0.6), `${h.precipProb}% chance of rain`, 'Keep your gear covered.');
      if (h.feels < 0) pen(r, 'cold', 8, `Freezing — feels like ${c.fmt.t(h.feels)}`, "Dress warmer than you think — you'll be standing still.");
      return r;
    },

    laundry(h, i, hours, c) {
      const p = c.prefs.laundry;
      const r = R();
      if (!h.isDay) pen(r, 'dark', 65, 'No sun overnight — clothes stay damp', 'Hang out after sunrise instead.');
      const ahead = rainAhead(hours, i, 4);
      if (ahead.maxProb > 15 || ahead.sum >= 0.2) {
        pen(r, 'rain', Math.min(65, Math.max((ahead.maxProb - 15) * 0.9, ahead.sum >= 0.2 ? 45 : 0)), `${ahead.maxProb}% chance of rain in the next 4 hours`, 'Hang under cover, or keep an eye on the sky.');
      } else {
        pro(r, 'No rain expected for the next 4 hours');
      }
      if (h.temp <= 0) pen(r, 'freeze', 30, 'Freezing — clothes may freeze stiff', 'Indoor drying will be much faster today.');
      else if (h.temp < p.tMin) pen(r, 'cool', Math.min(30, (p.tMin - h.temp) * 2.5), `Cool air (${c.fmt.t(h.temp)}) slows drying`, 'Thin items will dry; leave heavy towels for later.');
      else if (h.temp >= p.tMin + 8) pro(r, `Warm air (${c.fmt.t(h.temp)}) speeds drying`);
      if (h.humidity > 65) pen(r, 'humid', Math.min(30, h.humidity - 65), `Humid air (${h.humidity}%)`, 'Space items out so air can circulate.');
      else if (h.humidity < 50) pro(r, `Dry air (${h.humidity}% humidity)`);
      if (h.wind < 5) pen(r, 'still', 8, 'Very still air', 'A gentle breeze dries clothes much faster.');
      else if (h.wind > p.maxWind) pen(r, 'wind', Math.min(25, h.wind - p.maxWind), `Strong wind (${c.fmt.w(h.wind)})`, "Use extra pegs — or it may end up in the neighbour's garden!");
      else if (h.wind >= 10) pro(r, `Good drying breeze (${c.fmt.w(h.wind)})`);
      if (h.isDay && h.radiation < 120) pen(r, 'dim', 10, 'Weak sunshine', 'Drying will be slow under thick cloud.');
      else if (h.isDay && h.radiation >= 400) pro(r, 'Strong sunshine');
      return r;
    },

    picnic(h, i, hours, c) {
      const p = c.prefs.picnic;
      const r = R();
      temperature(r, h.feels, p.tMin, p.tMax, 3.5, 50, c, {
        cold: 'Bring blankets and a flask of something warm.',
        hot: 'Find shade and pack plenty of cold drinks.',
      });
      const ahead = rainAhead(hours, i, 3);
      const th = c.rainThreshold;
      if (ahead.maxProb > th || ahead.sum >= 0.3) {
        pen(r, 'rain', Math.min(50, Math.max(((ahead.maxProb - th) / (100 - th)) * 50, ahead.sum >= 0.3 ? 35 : 0)), `${ahead.maxProb}% chance of rain in the next 3 hours`, 'Pick a spot near shelter, or bring a gazebo.');
      } else {
        pro(r, 'Dry for the next 3 hours');
      }
      if (!AC.isStorm(h.code) && ahead.storm) pen(r, 'thunder', 30, `Thunderstorms from ${c.fmt.hour(ahead.storm.time)}`, 'Plan to pack up before the storm arrives.');
      wind(r, h, c, p.maxWind, 1.5, 30, 'Weigh down napkins and shelter the BBQ flame.', null);
      uv(r, h, 7, 4, 15, 'Bring shade, sunscreen and a hat.');
      aqi(r, h, 0.6);
      ice(r, h, 40);
      dark(r, h, 30, 'Bring lanterns, or plan an earlier start.');
      return r;
    },

    photo(h, i, hours, c) {
      const r = R();
      const day = c.dayMap[h.date];
      const mid = U.minutesOfDay(h.time) + 30;
      if (day && day.sunrise && day.sunset) {
        const sr = U.minutesOfDay(day.sunrise);
        const ss = U.minutesOfDay(day.sunset);
        const golden = (mid >= sr - 30 && mid <= sr + 75) || (mid >= ss - 75 && mid <= ss + 30);
        const near = (mid >= sr - 75 && mid <= sr + 140) || (mid >= ss - 140 && mid <= ss + 75);
        if (golden) pro(r, 'Golden hour — warm, soft, directional light');
        else if (near) pen(r, 'light', 15, 'Close to golden hour', 'Shoot a little nearer sunrise or sunset for warmer light.');
        else if (h.isDay && h.cloud >= 70) pen(r, 'light', 20, 'Midday, but soft overcast light', 'Great for portraits and macro — no harsh shadows.');
        else if (h.isDay) pen(r, 'light', 38, 'Harsh midday light', 'Look for open shade, or wait for golden hour.');
        else pen(r, 'light', 50, 'Dark — night photography only', 'Bring a tripod for long exposures.');
      } else if (!h.isDay) {
        pen(r, 'light', 50, 'Dark — night photography only', 'Bring a tripod for long exposures.');
      }
      if (h.cloud >= 20 && h.cloud <= 70) pro(r, `Textured sky — ${h.cloud}% cloud adds drama`);
      else if (h.cloud < 20 && h.isDay) pen(r, 'plain', 8, 'Cloudless sky — clean but plain', 'Use foreground interest to fill the frame.');
      else if (h.cloud > 90) pen(r, 'grey', 22, 'Flat grey sky', 'Keep the sky out of your compositions.');
      if (h.precipProb > 50 || h.precip >= 0.3) pen(r, 'rain', 25, `${h.precipProb}% chance of rain`, 'Protect your gear — though reflections after rain look great.');
      if (h.visibility < 3000) pen(r, 'haze', 10, 'Fog / haze — moody but low contrast', 'Try minimalist, atmospheric compositions.');
      return r;
    },
  };

  const STORM_TEXT = {
    dog: 'Thunderstorm — lightning risk, and frightening for dogs',
    carwash: 'Thunderstorm overhead',
    stargaze: 'Thunderstorm — sky obscured',
  };

  function finalize(actId, h, r) {
    if (r.na) {
      return { actId, time: h.time, na: true, score: null, grade: '–', label: 'N/A', color: '#94a3b8', headline: 'Not applicable now', detail: r.na, penalties: [], pros: [] };
    }
    const penalties = r.pen.slice().sort((a, b) => b.amount - a.amount);
    if (AC.isStorm(h.code)) {
      penalties.unshift({ key: 'storm', amount: 95, text: STORM_TEXT[actId] || 'Thunderstorm — lightning risk', tip: 'Stay indoors until 30 minutes after the last thunder.' });
    }
    const total = penalties.reduce((s, p) => s + p.amount, 0);
    const score = Math.round(U.clamp(100 - total, 0, 100));
    const g = gradeOf(score);
    const top = penalties[0];
    return {
      actId,
      time: h.time,
      na: false,
      score,
      grade: g.g,
      label: g.label,
      color: g.color,
      headline: AC.ACT[actId].headlines[g.g],
      detail: top && top.amount >= 8 ? top.text : r.pros[0] || (top ? top.text : ''),
      penalties,
      pros: r.pros,
    };
  }

  function scoreHour(actId, hours, i, ctx) {
    return finalize(actId, hours[i], SCORERS[actId](hours[i], i, hours, ctx));
  }

  function buildCtx(model, settings, fmt) {
    const tol = AC.RAIN_TOLERANCE[settings.rainTolerance] || AC.RAIN_TOLERANCE.medium;
    return {
      prefs: settings.prefs,
      rainThreshold: tol.threshold,
      fmt,
      dayMap: Object.fromEntries(model.days.map((d) => [d.date, d])),
      moonAt: (t) => moon(U.localToUtcMs(t, model.utcOffset || 0)),
    };
  }

  function scoreAll(model, ctx) {
    const out = {};
    for (const a of AC.ACTIVITIES) out[a.id] = model.hours.map((_, i) => scoreHour(a.id, model.hours, i, ctx));
    return out;
  }

  /* ---------- "Find my window" ---------- */
  function hourAllowed(H, earliest, latest) {
    if (earliest <= latest) return H >= earliest && H + 1 <= latest;
    return H >= earliest || H + 1 <= latest;
  }

  // Window value blends the mean with the worst hour so one bad hour can't hide inside a good average.
  function findWindows(results, hours, opts) {
    const { start, end, duration, earliest = 0, latest = 24, max = 4 } = opts;
    const cands = [];
    for (let i = start; i + duration <= end; i++) {
      let ok = true;
      let sum = 0;
      let min = 101;
      for (let k = 0; k < duration; k++) {
        const res = results[i + k];
        const H = U.parseLocal(hours[i + k].time).h;
        if (!res || res.na || !hourAllowed(H, earliest, latest)) {
          ok = false;
          break;
        }
        sum += res.score;
        min = Math.min(min, res.score);
      }
      if (!ok) continue;
      const mean = sum / duration;
      cands.push({ start: i, end: i + duration, mean, min, value: 0.7 * mean + 0.3 * min });
    }
    cands.sort((a, b) => b.value - a.value || a.start - b.start);
    const picked = [];
    for (const w of cands) {
      if (picked.length >= max) break;
      if (picked.every((p) => w.end <= p.start || w.start >= p.end)) picked.push(w);
    }
    return {
      candidates: cands.length,
      windows: picked.map((w) => {
        const score = Math.round(w.value);
        const g = gradeOf(score);
        return { ...w, score, grade: g.g, label: g.label, color: g.color };
      }),
    };
  }

  function summarizeWindow(w, hours, results) {
    const hs = hours.slice(w.start, w.end);
    const rs = results.slice(w.start, w.end);
    const worst = rs.reduce((a, b) => (b.score < a.score ? b : a));
    const best = rs.reduce((a, b) => (b.score > a.score ? b : a));
    return {
      feelsMin: Math.min(...hs.map((h) => h.feels)),
      feelsMax: Math.max(...hs.map((h) => h.feels)),
      rainMax: Math.max(...hs.map((h) => h.precipProb)),
      windAvg: U.avg(hs.map((h) => h.wind)),
      uvMax: Math.max(...hs.map((h) => h.uv)),
      concerns: worst.penalties.slice(0, 2),
      pros: best.pros.slice(0, 3),
    };
  }

  function bestInRange(results, from, to) {
    let best = null;
    for (let i = Math.max(0, from); i < Math.min(results.length, to); i++) {
      const r = results[i];
      if (!r.na && (!best || r.score > best.score)) best = { ...r, idx: i };
    }
    return best;
  }

  function dayBest(results, hours, date) {
    let best = null;
    hours.forEach((h, i) => {
      if (h.date !== date) return;
      const r = results[i];
      if (!r.na && (!best || r.score > best.score)) best = { ...r, idx: i };
    });
    return best;
  }

  /* ---------- Alerts & summary ---------- */
  function alerts(model, ctx) {
    const out = [];
    const now = model.nowIndex;
    const next = model.hours.slice(now, now + 12);
    if (!next.length) return out;
    const f = ctx.fmt;
    const argmax = (key) => next.reduce((a, b) => (b[key] > a[key] ? b : a));
    const argmin = (key) => next.reduce((a, b) => (b[key] < a[key] ? b : a));

    const storm = next.find((h) => AC.isStorm(h.code));
    if (storm) out.push({ level: 'danger', icon: 'storm', title: 'Thunderstorms expected', text: `Storms possible from ${f.when(storm.time)}. Avoid open fields, hilltops and water.` });

    const hot = argmax('feels');
    if (hot.feels >= 35) out.push({ level: 'danger', icon: 'thermo', title: 'Extreme heat', text: `Feels like ${f.t(hot.feels)} around ${f.hour(hot.time)}. Limit exertion and hydrate.` });
    else if (hot.feels >= 31) out.push({ level: 'warn', icon: 'thermo', title: 'High heat', text: `Feels like ${f.t(hot.feels)} around ${f.hour(hot.time)}. Exercise early or late.` });

    const cold = argmin('feels');
    if (cold.feels <= -10) out.push({ level: 'warn', icon: 'thermo', title: 'Severe cold', text: `Feels like ${f.t(cold.feels)} around ${f.hour(cold.time)}. Cover exposed skin.` });

    const uvPeak = argmax('uv');
    if (uvPeak.uv >= 8) out.push({ level: 'warn', icon: 'clear', title: 'Very high UV', text: `UV peaks at ${Math.round(uvPeak.uv)} around ${f.hour(uvPeak.time)}. Skin can burn in 15 minutes.` });

    const gust = argmax('gust');
    if (gust.gust >= 60) out.push({ level: 'warn', icon: 'gust', title: 'Damaging gusts', text: `Gusts up to ${f.w(gust.gust)} around ${f.hour(gust.time)}. Secure loose items.` });

    const icy = next.find((h) => (h.temp <= 0 && h.precip > 0) || AC.isFreezingPrecip(h.code));
    if (icy) out.push({ level: 'warn', icon: 'snow', title: 'Icy conditions', text: `Freezing precipitation possible from ${f.when(icy.time)}.` });

    const rainSum = next.reduce((s, h) => s + h.precip, 0);
    if (rainSum >= 10) out.push({ level: 'warn', icon: 'rain', title: 'Heavy rain', text: `About ${Math.round(rainSum)} mm expected over the next 12 hours.` });

    const pave = next.map((h) => ({ h, p: pavementTemp(h) })).filter((x) => x.p >= 50);
    if (pave.length) out.push({ level: 'warn', icon: 'dog', title: 'Hot pavement', text: `Pavement may reach ${f.t(Math.max(...pave.map((x) => x.p)))} — walk dogs before ${f.hour(pave[0].h.time)} or after sunset.` });

    const aq = next.filter((h) => h.aqi != null);
    if (aq.length) {
      const worst = aq.reduce((a, b) => (b.aqi > a.aqi ? b : a));
      if (worst.aqi > 150) out.push({ level: 'danger', icon: 'leaf', title: 'Unhealthy air', text: `AQI reaches ${worst.aqi} around ${f.hour(worst.time)}. Move workouts indoors.` });
      else if (worst.aqi > 100) out.push({ level: 'warn', icon: 'leaf', title: 'Poor air quality', text: `AQI reaches ${worst.aqi} — sensitive groups should take it easy.` });
    }

    const fogH = next.slice(0, 6).find((h) => h.visibility < 1000);
    if (fogH) out.push({ level: 'info', icon: 'fog', title: 'Fog', text: `Visibility drops below 1 km around ${f.hour(fogH.time)}.` });

    const rank = { danger: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  function nextChange(model, fmt) {
    const now = model.nowIndex;
    const cur = model.hours[now];
    const next = model.hours.slice(now + 1, now + 13);
    const curWet = cur.precipProb >= 50 || cur.precip >= 0.3;
    if (curWet) {
      const dry = next.find((h) => h.precipProb < 25 && h.precip < 0.1);
      return dry ? `Drying out from ${fmt.when(dry.time)}` : 'Wet spell continues for the next 12 hours';
    }
    const wet = next.find((h) => h.precipProb >= 55 || h.precip >= 0.5);
    if (wet) return `Rain likely from ${fmt.when(wet.time)} (${wet.precipProb}%)`;
    const temps = next.map((h) => h.temp);
    if (temps.length && Math.max(...temps) - cur.temp >= 5) return `Warming to ${fmt.t(Math.max(...temps))} later`;
    if (temps.length && cur.temp - Math.min(...temps) >= 6) return `Cooling to ${fmt.t(Math.min(...temps))} later`;
    return 'Settled conditions for the next 12 hours';
  }

  function summary(model, scores, enabledIds, fmt) {
    const i = model.nowIndex;
    const nowRes = enabledIds.map((id) => scores[id][i]).filter((r) => !r.na);
    const sorted = nowRes.slice().sort((a, b) => b.score - a.score);
    const best = sorted[0] || null;
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    let headline = 'Stay inside if you can';
    if (best) {
      if (best.score >= 85) headline = 'A great time to get outside';
      else if (best.score >= 70) headline = 'A good time to get outside';
      else if (best.score >= 55) headline = 'Mixed conditions — choose wisely';
      else if (best.score >= 40) headline = 'Not ideal outdoors right now';
    }
    return { best, worst, headline, change: nextChange(model, fmt) };
  }

  AC.engine = { gradeOf, moon, pavementTemp, scoreHour, scoreAll, buildCtx, findWindows, summarizeWindow, bestInRange, dayBest, alerts, summary, hourAllowed, SCORERS };
})();
