const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'guardian.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ✅ FIX 1.3: Comprehensive secret redaction patterns
const SENSITIVE_PATTERNS = [
  // Cloud provider keys
  { pattern: /AKIA[0-9A-Z]{16}/g,                        label: '[AWS_ACCESS_KEY]' },
  { pattern: /[0-9a-zA-Z/+]{40}/g,                       label: '[AWS_SECRET_KEY]' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/g,                  label: '[GCP_API_KEY]' },

  // Auth tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/g,                     label: '[GITHUB_TOKEN]' },
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/g,             label: '[GITHUB_PAT]' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g,                     label: '[GITHUB_OAUTH]' },
  { pattern: /sk-[a-zA-Z0-9]{32,}/g,                     label: '[OPENAI_KEY]' },
  { pattern: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g,          label: '[SLACK_TOKEN]' },
  { pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,        label: 'Bearer [REDACTED]' },
  { pattern: /token[=:\s]+[^\s"'&]{8,}/gi,               label: 'token=[REDACTED]' },

  // Credentials
  { pattern: /password[=:\s]+[^\s"'&]{4,}/gi,            label: 'password=[REDACTED]' },
  { pattern: /passwd[=:\s]+[^\s"'&]{4,}/gi,              label: 'passwd=[REDACTED]' },
  { pattern: /secret[=:\s]+[^\s"'&]{4,}/gi,              label: 'secret=[REDACTED]' },
  { pattern: /api[_-]?key[=:\s]+[^\s"'&]{4,}/gi,        label: 'api_key=[REDACTED]' },
  { pattern: /Authorization:\s*\S+/gi,                   label: 'Authorization: [REDACTED]' },

  // Connection strings
  { pattern: /mongodb(\+srv)?:\/\/[^\s]+/gi,             label: '[MONGO_URI]' },
  { pattern: /postgres:\/\/[^\s]+/gi,                    label: '[POSTGRES_URI]' },
  { pattern: /mysql:\/\/[^\s]+/gi,                       label: '[MYSQL_URI]' },
  { pattern: /redis:\/\/[^\s]+/gi,                       label: '[REDIS_URI]' },
  { pattern: /amqp:\/\/[^\s]+/gi,                        label: '[AMQP_URI]' },

  // Private keys
  { pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, label: '[PRIVATE_KEY]' },

  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, label: '[JWT_TOKEN]' },

  // IP addresses (optional — uncomment if needed)
  // { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: '[IP_ADDRESS]' },
];

function redact(value) {
  if (typeof value !== 'string') return value;
  let safe = value;
  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    safe = safe.replace(pattern, label);
  }
  return safe;
}

function redactObject(obj, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]';  // ✅ prevent circular ref crash
  if (typeof obj === 'string') return redact(obj);
  if (typeof obj !== 'object' || obj === null) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = typeof val === 'string' ? redact(val) : redactObject(val, depth + 1);
  }
  return result;
}

function logAction(decision, command, riskScore = 0, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    command: redact(String(command)),
    riskLevel: decision,
    score: riskScore,
    aiResponse: details.ai ? redact(details.ai) : null,
    context: redactObject(details.context || details)
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error(`[Logger] Failed to write log: ${err.message}`);
  }
}

module.exports = { logAction };