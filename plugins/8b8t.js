let checkInterval = null;
let lastCommand = 0;
const COOLDOWN_MS = 60000; // 1 minute cooldown between /8b8t attempts

module.exports = {
  load(bot, log) {
    log('info', 'auto-8b8t plugin loaded', 'auto-8b8t');

    checkInterval = setInterval(() => {
      if (!bot || !bot.entity) return;

      const pos = bot.entity.position;
      const dim = bot.game?.dimension;
      const now = Date.now();

      // Only act if we're in the end dimension
      if (dim !== 'the_end') return;

      // Check if we're near the 8b8t login island (End spawn is around 0,0)
      // Main server's end would be far from 0,0
      const distFromOrigin = Math.sqrt(pos.x ** 2 + pos.z ** 2);

      // Login server end island is usually within ~100 blocks of origin
      // Main server end would typically be much further
      if (distFromOrigin > 200) {
        log('info', `In end but far from origin (${Math.floor(distFromOrigin)} blocks) — probably main server's end, skipping`, 'auto-8b8t');
        return;
      }

      
      // Cooldown check
      if (now - lastCommand < COOLDOWN_MS) return;

      log('info', `In login end near origin — sending /8b8t`, 'auto-8b8t');
      bot.chat('/8b8t');
      lastCommand = now;

    }, 5000); // check every 5 seconds
  },

  unload() {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
