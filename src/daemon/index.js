const chokidar = require('chokidar');
const chalk = require('chalk');
const { logAction } = require('../core/logger');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');

const HOME_DIR = os.homedir();

function checkCPU() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

let lastCPU = checkCPU();

function startDaemon() {
  console.log(chalk.cyan('Background daemon started. Monitoring sensitive files...'));

  // ✅ FIX 2.2: Use proper absolute glob paths for chokidar (no path.join for globs)
  const sensitivePaths = [
    HOME_DIR + '/**/.env',
    HOME_DIR + '/**/.env.*',
    HOME_DIR + '/.ssh/**',
    HOME_DIR + '/**/*.pem',
    HOME_DIR + '/**/*.key',
    HOME_DIR + '/**/*.p12',
  ];

  const watcher = chokidar.watch(sensitivePaths, {
    ignored: /(node_modules|\.git)/,
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,       // ✅ prevent symlink escape
    depth: 6,                    // ✅ limit recursion depth
  });

  // ✅ FIX 3.1 NEW: Watcher itself wrapped in error handler
  watcher
    .on('add', filePath => {
      try {
        logAction('ANOMALY_FILE', `Sensitive file added: ${filePath}`);
        console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file added: ${filePath}`));
      } catch (err) {
        console.error(chalk.red(`[Daemon] add handler error: ${err.message}`));
      }
    })
    .on('change', filePath => {
      try {
        logAction('ANOMALY_FILE', `Sensitive file modified: ${filePath}`);
        console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file modified: ${filePath}`));
      } catch (err) {
        console.error(chalk.red(`[Daemon] change handler error: ${err.message}`));
      }
    })
    .on('unlink', filePath => {
      try {
        logAction('ANOMALY_FILE', `Sensitive file deleted: ${filePath}`);
        console.log(chalk.magenta(`\n[Daemon Alert] Sensitive file deleted: ${filePath}`));
      } catch (err) {
        console.error(chalk.red(`[Daemon] unlink handler error: ${err.message}`));
      }
    })
    .on('error', err => {
      // ✅ FIX 3.1 NEW: Watcher errors logged, daemon stays alive
      console.error(chalk.red(`[Daemon] Watcher error: ${err.message}`));
      logAction('DAEMON_WATCHER_ERROR', err.message);
    });

  // ✅ FIX 3.1: Full try-catch in interval + division by zero guard
  setInterval(() => {
    try {
      const cmd = os.platform() === 'win32' ? 'tasklist' : 'ps aux';
      exec(cmd, (error, stdout) => {
        try {
          if (error) {
            console.error(chalk.red(`[Daemon] Process check failed: ${error.message}`));
            return;
          }
          logAction('PROCESS_MONITOR', `Processes checked. Found ${stdout.split('\n').length} processes.`);
        } catch (innerErr) {
          console.error(chalk.red(`[Daemon] Process log error: ${innerErr.message}`));
        }
      });

      const currentCPU = checkCPU();
      const idleDiff = currentCPU.idle - lastCPU.idle;
      const totalDiff = currentCPU.total - lastCPU.total;

      if (totalDiff === 0) return; // ✅ division by zero guard

      const usage = 100 - ~~(100 * idleDiff / totalDiff);

      if (usage > 85) {
        logAction('ANOMALY_CPU', `High CPU usage: ${usage}%`);
        console.log(chalk.red(`\n[Daemon Alert] High CPU usage: ${usage}%`));
      }

      lastCPU = currentCPU;

    } catch (err) {
      console.error(chalk.red(`[Daemon] Interval error: ${err.message}`));
      logAction('DAEMON_ERROR', err.message);
    }
  }, 30000);
}

module.exports = { startDaemon };