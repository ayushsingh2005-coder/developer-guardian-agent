const chokidar = require('chokidar');
const chalk = require('chalk');
const { logAction } = require('../core/logger'); // ✅ Fixed path
const { exec } = require('child_process');
const os = require('os');

function checkCPU() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

let lastCPU = checkCPU();

function startDaemon() {
  console.log(chalk.cyan('Background daemon started. Monitoring sensitive files and processes...'));

  const sensitivePaths = [
    '**/.env*',
    '**/.ssh/**',
    '**/*.pem'
  ];

  const watcher = chokidar.watch(sensitivePaths, {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
  });

  watcher
    .on('add', path => {
      logAction('ANOMALY_FILE', `Sensitive file added: ${path}`);
      console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file added: ${path}`));
    })
    .on('change', path => {
      logAction('ANOMALY_FILE', `Sensitive file modified: ${path}`);
      console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file modified: ${path}`));
    })
    .on('unlink', path => {
      logAction('ANOMALY_FILE', `Sensitive file deleted: ${path}`);
      console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file deleted: ${path}`));
    });

  setInterval(() => {
    const cmd = os.platform() === 'win32' ? 'tasklist' : 'ps aux';
    exec(cmd, (error, stdout) => {
      if (!error) {
        logAction('PROCESS_MONITOR', `System processes checked. Found ${stdout.split('\n').length} processes.`);
      }
    });

    // CPU spike check
    const currentCPU = checkCPU();
    const idleDiff = currentCPU.idle - lastCPU.idle;
    const totalDiff = currentCPU.total - lastCPU.total;
    const usage = 100 - ~~(100 * idleDiff / totalDiff);

    if (usage > 85) {
      logAction('ANOMALY_CPU', `High CPU usage detected: ${usage}%`);
      console.log(chalk.red(`\n[Daemon Alert] High CPU usage detected: ${usage}%`));
    }
    lastCPU = currentCPU;

  }, 30000);
}

module.exports = { startDaemon };