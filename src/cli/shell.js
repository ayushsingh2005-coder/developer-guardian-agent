const readline = require('readline');
const { spawn } = require('child_process');
const os = require('os');
const chalk = require('chalk');
const analyzer = require('../core/analyzer');
const { getExplanation } = require('../core/llm');
const { logAction } = require('../core/logger');
const { loadConfig, saveConfig } = require('../core/config');
const { printAnalysis } = require('./formatter');

const isWindows = os.platform() === 'win32';
const shellCmd = isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
let rl;
let config = loadConfig();

function updatePrompt() {
  const modeText = config.safeMode ? chalk.bgGreen.black(' [SAFE MODE] ') : '';
  rl.setPrompt(chalk.cyan(`guardian-shell${modeText}> `));
}

async function executeCommand(command) {
  return new Promise((resolve) => {
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      try {
        process.chdir(dir);
      } catch (err) {
        console.error(chalk.red(`cd: ${err.message}`));
      }
      resolve(0);
      return;
    }

    const args = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];
    const child = spawn(shellCmd, args, { stdio: 'inherit', env: process.env, cwd: process.cwd() });
    
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      console.error(chalk.red(`Execution error: ${err.message}`));
      resolve(1);
    });
  });
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

  const analysis = analyzer.analyzeCommand(trimmed);

  // Learning mode check
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
      console.log(chalk.red(`Score: ${analysis.score}/100 | Rule Matched: ${analysis.match}`));
      logAction('BLOCKED_SAFE_MODE', trimmed, analysis.score, analysis.context);
      if (rl) rl.prompt();
      return;
    }

    const explanation = await getExplanation(trimmed, analysis.context, analysis.score);
    printAnalysis(analysis, explanation);
    
    if (simulate) {
      console.log(chalk.blue('\n[Dry Run Simulation] The command would have been BLOCKED here pending user confirmation.'));
      if (rl) rl.prompt();
      return;
    }

    logAction('DANGER_PROMPT', trimmed, analysis.score, { ...analysis.context, ai: explanation });
    
    rl.question(chalk.bgRed.white.bold(' Are you absolutely sure you want to execute this? (y/N/trust) '), async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        logAction('BYPASS', trimmed, analysis.score);
        console.log(chalk.red('Executing dangerous command...'));
        await executeCommand(trimmed);
      } else if (answer.toLowerCase() === 'trust') {
        config.trustedCommands.push(trimmed);
        saveConfig(config);
        logAction('TRUSTED', trimmed, analysis.score);
        console.log(chalk.green(`Command added to trusted list.`));
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
      console.log(chalk.blue('\n[Dry Run Simulation] The command would have triggered a WARNING but allowed execution.'));
      if (rl) rl.prompt();
      return;
    }

    logAction('EXECUTE_WARNING', trimmed, analysis.score, { ...analysis.context, ai: explanation });
    await executeCommand(trimmed);
    if (rl) rl.prompt();
  } else {
    if (simulate) {
      console.log(chalk.bgGreen.black.bold(` ✅ SAFE (Score: ${analysis.score}/100) `));
      console.log(chalk.green('\n[Dry Run Simulation] Command is SAFE and would execute normally.'));
      if (rl) rl.prompt();
      return;
    }
    logAction('EXECUTE_SAFE', trimmed, analysis.score, analysis.context);
    await executeCommand(trimmed);
    if (rl) rl.prompt();
  }
}

function startShell(simulateCommand = null) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (simulateCommand) {
    console.log(chalk.blue(`\n=== Guardian Simulation ===`));
    console.log(chalk.blue(`Simulating command: ${simulateCommand}`));
    handleCommand(simulateCommand, true).then(() => {
      process.exit(0);
    });
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
