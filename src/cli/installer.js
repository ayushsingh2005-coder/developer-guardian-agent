const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

function installShell() {
  const home = os.homedir();
  const bashrc = path.join(home, '.bashrc');
  const zshrc = path.join(home, '.zshrc');

  const guardianLoader = `
# Developer Guardian Agent - Auto Start
if [ -z "$GUARDIAN_ACTIVE" ] && command -v guardian >/dev/null 2>&1; then
  export GUARDIAN_ACTIVE=1
  guardian on
fi
`;

  [bashrc, zshrc].forEach(rcPath => {
    if (fs.existsSync(rcPath)) {
      const content = fs.readFileSync(rcPath, 'utf8');

      if (!content.includes('GUARDIAN_ACTIVE')) {
        fs.appendFileSync(rcPath, '\n' + guardianLoader);
        console.log(chalk.green(`✅ Integrated Guardian into ${rcPath}`));
      } else {
        console.log(chalk.yellow(`⚠️ Already exists in ${rcPath}`));
      }
    }
  });

  console.log(chalk.cyan('Restart terminal to activate Guardian.'));
}

function startService() {
  console.log(chalk.cyan('Starting background daemon...'));

  const daemonPath = path.join(__dirname, '..', 'daemon', 'index.js');

  require('child_process').spawn('node', [daemonPath], {
    stdio: 'ignore',
    detached: true
  }).unref();

  console.log(chalk.green('Daemon started successfully.'));
}

function stopService() {
  console.log(chalk.yellow('Stopping service is manual for now.'));
  console.log(chalk.gray('Use Task Manager / kill process.'));
}

if (process.argv.includes('--postinstall')) {
  console.log(chalk.cyan('Thank you for installing Developer Guardian.'));
  console.log(chalk.cyan('Run: guardian install-shell'));
}

module.exports = {
  installShell,
  startService,
  stopService
};
