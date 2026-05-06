# SystemGuardian

> Policy-driven terminal safety layer for developers and teams. SystemGuardian intercepts dangerous terminal commands before execution using repository policies, context-aware analysis, deterministic rules, and optional AI-powered explanations.

[![npm version](https://img.shields.io/npm/v/systemguardian?color=6C63FF&style=flat-square)](https://www.npmjs.com/package/systemguardian)
[![npm downloads](https://img.shields.io/npm/dm/systemguardian?color=green&style=flat-square)](https://www.npmjs.com/package/systemguardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen?style=flat-square)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square)]()

---

## Quick Start

```bash
npm install -g systemguardian
guardian config --key YOUR_GEMINI_API_KEY
guardian on
```

No `.env` file. No automatic shell modification. Works globally across projects and languages.

---

## New in v1.2.1

This is a trust and security hardening release:

- Removed npm `postinstall` shell integration.
- Shell auto-start integration is now explicit opt-in through `guardian install-shell`.
- Added local-only mode to disable all Gemini API usage.
- Added `.guardianrc` project policy loading and validation.
- Added deterministic built-in rule engine.
- Added protected git branch enforcement.
- Added `SECURITY.md` and npm package ignore hardening.

---

## Demo

![Demo](./assets/demo.png)

---

## How It Works

```text
Your Command
     |
Guardian Shell intercepts command
     |
Repository Policy Engine checks .guardianrc
     |
Rule Engine + Git Context Detection
     |
Optional Gemini AI explanation
     |
Allow / Warn / Block
```

SystemGuardian requires shell access because it analyzes terminal commands before execution. This access is intentional and limited to the terminal safety workflow.

---

## Security & Trust

SystemGuardian is designed to be transparent about what it does:

- No telemetry.
- No hidden network requests.
- No automatic shell modification.
- No npm `postinstall` scripts.
- No root or kernel access.
- Shell integration is explicit opt-in through `guardian install-shell`.
- AI requests only go to the user's configured Gemini API key.
- Repository policies are local-only and are not uploaded by SystemGuardian.

SystemGuardian uses shell and process APIs because it is a terminal safety tool. It must inspect commands before execution, block unsafe commands, and pass safe commands to the user's shell. The CLI bin entry, shell access, `child_process` usage, and command execution are legitimate required functionality.

For deterministic-only operation with no external AI requests:

```bash
guardian config --local-only on
```

To re-enable optional Gemini analysis when an API key is configured:

```bash
guardian config --local-only off
```

---

## Project Policy

SystemGuardian loads a per-project `.guardianrc` file from the current working directory before executing commands.

Example `.guardianrc`:

```json
{
  "safeMode": true,
  "protectedBranches": ["main", "master", "production"],
  "productionKeywords": ["prod", "production"],
  "blocked": ["terraform destroy", "rm -rf /"],
  "warn": ["git push --force", "docker system prune"]
}
```

Policy behavior:

| Field | Behavior |
|---|---|
| `blocked` | Matching commands are blocked before execution |
| `warn` | Matching commands require `Continue? (y/n)` confirmation |
| `protectedBranches` | Dangerous git operations are blocked on matching branches |
| `productionKeywords` | Reserved for production-aware policy checks |
| `safeMode` | Defaults to `true` in policy validation |

Policy validation is defensive:

- `blocked`, `warn`, `protectedBranches`, and `productionKeywords` must be arrays.
- Array values must be strings.
- Dangerous keys such as `__proto__`, `prototype`, and `constructor` are rejected.
- Invalid or missing values fall back to safe defaults.
- If `.guardianrc` is missing or invalid JSON, SystemGuardian falls back to `DEFAULT_POLICY`.

---

## Built-in Rule Engine

SystemGuardian includes deterministic rules for high-risk commands:

| Command Pattern | Score | Level | Safer Alternative |
|---|---:|---|---|
| `git push --force` | 90 | dangerous | `git push --force-with-lease` |
| `git reset --hard` | 85 | dangerous | - |
| `terraform destroy` | 95 | critical | `terraform plan -destroy` |
| `rm -rf /` | 100 | critical | - |

The rule engine returns:

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

SystemGuardian detects the current git branch using:

```bash
git branch --show-current
```

If the current branch matches `policy.protectedBranches`, these dangerous git operations are blocked:

- `git push --force`
- `git reset --hard`
- `git clean -fdx`

When blocked, the command score is raised to at least `95` and the explanation includes:

```text
Protected branch detected: <branch>
```

If git branch detection fails, SystemGuardian safely returns `null` and continues with existing behavior.

---

## API Key Setup

```bash
guardian config --key YOUR_GEMINI_API_KEY
```

The key is stored at `~/.guardian/config.json` with owner-only permissions.

```bash
guardian config --show      # view saved key masked
guardian config --remove    # remove saved key
```

No API key? SystemGuardian still works with deterministic rule-based detection.

Get a free key: [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Local-Only Mode

Local-only mode disables all Gemini API usage and uses only deterministic rules:

```bash
guardian config --local-only on
guardian config --local-only off
```

Status shows whether AI analysis and local-only mode are enabled:

```bash
guardian status
```

---

## Real Example

```bash
guardian simulate "rm -rf /"
```

```text
DANGER (Score: 95/100)

Confidence     : HIGH
Rule Matched   : Recursive delete on critical system path
Impact Summary : Catastrophic system failure and irreversible data loss

Explanation:
   Attempts to recursively delete every file starting from root.

Consequences:
   Complete data loss. System becomes unbootable. No recovery
   without a full backup.

Safer Alternative:
   Use specific path: rm -rf ./tmp
```

---

## Policy Block Example

With this `.guardianrc`:

```json
{
  "blocked": ["terraform destroy"],
  "warn": ["git push --force"],
  "protectedBranches": ["main"]
}
```

Running a blocked command prints:

```text
BLOCKED by project policy
Command: terraform destroy
Explanation: Terraform destroy removes managed infrastructure.
Safer alternative: terraform plan -destroy
```

Running a warned command asks:

```text
Continue? (y/n)
```

The command only executes if the user confirms.

---

## Commands

### Outside Guardian Shell

| Command | Description |
|---|---|
| `guardian on` | Start the protected shell |
| `guardian simulate "cmd"` | Dry-run any command safely |
| `guardian safe-mode on\|off` | Toggle strict blocking mode |
| `guardian status` | Show config, AI, and local-only status |
| `guardian config --key KEY` | Save Gemini API key |
| `guardian config --show` | View saved key masked |
| `guardian config --remove` | Remove saved API key |
| `guardian config --local-only on\|off` | Disable or enable external AI requests |
| `guardian install-shell` | Explicitly opt into shell auto-start integration |

### Inside Guardian Shell

| Command | Description |
|---|---|
| `history` | All commands run this session |
| `last` | Last command you ran |
| `status` | Config, AI, local-only, and platform status |
| `info <cmd>` | Explain risk of any command |
| `ls` / `ls -la` | List files in current directory |
| `pwd` | Print current directory |
| `whoami` | Show current user |
| `clear` | Clear terminal screen |
| `help` | Show all available commands |
| `exit` / `quit` | Exit guardian shell |

---

## Info Command

```bash
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

Each entry shows what it does, risk level, safe conditions, and safer alternative.

---

## Risk Levels

| Score | Level | Action |
|---|---|---|
| 0-29 | Safe | Executes directly |
| 30-69 | Warning | Shows analysis, then executes or asks based on policy |
| 70-100 | Danger | Blocks or asks confirmation depending on safe mode and policy |

Safe Mode (`guardian safe-mode on`) hard-blocks dangerous commands.

Project policy checks run before normal shell execution. If a command matches `policy.blocked`, it is not executed.

---

## Security Features

| Feature | Detail |
|---|---|
| Project policy enforcement | `.guardianrc` can block or warn per repo |
| Protected branch blocking | Dangerous git operations are blocked on configured branches |
| Local-only mode | Disables all Gemini API usage |
| No postinstall scripts | npm install does not modify shell startup files |
| Safe policy validation | Rejects prototype pollution keys and invalid policy values |
| Built-in dangerous command rules | Detects force push, hard reset, Terraform destroy, and root deletion |
| Shell injection blocked | Metacharacters, backticks, eval, reverse shells |
| Path traversal blocked | `../../..` patterns rejected |
| Rate limiting | Max 30 commands per minute |
| Command length limit | Max 2048 characters |
| Secret redaction | API keys, tokens, passwords never stored plain |
| Config permissions | `~/.guardian/config.json` is owner-only |
| No kernel access | Fully user-space, no root required |
| No telemetry | Nothing sent anywhere except optional Gemini API requests |

---

## Project Structure

```text
src/
  cli/
    index.js       -> CLI entry + guardian commands
    shell.js       -> Guardian shell + built-in commands + policy gate
    installer.js   -> Explicit shell integration helper
    formatter.js   -> Terminal output formatting
  core/
    analyzer.js    -> Risk scoring engine
    config.js      -> Global config (~/.guardian/config.json)
    gitContext.js  -> Current git branch detection
    llm.js         -> Gemini AI integration
    logger.js      -> Secure action logging with secret redaction
    policy.js      -> .guardianrc loading and policy validation
    ruleEngine.js  -> Built-in policy-aware command rules
    rules.json     -> Dangerous command patterns reference
  daemon/
    index.js       -> Background stub (reserved)
```

---

## Local Development

```bash
git clone https://github.com/ayushsingh2005-coder/developer-guardian-agent
cd developer-guardian-agent
npm install
npm link
guardian config --key YOUR_KEY
guardian on
```

---

## Requirements

- Node.js >= 16
- Linux, macOS, Windows PowerShell, or Git Bash
- Gemini API key is optional

---

## License

MIT (c) [Ayush Singh](https://github.com/ayushsingh2005-coder)
