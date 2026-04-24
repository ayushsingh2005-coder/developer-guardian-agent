const readline = require('readline');
const { spawn } = require('child_process');
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

// ✅ FIX 6.1: Command length limit
const MAX_COMMAND_LENGTH = 2048;

let rl;
let config = loadConfig();

// ✅ FIX 2.1: Whitelisted navigation roots
const ALLOWED_ROOTS = [
  HOME_DIR,
  path.join(HOME_DIR, 'Desktop'),
  path.join(HOME_DIR, 'Documents'),
  path.join(HOME_DIR, 'Downloads'),
  path.join(HOME_DIR, 'Projects'),
  process.cwd()
];

function isSafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some(root => resolved.startsWith(root));
}

// ✅ FIX 1.1: Expanded BLOCKED_PATTERNS — covers bypasses, encoded chars, hex, octal
const BLOCKED_PATTERNS = [
  /[;&|`$(){}<>]/,                        // shell metacharacters
  /\$\(/,                                  // command substitution
  /`[^`]*`/,                               // backtick execution
  />\s*\/etc\//,                           // redirect to system paths
  />\s*~\//,                               // redirect to home
  /curl\s+.*\|\s*(ba)?sh/i,               // curl pipe shell
  /wget\s+.*\|\s*(ba)?sh/i,               // wget pipe shell
  /eval\s*[\s(]/i,                         // eval()
  /base64\s*(--decode|-d)/i,              // base64 decode
  /\$\{.*\}/,                              // variable expansion
  /\\x[0-9a-fA-F]{2}/,                    // hex encoded chars
  /\\u[0-9a-fA-F]{4}/,                    // unicode escape sequences
  /%[0-9a-fA-F]{2}/,                      // URL encoded chars
  /\$'\\.*/,                               // ANSI-C quoting bypass
  /\/dev\/(tcp|udp)\//i,                  // reverse shell via /dev/tcp
  /nc\s+-.*-e/i,                           // netcat reverse shell
  /python.*-c\s+['"]import/i,             // python reverse shell
  /bash\s+-i\s+>&/i,                       // bash reverse shell
  /0\.0\.0\.0|127\.0\.0\.1/,              // localhost binding
  /proc\/self\/environ/i,                  // proc environ access
  /\.\.\/\.\.\/\.\.\//,                   // deep path traversal
];

function isSafeCommand(command) {
  // ✅ FIX 6.1: Reject oversized commands
  if (command.length > MAX_COMMAND_LENGTH) {
    console.error(chalk.red(`Command too long (${command.length} chars). Max: ${MAX_COMMAND_LENGTH}`));
    return false;
  }
  return !BLOCKED_PATTERNS.some(pattern => pattern.test(command));
}

function updatePrompt() {
  const modeText = config.safeMode ? chalk.bgGreen.black(' [SAFE MODE] ') : '';
  rl.setPrompt(chalk.cyan(`guardian-shell${modeText}> `));
}

async function executeCommand(command) {
  return new Promise((resolve) => {

    // ✅ FIX 2.1: Safe cd with path validation
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      const resolved = path.resolve(dir);

      if (!isSafePath(resolved)) {
        console.error(chalk.red(`cd: Access denied — cannot navigate to ${resolved}`));
        resolve(1);
        return;
      }

      try {
        process.chdir(resolved);
        console.log(chalk.gray(`cwd: ${process.cwd()}`));
      } catch (err) {
        console.error(chalk.red(`cd: ${err.message}`));
      }
      resolve(0);
      return;
    }

    // ✅ FIX 1.1: Block dangerous patterns
    if (!isSafeCommand(command)) {
      console.error(chalk.bgRed.white.bold('\n 🚨 BLOCKED — Dangerous pattern detected 🚨 \n'));
      logAction('BLOCKED_INJECTION', command, 100);
      resolve(1);
      return;
    }

    const args = isWindows
      ? ['-NoProfile', '-NonInteractive', '-Command', command]
      : ['-c', command];

    const child = spawn(shellCmd, args, {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd()
    });

    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      console.error(chalk.red(`Execution error: ${err.message}`));
      resolve(1);
    });
  });
}

// ✅ FIX 6.2: Rate limiting — max 30 commands per minute
const RATE_LIMIT = { max: 30, windowMs: 60000 };
let commandTimestamps = [];

function isRateLimited() {
  const now = Date.now();
  commandTimestamps = commandTimestamps.filter(t => now - t < RATE_LIMIT.windowMs);
  if (commandTimestamps.length >= RATE_LIMIT.max) {
    console.error(chalk.bgRed.white(`\n 🚨 RATE LIMIT EXCEEDED — ${RATE_LIMIT.max} commands/min max \n`));
    logAction('RATE_LIMITED', `${commandTimestamps.length} commands in window`, 50);
    return true;
  }
  commandTimestamps.push(now);
  return false;
}

async function handleCommand(command, simulate = false) {
  const trimmed = command.trim();
  if (!trimmed) {
    if (rl) rl.prompt();
    return;
  }

  if (trimmed === 'exit' || trimmed === 'quit') {
    console.log(chalk.green('Exiting Guardian Shell.'));
    process.exit(0);
  }

  // ✅ FIX 6.2: Check rate limit before processing
  if (!simulate && isRateLimited()) {
    if (rl) rl.prompt();
    return;
  }

  const analysis = analyzer.analyzeCommand(trimmed);

  if (config.trustedCommands.includes(trimmed)) {
    console.log(chalk.gray('[Trusted Command]'));
    logAction('EXECUTE_TRUSTED', trimmed, analysis.score);
    if (!simulate) await executeCommand(trimmed);
    if (rl) rl.prompt();
    return;
  }

  if (analysis.level === 'dangerous') {
    if (config.safeMode && !simulate) {
      console.log(chalk.bgRed.white.bold('\n 🚨 BLOCKED BY SAFE MODE 🚨 \n'));
      console.log(chalk.red(`Score: ${analysis.score}/100 | Rule: ${analysis.match}`));
      logAction('BLOCKED_SAFE_MODE', trimmed, analysis.score, analysis.context);
      if (rl) rl.prompt();
      return;
    }

    const explanation = await getExplanation(trimmed, analysis.context, analysis.score);
    printAnalysis(analysis, explanation);

    if (simulate) {
      console.log(chalk.blue('\n[Dry Run] Command would be BLOCKED pending confirmation.'));
      if (rl) rl.prompt();
      return;
    }

    logAction('DANGER_PROMPT', trimmed, analysis.score, { ...analysis.context, ai: explanation });

    rl.question(chalk.bgRed.white.bold(' Are you absolutely sure? (y/N/trust) '), async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        logAction('BYPASS', trimmed, analysis.score);
        await executeCommand(trimmed);
      } else if (answer.toLowerCase() === 'trust') {
        config.trustedCommands.push(trimmed);
        saveConfig(config);
        logAction('TRUSTED', trimmed, analysis.score);
        await executeCommand(trimmed);
      } else {
        logAction('PREVENTED', trimmed, analysis.score);
        console.log(chalk.green('Command cancelled.'));
      }
      if (rl) rl.prompt();
    });

  } else if (analysis.level === 'warning') {
    const explanation = await getExplanation(trimmed, analysis.context, analysis.score);
    printAnalysis(analysis, explanation);

    if (simulate) {
      console.log(chalk.blue('\n[Dry Run] WARNING — would allow execution.'));
      if (rl) rl.prompt();
      return;
    }

    logAction('EXECUTE_WARNING', trimmed, analysis.score, { ...analysis.context, ai: explanation });
    await executeCommand(trimmed);
    if (rl) rl.prompt();
  } else {
    if (simulate) {
      console.log(chalk.bgGreen.black.bold(` ✅ SAFE (Score: ${analysis.score}/100) `));
      if (rl) rl.prompt();
      return;
    }
    logAction('EXECUTE_SAFE', trimmed, analysis.score, analysis.context);
    await executeCommand(trimmed);
    if (rl) rl.prompt();
  }
}

function startShell(simulateCommand = null) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (simulateCommand) {
    console.log(chalk.blue(`\n=== Guardian Simulation: ${simulateCommand} ===`));
    handleCommand(simulateCommand, true).then(() => process.exit(0));
    return;
  }

  console.log(chalk.green('================================================'));
  console.log(chalk.green.bold('🛡️  Developer Guardian Agent Shell Activated 🛡️'));
  console.log(chalk.green('================================================'));
  console.log(chalk.gray('All commands are monitored and analyzed in real-time.\n'));

  updatePrompt();
  rl.prompt();

  rl.on('line', async (line) => {
    rl.pause();
    await handleCommand(line);
    rl.resume();
  }).on('close', () => {
    console.log(chalk.green('\nGuardian Shell deactivated.'));
    process.exit(0);
  });
}

module.exports = { startShell };