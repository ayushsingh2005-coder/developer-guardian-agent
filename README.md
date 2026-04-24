# 🛡️ SystemGuardian

AI-powered CLI tool that detects and prevents dangerous terminal commands in real-time.

---

## ⚡ Quick Start

```bash
npm install -g systemguardian
guardian config --key YOUR_GEMINI_API_KEY
guardian on
```

That's it. No `.env` file. No manual config. Works globally.

---

## 🎬 Demo

![Demo](./assets/demo.png)

---

## 🔑 API Key Setup (One Time Only)

```bash
guardian config --key YOUR_GEMINI_API_KEY
```

Your key is stored securely at `~/.guardian/config.json` (owner-only permissions).

Get your free API key → [Google AI Studio](https://aistudio.google.com/app/apikey)

```bash
guardian config --show      # view saved key (masked)
guardian config --remove    # remove saved key
```

> **Without API key** — tool still works using rule-based detection. AI explanations will be disabled.

---

## 🎬 How It Works

```
Your Command
     ↓
Guardian Shell (intercepts)
     ↓
Rule-based Analyzer (score 0–100)
     ↓
AI Layer — Gemini (explains risk)
     ↓
Warning / Block / Allow
```

---

## ▶️ All Commands

### Outside Guardian Shell

| Command | Description |
|---|---|
| `guardian on` | Start the protected shell |
| `guardian off` | Exit reminder |
| `guardian simulate "cmd"` | Dry-run any command safely |
| `guardian safe-mode on\|off` | Toggle strict blocking |
| `guardian status` | Show config and API key status |
| `guardian config --key KEY` | Save Gemini API key |
| `guardian config --show` | Show saved key (masked) |
| `guardian config --remove` | Remove saved key |
| `guardian install-shell` | Auto-start on terminal open |

### Inside Guardian Shell

| Command | Description |
|---|---|
| `history` | Show all commands this session |
| `last` | Show last command run |
| `status` | Show guardian config and API status |
| `info <cmd>` | Explain risk of any command |
| `ls` / `ls -la` | List files in current directory |
| `pwd` | Print current directory |
| `whoami` | Show current user |
| `clear` | Clear screen |
| `help` | Show all shell commands |
| `exit` / `quit` | Exit guardian shell |

---

## 🔍 Example

```bash
guardian simulate "rm -rf /"
```

```
🚨 DANGER (Score: 95/100)

📌 Rule Matched   : Recursive delete on critical system path
⚡ Impact Summary : Complete and irreversible data loss
🧠 Explanation    : Deletes every file on the system starting from root
💣 Consequences   : Full OS destruction — unrecoverable without backup
🛠️ Safer Alt      : Use specific path e.g. rm -rf ./tmp
✅ Safe When      : Never on / or ~ without absolute certainty
```

---

## 📖 Info Command

```bash
# Inside guardian shell:
info rm -rf
info chmod 777
info sudo
info dd
info curl
info wget
info git push --force
info docker system prune
info mkfs
```

---

## 🛡️ Risk Levels

| Score | Level | Action |
|---|---|---|
| 0–29 | ✅ Safe | Executes directly |
| 30–69 | ⚠️ Warning | Shows analysis, executes |
| 70–100 | 🚨 Danger | Blocks, asks confirmation |

### In Safe Mode (`guardian safe-mode on`)
All dangerous commands (score ≥ 70) are **hard blocked** — no bypass possible.

---

## 🔐 Security Features

- **Shell injection blocked** — metacharacters, backticks, eval, reverse shells
- **Path traversal blocked** — `../../..` patterns
- **Rate limiting** — max 30 commands per minute
- **Command length limit** — max 2048 characters
- **Secret redaction in logs** — API keys, tokens, passwords never stored in plain text
- **Config file permissions** — `~/.guardian/config.json` is `600` (owner only)
- **No kernel-level access** — runs fully in user space
- **No telemetry** — nothing sent anywhere except your own Gemini API

---

## 📁 Project Structure

```
src/
  cli/
    index.js       → CLI entry point + all guardian commands
    shell.js       → Guardian shell + built-in commands
    installer.js   → Shell auto-start integration
    formatter.js   → Terminal output formatting
  core/
    analyzer.js    → Risk scoring engine
    llm.js         → Gemini AI integration
    config.js      → Global config (~/.guardian/config.json)
    logger.js      → Secure action logging
    rules.json     → Dangerous command patterns reference
  daemon/
    index.js       → Background stub (reserved)
```

---

## 📦 Local Development

```bash
git clone https://github.com/yourusername/systemguardian
cd systemguardian
npm install
npm link
guardian config --key YOUR_KEY
guardian on
```

---

## ⚙️ Requirements

- Node.js >= 16
- Works on Linux, macOS, Windows (PowerShell)
- Gemini API key (free) — optional but recommended

---

## 📜 License

MIT © Ayush Singh