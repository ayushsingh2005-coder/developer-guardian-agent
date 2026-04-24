const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'guardian.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logAction(decision, command, riskScore = 0, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    command,
    riskLevel: decision, // 'EXECUTE_SAFE', 'DANGER_PROMPT', 'BLOCKED_SAFE_MODE'
    score: riskScore,
    aiResponse: details.ai || null,
    context: details.context || details // Fallback if context isn't wrapped nicely
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
}

module.exports = { logAction };
