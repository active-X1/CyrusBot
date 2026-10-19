// commands/weather.js
//   .weather <city>  -> current weather + today's outlook for that city
//   .weather         -> 3 Nigerian cities and 2 cities from other countries
const ui = require('../lib/ui');
const { getCityWeather, getOverview, coolMessage, WeatherError } = require('../lib/weather');

const TITLE = '🌦️ WEATHER';

function cityBlock(w) {
  return [
    `📍 ${w.name} ${w.flag}`,
    `${w.emoji} ${w.text}, ${w.temp}°C`,
  ];
}

module.exports = {
  name: 'weather',
  aliases: [],
  description: 'Weather for a city (or around the world)',
  usage: '<city>',
  emoji: '🌦️',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const city = args.join(' ').trim();

    try {
      // ---- one city -------------------------------------------------
      if (city) {
        const w = await getCityWeather(city);
        const lines = [
          `📍 ${w.place} ${w.flag}`,
          '',
          `${w.emoji} ${w.text}`,
          `🌡️ ${w.temp}°C (feels like ${w.feels}°C)`,
          `💧 Humidity: ${w.humidity}%`,
          `💨 Wind: ${w.wind} km/h`,
        ];
        if (w.high !== null && w.low !== null) lines.push(`📈 High ${w.high}°C   📉 Low ${w.low}°C`);
        if (w.rainChance !== null) lines.push(`🌧️ Rain chance: ${w.rainChance}%`);
        lines.push('', `💬 ${coolMessage(w.kind, w.temp)}`);
        return reply(ui.box(TITLE, lines));
      }

      // ---- no city: 3 from Nigeria + 2 from elsewhere ---------------
      const { nigeria, world } = await getOverview();
      const lines = [];
      if (nigeria.length) {
        lines.push('🇳🇬 NIGERIA', '');
        nigeria.forEach((w) => lines.push(...cityBlock(w), ''));
      }
      if (world.length) {
        lines.push('🌍 AROUND THE WORLD', '');
        world.forEach((w) => lines.push(...cityBlock(w), ''));
      }
      const lead = nigeria[0] || world[0];
      lines.push(`💬 ${coolMessage(lead.kind, lead.temp)}`, '', `🔎 For one city: ${ctx.config.prefix}weather <city>`);
      return reply(ui.box(TITLE, lines));
    } catch (err) {
      if (err instanceof WeatherError) return reply(ui.error(err.userMessage));
      ctx.logger.error({ err: err.message }, 'weather command failed');
      return reply(ui.error('Could not get the weather right now. Please try again shortly.'));
    }
  },
};
