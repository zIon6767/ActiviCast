/* ActiviCast — application controller and UI rendering */
(function () {
  'use strict';
  const AC = window.AC;
  const U = AC.util;
  const $ = (id) => document.getElementById(id);
  const esc = U.escapeHtml;

  const state = {
    settings: U.deepMerge(AC.DEFAULT_SETTINGS, U.store.get('ac_settings_v1', {})),
    model: null,
    scores: null,
    ctx: null,
    fmt: null,
    selectedSearch: -1,
    searchItems: [],
    openActivity: null,
    previousFocus: null,
    loading: false,
  };

  const staticIcons = {
    searchIcon: 'search', locateIcon: 'locate', settingsIcon: 'sliders', pinIcon: 'pin', refreshIcon: 'refresh',
    rainMetricIcon: 'umbrella', windMetricIcon: 'wind', humidityMetricIcon: 'droplet', uvMetricIcon: 'clear', airMetricIcon: 'leaf',
    sparkIcon: 'spark', clockBriefIcon: 'clock', alertBriefIcon: 'alert', targetIcon: 'target', slidersIcon2: 'sliders',
    sunriseIcon: 'sunrise', sunsetIcon: 'sunset', factorThermo: 'thermo', factorRain: 'rain', factorSafety: 'alert', factorPersonal: 'sliders',
    plannerEmptyIcon: 'target', welcomePin: 'pin',
  };

  function setStaticIcons() {
    Object.entries(staticIcons).forEach(([id, name]) => { if ($(id)) $(id).innerHTML = AC.icon(name); });
    document.querySelectorAll('.close-icon').forEach((el) => { el.innerHTML = AC.icon('close'); });
    document.querySelectorAll('.planner-target').forEach((el) => { el.innerHTML = AC.icon('target'); });
  }

  function enabledIds() {
    return AC.ACTIVITIES.filter((a) => state.settings.enabled[a.id]).map((a) => a.id);
  }

  function currentLocation() {
    return state.model && state.model.location;
  }

  function saveSettings() {
    U.store.set('ac_settings_v1', state.settings);
  }

  function updateComputed() {
    state.fmt = U.makeFmt(state.settings, state.model.current.date);
    state.ctx = AC.engine.buildCtx(state.model, state.settings, state.fmt);
    state.scores = AC.engine.scoreAll(state.model, state.ctx);
  }

  function showAppState(mode, message) {
    const box = $('appState');
    if (mode === 'hide') { box.hidden = true; return; }
    box.hidden = false;
    $('stateTitle').textContent = mode === 'error' ? 'We couldn’t reach the weather service' : 'Reading the sky…';
    $('stateText').textContent = message || (mode === 'error' ? 'Check your connection, try again, or explore the app with demo weather.' : 'Fetching live local weather and building your activity forecast.');
    $('stateActions').hidden = mode !== 'error';
    box.querySelector('.loader-logo').hidden = mode === 'error';
  }

  function toast(title, text, type = 'ok', duration = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${AC.icon(type === 'error' ? 'alert' : 'check')}</span><div><b>${esc(title)}</b><p>${esc(text)}</p></div><button aria-label="Dismiss">×</button>`;
    el.querySelector('button').onclick = () => el.remove();
    $('toastRegion').appendChild(el);
    setTimeout(() => el.isConnected && el.remove(), duration);
  }

  function freshnessText() {
    const mins = Math.max(0, Math.round((Date.now() - state.model.fetchedAt) / 60000));
    if (state.model.source === 'demo') return 'DEMO DATA';
    if (state.model.stale) return `CACHED · ${mins} MIN AGO`;
    if (state.model.source === 'cache') return `CACHED · ${mins || '<1'} MIN AGO`;
    return 'LIVE · UPDATED NOW';
  }

  async function loadPlace(place, opts = {}) {
    if (state.loading) return;
    state.loading = true;
    $('refreshBtn').classList.add('loading');
    if (!state.model) showAppState('loading');
    try {
      const scenario = state.settings.scenario;
      state.model = scenario !== 'live' ? AC.api.demoModel(scenario === 'fair' ? 'live' : scenario) : await AC.api.fetchWeather(place, opts);
      if (scenario === 'live') {
        state.model.location = { ...state.model.location, ...place };
        U.store.set('ac_last_place_v1', place);
      }
      updateComputed();
      renderAll();
      showAppState('hide');
      if (state.model.stale) {
        $('connectionBanner').hidden = false;
        $('connectionBanner').className = 'connection-banner';
        $('connectionBanner').textContent = `Live update failed — showing your last saved forecast. ${state.model.fetchError || ''}`;
      } else {
        $('connectionBanner').hidden = true;
      }
    } catch (err) {
      console.error(err);
      if (!state.model) showAppState('error', err.message || 'No forecast is available right now.');
      else toast('Refresh failed', 'Still showing the last forecast.', 'error');
    } finally {
      state.loading = false;
      $('refreshBtn').classList.remove('loading');
    }
  }

  function renderAll() {
    renderHero();
    renderAlerts();
    renderActivities();
    renderHourly();
    renderSunMoon();
    renderForecast();
    renderPlannerOptions();
    renderSettings();
    if (state.openActivity) renderDetail(state.openActivity);
  }

  function renderHero() {
    const { model, fmt } = state;
    const h = model.current;
    const day = model.days.find((d) => d.date === h.date) || model.days[0];
    const loc = model.location;
    const desc = AC.wmo(h.code)[0];
    $('locationName').textContent = loc.name || 'Selected location';
    $('countryFlag').textContent = U.flagEmoji(loc.cc);
    $('localDate').textContent = `${fmt.dateLong(h.date)} · ${model.timezoneAbbr || loc.timezone || 'local time'} · ${loc.country || loc.admin || ''}`.replace(/ · $/, '');
    $('freshnessText').textContent = freshnessText();
    $('tempNow').textContent = fmt.deg(h.temp);
    $('conditionNow').textContent = desc;
    $('feelsNow').textContent = `Feels like ${fmt.t(h.feels)}`;
    $('todayHigh').textContent = fmt.deg(day.max);
    $('todayLow').textContent = fmt.deg(day.min);
    $('currentWeatherIcon').innerHTML = AC.icon(AC.weatherIcon(h.code, h.isDay));
    $('rainNow').textContent = `${h.precipProb}%`;
    $('windNow').textContent = fmt.wv(h.wind);
    $('windUnitNow').textContent = fmt.windUnit;
    $('humidityNow').textContent = `${h.humidity}%`;
    $('uvNow').textContent = `${Math.round(h.uv)} · ${uvLabel(h.uv)}`;
    $('airNow').textContent = h.aqi == null ? 'N/A' : `${h.aqi} · ${aqiLabel(h.aqi)}`;

    const hero = $('weatherHero');
    hero.classList.remove('theme-rain', 'theme-storm', 'theme-hot', 'theme-night');
    if (!h.isDay) hero.classList.add('theme-night');
    if (AC.isWet(h.code)) hero.classList.add('theme-rain');
    if (AC.isStorm(h.code)) hero.classList.add('theme-storm');
    if (h.feels >= 32) hero.classList.add('theme-hot');

    const ids = enabledIds();
    const brief = AC.engine.summary(model, state.scores, ids, fmt);
    $('briefHeadline').textContent = brief.headline;
    $('nextChange').textContent = brief.change;
    const al = AC.engine.alerts(model, state.ctx);
    $('mainWatch').textContent = al[0] ? al[0].title : 'No major concerns found';
    if (brief.best) {
      const a = AC.ACT[brief.best.actId];
      $('briefText').textContent = brief.best.score >= 70
        ? `${a.name} leads the current conditions. ${brief.best.detail || 'Most key factors are in your favour.'}`
        : `Conditions are challenging, but ${a.name.toLowerCase()} is your best option right now.`;
      $('bestActivity').textContent = a.name;
      $('bestReason').textContent = brief.best.detail || brief.best.label;
      $('bestIcon').innerHTML = AC.icon(a.icon);
      $('bestIcon').style.color = a.color;
      const orb = $('bestScore');
      orb.style.setProperty('--score', brief.best.score);
      orb.style.setProperty('--score-color', brief.best.color);
      orb.querySelector('span').textContent = brief.best.score;
    } else {
      $('briefText').textContent = 'Enable at least one daytime activity in Settings to get a recommendation.';
      $('bestActivity').textContent = 'No activity enabled';
      $('bestReason').textContent = 'Open Settings to choose activities';
      $('bestIcon').innerHTML = AC.icon('sliders');
      $('bestScore').querySelector('span').textContent = '—';
    }
  }

  function uvLabel(v) {
    if (v < 3) return 'Low'; if (v < 6) return 'Mod'; if (v < 8) return 'High'; if (v < 11) return 'V.high'; return 'Extreme';
  }
  function aqiLabel(v) {
    if (v <= 50) return 'Good'; if (v <= 100) return 'Moderate'; if (v <= 150) return 'Sensitive'; if (v <= 200) return 'Unhealthy'; return 'Very poor';
  }

  function renderAlerts() {
    const list = AC.engine.alerts(state.model, state.ctx);
    $('alertsSection').hidden = !list.length;
    $('alertCount').textContent = list.length ? `${list.length} ${list.length === 1 ? 'notice' : 'notices'}` : '';
    $('alertStrip').innerHTML = list.slice(0, 6).map((a) => `<article class="alert-card ${a.level}"><span>${AC.icon(a.icon)}</span><div><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div></article>`).join('');
  }

  function renderActivities() {
    const i = state.model.nowIndex;
    const ids = enabledIds();
    $('activityGrid').innerHTML = ids.length ? ids.map((id) => {
      const a = AC.ACT[id];
      const r = state.scores[id][i];
      return `<button class="activity-card ${r.na ? 'na' : ''}" data-activity="${id}" style="--activity-color:${a.color};--score-color:${r.color};--score:${r.score || 0}">
        <div class="activity-top"><div class="activity-title"><span class="activity-symbol">${AC.icon(a.icon)}</span><div><h3>${esc(a.name)}</h3><small>${r.na ? 'Not scored now' : `${r.score}/100 activity index`}</small></div></div><span class="grade-badge"><b>${r.grade}</b><small>${esc(r.label)}</small></span></div>
        <h4>${esc(r.headline)}</h4><p class="activity-reason">${esc(r.detail || a.blurb)}</p>
        <div class="score-line"><span></span></div><div class="activity-foot"><span>${r.na ? 'Check evening hours' : nextBestLabel(id)}</span><span>Why this score →</span></div>
      </button>`;
    }).join('') : '<div class="search-empty">No activities enabled. Open Settings to choose some.</div>';
  }

  function nextBestLabel(id) {
    const now = state.model.nowIndex;
    const end = Math.min(now + 24, state.model.hours.length);
    const best = AC.engine.bestInRange(state.scores[id], now, end);
    if (!best) return 'No suitable hour today';
    return best.idx === now ? 'Best window: right now' : `Best: ${state.fmt.when(state.model.hours[best.idx].time)}`;
  }

  function renderHourly() {
    const start = state.model.nowIndex;
    const hours = state.model.hours.slice(start, start + 24);
    const vals = hours.map((h) => h.feels);
    const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);
    $('hourlyChart').innerHTML = hours.map((h, j) => {
      const y = Math.round(((h.feels - min) / span) * 40 + 50);
      return `<div class="hour-column ${j === 0 ? 'now' : ''}" style="--rain:${h.precipProb};--temp-y:${y}">
        <div class="hour-tooltip"><b>${esc(state.fmt.t(h.feels))} feels-like</b><br>${h.precipProb}% rain · ${esc(state.fmt.w(h.wind))}</div>
        <div class="hour-temp">${esc(state.fmt.deg(h.feels))}</div><div class="hour-rainbar"></div><div class="hour-icon">${AC.icon(AC.weatherIcon(h.code, h.isDay))}</div><div class="hour-label ${j === 0 ? 'now-label' : ''}">${j === 0 ? 'NOW' : esc(state.fmt.hourNum(U.parseLocal(h.time).h))}</div>
      </div>`;
    }).join('');
  }

  function renderSunMoon() {
    const day = state.model.days.find((d) => d.date === state.model.current.date) || state.model.days[0];
    if (!day || !day.sunrise || !day.sunset) return;
    $('sunriseTime').textContent = state.fmt.hour(day.sunrise);
    $('sunsetTime').textContent = state.fmt.hour(day.sunset);
    const sr = U.minutesOfDay(day.sunrise), ss = U.minutesOfDay(day.sunset), mins = ss - sr;
    $('daylightTime').textContent = `${Math.floor(mins / 60)} h ${mins % 60} m`;
    const nowM = U.minutesOfDay(state.model.current.time);
    const pos = U.clamp(((nowM - sr) / Math.max(1, ss - sr)) * 100, 0, 100);
    $('sunMarker').style.setProperty('--sun-pos', `${pos}%`);
    const tonight = `${day.date}T23:00`;
    const m = state.ctx.moonAt(tonight);
    $('moonEmoji').textContent = m.emoji;
    $('moonGlyph').textContent = m.emoji;
    $('moonName').textContent = m.name;
    $('moonIllum').textContent = `${Math.round(m.illum * 100)}% lit`;
  }

  function renderForecast() {
    const days = state.model.days.slice(0, 7);
    const ids = enabledIds();
    $('timezoneLabel').textContent = state.model.timezone || '';
    $('forecastGrid').innerHTML = days.map((d, di) => {
      let best = null;
      ids.forEach((id) => {
        const r = AC.engine.dayBest(state.scores[id], state.model.hours, d.date);
        if (r && (!best || r.score > best.score)) best = r;
      });
      const a = best && AC.ACT[best.actId];
      return `<article class="forecast-day ${di === 0 ? 'today' : ''}"><h3>${esc(state.fmt.dayLabel(d.date))}</h3><div class="forecast-date">${esc(state.fmt.dateShort(d.date))}</div><div class="forecast-weather">${AC.icon(AC.weatherIcon(d.code, 1))}</div><div class="forecast-temps"><span>${esc(state.fmt.deg(d.max))}</span><span>${esc(state.fmt.deg(d.min))}</span></div><div class="forecast-rain">${AC.icon('droplet')} ${d.precipProb}%</div><div class="day-best"><small>Best activity</small><b>${a ? esc(a.name) : '—'}</b>${best ? `<span style="--day-color:${best.color}">${best.score} · ${esc(state.fmt.hour(state.model.hours[best.idx].time))}</span>` : ''}</div></article>`;
    }).join('');
  }

  function renderPlannerOptions() {
    const select = $('planActivity');
    const currentValue = select.value;
    select.innerHTML = enabledIds().map((id) => `<option value="${id}">${esc(AC.ACT[id].name)}</option>`).join('');
    if (currentValue && state.settings.enabled[currentValue]) select.value = currentValue;
    const makeHours = (include24) => {
      const end = include24 ? 24 : 23;
      return Array.from({ length: end + 1 }, (_, h) => `<option value="${h}">${h === 24 ? (state.settings.units.time === '12' ? '12am (next day)' : '24:00') : esc(state.fmt.hourNum(h))}${state.settings.units.time === '24' && h < 24 ? ':00' : ''}</option>`).join('');
    };
    $('planEarliest').innerHTML = makeHours(false);
    $('planLatest').innerHTML = makeHours(true);
    $('planEarliest').value = '6'; $('planLatest').value = '22';
  }

  function rangeForPlan(day) {
    const m = state.model, now = m.nowIndex;
    if (day === '48') return { start: now, end: Math.min(now + 48, m.hours.length) };
    if (day === 'week') return { start: now, end: m.hours.length };
    const date = day === 'tomorrow' ? U.addDays(m.current.date, 1) : m.current.date;
    const idx = m.hours.reduce((a, h, i) => h.date === date ? a.concat(i) : a, []);
    if (!idx.length) return { start: now, end: now };
    return { start: Math.max(day === 'today' ? now : idx[0], idx[0]), end: idx[idx.length - 1] + 1 };
  }

  function runPlanner(e) {
    e.preventDefault();
    const id = $('planActivity').value;
    if (!id || !state.scores[id]) return;
    const duration = Number($('planDuration').value);
    const range = rangeForPlan($('planDay').value);
    const found = AC.engine.findWindows(state.scores[id], state.model.hours, {
      ...range, duration, earliest: Number($('planEarliest').value), latest: Number($('planLatest').value), max: 4,
    });
    $('plannerEmpty').hidden = true;
    $('plannerResults').hidden = false;
    renderPlannerResults(id, duration, found);
  }

  function endTime(w) {
    if (w.end < state.model.hours.length) return state.model.hours[w.end].time;
    const last = state.model.hours[w.end - 1].time;
    const p = U.parseLocal(last);
    return `${p.date}T${String((p.h + 1) % 24).padStart(2, '0')}:00`;
  }

  function windowLabel(w) {
    const a = state.model.hours[w.start].time, b = endTime(w);
    const same = a.slice(0, 10) === b.slice(0, 10);
    return `${same ? state.fmt.dayLabel(a.slice(0, 10)) + ', ' : state.fmt.when(a) + ' – '}${state.fmt.hour(a)}–${state.fmt.hour(b)}`;
  }

  function renderPlannerResults(id, duration, found) {
    const a = AC.ACT[id];
    if (!found.windows.length) {
      $('plannerResults').innerHTML = `<div class="no-window">${AC.icon('alert')}<h3>No matching window found</h3><p>Try a wider time range, shorter duration, or another day. There may also be daylight-only limits for this activity.</p></div>`;
      return;
    }
    const [best, ...alts] = found.windows;
    const s = AC.engine.summarizeWindow(best, state.model.hours, state.scores[id]);
    const reason = s.pros[0] || (s.concerns[0] ? `Best available despite ${s.concerns[0].text.toLowerCase()}` : 'Most conditions are favourable');
    $('plannerResults').innerHTML = `<div class="best-window-card" style="--window-color:${best.color}"><div class="window-grade"><b>${best.grade}</b><small>${esc(best.label)}</small></div><div class="window-copy"><small>YOUR BEST ${duration}-HOUR WINDOW</small><h3>${esc(windowLabel(best))}</h3><p>${esc(reason)}</p></div><div class="window-score"><b>${best.score}</b><small>ACTIVITY INDEX</small></div></div>
      <div class="window-metrics"><div class="window-metric"><small>Feels like</small><b>${esc(state.fmt.t(s.feelsMin))}–${esc(state.fmt.t(s.feelsMax))}</b></div><div class="window-metric"><small>Rain chance</small><b>${s.rainMax}% max</b></div><div class="window-metric"><small>Avg wind</small><b>${esc(state.fmt.w(s.windAvg))}</b></div><div class="window-metric"><small>Peak UV</small><b>${Math.round(s.uvMax)} · ${uvLabel(s.uvMax)}</b></div></div>
      ${s.concerns[0] ? `<div class="tip-card" style="margin-top:11px"><b>${AC.icon('info')} Keep in mind</b><p>${esc(s.concerns[0].text)}. ${esc(s.concerns[0].tip || '')}</p></div>` : ''}
      ${alts.length ? `<div class="planner-alts"><h4>Other good options</h4>${alts.map((w, j) => `<div class="alt-window"><span class="alt-rank">#${j + 2}</span><div><b>${esc(windowLabel(w))}</b><small>${duration} hour${duration > 1 ? 's' : ''} · ${esc(a.name)}</small></div><span>${esc(w.label)}</span><span class="alt-score" style="--alt-color:${w.color}">${w.score}/100</span></div>`).join('')}</div>` : ''}`;
  }

  function renderDetail(id) {
    const a = AC.ACT[id], r = state.scores[id][state.model.nowIndex];
    state.openActivity = id;
    $('detailIcon').innerHTML = AC.icon(a.icon); $('detailIcon').style.color = a.color;
    $('detailTitle').textContent = a.name; $('detailEyebrow').textContent = 'ACTIVITY SCORE BREAKDOWN';
    const future = AC.engine.bestInRange(state.scores[id], state.model.nowIndex, Math.min(state.model.nowIndex + 48, state.model.hours.length));
    const factors = [
      ...r.penalties.slice(0, 6).map((p) => ({ good: false, title: p.text, sub: p.tip || 'This reduces the activity score.', pts: `−${p.amount}` })),
      ...r.pros.slice(0, Math.max(0, 5 - r.penalties.length)).map((p) => ({ good: true, title: p, sub: 'This helps your score.', pts: '✓' })),
    ];
    const iconFor = (good) => good ? 'check' : 'alert';
    const tip = r.penalties.find((p) => p.tip) || null;
    const start = state.model.nowIndex;
    const mini = state.scores[id].slice(start, start + 12);
    $('detailContent').innerHTML = `<div class="detail-hero" style="--detail-color:${r.color};--detail-score:${r.score || 0}"><div class="detail-score"><b>${r.na ? '—' : r.score}</b><span>${esc(r.label)}</span></div><div class="detail-summary"><h3>${esc(r.headline)}</h3><p>${esc(r.detail || a.blurb)}</p>${future ? `<span class="best-later">${AC.icon('clock')} Best in 48h: <b>${esc(state.fmt.when(state.model.hours[future.idx].time))} · ${future.score}/100</b></span>` : ''}</div></div>
      <div class="detail-body"><div><h4>What built this score</h4><div class="factor-list">${factors.length ? factors.map((f) => `<div class="factor-row ${f.good ? 'good' : 'bad'}"><span class="factor-dot">${AC.icon(iconFor(f.good))}</span><div><b>${esc(f.title)}</b><small>${esc(f.sub)}</small></div><span class="factor-points">${esc(f.pts)}</span></div>`).join('') : '<div class="search-empty">No major factors available.</div>'}</div></div><div><h4>Practical advice</h4>${tip ? `<div class="tip-card"><b>${AC.icon('spark')} Smart tip</b><p>${esc(tip.tip)}</p></div>` : ''}<div class="tip-card"><b>${AC.icon('info')} How this score works</b><p>${esc(a.blurb)}. A perfect score starts at 100 and each unfavourable condition subtracts weighted points.</p></div><div class="tip-card"><b>${AC.icon('spark')} Indoor alternative</b><p>${esc(a.indoor)}.</p></div><h4 style="margin-top:15px">Next 12 hours</h4><div class="hour-scores">${mini.map((x, j) => `<div class="mini-hour" style="--mini-color:${x.color}"><b>${x.na ? '—' : x.score}</b><small>${j === 0 ? 'NOW' : esc(state.fmt.hourNum(U.parseLocal(state.model.hours[start + j].time).h))}</small></div>`).join('')}</div></div></div>`;
  }

  function openLayer(name) {
    state.previousFocus = document.activeElement;
    const layer = $(`${name}Layer`);
    layer.hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(() => layer.querySelector('button, select, [tabindex]')?.focus(), 20);
  }
  function closeLayer(name) {
    const layer = $(`${name}Layer`);
    layer.hidden = true;
    document.body.classList.remove('no-scroll');
    if (name === 'detail') state.openActivity = null;
    state.previousFocus?.focus?.();
  }

  function renderSettings() {
    document.querySelectorAll('.segmented').forEach((seg) => {
      const k = seg.dataset.setting;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === state.settings.units[k]));
    });
    $('rainTolerance').innerHTML = Object.entries(AC.RAIN_TOLERANCE).map(([id, v]) => `<label class="radio-option"><span>${esc(v.label)} <small style="color:var(--muted)">(${v.threshold}% threshold)</small></span><input type="radio" name="rainTolerance" value="${id}" ${state.settings.rainTolerance === id ? 'checked' : ''}></label>`).join('');
    $('activityToggles').innerHTML = AC.ACTIVITIES.map((a) => `<button class="toggle-row ${state.settings.enabled[a.id] ? 'on' : ''}" data-toggle-activity="${a.id}" type="button"><span><i class="activity-symbol" style="--activity-color:${a.color}">${AC.icon(a.icon)}</i>${esc(a.name)}</span><i class="switch" aria-hidden="true"></i></button>`).join('');
    const numeric = [
      ['run', 'Running'], ['cycle', 'Cycling'], ['laundry', 'Line-drying'], ['picnic', 'Picnic / BBQ'],
    ];
    $('thresholds').innerHTML = numeric.map(([id, label]) => {
      const p = state.settings.prefs[id], a = AC.ACT[id];
      return `<div class="threshold-card"><div class="threshold-head"><span class="threshold-title"><i class="activity-symbol" style="--activity-color:${a.color}">${AC.icon(a.icon)}</i>${label}</span></div><div class="threshold-fields"><div class="tiny-field"><label>Min comfortable °C</label><input type="number" min="-20" max="45" step="1" value="${p.tMin}" data-pref="${id}" data-key="tMin"></div><div class="tiny-field"><label>Max comfortable °C</label><input type="number" min="-10" max="55" step="1" value="${p.tMax}" data-pref="${id}" data-key="tMax"></div><div class="tiny-field"><label>Max wind km/h</label><input type="number" min="5" max="90" step="1" value="${p.maxWind}" data-pref="${id}" data-key="maxWind"></div></div></div>`;
    }).join('') + dogSkySettings();
    document.querySelectorAll('.scenario-btn').forEach((b) => b.classList.toggle('active', b.dataset.scenario === state.settings.scenario));
  }

  function dogSkySettings() {
    return `<div class="threshold-card"><div class="threshold-head"><span class="threshold-title"><i class="activity-symbol" style="--activity-color:${AC.ACT.dog.color}">${AC.icon('dog')}</i>Dog profile</span></div><div class="threshold-fields" style="grid-template-columns:1fr"><div class="tiny-field"><label>Heat and cold sensitivity</label><select data-pref="dog" data-key="profile">${Object.entries(AC.DOG_PROFILES).map(([id, x]) => `<option value="${id}" ${state.settings.prefs.dog.profile === id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div></div></div>
      <div class="threshold-card"><div class="threshold-head"><span class="threshold-title"><i class="activity-symbol" style="--activity-color:${AC.ACT.stargaze.color}">${AC.icon('stargaze')}</i>Stargazing site</span></div><div class="threshold-fields" style="grid-template-columns:1fr"><div class="tiny-field"><label>Local light pollution</label><select data-pref="stargaze" data-key="sky">${Object.entries(AC.SKY_PROFILES).map(([id, x]) => `<option value="${id}" ${state.settings.prefs.stargaze.sky === id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div></div></div>`;
  }

  async function citySearch(query) {
    const box = $('searchResults');
    if (query.trim().length < 2) { box.hidden = true; return; }
    $('searchSpinner').hidden = false;
    try {
      state.searchItems = await AC.api.searchPlaces(query);
      state.selectedSearch = -1;
      box.hidden = false;
      box.innerHTML = state.searchItems.length ? state.searchItems.map((p, i) => `<button class="search-result" role="option" data-search-index="${i}"><span class="flag">${U.flagEmoji(p.cc) || '◉'}</span><span><b>${esc(p.name)}</b><small>${esc([p.admin, p.country].filter(Boolean).join(', '))}</small></span><span class="result-arrow">→</span></button>`).join('') : '<div class="search-empty">No matching places. Try a nearby city or a broader name.</div>';
    } catch (e) {
      box.hidden = false;
      box.innerHTML = '<div class="search-empty">Search is unavailable right now. Check your connection.</div>';
    } finally { $('searchSpinner').hidden = true; }
  }
  const debouncedSearch = U.debounce(citySearch, 350);

  async function selectPlace(p) {
    $('citySearch').value = '';
    $('searchResults').hidden = true;
    if (state.settings.scenario !== 'live') { state.settings.scenario = 'live'; saveSettings(); }
    await loadPlace(p, { force: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function useLocation() {
    if (!navigator.geolocation) { toast('Location unavailable', 'Your browser does not support geolocation. Search for your city instead.', 'error'); return; }
    toast('Locating you', 'Waiting for your browser’s location permission…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      let place = { name: 'Current location', country: '', cc: '', lat, lon };
      try { place = await AC.api.reversePlace(lat, lon); } catch (e) { /* coordinates still work */ }
      $('welcomeCard').hidden = true; U.store.set('ac_welcome_seen', true);
      selectPlace(place);
    }, (err) => {
      const msg = err.code === 1 ? 'Permission was denied. Search for your city instead, or enable location in browser settings.' : 'We could not get your position. Search for your city instead.';
      toast('Location not available', msg, 'error', 6500);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  function bindEvents() {
    $('refreshBtn').addEventListener('click', () => {
      if (state.settings.scenario !== 'live') { state.model = AC.api.demoModel(state.settings.scenario === 'fair' ? 'live' : state.settings.scenario); updateComputed(); renderAll(); toast('Demo refreshed', 'Scenario data has been regenerated.'); }
      else loadPlace(currentLocation(), { force: true });
    });
    $('locateBtn').addEventListener('click', useLocation);
    $('welcomeLocate').addEventListener('click', useLocation);
    $('welcomeClose').addEventListener('click', () => { $('welcomeCard').hidden = true; U.store.set('ac_welcome_seen', true); });
    $('settingsBtn').addEventListener('click', () => openLayer('settings'));
    $('customizeBtn').addEventListener('click', () => openLayer('settings'));
    $('doneSettings').addEventListener('click', () => closeLayer('settings'));
    $('navPlanner').addEventListener('click', () => openLayer('planner'));
    $('findWindowHero').addEventListener('click', () => openLayer('planner'));
    $('plannerForm').addEventListener('submit', runPlanner);
    $('stargazingShortcut').addEventListener('click', () => { renderDetail('stargaze'); openLayer('detail'); });
    $('activityGrid').addEventListener('click', (e) => { const card = e.target.closest('[data-activity]'); if (card) { renderDetail(card.dataset.activity); openLayer('detail'); } });
    document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => closeLayer(el.dataset.close)));
    document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => $(b.dataset.scroll).scrollIntoView({ behavior: 'smooth' })));

    $('citySearch').addEventListener('input', (e) => debouncedSearch(e.target.value));
    $('citySearch').addEventListener('keydown', (e) => {
      const items = [...$('searchResults').querySelectorAll('.search-result')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); state.selectedSearch += e.key === 'ArrowDown' ? 1 : -1;
        state.selectedSearch = (state.selectedSearch + items.length) % Math.max(1, items.length);
        items.forEach((x, i) => x.classList.toggle('active', i === state.selectedSearch)); items[state.selectedSearch]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && state.selectedSearch >= 0) { e.preventDefault(); selectPlace(state.searchItems[state.selectedSearch]); }
      else if (e.key === 'Escape') $('searchResults').hidden = true;
    });
    $('searchForm').addEventListener('submit', (e) => { e.preventDefault(); if (state.searchItems[0]) selectPlace(state.searchItems[Math.max(0, state.selectedSearch)]); });
    $('searchResults').addEventListener('click', (e) => { const b = e.target.closest('[data-search-index]'); if (b) selectPlace(state.searchItems[Number(b.dataset.searchIndex)]); });
    document.addEventListener('click', (e) => { if (!$('searchWrap').contains(e.target)) $('searchResults').hidden = true; });

    document.querySelectorAll('.segmented').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !state.model) return;
      state.settings.units[seg.dataset.setting] = b.dataset.value; saveSettings(); updateComputed(); renderAll();
    }));
    $('rainTolerance').addEventListener('change', (e) => { state.settings.rainTolerance = e.target.value; saveSettings(); updateComputed(); renderAll(); });
    $('activityToggles').addEventListener('click', (e) => { const b = e.target.closest('[data-toggle-activity]'); if (!b) return; const id = b.dataset.toggleActivity; state.settings.enabled[id] = !state.settings.enabled[id]; saveSettings(); updateComputed(); renderAll(); });
    $('thresholds').addEventListener('change', (e) => { const el = e.target; if (!el.dataset.pref) return; state.settings.prefs[el.dataset.pref][el.dataset.key] = el.type === 'number' ? Number(el.value) : el.value; saveSettings(); updateComputed(); renderAll(); });
    document.querySelector('.demo-buttons').addEventListener('click', async (e) => { const b = e.target.closest('[data-scenario]'); if (!b) return; state.settings.scenario = b.dataset.scenario; saveSettings(); if (b.dataset.scenario === 'live') await loadPlace(U.store.get('ac_last_place_v1', AC.POPULAR[0]), { force: false }); else { state.model = AC.api.demoModel(b.dataset.scenario === 'fair' ? 'live' : b.dataset.scenario); updateComputed(); renderAll(); } toast('Scenario changed', b.textContent.trim()); });
    $('resetSettings').addEventListener('click', () => { state.settings = U.deepMerge(AC.DEFAULT_SETTINGS, {}); saveSettings(); updateComputed(); renderAll(); toast('Settings reset', 'Default preferences have been restored.'); });
    $('stateRetry').addEventListener('click', () => loadPlace(U.store.get('ac_last_place_v1', AC.POPULAR[0]), { force: true }));
    $('stateDemo').addEventListener('click', () => { state.settings.scenario = 'fair'; state.model = AC.api.demoModel('live'); saveSettings(); updateComputed(); renderAll(); showAppState('hide'); });
    window.addEventListener('online', () => { $('connectionBanner').hidden = false; $('connectionBanner').className = 'connection-banner good'; $('connectionBanner').textContent = 'You’re back online — refresh to update the forecast.'; });
    window.addEventListener('offline', () => { $('connectionBanner').hidden = false; $('connectionBanner').className = 'connection-banner'; $('connectionBanner').textContent = 'You’re offline — saved weather remains available.'; });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('citySearch').focus(); }
      if (e.key === 'Escape') { ['planner', 'detail', 'settings'].forEach((n) => { if (!$(`${n}Layer`).hidden) closeLayer(n); }); }
    });
  }

  async function init() {
    setStaticIcons();
    bindEvents();
    $('activityGrid').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join('');
    const last = U.store.get('ac_last_place_v1', null);
    const place = last || AC.POPULAR[0];
    if (!U.store.get('ac_welcome_seen', false)) setTimeout(() => { if (state.model) $('welcomeCard').hidden = false; }, 1800);
    await loadPlace(place);
  }

  init();
})();
