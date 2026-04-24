# 🛡️ SystemGuardian

AI-powered CLI tool that detects and prevents dangerous terminal commands in real-time.

---

## 🚀 Quick Start

```bash
npm install -g systemguardian
guardian on
```

---

## 🎬 Demo

![Demo](./assets/demo.png)

---

## ✨ What This Tool Does

SystemGuardian acts like a **safety layer on top of your terminal**.

Whenever you run a command:

1. It intercepts the command
2. Analyzes risk (rule-based engine)
3. Uses AI to explain consequences
4. Warns or blocks execution

---

## 🧠 How It Works (Architecture)

```text
User Command
   ↓
CLI Wrapper (shell.js)
   ↓
Analyzer Engine (rules + context)
   ↓
Risk Score (0–100)
   ↓
AI Layer (Gemini)
   ↓
Formatted Output + Warning
```

---

## 🔍 Example

```bash
guardian simulate "rm -rf /"
```

Output:

```
🚨 DANGER (Score: 95)

Explanation: Deletes entire system  
Consequence: Complete data loss  
Safer Alternative: Use specific path instead  
```

---

## ▶️ Usage

```bash
guardian on                  # Start protected shell
guardian off                 # Exit shell
guardian simulate "<cmd>"    # Test a command
guardian safe-mode on        # Strict blocking
guardian install-shell       # Auto-start
guardian service start       # Background daemon
guardian help                # Show commands
```

---

## 🔐 API Setup (Important)

Create a `.env` file:

```bash
GEMINI_API_KEY=your_api_key_here
```

👉 Get API key from Google Gemini

---

## ⚠️ Without API

* Tool still works
* Uses rule-based detection
* AI explanation disabled

---

## 📁 Project Structure Explained

```text
src/core/
  analyzer.js   → Risk calculation logic  
  llm.js        → AI integration  
  rules.json    → Dangerous command patterns  

src/cli/
  index.js      → CLI entry point  
  shell.js      → Command interception  

src/daemon/
  index.js      → Background monitoring  

vscode-extension/
  extension.js  → Editor integration  
```

---

## 🛠️ How You Can Build Something Like This

### Step 1: Capture commands

Use a CLI wrapper (`readline` / shell proxy)

### Step 2: Analyze commands

Create rules:

* rm -rf → high risk
* chmod 777 → medium risk

### Step 3: Add AI layer

Send command → get explanation

### Step 4: Add safety system

* warning
* confirmation
* block

---

## 🛡️ Security Notes

* No kernel-level access
* Runs fully in user space
* Simulation mode ensures no real execution
* API key never bundled in package

---

## 📦 Local Development

```bash
npm install
npm link
guardian on
```

---

## 📜 License

MIT
