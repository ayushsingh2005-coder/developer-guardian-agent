# 🛡️ SystemGuardian for VS Code

AI-powered extension that detects dangerous terminal commands in real-time — with Gemini AI explanations, risk scoring, and a protected Guardian Shell.

> Also available as a CLI tool → [systemguardian on npm](https://www.npmjs.com/package/systemguardian)

---

## ✨ Features

- **Analyze any command** — Select any text in editor → instant AI risk analysis
- **Gemini AI explanations** — explains what could go wrong + safer alternatives
- **Risk scoring** — 0 to 100 with SAFE / WARNING / DANGER levels
- **Guardian Shell** — open protected terminal directly from VS Code
- **One-time setup** — API key saved securely in VS Code global settings

---

## ⚡ Quick Start

1. Install this extension
2. `Ctrl+Shift+P` → **Guardian: Set Gemini API Key**
3. Select any command in the editor
4. `Ctrl+Shift+P` → **Guardian: Analyze Selected Command**

Get free Gemini API key → [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## 🔍 Example

Select `rm -rf /` in editor → Analyze → you get:

```
🚨 DANGEROUS — 95/100

📌 RULE MATCHED
Recursive delete on critical path

🧠 EXPLANATION
Attempts to recursively delete every file starting from root.
On Linux/macOS this destroys the OS entirely.

💣 CONSEQUENCES
Complete data loss. System becomes unbootable.
No recovery without a full backup.

🛠️ SAFER ALTERNATIVE
Use specific path: rm -rf ./tmp
On Windows: Remove-Item -Path 'C:\Users\you\folder' -Recurse -Force

✅ SAFE WHEN
Almost never. Only in throwaway Docker containers or isolated VMs.
```

---

## 📋 All Commands

| Command | Description |
|---|---|
| `Guardian: Analyze Selected Command` | Analyze selected text as a terminal command |
| `Guardian: Open Protected Terminal` | Open Guardian Shell in VS Code terminal |
| `Guardian: Set Gemini API Key` | Save your Gemini API key (one time only) |
| `Guardian: Show Status` | Show API key and safe mode status |

---

## 🛡️ Risk Levels

| Score | Level | Meaning |
|---|---|---|
| 0 – 29 | ✅ Safe | Command is safe to run |
| 30 – 69 | ⚠️ Warning | Use with caution |
| 70 – 100 | 🚨 Danger | High risk — review before running |

---

## 🔐 Security

- API key stored in VS Code global settings — never in plain text files
- No telemetry — nothing sent anywhere except your own Gemini API
- Works without API key — rule-based detection as fallback

---

## 📦 CLI Version

For full terminal protection outside VS Code:

```bash
npm install -g systemguardian
guardian config --key YOUR_GEMINI_API_KEY
guardian on
```

→ [systemguardian on npm](https://www.npmjs.com/package/systemguardian)

---

## ⚙️ Requirements

- VS Code >= 1.80.0
- Gemini API key — free, optional

---

## 🔖 Release Notes

### 1.0.0
Initial release — command analysis, Guardian Shell, AI explanations, risk scoring.

---

## 📜 License

MIT © [Ayush Singh](https://github.com/ayushsingh2005-coder)