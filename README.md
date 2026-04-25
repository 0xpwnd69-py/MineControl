# 🎮 MineControl

> A web-controlled Mineflayer bot with live JS eval, hot-reload plugin system, real-time 3D world viewer, and a Discord chat bridge.

Control a Minecraft bot entirely from your browser. Write and reload plugins without ever restarting the server. Chat between Minecraft and Discord in real time.

---

## ✨ Features

- 🌐 **Password protected control panel** — nobody can access it without your password
- 💬 **Live console** — real-time log stream with chat, errors, and system events
- ⚡ **JS Eval** — run JavaScript against the live bot instantly from the browser
- 🔌 **Hot-reload plugins** — drop a `.js` file in `plugins/` and it loads automatically, edit it and it reloads on save — no restarts ever
- 🌍 **3D World Viewer** — real-time prismarine-viewer embedded in the panel
- 📊 **Live stats** — health, food, position, ping, gamemode
- 🎒 **Inventory viewer** — see everything the bot is carrying
- 🧭 **Navigation** — D-pad controls + pathfinder GoTo X/Y/Z
- 🤖 **Auto-login** — automatically sends `/login` for cracked/AuthMe servers
- 🔁 **Auto-8b8t** — automatically sends `/8b8t` when bot is on the login server
- 📡 **Discord chat bridge** — two-way chat between Minecraft and Discord with rank detection and DM support

---

## 🚀 Quick Start

**Requirements:** [Node.js](https://nodejs.org) v18 or higher

```bash
git clone https://github.com/0xpwnd69-py/MineControl
cd MineControl
npm install
npm start
```

Open **http://localhost:3000** in your browser, fill in your server details and click **Connect**.

---

## ⚙️ Environment Variables

Never hardcode secrets in your code. Use environment variables instead:

| Variable | Description |
|---|---|
| `PANEL_PASSWORD` | Password to access the web control panel |
| `DISCORD_TOKEN` | Your Discord bot token |
| `DISCORD_CHANNEL_ID` | Channel ID for the chat bridge |
| `DISCORD_WEBHOOK_URL` | Webhook URL for nicer looking messages (optional) |
| `MC_PASSWORD` | Minecraft account password for auto-login |
| `PORT` | Web panel port (default: `3000`) |
| `VIEWER_PORT` | World viewer port (default: `3001`) |

For local development create a `.env` file:
```
PANEL_PASSWORD=yourpassword
DISCORD_TOKEN=your_token
DISCORD_CHANNEL_ID=your_channel_id
MC_PASSWORD=your_mc_password
```

For hosting add these in your hosting provider's dashboard.

---

## 🔌 Plugin System

Plugins live in the `plugins/` folder. The server watches this folder — any file you add, edit, or delete is picked up **instantly** with no restart. You can also write plugins directly from the **Plugins tab** in the browser.

### Included Plugins

| Plugin | Description |
|---|---|
| `auto-login.js` | Auto sends `/login <password>` for AuthMe servers |
| `auto-respond.js` | Responds to `!pos` and `!health` commands in chat |
| `auto-8b8t.js` | Auto sends `/8b8t` when bot is on the login island |

### Writing a Plugin

```js
let interval = null;

module.exports = {
  load(bot, log, broadcast) {
    log('info', 'my plugin loaded!', 'my-plugin');

    interval = setInterval(() => {
      // do something every 30 seconds
    }, 30000);
  },

  unload(bot) {
    // always clean up or things stack up on hot-reload
    clearInterval(interval);
    interval = null;
  }
};
```

**Available in every plugin:**
- `bot` — full Mineflayer bot instance
- `log(level, msg, source)` — logs to the web console
- `broadcast(type, data)` — sends a WebSocket event to all browser clients

---

## 📡 Discord Chat Bridge

Two-way chat between Minecraft and Discord with smart formatting:

| Message Type | Discord Format |
|---|---|
| Normal player | `` `Player1: hello` `` |
| Ranked player | `` `[Owner] Player2: hello` `` |
| Server message | `` `[Server] Use /login ...` `` |
| Incoming DM | `` `📨 [DM from Player] hey` `` |
| Outgoing DM | `` `📤 [DM to Player] hey` `` |

**Features:**
- Automatically detects 8b8t ranks (`Ultra`, `Pro+`, `Basic`, `SE`, `Mini`, `Pro`)
- Links never embed in Discord
- Never accidentally pings `@everyone`
- Webhook support for player avatars

**Setup:**
1. Go to [discord.com/developers](https://discord.com/developers) → New Application → Bot
2. Enable **Message Content Intent**
3. Copy token → add as `DISCORD_TOKEN` environment variable
4. Right click your channel → Copy ID → add as `DISCORD_CHANNEL_ID`
5. Optionally create a Webhook in channel settings for nicer messages

---

## 🧑‍💻 JS Eval

Run any JavaScript against the live bot from the **JS Eval** tab:

```js
// Follow nearest player
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
MineControl/
├── server.js            # Express + WebSocket server, bot & plugin manager
├── discord-bridge.js    # Discord chat bridge
├── package.json
├── plugins/
│   ├── auto-login.js    # Auto /login for cracked servers
│   ├── auto-respond.js  # Responds to chat commands
│   └── auto-8b8t.js     # Auto /8b8t on login island
└── public/
    └── index.html       # Web control panel
```

---

## ☁️ Hosting on Render (free)

1. Push your code to GitHub (never commit secrets!)
2. Go to [render.com](https://render.com) → sign up with GitHub
3. New → Web Service → select your repo
4. Set **Build Command** to `npm install` and **Start Command** to `node server.js`
5. Add all your environment variables in the dashboard
6. Deploy!

To keep it awake 24/7 for free, use [UptimeRobot](https://uptimerobot.com):
- Monitor Type: `HTTP(s)`
- URL: `https://your-app.onrender.com/ping`
- Interval: `5 minutes`

---

## 📦 Built With

- [Mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft bot framework
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) — Pathfinding
- [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer) — 3D world viewer
- [discord.js](https://discord.js.org) — Discord bot
- [Express](https://expressjs.com) — Web server
- [chokidar](https://github.com/paulmillr/chokidar) — File watcher for hot-reload
- [CodeMirror](https://codemirror.net) — In-browser code editor
