// lib/weather.js
// Weather via Open-Meteo (free, no API key): https://open-meteo.com
//   getCityWeather('Abuja')      -> one city (geocoded by name)
//   getOverview()                -> 3 random Nigerian cities + 2 from other countries

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 12_000;

class WeatherError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.userMessage = userMessage;
  }
}

// WMO weather codes -> label, emoji, and a "kind" used to pick a cool message.
function describe(code, isDay = 1) {
  const day = Boolean(isDay);
  if (code === 0) return { text: 'Clear sky', emoji: day ? '☀️' : '🌙', kind: day ? 'sunny' : 'clearNight' };
  if (code === 1) return { text: 'Mostly clear', emoji: day ? '🌤️' : '🌙', kind: day ? 'sunny' : 'clearNight' };
  if (code === 2) return { text: 'Partly cloudy', emoji: '⛅', kind: 'cloudy' };
  if (code === 3) return { text: 'Overcast', emoji: '☁️', kind: 'cloudy' };
  if (code === 45 || code === 48) return { text: 'Foggy', emoji: '🌫️', kind: 'fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { text: 'Drizzle', emoji: '🌦️', kind: 'rain' };
  if ([61, 63, 66].includes(code)) return { text: 'Rain', emoji: '🌧️', kind: 'rain' };
  if ([65, 67].includes(code)) return { text: 'Heavy rain', emoji: '🌧️', kind: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: 'Snow', emoji: '❄️', kind: 'snow' };
  if ([80, 81, 82].includes(code)) return { text: 'Rain showers', emoji: '🌦️', kind: 'rain' };
  if ([95, 96, 99].includes(code)) return { text: 'Thunderstorm', emoji: '⛈️', kind: 'storm' };
  return { text: 'Unsettled', emoji: '🌡️', kind: 'cloudy' };
}

const MESSAGES = {
  sunny: [
    "It's going to be sunny today 😎 Shades on, sunscreen up, and go enjoy it!",
    "It's going to be a sunny one today ☀️ Perfect day to step out!",
  ],
  clearNight: [
    'Clear skies tonight 🌙✨ A calm, beautiful night ahead.',
  ],
  cloudy: [
    'Clouds are out today ☁️ No harsh sun, so it should feel nice and mild.',
    'A cloudy one today ⛅ Comfortable weather to get things done.',
  ],
  rain: [
    "Rain is around today 🌧️ Don't forget your umbrella ☔",
    'Wet weather ahead 🌦️ Carry an umbrella and watch your step!',
  ],
  storm: [
    'Thunderstorm alert ⛈️ Stay indoors if you can and keep your devices safe.',
  ],
  fog: [
    'Foggy out there 🌫️ Take it slow if you are driving.',
  ],
  snow: [
    "Snow today ❄️ Wrap up warm 🧣 and be careful on the road.",
  ],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A short, friendly line to go with the weather. */
function coolMessage(kind, temp) {
  let message = pick(MESSAGES[kind] || MESSAGES.cloudy);
  if (typeof temp === 'number' && temp >= 34) message += ' 🔥 It is really hot, so stay hydrated 💧';
  else if (typeof temp === 'number' && temp <= 5) message += ' 🥶 It is freezing, so dress warm.';
  return message;
}

const flag = (countryCode) =>
  /^[A-Za-z]{2}$/.test(countryCode || '')
    ? String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '🌍';

async function getJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new WeatherError('Could not reach the weather service. Please try again shortly.');
  }
  if (!response.ok) throw new WeatherError('The weather service had a problem. Please try again shortly.');
  return response.json();
}

async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '1',
    timezone: 'auto',
  });
  const data = await getJson(`${FORECAST_URL}?${params}`);
  const c = data.current;
  if (!c) throw new WeatherError('No weather data was returned for that place.');
  const d = data.daily || {};
  const info = describe(c.weather_code, c.is_day);
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    wind: Math.round(c.wind_speed_10m),
    high: d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : null,
    low: d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : null,
    rainChance: d.precipitation_probability_max ? d.precipitation_probability_max[0] : null,
    ...info,
  };
}

/** Weather for one city, found by name. Prefers a Nigerian match when there is one. */
async function getCityWeather(name) {
  const params = new URLSearchParams({ name, count: '10', language: 'en', format: 'json' });
  const geo = await getJson(`${GEO_URL}?${params}`);
  const places = geo.results || [];
  if (!places.length) throw new WeatherError(`Could not find a place called "${name}".\nCheck the spelling and try again.`);

  const place = places.find((p) => p.country_code === 'NG') || places[0];
  const weather = await fetchForecast(place.latitude, place.longitude);
  return {
    place: [place.name, place.admin1 && place.admin1 !== place.name ? place.admin1 : null, place.country]
      .filter(Boolean)
      .join(', '),
    flag: flag(place.country_code),
    ...weather,
  };
}

const NIGERIA = [
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { name: 'Abuja', lat: 9.0765, lon: 7.3986 },
  { name: 'Port Harcourt', lat: 4.8156, lon: 7.0498 },
  { name: 'Kano', lat: 12.0022, lon: 8.592 },
  { name: 'Ibadan', lat: 7.3775, lon: 3.947 },
  { name: 'Enugu', lat: 6.4584, lon: 7.5464 },
  { name: 'Kaduna', lat: 10.5105, lon: 7.4165 },
  { name: 'Benin City', lat: 6.335, lon: 5.6037 },
];

const WORLD = [
  { name: 'London', cc: 'GB', lat: 51.5072, lon: -0.1276 },
  { name: 'New York', cc: 'US', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', cc: 'JP', lat: 35.6762, lon: 139.6503 },
  { name: 'Dubai', cc: 'AE', lat: 25.2048, lon: 55.2708 },
  { name: 'Paris', cc: 'FR', lat: 48.8566, lon: 2.3522 },
  { name: 'Nairobi', cc: 'KE', lat: -1.2921, lon: 36.8219 },
  { name: 'Accra', cc: 'GH', lat: 5.6037, lon: -0.187 },
  { name: 'Cairo', cc: 'EG', lat: 30.0444, lon: 31.2357 },
  { name: 'Sydney', cc: 'AU', lat: -33.8688, lon: 151.2093 },
  { name: 'Toronto', cc: 'CA', lat: 43.6532, lon: -79.3832 },
  { name: 'Rio de Janeiro', cc: 'BR', lat: -22.9068, lon: -43.1729 },
  { name: 'Mumbai', cc: 'IN', lat: 19.076, lon: 72.8777 },
];

function sample(list, n) {
  const copy = [...list];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

/** 3 random Nigerian cities + 2 random cities from other countries. */
async function getOverview() {
  const nigeria = sample(NIGERIA, 3).map((c) => ({ ...c, cc: 'NG' }));
  const world = sample(WORLD, 2);
  const all = [...nigeria, ...world];

  const results = await Promise.allSettled(all.map((c) => fetchForecast(c.lat, c.lon)));
  const rows = all
    .map((c, i) => (results[i].status === 'fulfilled' ? { name: c.name, flag: flag(c.cc), ...results[i].value } : null));
  if (rows.every((r) => !r)) throw new WeatherError('Could not reach the weather service. Please try again shortly.');

  return {
    nigeria: rows.slice(0, 3).filter(Boolean),
    world: rows.slice(3).filter(Boolean),
  };
}

module.exports = { getCityWeather, getOverview, coolMessage, WeatherError, describe, flag };
