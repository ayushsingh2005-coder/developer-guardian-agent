# Security Policy

## Supported Versions

Security fixes are provided for the latest published release of SystemGuardian.

| Version | Supported |
|---|---|
| 1.2.x | Yes |
| Older versions | No |

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately.

Email: security@example.com

Include:

- A clear description of the issue
- Steps to reproduce
- Impact and affected versions, if known
- Any relevant logs or proof of concept details

Please do not open public issues for unresolved vulnerabilities.

## Shell Access Notice

SystemGuardian intentionally uses shell and process APIs because it is a terminal safety tool. It must inspect and execute terminal commands in order to warn about, block, or safely pass through those commands.

SystemGuardian does not require root or kernel access. Shell integration is explicit opt-in through `guardian install-shell`; npm install does not modify shell startup files.

## Network and AI Behavior

SystemGuardian has no telemetry and no hidden network requests. AI analysis is only sent to the user's configured Gemini API key. Local-only mode disables Gemini usage and uses deterministic rules only.

Repository policy files such as `.guardianrc` are local-only and are not uploaded by SystemGuardian.
