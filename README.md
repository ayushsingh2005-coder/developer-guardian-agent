# SystemGuardian

> Policy-driven terminal safety for developers. SystemGuardian runs a protected shell that analyzes terminal commands before execution using deterministic rules, repository policies, git context, and optional Gemini AI explanations.

[![npm version](https://img.shields.io/npm/v/systemguardian?color=6C63FF&style=flat-square)](https://www.npmjs.com/package/systemguardian)
[![npm downloads](https://img.shields.io/npm/dm/systemguardian?color=green&style=flat-square)](https://www.npmjs.com/package/systemguardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen?style=flat-square)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square)]()

Current package version: `1.3.1`

---

## Quick Start

```bash
npm install -g systemguardian
guardian config --key YOUR_GEMINI_API_KEY
guardian on
```

Gemini is optional. Without an API key, SystemGuardian still uses local deterministic rules.

---

## What It Does

SystemGuardian starts an interactive protected shell. Every non-built-in command is checked before execution:

```text
Command
  |
Guardian shell
  |
.guardianrc project policy
  |
Built-in rule engine
  |
Git branch context
  |
Risk analyzer
  |
Optional Gemini explanation
  |
Execute / warn / block
```

SystemGuardian intentionally uses shell and `child_process` APIs because it is a terminal safety tool. It does not require root or kernel access.

---

## Security & Trust

- No telemetry.
- No hidden network requests.
- No npm `postinstall` script.
- No automatic shell modification during install.
- Shell auto-start integration is explicit opt-in with `guardian install-shell`.
- AI requests only go to Gemini using the user's configured API key.
- Repository policies are read locally from `.guardianrc`.
- Local-only mode disables all Gemini API usage.
- Secrets are redacted before logging.
- Config is stored under `~/.guardian/config.json` with owner-only file permissions.

Security policy: [SECURITY.md](./SECURITY.md)

---

## Local-Only Mode

Use local-only mode when you want deterministic rules only and no external AI requests:

```bash
guardian config --local-only on
guardian config --local-only off
```

When local-only mode is enabled, `getApiKey()` returns `null`, so the Gemini client is not created.

---

## Project Policies

SystemGuardian looks for `.guardianrc` in the current working directory.

Start from the included example:

```bash
cp .guardianrc.example .guardianrc
```

Example policy:

```json
{
  "safeMode": true,
  "protectedBranches": ["main", "master", "production"],
  "productionKeywords": ["prod", "production"],
  "blocked": ["terraform destroy", "rm -rf /"],
  "warn": ["git push --force", "docker system prune"]
}
```

Policy fields:

| Field | Behavior |
|---|---|
| `safeMode` | Defaults to `true` in project policy validation |
| `protectedBranches` | Blocks dangerous git operations when the current branch matches exactly |
| `productionKeywords` | Reserved for production-aware checks |
| `blocked` | Matching command patterns are blocked before execution |
| `warn` | Matching command patterns require `Continue? (y/n)` |

Policy validation is defensive:

- Array fields must be arrays.
- Array values must be strings.
- `__proto__`, `prototype`, and `constructor` keys are rejected.
- Missing or invalid values fall back to `DEFAULT_POLICY`.
- Invalid JSON falls back to defaults and does not crash the shell.

Note: `protectedBranches` currently uses exact string matching. Patterns like `release/*` in `.guardianrc.example` are documentation examples for policy intent, not wildcard matching in the current rule engine.

---

## Built-in Policy Rules

`src/core/ruleEngine.js` includes these built-in rules:

| Pattern | Score | Level | Safer Alternative |
|---|---:|---|---|
| `git push --force` | 90 | dangerous | `git push --force-with-lease` |
| `git reset --hard` | 85 | dangerous | - |
| `terraform destroy` | 95 | critical | `terraform plan -destroy` |
| `rm -rf /` | 100 | critical | - |

The policy rule engine returns:

```js
{
  blocked,
  warned,
  score,
  matchedRule,
  saferAlternative,
  explanation
}
```

---

## Protected Git Branches

SystemGuardian detects the current branch with:

```bash
git branch --show-current
```

If `context.currentBranch` matches `policy.protectedBranches`, these commands are blocked:

- `git push --force`
- `git reset --hard`
- `git clean -fdx`

Protected branch blocks raise score to at least `95` and return:

```text
Protected branch detected: <branch>
```

If git branch detection fails, it returns `null` and command analysis continues normally.

---

## Risk Analyzer

`src/core/analyzer.js` performs broader command scoring and context collection:

- Git repository and branch context
- Docker container and volume context
- Dangerous paths such as `/`, `/etc`, `C:\`, and `C:\Windows`
- Recursive deletion patterns
- Force pushes
- Docker prune
- `chmod 777`
- `sudo`
- Disk write and format commands
- Fork bombs
- Remote script execution through `curl` or `wget`

Risk levels:

| Score | Level | Behavior |
|---|---|---|
| `0-29` | safe | Executes directly |
| `30-69` | warning | Shows analysis, then executes |
| `70-100` | dangerous | Requires confirmation, or blocks in safe mode |

Safe mode:

```bash
guardian safe-mode on
guardian safe-mode off
```

---

## Commands

### Outside Guardian Shell

| Command | Description |
|---|---|
| `guardian on` | Start the protected Guardian shell |
| `guardian off` | Reminder to exit from inside the shell |
| `guardian simulate "cmd"` | Dry-run command analysis |
| `guardian safe-mode on\|off` | Toggle strict blocking mode |
| `guardian status` | Show safe mode, AI, local-only, config, and trusted command status |
| `guardian config --key KEY` | Save Gemini API key |
| `guardian config --show` | Show masked saved API key |
| `guardian config --remove` | Remove saved API key |
| `guardian config --local-only on\|off` | Disable or enable Gemini usage |
| `guardian install-shell` | Explicitly opt into shell auto-start integration |

### Inside Guardian Shell

| Command | Description |
|---|---|
| `history` | Show session command history |
| `last` | Show previous command |
| `status` | Show shell status, AI state, local-only state, platform |
| `info <cmd>` | Show built-in command risk information |
| `ls` / `ls -la` / `dir` | List files |
| `pwd` | Print current directory |
| `whoami` | Show current OS user |
| `clear` / `cls` | Clear screen |
| `help` | Show shell help |
| `exit` / `quit` | Exit Guardian shell |

---

## Info Command

Inside the Guardian shell:

```bash
info rm -rf
info chmod 777
info git push --force
info sudo
info dd
info curl
info wget
info docker system prune
info mkfs
```

Each entry explains what the command does, why it is risky, when it is safe, and a safer alternative.

---

## API Key and AI Analysis

Save a Gemini API key:

```bash
guardian config --key YOUR_GEMINI_API_KEY
```

Show or remove it:

```bash
guardian config --show
guardian config --remove
```

AI behavior:

- Uses `@google/genai`.
- Model: `gemini-2.5-flash`.
- Responses are requested as JSON.
- If no key exists, local-only mode is enabled, or Gemini fails, SystemGuardian falls back to deterministic analysis.

Get a Gemini key: [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Logging

Runtime logs are written under:

```text
~/.guardian/guardian.log
```

The logger redacts common secrets before writing:

- AWS, GCP, GitHub, OpenAI, and Slack tokens
- Bearer tokens
- Passwords, secrets, and API keys in command text
- Database URLs
- Private keys
- JWTs

The repository `logs/` and `src/logs/` directories are excluded from npm packaging.

---

## Shell Integration

SystemGuardian does not modify shell startup files during npm install.

To explicitly opt into auto-start integration:

```bash
guardian install-shell
```

The installer appends a Guardian loader to existing `.bashrc` and `.zshrc` files only if they exist and do not already contain `GUARDIAN_ACTIVE`.

On Windows, use `guardian on` directly from PowerShell or Git Bash.

---

## Package Contents

The npm package includes only:

```text
src/cli
src/core
src/daemon
README.md
SECURITY.md
```

Excluded by `.npmignore`:

- logs and runtime output
- `.env` and local config files
- `node_modules`
- tests and screenshots
- VS Code extension workspace
- temporary/editor files

---

## Repository Layout

```text
.
|-- assets/
|   `-- demo.png
|-- logs/
|   `-- guardian.log                 # local runtime log, ignored by npm
|-- src/
|   |-- cli/
|   |   |-- formatter.js             # terminal formatting for analysis output
|   |   |-- index.js                 # CLI entrypoint and commands
|   |   |-- installer.js             # explicit shell integration helper
|   |   `-- shell.js                 # protected shell runtime
|   |-- core/
|   |   |-- analyzer.js              # risk scoring and context collection
|   |   |-- config.js                # ~/.guardian/config.json management
|   |   |-- gitContext.js            # current branch detection
|   |   |-- llm.js                   # Gemini integration and fallback
|   |   |-- logger.js                # redacted action logging
|   |   |-- policy.js                # .guardianrc loading and validation
|   |   |-- ruleEngine.js            # deterministic project policy rules
|   |   `-- rules.json               # reference dangerous command patterns
|   |-- daemon/
|   |   `-- index.js                 # no-op daemon stub
|   `-- logs/
|       `-- guardian.log             # local log artifact, ignored by npm
|-- vscode-extension/
|   |-- src/extension.js             # extension source
|   `-- systemguardian/              # VS Code extension project and packaged VSIX
|-- .guardianrc.example              # sample repository policy
|-- .npmignore                       # npm package hardening
|-- package.json                     # CLI package metadata
|-- package-lock.json
|-- README.md
`-- SECURITY.md
```

---

## VS Code Extension

The repository includes a VS Code extension workspace under `vscode-extension/`.

It contributes commands such as:

- `Guardian: Analyze Selected Command`
- `Guardian: Open Protected Terminal`
- `Guardian: Set Gemini API Key`
- `Guardian: Show Status`

The extension folder is excluded from the npm CLI package.

---

## Local Development

```bash
git clone https://github.com/ayushsingh2005-coder/developer-guardian-agent
cd developer-guardian-agent
npm install
npm link
guardian status
guardian on
```

Useful checks:

```bash
node src/cli/index.js status
npm pack --dry-run --ignore-scripts
```

---

## Requirements

- Node.js >= 16
- Windows PowerShell, Git Bash, macOS shell, or Linux shell
- Optional Gemini API key

---

## License

MIT (c) [Ayush Singh](https://github.com/ayushsingh2005-coder)
