const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const path = require('path');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const chokidar = require('chokidar');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const { initDiscord, sendToDiscord, setBot } = require('./discord-bridge');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const VIEWER_PORT = parseInt(process.env.VIEWER_PORT || (parseInt(PORT) + 1));
const PLUGINS_DIR = path.join(__dirname, 'plugins');

// ─── State ───────────────────────────────────────────────────────────────────
let bot = null;
let botConfig = null;
let logs = [];
let loadedPlugins = {};
let pluginWatcher = null;
let viewerActive = false;
let viewerStarted = false;

// ─── Broadcast to all WS clients ─────────────────────────────────────────────
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function log(level, msg, source = 'system') {
  const entry = { level, msg, source, ts: Date.now() };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  broadcast('log', entry);
  console.log(`[${level.toUpperCase()}][${source}] ${msg}`);
}

// ─── Bot Status ───────────────────────────────────────────────────────────────
function getBotStatus() {
  if (!bot || !bot.entity) {
    return { online: false };
  }
  return {
    online: true,
    username: bot.username,
    health: bot.health,
    food: bot.food,
    position: bot.entity.position,
    gameMode: bot.game?.gameMode,
    dimension: bot.game?.dimension,
    version: bot.version,
    ping: bot.player?.ping ?? 0,
    inventory: getInventorySummary(),
  };
}

function getInventorySummary() {
  if (!bot) return [];
  return bot.inventory.items().map(item => ({
    name: item.name,
    count: item.count,
    slot: item.slot,
  }));
}

// ─── Plugin System ────────────────────────────────────────────────────────────
function loadPlugin(filePath) {
  const name = path.basename(filePath, '.js');
  try {
    // Unload existing
    if (loadedPlugins[name]) {
      try {
        if (typeof loadedPlugins[name].unload === 'function') {
          loadedPlugins[name].unload(bot);
        }
      } catch (e) {}
      delete require.cache[require.resolve(filePath)];
    }

    const plugin = require(filePath);
    loadedPlugins[name] = plugin;

    if (bot && typeof plugin.load === 'function') {
      plugin.load(bot, log, broadcast);
    }

    log('info', `Plugin loaded: ${name}`, 'plugin');
    broadcast('plugin_update', { name, status: 'loaded', ts: Date.now() });
    return true;
  } catch (err) {
    log('error', `Failed to load plugin "${name}": ${err.message}`, 'plugin');
    broadcast('plugin_update', { name, status: 'error', error: err.message, ts: Date.now() });
    return false;
  }
}

function unloadPlugin(name) {
  const filePath = path.join(PLUGINS_DIR, `${name}.js`);
  if (loadedPlugins[name]) {
    try {
      if (typeof loadedPlugins[name].unload === 'function') {
        loadedPlugins[name].unload(bot);
      }
    } catch (e) {}
    try { delete require.cache[require.resolve(filePath)]; } catch(e){}
    delete loadedPlugins[name];
    log('info', `Plugin unloaded: ${name}`, 'plugin');
    broadcast('plugin_update', { name, status: 'unloaded', ts: Date.now() });
  }
}

function loadAllPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
initDiscord(log);
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  files.forEach(f => loadPlugin(path.join(PLUGINS_DIR, f)));
}

function watchPlugins() {
  if (pluginWatcher) pluginWatcher.close();
  pluginWatcher = chokidar.watch(PLUGINS_DIR, { ignoreInitial: true });

  pluginWatcher.on('add', filePath => {
    if (filePath.endsWith('.js')) {
      log('info', `New plugin detected: ${path.basename(filePath)}`, 'plugin');
      loadPlugin(filePath);
    }
  });

  pluginWatcher.on('change', filePath => {
    if (filePath.endsWith('.js')) {
      log('info', `Plugin changed, hot-reloading: ${path.basename(filePath)}`, 'plugin');
      loadPlugin(filePath);
    }
  });

  pluginWatcher.on('unlink', filePath => {
    if (filePath.endsWith('.js')) {
      const name = path.basename(filePath, '.js');
      unloadPlugin(name);
    }
  });
}

// ─── Bot Management ───────────────────────────────────────────────────────────
function createBot(config) {
  if (bot) destroyBot();

  botConfig = config;
  log('info', `Connecting to ${config.host}:${config.port} as ${config.username}...`, 'bot');

  try {
    bot = mineflayer.createBot({
      host: config.host,
      port: parseInt(config.port) || 25565,
      username: config.username,
      password: config.password || undefined,
      version: config.version || false,
      auth: config.auth || 'offline',
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
      log('info', `Bot spawned as ${bot.username}`, 'bot');
      setBot(bot);
      broadcast('bot_status', getBotStatus());

      const mcData = require('minecraft-data')(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);

      // Start prismarine-viewer (only once — reuses server on reconnect)
      if (!viewerStarted) {
        try {
          mineflayerViewer(bot, { port: VIEWER_PORT, firstPerson: false });
          viewerStarted = true;
          viewerActive = true;
          log('info', `🌍 World viewer at http://localhost:${VIEWER_PORT}`, 'viewer');
          broadcast('viewer_status', { active: true, port: VIEWER_PORT });
        } catch (err) {
          log('warn', `Viewer failed to start: ${err.message}`, 'viewer');
        }
      } else {
        // Viewer already running, just update the bot it's attached to
        viewerActive = true;
        log('info', `🌍 World viewer reattached at http://localhost:${VIEWER_PORT}`, 'viewer');
        broadcast('viewer_status', { active: true, port: VIEWER_PORT });
      }

      // Load all plugins now that bot is ready
      Object.keys(loadedPlugins).forEach(name => {
        const plugin = loadedPlugins[name];
        if (typeof plugin.load === 'function') {
          try { plugin.load(bot, log, broadcast); } catch(e) {
            log('error', `Plugin ${name} load error: ${e.message}`, 'plugin');
          }
        }
      });
    });

    bot.on('chat', (username, message) => {
      if (username === bot.username) return;
      log('chat', `<${username}> ${message}`, 'chat');
      broadcast('chat', { username, message });
      sendToDiscord(username, message);
    });

    bot.on('health', () => {
      broadcast('bot_status', getBotStatus());
    });

    bot.on('move', () => {
      broadcast('position', bot.entity?.position);
    });

    bot.on('kicked', (reason) => {
      log('warn', `Bot was kicked: ${reason}`, 'bot');
      broadcast('bot_status', { online: false, kickReason: reason });
    });

    bot.on('end', (reason) => {
      log('warn', `Bot disconnected: ${reason}`, 'bot');
      viewerActive = false;
      broadcast('bot_status', { online: false });
      broadcast('viewer_status', { active: false });
    });

    bot.on('error', (err) => {
      log('error', `Bot error: ${err.message}`, 'bot');
      broadcast('bot_status', { online: false, error: err.message });
    });

    bot._client.on('packet', (data, meta) => {
      // throttle packet broadcasts
    });

    setInterval(() => {
      if (bot && bot.entity) broadcast('bot_status', getBotStatus());
    }, 2000);

  } catch (err) {
    log('error', `Failed to create bot: ${err.message}`, 'bot');
  }
}

