const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'guardian-config.json');

const DEFAULT_CONFIG = { trustedCommands: [], safeMode: false };

// ✅ FIX 5.2: Validate config to prevent prototype pollution / DoS
function validateConfig(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_CONFIG };
  }

  // Strip prototype pollution keys
  const safe = Object.create(null);
  safe.safeMode = typeof raw.safeMode === 'boolean' ? raw.safeMode : false;
  safe.trustedCommands = Array.isArray(raw.trustedCommands)
    ? raw.trustedCommands
        .filter(cmd => typeof cmd === 'string')
        .slice(0, 500)          // ✅ Cap array size (DoS protection)
        .map(cmd => cmd.trim())
    : [];

  return safe;
}

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return validateConfig(raw);
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  const safe = validateConfig(config);
  fs.writeFileSync(configPath, JSON.stringify(safe, null, 2), 'utf8');
}

module.exports = { loadConfig, saveConfig };