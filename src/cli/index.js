#!/usr/bin/env node
const path = require('path');

require('dotenv').config({
  path: path.join(process.cwd(), '.env')
});
const { startShell } = require('./shell');
const { startDaemon } = require('../daemon');
const { installShell, startService, stopService } = require('./installer');
const { loadConfig, saveConfig } = require('../core/config');
const chalk = require('chalk');

const args = process.argv.slice(2);
const command = args[0];

if (command === 'on') {
  console.log(chalk.green('Starting Developer Guardian Agent...'));

  if (process.env.GUARDIAN_ACTIVE && !args.includes('--force')) {
    console.log(chalk.yellow('Guardian is already active in this shell session.'));
    startShell();
  } else {
    process.env.GUARDIAN_ACTIVE = '1';
    startDaemon();
    startShell();
  }

} else if (command === 'off') {
  console.log(chalk.yellow('Developer Guardian Agent turned OFF.'));
  console.log(chalk.gray('Please run "exit" to leave the guardian shell.'));
  process.exit(0);

} else if (command === 'simulate') {
  const simCmd = args.slice(1).join(' ');

  if (!simCmd) {
    console.log(chalk.red('Please provide a command to simulate. Example: guardian simulate rm -rf /'));
    process.exit(1);
  }

  startShell(simCmd);

} else if (command === 'safe-mode') {
  const state = args[1];
  let config = loadConfig();

  if (state === 'on') {
    config.safeMode = true;
    saveConfig(config);
    console.log(chalk.green('Safe Mode ENABLED. All dangerous commands will be strictly blocked.'));
  } else if (state === 'off') {
    config.safeMode = false;
    saveConfig(config);
    console.log(chalk.yellow('Safe Mode DISABLED. Warnings can be bypassed.'));
  } else {
    console.log(chalk.red('Usage: guardian safe-mode on|off'));
  }

  process.exit(0);

} else if (command === 'install-shell') {
  installShell();

} else if (command === 'service') {
  const action = args[1];

  if (action === 'start') startService();
  else if (action === 'stop') stopService();
  else console.log(chalk.red('Usage: guardian service start|stop'));

} else {
  console.log(chalk.bold('🛡️  Developer Guardian Agent CLI'));
  console.log(`Usage:`);
  console.log(`  guardian on                 - Start the agent and enter the protected shell`);
  console.log(`  guardian off                - Stop the agent`);
  console.log(`  guardian simulate <cmd>     - Dry run a command`);
  console.log(`  guardian safe-mode on/off   - Toggle strict blocking mode`);
  console.log(`  guardian install-shell      - Enable auto-start in terminal`);
  console.log(`  guardian service start|stop - Manage background service`);
  process.exit(1);
}
