/* ActiviCast — static configuration: weather codes, icons, activities, default settings */
(function () {
  'use strict';
  const AC = (window.AC = window.AC || {});

  AC.WMO = {
    0: ['Clear sky', 'clear'],
    1: ['Mainly clear', 'clear'],
    2: ['Partly cloudy', 'partly'],
    3: ['Overcast', 'cloud'],
    45: ['Fog', 'fog'],
    48: ['Freezing fog', 'fog'],
    51: ['Light drizzle', 'drizzle'],
    53: ['Drizzle', 'drizzle'],
    55: ['Heavy drizzle', 'drizzle'],
    56: ['Light freezing drizzle', 'drizzle'],
    57: ['Freezing drizzle', 'drizzle'],
    61: ['Light rain', 'rain'],
    63: ['Rain', 'rain'],
    65: ['Heavy rain', 'rain'],
    66: ['Light freezing rain', 'rain'],
    67: ['Freezing rain', 'rain'],
    71: ['Light snow', 'snow'],
    73: ['Snow', 'snow'],
    75: ['Heavy snow', 'snow'],
    77: ['Snow grains', 'snow'],
    80: ['Light showers', 'rain'],
    81: ['Rain showers', 'rain'],
    82: ['Violent showers', 'rain'],
    85: ['Snow showers', 'snow'],
    86: ['Heavy snow showers', 'snow'],
    95: ['Thunderstorm', 'storm'],
    96: ['Thunderstorm with hail', 'storm'],
    99: ['Severe thunderstorm', 'storm'],
  };
  AC.wmo = (code) => AC.WMO[code] || ['Unknown', 'cloud'];
  AC.isStorm = (code) => code >= 95;
  AC.isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
  AC.isFreezingPrecip = (code) => [48, 56, 57, 66, 67].includes(code);
  AC.isWet = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

  const P = (d) => `<path d="${d}"/>`;
  const CLOUD_BASE = 'M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24';
  AC.ICONS = {
    search: '<circle cx="11" cy="11" r="8"/>' + P('m21 21-4.3-4.3'),
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>' + P('M12 2v3M12 19v3M2 12h3M19 12h3'),
    refresh: P('M21 12a9 9 0 1 1-2.64-6.36L21 8') + P('M21 3v5h-5'),
    sliders: P('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'),
    close: P('M18 6 6 18M6 6l12 12'),
    star: P('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'),
    info: '<circle cx="12" cy="12" r="10"/>' + P('M12 16v-4M12 8h.01'),
    clock: '<circle cx="12" cy="12" r="10"/>' + P('M12 6v6l4 2'),
    droplet: P('M12 2.7s-6 6.3-6 11.3a6 6 0 0 0 12 0c0-5-6-11.3-6-11.3z'),
    wind: P('M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2') + P('M9.6 4.6A2 2 0 1 1 11 8H2') + P('M12.6 19.4A2 2 0 1 0 14 16H2'),
    gust: P('M3 8h9a3 3 0 1 0-3-3') + P('M3 12h15a3 3 0 1 1-3 3') + P('M3 16h6'),
    thermo: P('M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z'),
    eye: P('M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z') + '<circle cx="12" cy="12" r="3"/>',
    leaf: P('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z') + P('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
    sunrise: P('M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0'),
    sunset: P('M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0'),
    umbrella: P('M22 12a10.06 10.06 1 0 0-20 0Z') + P('M12 12v8a2 2 0 0 0 4 0') + P('M12 2v1'),
    alert: P('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3') + P('M12 9v4M12 17h.01'),
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/>' + P('M16 2v4M8 2v4M3 10h18'),
    pin: P('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z') + '<circle cx="12" cy="10" r="3"/>',
    check: P('M20 6 9 17l-5-5'),
    spark: P('M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z'),
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    wifiOff: P('M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20'),
    flask: P('M10 2v7.31M14 9.3V1.99M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.52 16h12.96'),
    trash: P('M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
    arrowUp: P('m5 12 7-7 7 7M12 19V5'),
    gauge: P('m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0'),
    // weather
    clear: '<circle cx="12" cy="12" r="4"/>' + P('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'),
    moon: P('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'),
    partly: P('M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128') + P('M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z'),
    partlyNight: P('M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6z') + P('M10.1 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6 6 6 0 0 1-3 5.197'),
    cloud: P('M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z'),
    fog: P(CLOUD_BASE) + P('M16 17H7M17 21H9'),
    drizzle: P(CLOUD_BASE) + P('M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1'),
    rain: P(CLOUD_BASE) + P('M16 14v6M8 14v6M12 16v6'),
    snow: P(CLOUD_BASE) + P('M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01'),
    storm: P('M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973') + P('m13 12-3 5h4l-3 5'),
    // activities
    run: P('M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z') + P('M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z') + P('M16 17h4M4 13h4'),
    cycle: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/>' + P('M12 17.5V14l-3-3 4-3 2 3h2'),
    dog: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>' + P('M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'),
    carwash: P('M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2') + '<circle cx="7" cy="17" r="2"/>' + P('M9 17h6') + '<circle cx="17" cy="17" r="2"/>' + P('M7 3.5v1.5M11 2.5v1.5M15 3.5v1.5'),
    stargaze: P('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9') + P('M19 2v4M21 4h-4'),
    laundry: P('M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'),
    picnic: P('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'),
    photo: P('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z') + '<circle cx="12" cy="13" r="3"/>',
  };
  AC.icon = (name, cls = '') =>
    `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AC.ICONS[name] || ''}</svg>`;
  AC.weatherIcon = (code, isDay) => {
    const kind = AC.wmo(code)[1];
    if (!isDay && kind === 'clear') return 'moon';
    if (!isDay && kind === 'partly') return 'partlyNight';
    return kind;
  };

  AC.ACTIVITIES = [
    {
      id: 'run', name: 'Running', icon: 'run', color: '#ff6b6b',
      blurb: 'Feels-like temp, humidity, wind, rain, UV & air quality',
      indoor: 'Treadmill session or a bodyweight HIIT workout',
      headlines: { A: 'Great time for an outdoor run', B: 'Good running conditions', C: 'Runnable, with some caveats', D: 'Tough conditions for a run', F: 'Skip the run — train indoors' },
    },
    {
      id: 'cycle', name: 'Cycling', icon: 'cycle', color: '#4dabf7',
      blurb: 'Wind & gusts weigh heavily, plus wet roads and visibility',
      indoor: 'Indoor trainer or a spin class',
      headlines: { A: 'Perfect riding weather', B: 'Good day for a ride', C: 'Rideable, but expect some resistance', D: 'Rough riding conditions', F: 'Keep the bike in the garage' },
    },
    {
      id: 'dog', name: 'Dog Walking', icon: 'dog', color: '#f59f00',
      blurb: 'Estimated pavement temperature for paws, heat stress & thunder',
      indoor: 'Indoor sniffing games or a puzzle feeder',
      headlines: { A: 'Lovely time for a walk', B: 'Good walk weather', C: 'OK for a shorter walk', D: 'Keep it to a quick potty break', F: 'Not safe for a walk right now' },
    },
    {
      id: 'carwash', name: 'Car Wash', icon: 'carwash', color: '#20c997',
      blurb: 'Looks 24 hours ahead for rain, freezing and harsh sun',
      indoor: 'Book a covered / indoor car wash, or wait for a dry spell',
      headlines: { A: 'Wash away — it will stay clean', B: 'Good time to wash the car', C: 'Washable, but it may not last', D: 'Probably a waste of money', F: "Don't wash — it won't stay clean" },
    },
    {
      id: 'stargaze', name: 'Stargazing', icon: 'stargaze', color: '#9775fa',
      blurb: 'Cloud cover, moon brightness, haze and your sky darkness',
      indoor: 'Explore the sky with a planetarium app like Stellarium',
      headlines: { A: 'Superb night for the stars', B: 'Good stargazing', C: 'Some stars visible', D: 'Poor viewing', F: 'Stars hidden tonight' },
    },
    {
      id: 'laundry', name: 'Line-Drying', icon: 'laundry', color: '#3bc9db',
      blurb: 'Drying power from sun, breeze & humidity, plus rain in the next 4h',
      indoor: 'Use a tumble dryer or an indoor airer near ventilation',
      headlines: { A: 'Excellent drying weather', B: 'Good drying weather', C: 'Slow drying — bring it in early', D: 'Barely drying', F: 'Dry indoors today' },
    },
    {
      id: 'picnic', name: 'Picnic / BBQ', icon: 'picnic', color: '#51cf66',
      blurb: 'Comfortable warmth, low wind and no rain for the next 3h',
      indoor: 'Indoor picnic or a grill-pan dinner',
      headlines: { A: 'Picture-perfect picnic weather', B: 'Nice for eating outdoors', C: 'Possible — pack a jacket', D: 'Not great for outdoor dining', F: 'Eat indoors today' },
    },
    {
      id: 'photo', name: 'Photography', icon: 'photo', color: '#f783ac',
      blurb: 'Golden-hour timing, dramatic cloud cover & visibility',
      indoor: 'Practise still-life or editing your back catalogue',
      headlines: { A: 'Magic light — grab the camera', B: 'Good light for photos', C: 'Decent light', D: 'Flat or harsh light', F: 'Poor conditions for photos' },
    },
  ];
  AC.ACT = Object.fromEntries(AC.ACTIVITIES.map((a) => [a.id, a]));

  AC.GRADES = [
    { g: 'A', min: 85, label: 'Excellent', color: '#12b886' },
    { g: 'B', min: 70, label: 'Good', color: '#82c91e' },
    { g: 'C', min: 55, label: 'Fair', color: '#fab005' },
    { g: 'D', min: 40, label: 'Poor', color: '#fd7e14' },
    { g: 'F', min: 0, label: 'Avoid', color: '#fa5252' },
  ];

  AC.DOG_PROFILES = {
    average: { label: 'Average dog', hot: 25, cold: -3 },
    short: { label: 'Short coat / small breed', hot: 26, cold: 4 },
    double: { label: 'Thick double coat (Husky, Malamute)', hot: 21, cold: -12 },
    brachy: { label: 'Flat-faced (Pug, Bulldog)', hot: 20, cold: 2 },
    senior: { label: 'Puppy or senior dog', hot: 23, cold: 4 },
  };
  AC.SKY_PROFILES = {
    city: { label: 'City (bright skyglow)', penalty: 25 },
    suburban: { label: 'Suburbs', penalty: 10 },
    rural: { label: 'Rural / dark site', penalty: 0 },
  };
  AC.RAIN_TOLERANCE = {
    low: { label: 'Low — I hate getting wet', threshold: 15 },
    medium: { label: 'Medium', threshold: 30 },
    high: { label: 'High — a little rain is fine', threshold: 50 },
  };

  AC.DEFAULT_SETTINGS = {
    units: { temp: 'C', wind: 'kmh', time: '24' },
    enabled: { run: true, cycle: true, dog: true, carwash: true, stargaze: true, laundry: true, picnic: true, photo: true },
    prefs: {
      run: { tMin: 7, tMax: 20, maxWind: 25 },
      cycle: { tMin: 12, tMax: 25, maxWind: 20 },
      dog: { profile: 'average' },
      carwash: { maxWind: 35 },
      stargaze: { sky: 'suburban' },
      laundry: { tMin: 14, tMax: 40, maxWind: 35 },
      picnic: { tMin: 18, tMax: 28, maxWind: 20 },
      photo: {},
    },
    rainTolerance: 'medium',
    scenario: 'live',
  };

  AC.POPULAR = [
    { name: 'Seremban', admin: 'Negeri Sembilan', country: 'Malaysia', cc: 'MY', lat: 2.7297, lon: 101.9381 },
    { name: 'Kuala Lumpur', country: 'Malaysia', cc: 'MY', lat: 3.1412, lon: 101.6865 },
    { name: 'New York', country: 'United States', cc: 'US', lat: 40.7143, lon: -74.006 },
    { name: 'Tokyo', country: 'Japan', cc: 'JP', lat: 35.6895, lon: 139.6917 },
    { name: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.8678, lon: 151.2073 },
    { name: 'Dubai', country: 'United Arab Emirates', cc: 'AE', lat: 25.0772, lon: 55.3093 },
  ];
})();
