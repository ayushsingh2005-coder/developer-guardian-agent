'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Global dir — ~/.guardian/ — works everywhere, npm global install pe bhi
const GUARDIAN_DIR = path.join(os.homedir(), '.guardian');
const CONFIG_PATH = path.join(GUARDIAN_DIR, 'config.json');

const DEFAULT_CONFIG = {
  apiKey: null,
  trustedCommands: [],
  safeMode: false
};

function validateConfig(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_CONFIG };
  }
  return {
    apiKey: typeof raw.apiKey === 'string' && raw.apiKey.trim().length > 0
      ? raw.apiKey.trim()
      : null,
    safeMode: typeof raw.safeMode === 'boolean' ? raw.safeMode : false,
    trustedCommands: Array.isArray(raw.trustedCommands)
      ? raw.trustedCommands
          .filter(cmd => typeof cmd === 'string' && cmd.trim().length > 0)
          .slice(0, 500)
          .map(cmd => cmd.trim())
      : []
  };
}

function ensureDir() {
  if (!fs.existsSync(GUARDIAN_DIR)) {
    fs.mkdirSync(GUARDIAN_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return validateConfig(raw);
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  ensureDir();
  const safe = validateConfig(config);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(safe, null, 2), {
    encoding: 'utf8',
    mode: 0o600  // owner-only, no group/world access
  });
}

function getApiKey() {
  return loadConfig().apiKey || null;
}

function setApiKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Invalid API key');
  }
  const config = loadConfig();
  config.apiKey = key.trim();
  saveConfig(config);
}

module.exports = { loadConfig, saveConfig, getApiKey, setApiKey, CONFIG_PATH, GUARDIAN_DIR };