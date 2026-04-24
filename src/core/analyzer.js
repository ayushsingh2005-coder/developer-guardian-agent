const os = require('os');
const { execSync } = require('child_process');

// ✅ FIX 1.2: Hardened isSafeCwd — blocks unicode, null bytes, encoded chars
function isSafeCwd(cwd) {
  if (typeof cwd !== 'string') return false;
  if (cwd.length > 512) return false;

  // Normalize unicode to catch homoglyph/encoded bypasses
  const normalized = cwd.normalize('NFC');

  const UNSAFE = [
    /\0/,                        // null bytes
    /[;&|`$(){}<>'"]/,           // shell metacharacters
    /\.\.\//,                    // path traversal
    /\\x[0-9a-fA-F]{2}/,        // hex escape
    /\\u[0-9a-fA-F]{4}/,        // unicode escape
    /%[0-9a-fA-F]{2}/,          // URL encoding
    /[\u0080-\u009F]/,           // C1 control characters
    /[\u200B-\u200D\uFEFF]/,     // zero-width chars (invisible bypass)
    /[\u2028\u2029]/,            // line/paragraph separator
  ];

  return !UNSAFE.some(p => p.test(normalized));
}

function safeExec(cmd) {
  const cwd = process.cwd();
  if (!isSafeCwd(cwd)) {
    throw new Error(`Unsafe cwd blocked: ${cwd}`);
  }
  return execSync(cmd, { stdio: 'pipe', cwd }).toString().trim();
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
    } catch (e) {
      return { isGitRepo: false };
    }
    return { isGitRepo: false };
  }

  getDockerContext() {
    try {
      const containers = safeExec('docker ps -q').split('\n').filter(Boolean).length;
      const volumes = safeExec('docker volume ls -q').split('\n').filter(Boolean).length;
      return { containers, volumes };
    } catch (e) {
      return { containers: 0, volumes: 0 };
    }
  }

  analyzeCommand(command) {
    const lowerCmd = command.toLowerCase().trim();
    const cwd = process.cwd();
    const osPlatform = os.platform();
    const gitContext = this.getGitContext();
    const dockerContext = this.getDockerContext();

    let score = 0;
    let match = null;

    const dangerousPaths = ['/', '~', '/etc', '/home', 'C:\\Windows', 'C:\\', 'C:\\Users'];
    const isDangerousPath = dangerousPaths.some(p => cwd === p || lowerCmd.includes(p));
    const isRootOrSystem = cwd === '/' || cwd === 'C:\\Windows';

    if (osPlatform === 'win32' && lowerCmd.startsWith('rm -rf')) {
      return {
        level: 'warning', score: 60,
        match: "Invalid command for PowerShell",
        context: { cwd, git: gitContext, docker: dockerContext, osPlatform },
        osHint: "Use Remove-Item -Recurse -Force in PowerShell."
      };
    }

    const justBuiltDocker = this.history.length > 0 &&
      this.history[this.history.length - 1].includes('docker build');

    if (lowerCmd.includes('rm -rf') || lowerCmd.includes('remove-item -recurse -force') || lowerCmd.includes('del /s /q')) {
      if (isRootOrSystem || isDangerousPath) { score = 95; match = "Recursive delete on critical system path"; }
      else if (lowerCmd.includes('./') || !lowerCmd.includes('/')) { score = 50; match = "Recursive delete on local folder"; }
      else { score = 80; match = "Recursive delete"; }
    } else if (lowerCmd.includes('git push --force') || lowerCmd.includes('git push -f')) {
      score = (gitContext.branch === 'main' || gitContext.branch === 'master') ? 90 : 45;
      match = score === 90 ? "Force push to main branch" : "Force push to branch";
    } else if (lowerCmd.includes('docker system prune -a')) {
      if (justBuiltDocker) { score = 85; match = "Docker prune after build"; }
      else if (dockerContext.volumes > 0) { score = 75; match = "Docker prune with active volumes"; }
      else { score = 60; match = "Docker full prune"; }
    } else if (lowerCmd.includes('chmod 777')) {
      score = 85; match = "Granting full permissions globally";
    } else if (lowerCmd.includes('sudo ') && !lowerCmd.includes('apt-get update')) {
      score = 40; match = "Sudo usage detected";
    }

    this.history.push(lowerCmd);
    if (this.history.length > 10) this.history.shift();

    let level = 'safe';
    if (score >= 70) level = 'dangerous';
    else if (score >= 30) level = 'warning';

    return {
      level, score,
      match: match || "no specific pattern",
      context: { cwd, git: gitContext, docker: dockerContext, osPlatform, isDangerousPath }
    };
  }
}

module.exports = new Analyzer();