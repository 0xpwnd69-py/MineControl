const { Client, GatewayIntentBits, WebhookClient } = require('discord.js');

// ─── Config ───────────────────────────────────────────────────────────────────
const DISCORD_TOKEN      = 'YOUR_BOT_TOKEN';
const DISCORD_CHANNEL_ID = 'YOUR_CHANNEL_ID';
const DISCORD_WEBHOOK_URL = ''; // optional but recommended for nicer look

// Known 8b8t ranks — if the "username" from mineflayer matches one of these,
// the real username is inside the message: "Ultra: <STONE BRICKS> hello"
const RANKS = ['Ultra', 'Pro+', 'Basic', 'SE', 'Mini', 'Pro', 'VIP', 'MVP', 'Elite', 'Legend', 'God', 'Admin', 'Owner', 'Builder', 'Helper', 'Mod', 'Dev', 'Youtuber', 'Streamer', 'Sponsor', 'Booster', 'Supporter', 'Contributor', 'Member', 'Donor', 'Friend','MOD✔'];

// ─── State ────────────────────────────────────────────────────────────────────
let discordClient = null;
let discordChannel = null;
let webhook        = null;
let _bot           = null;
let _log           = null;

// ─── Parse 8b8t chat format ───────────────────────────────────────────────────
/**
 * Mineflayer gives us: username, message
 *
 * Case 1 — normal player (no rank):
 *   username = "HighwayCleaner"
 *   message  = "not"
 *   → { rank: null, player: "HighwayCleaner", text: "not" }
 *
 * Case 2 — ranked player:
 *   username = "Ultra"          ← mineflayer thinks this is the username
 *   message  = "<STONE BRICKS> destroy it man"
 *   → { rank: "Ultra", player: "STONE BRICKS", text: "destroy it man" }
 *
 * Case 3 — server message (username = "8b8t" or similar non-player name):
 *   → { rank: null, player: null, text: "..." }  (server = true)
 */
function parseChat(username, message) {
  // Server messages — 8b8t announces etc
  const serverNames = ['8b8t', 'Server', 'SERVER', ''];
  if (serverNames.includes(username)) {
    return { server: true, rank: null, player: null, text: message };
  }

  // Ranked player — username matches a known rank
  if (RANKS.includes(username)) {
    // message format: "<PLAYERNAME> actual message"
    const match = message.match(/^<([^>]+)>\s*(.*)/s);
    if (match) {
      return { server: false, rank: username, player: match[1], text: match[2] };
    }
    // fallback — couldn't parse player name
    return { server: false, rank: username, player: '???', text: message };
  }

  // Normal player — no rank
  return { server: false, rank: null, player: username, text: message };
}

// Suppress link embeds by wrapping URLs in < >
function suppressEmbeds(text) {
  return text.replace(/https?:\/\/[^\s]+/g, url => `<${url}>`);
}

// ─── Format for Discord ───────────────────────────────────────────────────────
function formatForDiscord(username, message) {
  const parsed = parseChat(username, message);
  const text = suppressEmbeds(parsed.text);

  if (parsed.server) {
    // Server message — monospace box so it stands out
    return { content: `\`[8b8t] ${text}\``, displayName: '8b8t Server', isServer: true };
  }

  if (parsed.rank) {
    // Ranked player
    const content = `**[${parsed.rank}]** ${text}`;
    return { content, displayName: parsed.player, isServer: false };
  }

  // Normal player
  return { content: text, displayName: parsed.player, isServer: false };
}

// ─── Send to Discord ──────────────────────────────────────────────────────────
function sendToDiscord(username, message) {
  if (!discordChannel) return;

  const { content, displayName, isServer } = formatForDiscord(username, message);

  try {
    if (webhook) {
      webhook.send({
        content,
        username: isServer ? '8b8t Server' : displayName,
        avatarURL: isServer
          ? 'https://i.imgur.com/6TqHIHZ.png' // generic server icon
          : `https://mc-heads.net/avatar/${displayName}/64`,
        allowedMentions: { parse: [] }, // never ping anyone from MC chat
      });
    } else {
      // Plain bot fallback
      if (isServer) {
        discordChannel.send({ content: `\`🖥️ [Server]\` ${content}`, allowedMentions: { parse: [] } });
      } else {
        const rankTag = formatForDiscord(username, message).content;
        discordChannel.send({
          content: `**${displayName}**: ${rankTag}`,
          allowedMentions: { parse: [] },
        });
      }
    }
  } catch (e) {
    _log?.('warn', `Discord send failed: ${e.message}`, 'discord');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initDiscord(log) {
  _log = log;

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once('ready', async () => {
    log('info', `Discord ready: ${discordClient.user.tag}`, 'discord');
    try {
      discordChannel = await discordClient.channels.fetch(DISCORD_CHANNEL_ID);
      if (DISCORD_WEBHOOK_URL) {
        webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
        log('info', 'Using webhook for Discord messages', 'discord');
      }
    } catch (e) {
      log('error', `Discord channel fetch failed: ${e.message}`, 'discord');
    }
  });

  // Discord → Minecraft
  discordClient.on('messageCreate', (msg) => {
    if (msg.author.bot) return;
    if (msg.channelId !== DISCORD_CHANNEL_ID) return;
    if (!_bot || !_bot.entity) return;

    const text = `[Discord] <${msg.author.username}> ${msg.content}`;
    _bot.chat(text.slice(0, 256));
    log('chat', text, 'discord');
  });

  discordClient.on('error', (e) => log('error', `Discord error: ${e.message}`, 'discord'));

  discordClient.login(DISCORD_TOKEN).catch(e => {
    log('error', `Discord login failed: ${e.message}`, 'discord');
  });
}

function setBot(bot) { _bot = bot; }

module.exports = { initDiscord, sendToDiscord, setBot };
