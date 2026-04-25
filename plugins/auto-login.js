/**
 * Plugin: auto-login
 *
 * Automatically runs /login <password> (and optionally /register) when
 * the server asks for it. Works with AuthMe, NLogin, and most cracked servers.
 *
 * HOW TO USE:
 *   Edit the PASSWORD field below, then save.
 *   The plugin hot-reloads instantly — no restart needed.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PASSWORD = process.env.MC_PASSWORD || 'your_password_here';   // ← change this
const REGISTER_PASSWORD = PASSWORD;      // used if the server says /register first
const LOGIN_DELAY_MS = 1500;             // wait a bit after spawn before logging in
// ─────────────────────────────────────────────────────────────────────────────

let loginTimeout = null;
let listeners = {};

module.exports = {
  load(bot, log) {
    log('info', 'auto-login plugin loaded', 'auto-login');

    // Attempt login shortly after spawn (catches initial connect)
    loginTimeout = setTimeout(() => attemptLogin(bot, log), LOGIN_DELAY_MS);

    // Also react to chat messages prompting login/register
    listeners.chat = (username, message) => {
      const lower = message.toLowerCase();
      const isServer = username === '' || username === bot.username;
      if (!isServer) return;

      if (lower.includes('/login') || lower.includes('please log in') || lower.includes('please login')) {
        log('info', 'Server requested /login', 'auto-login');
        clearTimeout(loginTimeout);
        loginTimeout = setTimeout(() => bot.chat(`/login ${PASSWORD}`), 500);
      }

      if (lower.includes('/register') || lower.includes('please register')) {
        log('info', 'Server requested /register', 'auto-login');
        clearTimeout(loginTimeout);
        loginTimeout = setTimeout(() => {
          bot.chat(`/register ${REGISTER_PASSWORD} ${REGISTER_PASSWORD}`);
        }, 500);
      }

      if (lower.includes('successfully logged in') || lower.includes('you are now logged in')) {
        log('info', '✅ Logged in successfully!', 'auto-login');
      }
    };

    bot.on('chat', listeners.chat);
  },

  unload(bot) {
    clearTimeout(loginTimeout);
    if (listeners.chat) {
      bot.removeListener('chat', listeners.chat);
      listeners.chat = null;
    }
  }
};

function attemptLogin(bot, log) {
  if (!bot || !bot.entity) return;
  log('info', `Sending /login ${PASSWORD.replace(/./g, '*')}`, 'auto-login');
  bot.chat(`/login ${PASSWORD}`);
}
