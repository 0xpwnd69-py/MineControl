let interval = null;

module.exports = {
  load(bot, log) {
    interval = setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
      log('info', 'Anti-AFK jump!', 'anti-afk');
    }, 30000); // every 30 seconds
  },

  unload(bot) {
    clearInterval(interval);
    interval = null;
  }
};
