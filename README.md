# Developer Guardian Agent

An advanced, context-aware cross-platform background service and shell wrapper that monitors system activity in real time. Transformed into a full multi-platform developer product, Guardian can be used via the CLI, as a background system service, and as a VS Code extension, sharing a unified core analysis engine.

## Advanced Features

- **Context-Aware Risk Analysis:** Differentiates based on path, Git branches, Docker volumes, etc.
- **Risk Scoring System:** Dynamically scores commands on a 0–100 scale.
- **AI Integration (Google Gemini):** Explains consequences and provides alternatives.
- **Shell Integration:** Auto-starts seamlessly on bash/zsh with `guardian install-shell`.
- **System Service:** Background daemon monitoring files/CPU via `guardian service start`.
- **VS Code Extension:** Integrated plugin to catch and highlight dangerous terminal commands inside your editor.
- **Shared Core Architecture:** The AI logic and analyzer are completely decoupled and shared across the CLI wrapper, Daemon service, and VS Code.

## Project Structure

```text
Systemguardian/
├── package.json
├── guardian-config.json
├── src/
│   ├── core/              # Shared logic module
│   │   ├── analyzer.js    # Contextual Risk analysis engine
│   │   ├── llm.js         # Real Google Gemini API Integration
│   │   ├── config.js      # Handles states
│   │   ├── logger.js      # Structured JSON Logger
│   │   └── rules.json     # Static rule fallbacks
│   ├── cli/               # CLI Interfaces
│   │   ├── index.js       # CLI entry point 
│   │   ├── shell.js       # Interactive shell wrapper logic
│   │   └── installer.js   # Shell setup and service scripts
│   └── daemon/            # Background Process
│       └── index.js       # Background monitor (files + CPU)
├── vscode-extension/      # VS Code Integration
│   ├── package.json
│   └── src/
│       └── extension.js
├── logs/                  # Contains guardian.log
└── .env                   # API Keys
```

## Installation

### Global Install

1. Clone or navigate to this directory.
2. Install dependencies:
   ```bash
   npm install
   ```
   *The `postinstall` script will guide you on how to set up the shell integration.*
3. Set your AI Key in a `.env` file at the root: `GEMINI_API_KEY="..."`
4. Link globally:
   ```bash
   npm link
   ```

### 1. Shell Integration (Auto Start)
To make Guardian start automatically every time you open a terminal:
```bash
guardian install-shell
```
*This safely modifies `~/.bashrc` and `~/.zshrc`. It uses `GUARDIAN_ACTIVE` to prevent infinite loops.*

### 2. Background System Service
Start the Guardian as a detached background service monitoring your files and CPU spikes:
```bash
guardian service start
guardian service stop
```

### 3. VS Code Extension
The extension code is fully prepared in `vscode-extension/`. You can package it using `vsce` or run it by opening the folder in VS Code and hitting `F5`. It connects directly to `src/core/analyzer.js` to evaluate commands in the editor palette (`Developer Guardian: Analyze Last Command`).

## CLI Usage

- `guardian on` : Enter the protected shell
- `guardian off` : Stop the shell
- `guardian simulate "rm -rf /"` : Test a command's risk score without executing it
- `guardian safe-mode on` : Toggle strict blocking mode

## Security Guarantee
Guardian is built 100% in user-space using standard Node.js libraries. No kernel hooks, no hidden behaviors. Everything is strictly transparent and logged in JSON format.

## ⚠️ API Key Required

You must provide your own Gemini API key.

Create `.env`:

GEMINI_API_KEY=your_key_here

# 🛡️ Developer Guardian Agent

An AI-powered, context-aware developer safety layer that monitors and analyzes terminal commands in real time.

Guardian helps prevent dangerous operations (like `rm -rf /`, `chmod 777`, etc.) by analyzing risk, explaining consequences, and suggesting safer alternatives.

---

## 🚀 Features

- 🔍 **Context-Aware Risk Analysis** (Git, Docker, OS-aware)
- 📊 **Dynamic Risk Scoring (0–100)**
- 🤖 **AI-Powered Explanations (Google Gemini)**
- 🧠 **Fallback Mode (works even without AI)**
- 🖥️ **CLI Shell Protection**
- 🔁 **Background System Monitoring**
- 🧩 **VS Code Extension Support**
- ⚡ **Cross-platform (Windows, Linux, Mac)**

---

## 🚀 Quick Start

npm install -g systemguardian  
guardian on