function destroyBot() {
  if (bot) {
    // Unload plugin hooks
    Object.values(loadedPlugins).forEach(p => {
      if (typeof p.unload === 'function') try { p.unload(bot); } catch(e) {}
    });
    try { bot.quit('Disconnected from web panel'); } catch (e) {}
    bot = null;
    log('info', 'Bot destroyed', 'bot');
    broadcast('bot_status', { online: false });
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────
app.post('/api/connect', (req, res) => {
  const { host, port, username, password, version, auth } = req.body;
  if (!host || !username) return res.status(400).json({ error: 'host and username required' });
  createBot({ host, port: port || 25565, username, password, version, auth: auth || 'offline' });
  res.json({ ok: true });
});

app.post('/api/disconnect', (req, res) => {
  destroyBot();
  res.json({ ok: true });
});

app.post('/api/chat', (req, res) => {
  if (!bot) return res.status(400).json({ error: 'Bot not connected' });
  bot.chat(req.body.message);
  log('chat', `[YOU] ${req.body.message}`, 'chat');
  res.json({ ok: true });
});

app.post('/api/command', (req, res) => {
  if (!bot) return res.status(400).json({ error: 'Bot not connected' });
  const cmd = req.body.command;
  try {
    // Execute arbitrary JS in bot context
    const fn = new Function('bot', 'pathfinder', 'goals', 'Movements', 'log', `"use strict"; return (async()=>{ ${cmd} })();`);
    fn(bot, pathfinder, goals, Movements, log)
      .then(result => res.json({ ok: true, result: String(result ?? '') }))
      .catch(err => res.json({ ok: false, error: err.message }));
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
app.get('/ping', (req, res) => res.send('pong'));
app.get('/api/status', (req, res) => {
  res.json(getBotStatus());
});

app.get('/api/logs', (req, res) => {
  res.json(logs.slice(-200));
});

// Plugin API
app.get('/api/plugins', (req, res) => {
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
initDiscord(log);
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  const plugins = files.map(f => ({
    name: path.basename(f, '.js'),
    loaded: !!loadedPlugins[path.basename(f, '.js')],
    code: fs.readFileSync(path.join(PLUGINS_DIR, f), 'utf8'),
  }));
  res.json(plugins);
});

app.post('/api/plugins/save', (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PLUGINS_DIR, `${safeName}.js`);
  fs.writeFileSync(filePath, code, 'utf8');
  // chokidar will auto-reload it
  res.json({ ok: true, name: safeName });
});

app.delete('/api/plugins/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(PLUGINS_DIR, `${name}.js`);
  if (fs.existsSync(filePath)) {
    unloadPlugin(name);
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Plugin not found' });
  }
});

app.post('/api/plugins/:name/reload', (req, res) => {
  const filePath = path.join(PLUGINS_DIR, `${req.params.name}.js`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plugin not found' });
  const ok = loadPlugin(filePath);
  res.json({ ok });
});

// Viewer
app.get('/api/viewer', (req, res) => {
  res.json({ active: viewerActive, port: VIEWER_PORT });
});

// Movement
app.post('/api/move', (req, res) => {
  if (!bot || !bot.entity) return res.status(400).json({ error: 'Bot not connected' });
  const { x, y, z } = req.body;
  try {
    const { GoalBlock } = goals;
    bot.pathfinder.setGoal(new GoalBlock(x, y, z));
    log('info', `Navigating to ${x}, ${y}, ${z}`, 'bot');
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/stop', (req, res) => {
  if (!bot) return res.status(400).json({ error: 'Bot not connected' });
  bot.pathfinder.setGoal(null);
  bot.clearControlStates();
  res.json({ ok: true });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  log('info', 'Web client connected', 'ws');
  ws.send(JSON.stringify({ type: 'init', data: { status: getBotStatus(), logs: logs.slice(-100) } }));
  ws.on('close', () => log('info', 'Web client disconnected', 'ws'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
initDiscord(log);
loadAllPlugins();
watchPlugins();

server.listen(PORT, () => {
  log('info', `🌐 Control panel running at http://localhost:${PORT}`, 'system');
  log('info', `🌍 World viewer will start at http://localhost:${VIEWER_PORT} once bot connects`, 'system');
});
