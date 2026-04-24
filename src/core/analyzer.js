'use strict';

const os = require('os');
const { execSync } = require('child_process');

// ✅ Safe cwd validation — blocks null bytes, traversal, encoded chars
function isSafeCwd(cwd) {
  if (typeof cwd !== 'string' || cwd.length > 512) return false;
  const normalized = cwd.normalize('NFC');
  const UNSAFE = [
    /\0/,
    /[;&|`$(){}<>'"]/,
    /\.\.\//,
    /\\x[0-9a-fA-F]{2}/,
    /\\u[0-9a-fA-F]{4}/,
    /%[0-9a-fA-F]{2}/,
    /[\u0080-\u009F]/,
    /[\u200B-\u200D\uFEFF]/,
    /[\u2028\u2029]/,
  ];
  return !UNSAFE.some(p => p.test(normalized));
}

function safeExec(cmd) {
  const cwd = process.cwd();
  if (!isSafeCwd(cwd)) throw new Error(`Unsafe cwd: ${cwd}`);
  return execSync(cmd, { stdio: 'pipe', cwd, timeout: 3000 }).toString().trim();
}

class Analyzer {
  constructor() {
    this.history = [];
  }

  getGitContext() {
    try {
      const isGit = safeExec('git rev-parse --is-inside-work-tree');
      if (isGit === 'true') {
        const branch = safeExec('git branch --show-current');
        return { isGitRepo: true, branch };
      }
    } catch (_) {}
    return { isGitRepo: false, branch: null };
  }

  getDockerContext() {
    try {
      const containers = safeExec('docker ps -q').split('\n').filter(Boolean).length;
      const volumes = safeExec('docker volume ls -q').split('\n').filter(Boolean).length;
      return { containers, volumes };
    } catch (_) {}
    return { containers: 0, volumes: 0 };
  }

  analyzeCommand(command) {
    const lowerCmd = command.toLowerCase().trim();
    const cwd = process.cwd();
    const osPlatform = os.platform();

    // Git & Docker context — cached per command, timeout protected
    const gitContext = this.getGitContext();
    const dockerContext = this.getDockerContext();

    let score = 0;
    let match = null;

    const dangerousPaths = ['/', '~', '/etc', '/home', 'C:\\Windows', 'C:\\', 'C:\\Users'];
    const isDangerousPath = dangerousPaths.some(p => cwd === p || lowerCmd.includes(p));
    const isRootOrSystem = cwd === '/' || cwd === 'C:\\Windows';

    // Windows: rm -rf is invalid
    if (osPlatform === 'win32' && lowerCmd.startsWith('rm -rf')) {
      return {
        level: 'warning', score: 60,
        match: 'Invalid command for PowerShell — use Remove-Item -Recurse -Force',
        context: { cwd, git: gitContext, docker: dockerContext, osPlatform }
      };
    }

    const justBuiltDocker = this.history.length > 0 &&
      this.history[this.history.length - 1].includes('docker build');

    // ── Scoring rules ──────────────────────────────────────────
    if (lowerCmd.includes('rm -rf') || lowerCmd.includes('remove-item -recurse -force') || lowerCmd.includes('del /s /q')) {
      if (isRootOrSystem || isDangerousPath) { score = 95; match = 'Recursive delete on critical system path'; }
      else if (lowerCmd.includes('./') || !lowerCmd.includes('/')) { score = 50; match = 'Recursive delete on local folder'; }
      else { score = 80; match = 'Recursive delete'; }

    } else if (lowerCmd.includes('git push --force') || lowerCmd.includes('git push -f')) {
      score = (gitContext.branch === 'main' || gitContext.branch === 'master') ? 90 : 45;
      match = score === 90 ? 'Force push to main/master branch' : 'Force push to feature branch';

    } else if (lowerCmd.includes('docker system prune')) {
      if (justBuiltDocker) { score = 85; match = 'Docker prune right after build'; }
      else if (dockerContext.volumes > 0) { score = 75; match = 'Docker prune with active volumes'; }
      else { score = 60; match = 'Docker full prune'; }

    } else if (lowerCmd.includes('chmod 777')) {
      score = 85; match = 'Granting full permissions globally';

    } else if (lowerCmd.includes('sudo') && !lowerCmd.includes('apt-get update')) {
      score = 40; match = 'Sudo usage detected';

    } else if (lowerCmd.includes('dd if=') && lowerCmd.includes('of=')) {
      score = 90; match = 'Direct disk write — can destroy data';

    } else if (lowerCmd.includes('mkfs')) {
      score = 95; match = 'Disk format command';

    } else if (lowerCmd.includes(':(){:|:&};:')) {
      score = 100; match = 'Fork bomb detected';

    } else if (lowerCmd.includes('> /dev/sd') || lowerCmd.includes('> /dev/hd')) {
      score = 95; match = 'Raw disk overwrite';

    } else if (lowerCmd.includes('wget') || lowerCmd.includes('curl')) {
      if (lowerCmd.includes('| sh') || lowerCmd.includes('| bash')) {
        score = 90; match = 'Remote script execution via pipe';
      } else {
        score = 20; match = 'Network download';
      }
    }

    // Track history (last 10 only)
    this.history.push(lowerCmd);
    if (this.history.length > 10) this.history.shift();

    const level = score >= 70 ? 'dangerous' : score >= 30 ? 'warning' : 'safe';

    return {
      level, score,
      match: match || 'No specific risk pattern matched',
      context: { cwd, git: gitContext, docker: dockerContext, osPlatform, isDangerousPath }
    };
  }
}

module.exports = new Analyzer();