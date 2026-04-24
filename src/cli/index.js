#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const { startShell } = require('./shell');
const { loadConfig, saveConfig, setApiKey, getApiKey, CONFIG_PATH, GUARDIAN_DIR } = require('../core/config');

const args = process.argv.slice(2);
const command = args[0];

// ── guardian config ──────────────────────────────────────────
if (command === 'config') {
  const flag = args[1];
  const value = args[2];

  if (flag === '--key' || flag === '-k') {
    if (!value || value.trim().length === 0) {
      console.log(chalk.red('Usage: guardian config --key YOUR_GEMINI_API_KEY'));
      process.exit(1);
    }
    try {
      setApiKey(value.trim());
      console.log(chalk.green('✅ API key saved successfully!'));
      console.log(chalk.gray(`   Stored at: ${CONFIG_PATH}`));
      console.log(chalk.gray('   Run "guardian on" to start the protected shell.'));
    } catch (err) {
      console.log(chalk.red(`Failed to save API key: ${err.message}`));
      process.exit(1);
    }
    process.exit(0);
  }

  if (flag === '--show') {
    const key = getApiKey();
    if (!key) {
      console.log(chalk.yellow('No API key configured.'));
      console.log(chalk.gray('Run: guardian config --key YOUR_GEMINI_API_KEY'));
    } else {
      // Show only first 8 and last 4 chars — never full key
      const masked = key.slice(0, 8) + '••••••••••••' + key.slice(-4);
      console.log(chalk.green(`API Key: ${masked}`));
      console.log(chalk.gray(`Config : ${CONFIG_PATH}`));
    }
    process.exit(0);
  }

  if (flag === '--remove') {
    const config = loadConfig();
    config.apiKey = null;
    saveConfig(config);
    console.log(chalk.yellow('API key removed.'));
    process.exit(0);
  }

  console.log(chalk.bold('\n🔧 Guardian Config'));
  console.log(chalk.gray('──────────────────────────────────────'));
  console.log(`  ${chalk.cyan('guardian config --key <KEY>')}   Save Gemini API key`);
  console.log(`  ${chalk.cyan('guardian config --show')}        Show saved key (masked)`);
  console.log(`  ${chalk.cyan('guardian config --remove')}      Remove saved key`);
  console.log(chalk.gray('──────────────────────────────────────\n'));
  process.exit(0);
}

// ── guardian on ─────────────────────────────────────────────
else if (command === 'on') {
  const key = getApiKey();
  if (!key) {
    console.log(chalk.yellow('\n⚠️  No API key configured — AI analysis disabled.'));
    console.log(chalk.gray('   To enable AI: guardian config --key YOUR_GEMINI_API_KEY\n'));
  } else {
    console.log(chalk.green('✅ AI analysis active.'));
  }
  startShell();
}

// ── guardian off ─────────────────────────────────────────────
else if (command === 'off') {
  console.log(chalk.yellow('Run "exit" inside guardian shell to quit.'));
  process.exit(0);
}

// ── guardian simulate ────────────────────────────────────────
else if (command === 'simulate') {
  const simCmd = args.slice(1).join(' ').trim();
  if (!simCmd) {
    console.log(chalk.red('Usage: guardian simulate "rm -rf /"'));
    process.exit(1);
  }
  startShell(simCmd);
}

// ── guardian safe-mode ───────────────────────────────────────
else if (command === 'safe-mode') {
  const state = args[1];
  const config = loadConfig();

  if (state === 'on') {
    config.safeMode = true;
    saveConfig(config);
    console.log(chalk.green('✅ Safe Mode ENABLED — dangerous commands will be blocked.'));
  } else if (state === 'off') {
    config.safeMode = false;
    saveConfig(config);
    console.log(chalk.yellow('⚠️  Safe Mode DISABLED — warnings can be bypassed.'));
  } else {
    console.log(chalk.red('Usage: guardian safe-mode on|off'));
    process.exit(1);
  }
  process.exit(0);
}

// ── guardian status ──────────────────────────────────────────
else if (command === 'status') {
  const config = loadConfig();
  const key = getApiKey();
  console.log(chalk.bold('\n🛡️  Guardian Status'));
  console.log(chalk.gray('──────────────────────────────────────'));
  console.log(`  Safe Mode     : ${config.safeMode ? chalk.green('ON') : chalk.yellow('OFF')}`);
  console.log(`  AI (Gemini)   : ${key ? chalk.green('Configured ✓') : chalk.red('Not set')}`);
  console.log(`  Config file   : ${chalk.gray(CONFIG_PATH)}`);
  console.log(`  Trusted cmds  : ${chalk.cyan(config.trustedCommands.length)}`);
  console.log(chalk.gray('──────────────────────────────────────\n'));
  process.exit(0);
}

// ── guardian help / default ──────────────────────────────────
else {
  console.log(chalk.bold('\n🛡️  SystemGuardian — AI-powered terminal safety\n'));
  console.log(chalk.gray('Usage: guardian <command>\n'));

  const cmds = [
    ['on',                        'Start the protected guardian shell'],
    ['off',                       'Exit reminder'],
    ['simulate "<cmd>"',          'Dry-run any command safely'],
    ['safe-mode on|off',          'Toggle strict blocking mode'],
    ['status',                    'Show current config & API key status'],
    ['config --key <KEY>',        'Save your Gemini API key (one time)'],
    ['config --show',             'Show saved API key (masked)'],
    ['config --remove',           'Remove saved API key'],
  ];

  cmds.forEach(([cmd, desc]) => {
    console.log(`  ${chalk.cyan(('guardian ' + cmd).padEnd(35))} ${desc}`);
  });

  console.log(chalk.gray('\nInside guardian shell, type "help" for shell commands.\n'));
  process.exit(0);
}