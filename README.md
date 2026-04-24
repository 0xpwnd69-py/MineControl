# 🎮 MineControl

> A web-controlled Mineflayer bot with live JS eval, hot-reload plugin system, and a real-time 3D world viewer.

Control a Minecraft bot entirely from your browser — no terminal commands needed after startup. Write and reload plugins without ever restarting the server.

---

## ✨ Features

- 🌐 **Browser control panel** — chat, move, and manage the bot from any browser
- ⚡ **Live JS Eval** — run JavaScript against the live bot instantly (`bot`, `pathfinder`, `goals` all available)
- 🔌 **Hot-reload plugins** — drop a `.js` file in the `plugins/` folder and it loads automatically, edit it and it reloads on save — no restarts ever
- 🌍 **3D World Viewer** — real-time prismarine-viewer embedded right in the panel
- 📊 **Live stats** — health, food, position, ping, gamemode updated in real time
- 🎒 **Inventory viewer** — see everything the bot is carrying
- 🧭 **Navigation** — D-pad controls + pathfinder GoTo X/Y/Z coordinates
- 💬 **Console** — live log stream with chat, errors, and system events

---

## 🚀 Quick Start

**Requirements:** [Node.js](https://nodejs.org) v18 or higher

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd mineflayer-bot
npm install
npm start
```

Then open **http://localhost:3000** in your browser, fill in your server details, and click **Connect**.

The 3D world viewer starts automatically at **http://localhost:3001** once the bot spawns.

---

## 🔌 Plugin System

Plugins live in the `plugins/` folder. The server watches this folder — any file you add, edit, or delete is picked up **instantly** with no restart.

You can also write plugins directly from the **Plugins tab** in the browser UI.

### Example Plugin

```js
// plugins/anti-afk.js
let interval = null;

module.exports = {
  load(bot, log) {
    interval = setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
      log('info', 'Anti-AFK jump!', 'anti-afk');
    }, 30000);
  },

  unload(bot) {
    clearInterval(interval);
    interval = null;
  }
};
```

### Available in every plugin

| Variable | Description |
|---|---|
| `bot` | The full Mineflayer bot instance |
| `log(level, msg, source)` | Logs to the web console (`'info'`, `'warn'`, `'error'`, `'chat'`) |
| `broadcast(type, data)` | Sends a WebSocket event to all connected browser clients |

> **Important:** Always clean up listeners and timers in `unload()` — otherwise they stack up every time the plugin reloads.

---

## 🧑‍💻 JS Eval

The **JS Eval** tab lets you run arbitrary code against the live bot:

```js
// Make the bot follow the nearest player
const { GoalFollow } = goals;
const player = Object.values(bot.players)
  .find(p => p.entity && p.username !== bot.username);
bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
return `Following ${player.username}`;
```

Available globals: `bot`, `pathfinder`, `goals`, `Movements`, `log`

---

## 📁 File Structure

```
mineflayer-bot/
├── server.js           # Express + WebSocket server, bot & plugin manager
├── package.json        # Dependencies
├── plugins/            # Hot-reload plugin folder
│   ├── auto-login.js   # Auto /login for cracked servers
│   └── auto-respond.js
└── public/
    └── index.html      # Web control panel
```

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Control panel port |
| `VIEWER_PORT` | `3001` | Prismarine world viewer port |

```bash
PORT=8080 VIEWER_PORT=8081 npm start
```

---

## 📦 Built With

- [Mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft bot framework
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) — Pathfinding
- [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer) — 3D world viewer
- [Express](https://expressjs.com) — Web server
- [chokidar](https://github.com/paulmillr/chokidar) — File watcher for hot-reload
- [CodeMirror](https://codemirror.net) — In-browser code editor
