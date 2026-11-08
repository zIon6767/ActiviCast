# ActiviCast — Weather that tells you what to do

ActiviCast is a desktop-first, responsive weather decision-support dashboard. It turns live forecast data into explainable activity scores and practical time-window suggestions.

## Run locally

**No API key, build step, or package installation is required.**

1. Extract the project folder.
2. Open a terminal in the extracted `0c8b559d` folder (or the folder containing `index.html`).
3. Start a local web server:

   ```bash
   python -m http.server 8000
   ```

4. Open <http://localhost:8000> in Chrome or Edge.

You can also use the VS Code **Live Server** extension and open `index.html` with it. A local server is recommended because browser location permissions and some browser features are restricted on `file://` pages.

## Features

- City search with geocoding and keyboard-accessible suggestions.
- Optional browser geolocation; manual city search remains available if permission is denied.
- Live current conditions, hourly forecast, 8-day outlook, sunrise/sunset, and moon-phase estimate.
- Optional air-quality enrichment (US AQI and PM2.5) when the air-quality endpoint is available.
- Eight activity assessments: running, cycling, dog walking, car washing, stargazing, line-drying, picnic/BBQ, and photography.
- Explainable 0–100 scores with grades, positive factors, penalties, safety cut-offs, and practical alternatives.
- Best-window planner that ranks contiguous forecast-hour windows for a chosen activity and duration.
- Personal settings for units, rain tolerance, activity visibility, and comfort thresholds.
- Demo scenarios for fair weather, rain/storms, and heatwaves, so the interface can be demonstrated without relying on a particular live forecast.
- Ten-minute local forecast cache and stale-data fallback if a live refresh fails.
- Responsive layout, accessible labels/focus states, loading/error states, and offline status messaging.

## Data sources

- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
- [BigDataCloud reverse geocoding](https://www.bigdatacloud.com/) for naming a browser-provided location.

The project uses the public Open-Meteo endpoints and does not require an API key for this educational, non-commercial demonstration. Review the providers' current terms and attribution requirements before public/commercial deployment.

## Project structure

```text
0c8b559d/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── config.js     # weather codes, activities, defaults, icons
│   ├── utils.js      # formatting, dates, storage helpers
│   ├── api.js        # API requests, normalization, caching, demo data
│   ├── engine.js     # activity scoring and best-window logic
│   └── app.js        # UI state, events, and rendering
└── tests/
    ├── engine.test.js
    ├── snapshot.txt
    └── desktop.png
```

## Run the automated logic tests

Requires Node.js (no third-party packages):

```bash
node tests/engine.test.js
```

The test suite checks all eight activity score arrays, score bounds, storm safety cut-offs, rain-ahead handling for car washing, hot-pavement estimation for dog walking, best-window ranking/non-overlap, moon-phase bounds, and heat-related alerts.

## Important interpretation notes

- Activity scores are **heuristic guidance**, not certified safety ratings or medical advice. Weather can vary locally and forecasts can be wrong.
- Dog-paw surface temperature is an estimate derived from air temperature and solar radiation; it is not a direct pavement measurement. Breed, age, health, coat, shade, and surface material also matter.
- Stargazing quality is estimated from forecast cloud cover and a configurable skyglow profile; it is not a live light-pollution or telescope forecast.
- Air-quality data is supplementary. If the provider does not return it, the engine omits AQI-based adjustments rather than inventing a value.
- The forecast horizon and hourly granularity are limited by the upstream public API.
- Geolocation is optional. The app only requests it after the user selects the location control; the default city can be changed through search.

## Academic demonstration suggestion

For a reliable presentation, open **Settings → Test scenarios** and demonstrate:
1. **Fair day** — compare activity scores and run the best-window planner.
2. **Rain & storms** — show lightning cut-offs and the car-wash rain-ahead warning.
3. **Heatwave** — show UV/heat penalties and the estimated hot-pavement warning.

Then switch back to **Live weather** and search your chosen city. This separates the deterministic scoring demonstration from the variability of real-time weather.

## Technology

HTML5 · CSS3 · Vanilla JavaScript (ES6+) · Fetch API · Open-Meteo · localStorage · Node.js built-in test assertions
