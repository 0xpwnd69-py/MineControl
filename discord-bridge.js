
const { Client, GatewayIntentBits, WebhookClient } = require('discord.js');

// ─── Config ───────────────────────────────────────────────────────────────────
const DISCORD_TOKEN      = 'BOT_TOKEN';
const DISCORD_CHANNEL_ID = 'CHANNEL_ID';
const DISCORD_WEBHOOK_URL = ''; // optional but recommended for nicer look

// Known 8b8t ranks — mineflayer gives these as the "username"
// when a ranked player talks, the real name is inside the message
const RANKS = ['Ultra', 'Pro+', 'Basic', 'SE', 'Mini', 'Pro', 'VIP', 'MVP', 'Elite', 'Legend', 'God', 'Admin', 'Owner', 'Builder', 'Helper', 'Mod', 'Dev', 'Youtuber', 'Streamer', 'Sponsor', 'Booster', 'Supporter', 'Contributor', 'Member', 'Donor', 'Friend','MOD✔'];

// ─── State ────────────────────────────────────────────────────────────────────
let discordClient = null;
let discordChannel = null;
let webhook        = null;
let _bot           = null;
let _log           = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Wrap URLs so Discord doesn't embed them
function suppressEmbeds(text) {
  return text.replace(/https?:\/\/[^\s]+/g, url => `<${url}>`);
}

// Wrap any text in a clean code block
function box(text) {
  return `\`\`\`${text}\`\`\``;
}

// ─── Parse 8b8t chat ─────────────────────────────────────────────────────────

//
function parseChat(username, message) {
  const serverNames = ['8b8t', 'Server', 'SERVER', ''];
  if (serverNames.includes(username)) {
    return { type: 'server', rank: null, player: '8b8t', text: message };
  }

  if (RANKS.includes(username)) {
    const match = message.match(/^<([^>]+)>\s*(.*)/s);
    if (match) {
      return { type: 'player', rank: username, player: match[1], text: match[2] };
    }
    return { type: 'player', rank: username, player: '???', text: message };
  }

  return { type: 'player', rank: null, player: username, text: message };
}

// ─── Format message ───────────────────────────────────────────────────────────
//
//  direction: 'chat' | 'from' (incoming DM) | 'to' (outgoing DM)
//
function buildMessage(username, message, direction = 'chat') {
  const text = suppressEmbeds(message);

  // ── Whisper: someone messaged the bot ──
  if (direction === 'from') {
    return {
      displayName: username,
      avatarURL: `https://mc-heads.net/avatar/${username}/64`,
      content: box(`📨 [DM from ${username}] ${text}`),
    };
  }

  // ── Whisper: bot messaged someone ──
  if (direction === 'to') {
    return {
      displayName: _bot?.username ?? 'Bot',
      avatarURL: `https://mc-heads.net/avatar/${_bot?.username ?? 'Steve'}/64`,
      content: box(`📤 [DM to ${username}] ${text}`),
    };
  }

  // ── Normal chat ──
  const parsed = parseChat(username, message);
  const cleanText = suppressEmbeds(parsed.text);

  if (parsed.type === 'server') {
    return {
      displayName: '8b8t',
      avatarURL: 'https://i.imgur.com/6TqHIHZ.png',
      content: box(`[Server] ${cleanText}`),
    };
  }

  if (parsed.rank) {
    return {
      displayName: parsed.player,
      avatarURL: `https://mc-heads.net/avatar/${parsed.player}/64`,
      content: box(`[${parsed.rank}] ${parsed.player}: ${cleanText}`),
    };
  }

  return {
    displayName: parsed.player,
    avatarURL: `https://mc-heads.net/avatar/${parsed.player}/64`,
    content: box(`${parsed.player}: ${cleanText}`),
  };
}

// ─── Send to Discord ──────────────────────────────────────────────────────────
function sendToDiscord(username, message, direction = 'chat') {
  if (!discordChannel) return;

  const { displayName, avatarURL, content } = buildMessage(username, message, direction);

  try {
    if (webhook) {
      webhook.send({
        content,
        username: displayName.slice(0, 80),
        avatarURL,
        allowedMentions: { parse: [] },
      });
    } else {
      discordChannel.send({ content, allowedMentions: { parse: [] } });
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
