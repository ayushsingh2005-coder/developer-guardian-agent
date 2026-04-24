const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'guardian-config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return { trustedCommands: [], safeMode: false };
    }
  }
  return { trustedCommands: [], safeMode: false };
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { loadConfig, saveConfig };
