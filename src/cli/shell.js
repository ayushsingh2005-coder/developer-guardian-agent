'use strict';

const readline = require('readline');
const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const analyzer = require('../core/analyzer');
const { getExplanation } = require('../core/llm');
const { logAction } = require('../core/logger');
const { loadConfig, saveConfig } = require('../core/config');
const { printAnalysis } = require('./formatter');

const isWindows = os.platform() === 'win32';
const shellCmd = isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
const HOME_DIR = os.homedir();

const MAX_COMMAND_LENGTH = 2048;
const RATE_LIMIT = { max: 30, windowMs: 60000 };

// ✅ Whitelisted navigation roots
const ALLOWED_ROOTS = [
  HOME_DIR,
  path.join(HOME_DIR, 'Desktop'),
  path.join(HOME_DIR, 'Documents'),
  path.join(HOME_DIR, 'Downloads'),
  path.join(HOME_DIR, 'Projects'),
  process.cwd()
];

// ✅ Blocked shell injection patterns
const BLOCKED_PATTERNS = [
  /\$\(/,
  /`[^`]*`/,
  />\s*\/etc\//,
  /curl\s+.*\|\s*(ba)?sh/i,
  /wget\s+.*\|\s*(ba)?sh/i,
  /eval\s*[\s(]/i,
  /base64\s*(--decode|-d)/i,
  /\\x[0-9a-fA-F]{2}/,
  /\\u[0-9a-fA-F]{4}/,
  /\/dev\/(tcp|udp)\//i,
  /nc\s+-.*-e/i,
  /python.*-c\s+['"]import/i,
  /bash\s+-i\s+>&/i,
  /proc\/self\/environ/i,
  /\.\.\/\.\.\/\.\.\//,
  /:\(\)\{/,   // fork bomb
];

// ── Command history (in-memory, this session) ──────────────
const sessionHistory = [];
const MAX_HISTORY = 200;

function addToHistory(cmd) {
  if (sessionHistory[sessionHistory.length - 1] !== cmd) {
    sessionHistory.push(cmd);
    if (sessionHistory.length > MAX_HISTORY) sessionHistory.shift();
  }
}

// ── Rate limiting ───────────────────────────────────────────
let commandTimestamps = [];

function isRateLimited() {
  const now = Date.now();
  commandTimestamps = commandTimestamps.filter(t => now - t < RATE_LIMIT.windowMs);
  if (commandTimestamps.length >= RATE_LIMIT.max) {
    console.error(chalk.bgRed.white(`\n 🚨 RATE LIMIT — max ${RATE_LIMIT.max} commands/min \n`));
    return true;
  }
  commandTimestamps.push(now);
  return false;
}

// ── Path safety ─────────────────────────────────────────────
function isSafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some(root => resolved.startsWith(root));
}

function isSafeCommand(command) {
  if (command.length > MAX_COMMAND_LENGTH) {
    console.error(chalk.red(`Command too long (${command.length} chars). Max: ${MAX_COMMAND_LENGTH}`));
    return false;
  }
  return !BLOCKED_PATTERNS.some(p => p.test(command));
}

// ── Built-in commands ────────────────────────────────────────

function handleBuiltins(trimmed, rl) {
  // history
  if (trimmed === 'history') {
    if (sessionHistory.length === 0) {
      console.log(chalk.gray('No commands in history yet.'));
    } else {
      sessionHistory.forEach((cmd, i) => {
        console.log(chalk.gray(`  ${String(i + 1).padStart(3)}  ${cmd}`));
      });
    }
    return true;
  }

  // last
  if (trimmed === 'last') {
    const last = sessionHistory[sessionHistory.length - 2]; // -1 is 'last' itself
    if (!last) console.log(chalk.gray('No previous command found.'));
    else console.log(chalk.cyan(`Last command: ${last}`));
    return true;
  }

  // pwd
  if (trimmed === 'pwd') {
    console.log(chalk.cyan(process.cwd()));
    return true;
  }

  // whoami
  if (trimmed === 'whoami') {
    try {
      const user = os.userInfo().username;
      console.log(chalk.cyan(user));
    } catch (_) {
      console.log(chalk.red('Could not determine user.'));
    }
    return true;
  }

  // ls / dir
  if (trimmed === 'ls' || trimmed === 'ls -la' || trimmed === 'dir') {
    try {
      const cmd = isWindows ? 'dir' : trimmed;
      const out = execSync(cmd, { cwd: process.cwd(), stdio: 'pipe', timeout: 5000 }).toString();
      console.log(out);
    } catch (err) {
      console.error(chalk.red(`ls error: ${err.message}`));
    }
    return true;
  }

  // info <command>
  if (trimmed.startsWith('info ')) {
    const target = trimmed.slice(5).trim();
    if (!target) {
      console.log(chalk.red('Usage: info <command>  e.g. info rm -rf'));
      return true;
    }
    printCommandInfo(target);
    return true;
  }

  // clear
  if (trimmed === 'clear' || trimmed === 'cls') {
    process.stdout.write('\x1Bc');
    return true;
  }

  // status
  if (trimmed === 'status') {
    const config = loadConfig();
    console.log(chalk.bold('\n🛡️  Guardian Status'));
    console.log(chalk.gray('─────────────────────────────'));
    console.log(`  Safe Mode  : ${config.safeMode ? chalk.green('ON') : chalk.yellow('OFF')}`);
    console.log(`  API Key    : ${config.apiKey ? chalk.green('Configured ✓') : chalk.red('Not set — run: guardian config --key YOUR_KEY')}`);
    console.log(`  Session Cmds: ${chalk.cyan(sessionHistory.length)}`);
    console.log(`  Platform   : ${chalk.cyan(os.platform())} / ${chalk.cyan(os.arch())}`);
    console.log(chalk.gray('─────────────────────────────\n'));
    return true;
  }

  // help
  if (trimmed === 'help') {
    printHelp();
    return true;
  }

  return false; // not a builtin
}

function printCommandInfo(cmd) {
  const INFO = {
    'rm -rf': {
      desc: 'Recursively deletes files and directories without confirmation.',
      risk: 'HIGH — irreversible data loss if wrong path used.',
      safe: 'Use only with exact known paths. Never on / or ~.',
      alt: 'trash-cli or mv to a temp folder first.'
    },
    'chmod 777': {
      desc: 'Grants read/write/execute to ALL users on file/folder.',
      risk: 'HIGH — serious security vulnerability.',
      safe: 'Never on system files. Use 755 for dirs, 644 for files.',
      alt: 'chmod 755 <dir> or chmod 644 <file>'
    },
    'git push --force': {
      desc: 'Force overwrites remote branch history.',
      risk: 'HIGH on main/master — destroys teammates work.',
      safe: 'Only on personal feature branches you own.',
      alt: 'git push --force-with-lease (safer version)'
    },
    'sudo': {
      desc: 'Runs command as root/superuser.',
      risk: 'MEDIUM — root can modify any file.',
      safe: 'Use only when absolutely required.',
      alt: 'Check if the task can be done without elevated privileges.'
    },
    'dd': {
      desc: 'Direct disk read/write — bypasses filesystem.',
      risk: 'CRITICAL — can wipe entire drives silently.',
      safe: 'Only when creating disk images with verified paths.',
      alt: 'Use cp or rsync for normal file operations.'
    },
    'curl': {
      desc: 'Transfers data from/to URLs.',
      risk: 'LOW alone, HIGH if piped to sh/bash.',
      safe: 'Download to file first, inspect, then execute.',
      alt: 'curl -o script.sh <url> && cat script.sh && bash script.sh'
    },
    'wget': {
      desc: 'Downloads files from the web.',
      risk: 'LOW alone, HIGH if piped to sh/bash.',
      safe: 'Same as curl — never pipe directly to shell.',
      alt: 'wget -O script.sh <url> && cat script.sh'
    },
    'docker system prune': {
      desc: 'Removes all unused Docker containers, images, volumes.',
      risk: 'MEDIUM-HIGH — data loss if volumes have important data.',
      safe: 'Run docker ps and docker volume ls first to verify.',
      alt: 'docker container prune (containers only)'
    },
    'mkfs': {
      desc: 'Formats a disk/partition with a filesystem.',
      risk: 'CRITICAL — permanently erases all data on device.',
      safe: 'Only on verified empty/new devices.',
      alt: 'Double-check device path with lsblk before running.'
    }
  };

  const found = INFO[cmd] || INFO[cmd.toLowerCase()];
  if (!found) {
    console.log(chalk.yellow(`No info entry for "${cmd}". Try: info rm -rf, info chmod 777, info sudo, info dd`));
    return;
  }

  console.log(chalk.bold(`\n📖 Info: ${cmd}`));
  console.log(chalk.gray('─────────────────────────────────────'));
  console.log(`  ${chalk.bold('What it does :')} ${found.desc}`);
  console.log(`  ${chalk.bold('Risk         :')} ${chalk.red(found.risk)}`);
  console.log(`  ${chalk.bold('Safe when    :')} ${found.safe}`);
  console.log(`  ${chalk.bold('Alternative  :')} ${chalk.green(found.alt)}`);
  console.log(chalk.gray('─────────────────────────────────────\n'));
}

function printHelp() {
  console.log(chalk.bold('\n🛡️  Guardian Shell — Available Commands'));
  console.log(chalk.gray('════════════════════════════════════════'));
  const cmds = [
    ['history',         'Show all commands run this session'],
    ['last',            'Show the last command you ran'],
    ['status',          'Show guardian config & API key status'],
    ['info <cmd>',      'Explain risk of a command (e.g. info rm -rf)'],
    ['ls / ls -la',     'List files in current directory'],
    ['pwd',             'Print current directory'],
    ['whoami',          'Show current user'],
    ['clear',           'Clear terminal screen'],
    ['exit / quit',     'Exit guardian shell'],
    ['help',            'Show this help'],
  ];
  cmds.forEach(([cmd, desc]) => {
    console.log(`  ${chalk.cyan(cmd.padEnd(20))} ${desc}`);
  });
  console.log(chalk.gray('════════════════════════════════════════\n'));
}

// ── Command execution ────────────────────────────────────────

async function executeCommand(command) {
  return new Promise((resolve) => {

    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      const resolved = path.resolve(dir);

      if (!isSafePath(resolved)) {
        console.error(chalk.red(`cd: Access denied — ${resolved} is outside allowed roots.`));
        resolve(1);
        return;
      }

      try {
        process.chdir(resolved);
        console.log(chalk.gray(`→ ${process.cwd()}`));
      } catch (err) {
        console.error(chalk.red(`cd: ${err.message}`));
      }
      resolve(0);
      return;
    }

    if (!isSafeCommand(command)) {
      console.error(chalk.bgRed.white.bold('\n 🚨 BLOCKED — Shell injection pattern detected 🚨 \n'));
      logAction('BLOCKED_INJECTION', command, 100);
      resolve(1);
      return;
    }

    const spawnArgs = isWindows
      ? ['-NoProfile', '-NonInteractive', '-Command', command]
      : ['-c', command];

    const child = spawn(shellCmd, spawnArgs, {
      stdio: 'inherit',
      env: { ...process.env },
      cwd: process.cwd()
    });

    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(chalk.red(`Execution error: ${err.message}`));
      resolve(1);
    });
  });
}

// ── Main command handler ─────────────────────────────────────

async function handleCommand(command, rl, simulate = false) {
  const trimmed = command.trim();
  if (!trimmed) return;

  if (trimmed === 'exit' || trimmed === 'quit') {
    console.log(chalk.green('Exiting Guardian Shell. Stay safe!'));
    process.exit(0);
  }

  addToHistory(trimmed);

  // Check builtins first
  if (handleBuiltins(trimmed, rl)) {
    rl.prompt();
    return;
  }

  if (!simulate && isRateLimited()) {
    rl.prompt();
    return;
  }

  const config = loadConfig();
  const analysis = analyzer.analyzeCommand(trimmed);

  // Trusted command — skip analysis
  if (config.trustedCommands.includes(trimmed)) {
    console.log(chalk.gray('[Trusted] Skipping analysis.'));
    logAction('EXECUTE_TRUSTED', trimmed, analysis.score);
    if (!simulate) await executeCommand(trimmed);
    rl.prompt();
    return;
  }

  if (analysis.level === 'dangerous') {
    if (config.safeMode && !simulate) {
      console.log(chalk.bgRed.white.bold('\n 🚨 BLOCKED BY SAFE MODE 🚨 \n'));
      console.log(chalk.red(`Score: ${analysis.score}/100 | Rule: ${analysis.match}`));
      logAction('BLOCKED_SAFE_MODE', trimmed, analysis.score);
      rl.prompt();
      return;
    }

    const explanation = await getExplanation(trimmed, analysis.context, analysis.score);
    printAnalysis(analysis, explanation);

    if (simulate) {
      console.log(chalk.blue('\n[Dry Run] Command would be BLOCKED pending confirmation.'));
      rl.prompt();
      return;
    }

    logAction('DANGER_PROMPT', trimmed, analysis.score);

    rl.question(chalk.bgRed.white.bold(' ⚠️  Are you sure? (y / N / trust) '), async (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === 'y' || a === 'yes') {
        logAction('BYPASS', trimmed, analysis.score);
        await executeCommand(trimmed);
      } else if (a === 'trust') {
        config.trustedCommands.push(trimmed);
        saveConfig(config);
        logAction('TRUSTED', trimmed, analysis.score);
        await executeCommand(trimmed);
      } else {
        logAction('PREVENTED', trimmed, analysis.score);
        console.log(chalk.green('Command cancelled.'));
      }
      rl.prompt();
    });

  } else if (analysis.level === 'warning') {
    const explanation = await getExplanation(trimmed, analysis.context, analysis.score);
    printAnalysis(analysis, explanation);

    if (simulate) {
      console.log(chalk.blue('\n[Dry Run] WARNING — would allow with notice.'));
      rl.prompt();
      return;
    }

    logAction('EXECUTE_WARNING', trimmed, analysis.score);
    await executeCommand(trimmed);
    rl.prompt();

  } else {
    if (simulate) {
      console.log(chalk.bgGreen.black.bold(` ✅ SAFE (Score: ${analysis.score}/100) `));
      rl.prompt();
      return;
    }
    logAction('EXECUTE_SAFE', trimmed, analysis.score);
    await executeCommand(trimmed);
    rl.prompt();
  }
}

// ── Shell entry point ────────────────────────────────────────

function startShell(simulateCommand = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  if (simulateCommand) {
    console.log(chalk.blue(`\n=== Guardian Simulation: "${simulateCommand}" ===\n`));
    handleCommand(simulateCommand, rl, true).then(() => {
      rl.close();
      process.exit(0);
    });
    return;
  }

  console.log(chalk.green('════════════════════════════════════════════'));
  console.log(chalk.green.bold('  🛡️  Guardian Shell Active — Type help'));
  console.log(chalk.green('════════════════════════════════════════════\n'));

  function updatePrompt() {
    const config = loadConfig();
    const mode = config.safeMode ? chalk.bgGreen.black(' SAFE ') : '';
    rl.setPrompt(chalk.cyan(`guardian ${mode}❯ `));
  }

  updatePrompt();
  rl.prompt();

  rl.on('line', async (line) => {
    rl.pause();
    await handleCommand(line, rl);
    updatePrompt();
    rl.resume();
  });

  rl.on('close', () => {
    console.log(chalk.green('\nGuardian Shell closed.'));
    process.exit(0);
  });
}

module.exports = { startShell };