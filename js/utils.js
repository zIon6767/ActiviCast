/* ActiviCast — shared helpers (formatting, dates, storage) */
(function () {
  'use strict';
  const AC = (window.AC = window.AC || {});

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const round = (v, d = 0) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Open-Meteo returns location-local wall-clock strings ("2026-11-06T14:00"); never pass them through Date parsing.
  function parseLocal(str) {
    const [d, t = '00:00'] = str.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [h, min] = t.split(':').map(Number);
    return { y, m, d: day, h, min, date: d };
  }
  function weekday(dateStr) {
    const p = parseLocal(dateStr);
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  }
  function addDays(dateStr, n) {
    const p = parseLocal(dateStr);
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return dt.toISOString().slice(0, 10);
  }
  function minutesOfDay(str) {
    const p = parseLocal(str);
    return p.h * 60 + p.min;
  }
  function localToUtcMs(str, utcOffsetSec) {
    const p = parseLocal(str);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - utcOffsetSec * 1000;
  }

  const cToF = (c) => (c * 9) / 5 + 32;
  const kmhTo = (kmh, unit) => (unit === 'mph' ? kmh * 0.621371 : unit === 'ms' ? kmh / 3.6 : kmh);
  const WIND_LABEL = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };

  function makeFmt(settings, todayDate) {
    const units = (settings && settings.units) || { temp: 'C', wind: 'kmh', time: '24' };
    const tv = (c) => Math.round(units.temp === 'F' ? cToF(c) : c);
    const fmt = {
      units,
      tv,
      t: (c) => `${tv(c)}°${units.temp}`,
      deg: (c) => `${tv(c)}°`,
      wv: (kmh) => Math.round(kmhTo(kmh, units.wind)),
      w: (kmh) => `${Math.round(kmhTo(kmh, units.wind))} ${WIND_LABEL[units.wind]}`,
      windUnit: WIND_LABEL[units.wind],
      hour(str) {
        const p = parseLocal(str);
        if (units.time === '12') {
          const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
          return `${h12}${p.min ? ':' + String(p.min).padStart(2, '0') : ''}${p.h < 12 ? 'am' : 'pm'}`;
        }
        return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
      },
      hourNum(h) {
        if (units.time === '12') return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
        return String(h).padStart(2, '0');
      },
      dayLabel(dateStr) {
        if (todayDate && dateStr === todayDate) return 'Today';
        if (todayDate && dateStr === addDays(todayDate, 1)) return 'Tomorrow';
        return DAY_SHORT[weekday(dateStr)];
      },
      when(str) {
        const d = str.slice(0, 10);
        const label = fmt.dayLabel(d);
        return `${label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : label} ${fmt.hour(str)}`;
      },
      dateLong(dateStr) {
        const p = parseLocal(dateStr);
        return `${DAY_LONG[weekday(dateStr)]}, ${p.d} ${MONTHS[p.m - 1]}`;
      },
      dateShort(dateStr) {
        const p = parseLocal(dateStr);
        return `${p.d} ${MONTHS[p.m - 1]}`;
      },
    };
    return fmt;
  }

  function debounce(fn, ms) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* storage unavailable */
      }
    },
    keys(prefix) {
      try {
        return Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      } catch (e) {
        return [];
      }
    },
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function flagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    return String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
  }

  function deepMerge(base, extra) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
    const out = { ...base };
    if (extra && typeof extra === 'object') {
      for (const k of Object.keys(base)) out[k] = deepMerge(base[k], extra[k]);
    }
    return out;
  }

  AC.util = { clamp, round, avg, parseLocal, weekday, addDays, minutesOfDay, localToUtcMs, cToF, kmhTo, makeFmt, debounce, store, escapeHtml, flagEmoji, deepMerge, DAY_SHORT, DAY_LONG, MONTHS };
})();
