'use strict';
const assert = require('node:assert/strict');

global.window = global;
global.localStorage = {
  data: {},
  getItem(k) { return Object.hasOwn(this.data, k) ? this.data[k] : null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
};
require('../js/utils.js');
require('../js/config.js');
require('../js/engine.js');
require('../js/api.js');

const settings = AC.util.deepMerge(AC.DEFAULT_SETTINGS, {});
function score(kind) {
  const model = AC.api.demoModel(kind);
  const fmt = AC.util.makeFmt(settings, model.days[0].date);
  const ctx = AC.engine.buildCtx(model, settings, fmt);
  return { model, fmt, ctx, scores: AC.engine.scoreAll(model, ctx) };
}

const fair = score('live');
assert.equal(fair.model.hours.length, 192, 'demo produces 8 days of hourly data');
assert.equal(Object.keys(fair.scores).length, 8, 'all eight activities are scored');
for (const id of Object.keys(fair.scores)) {
  assert.equal(fair.scores[id].length, fair.model.hours.length, `${id} has a score for every hour`);
  for (const result of fair.scores[id]) {
    assert.ok(result.na || (result.score >= 0 && result.score <= 100), `${id} score stays inside 0–100`);
  }
}

const rainy = score('rainy');
const stormIndex = rainy.model.hours.findIndex((h, i) => i >= rainy.model.nowIndex && AC.isStorm(h.code));
assert.ok(stormIndex >= 0, 'rain scenario includes a thunderstorm');
for (const id of ['run', 'cycle', 'dog', 'carwash', 'laundry', 'picnic', 'photo']) {
  assert.ok(rainy.scores[id][stormIndex].score <= 5, `${id} is effectively blocked in lightning`);
}
const washNow = rainy.scores.carwash[rainy.model.nowIndex];
assert.ok(washNow.penalties.some((p) => p.key === 'rainahead'), 'car wash looks ahead for forecast rain');

const heat = score('heatwave');
const noonIndex = heat.model.hours.findIndex((h, i) => i >= heat.model.nowIndex && h.isDay && h.radiation > 800);
assert.ok(noonIndex >= 0, 'heatwave has intense midday sun');
assert.ok(AC.engine.pavementTemp(heat.model.hours[noonIndex]) > heat.model.hours[noonIndex].temp + 20, 'pavement estimate responds to solar radiation');
assert.ok(heat.scores.dog[noonIndex].penalties.some((p) => p.key === 'paws'), 'dog score flags hot pavement');

const windows = AC.engine.findWindows(fair.scores.run, fair.model.hours, {
  start: fair.model.nowIndex,
  end: Math.min(fair.model.nowIndex + 48, fair.model.hours.length),
  duration: 2,
  earliest: 6,
  latest: 22,
  max: 4,
});
assert.ok(windows.windows.length > 0, 'window finder returns ranked options');
for (let i = 0; i < windows.windows.length; i++) {
  for (let j = i + 1; j < windows.windows.length; j++) {
    const a = windows.windows[i], b = windows.windows[j];
    assert.ok(a.end <= b.start || a.start >= b.end, 'suggested windows do not overlap');
  }
}
assert.ok(windows.windows.every((w) => w.score >= 0 && w.score <= 100), 'window scores stay inside 0–100');

const m = AC.engine.moon(Date.UTC(2026, 10, 6));
assert.ok(m.illum >= 0 && m.illum <= 1 && m.age >= 0 && m.age < 29.54, 'moon phase is bounded');

const alerts = AC.engine.alerts(heat.model, heat.ctx);
assert.ok(alerts.some((a) => /heat|pavement|UV/i.test(`${a.title} ${a.text}`)), 'heatwave creates a safety alert');

console.log('ActiviCast engine tests: 8/8 groups passed');
