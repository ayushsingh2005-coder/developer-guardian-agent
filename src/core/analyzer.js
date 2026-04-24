const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class Analyzer {
  constructor() {
    this.history = [];
  }

  getGitContext() {
    try {
      const isGit = execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' }).toString().trim();
      if (isGit === 'true') {
        const branch = execSync('git branch --show-current', { stdio: 'pipe' }).toString().trim();
        return { isGitRepo: true, branch };
      }
    } catch (e) {
      return { isGitRepo: false };
    }
    return { isGitRepo: false };
  }

  getDockerContext() {
    try {
      const containers = execSync('docker ps -q', { stdio: 'pipe' }).toString().trim().split('\n').filter(Boolean).length;
      const volumes = execSync('docker volume ls -q', { stdio: 'pipe' }).toString().trim().split('\n').filter(Boolean).length;
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

    // OS-Aware Invalid Commands
    if (osPlatform === 'win32' && lowerCmd.startsWith('rm -rf')) {
      return {
        level: 'warning',
        score: 60,
        match: "Invalid command for PowerShell",
        context: { cwd, git: gitContext, docker: dockerContext, osPlatform },
        osHint: "rm -rf is not natively valid in standard Windows CMD. Use Remove-Item -Recurse -Force in PowerShell."
      };
    }

    const justBuiltDocker = this.history.length > 0 && this.history[this.history.length - 1].includes('docker build');

    // Destructive File Operations
    if (
      lowerCmd.includes('rm -rf') || 
      lowerCmd.includes('remove-item -recurse -force') || 
      lowerCmd.includes('del /s /q')
    ) {
      if (isRootOrSystem || isDangerousPath) {
        score = 95;
        match = "Recursive delete on critical system path";
      } else if (lowerCmd.includes('./') || !lowerCmd.includes('/')) {
        score = 50; 
        match = "Recursive delete on local folder";
      } else {
        score = 80;
        match = "Recursive delete";
      }
    } 
    // Git Operations
    else if (lowerCmd.includes('git push --force') || lowerCmd.includes('git push -f')) {
      if (gitContext.branch === 'main' || gitContext.branch === 'master') {
        score = 90;
        match = "Force push to main branch";
      } else {
        score = 45;
        match = "Force push to branch";
      }
    } 
    // Docker Operations
    else if (lowerCmd.includes('docker system prune -a')) {
      if (justBuiltDocker) {
        score = 85;
        match = "Docker full prune immediately after build";
      } else if (dockerContext.volumes > 0) {
        score = 75;
        match = "Docker full prune with active volumes";
      } else {
        score = 60;
        match = "Docker full prune";
      }
    } 
    // Permissions
    else if (lowerCmd.includes('chmod 777') || lowerCmd.includes('chmod -r 777')) {
      score = 85;
      match = "Granting full permissions globally";
    } 
    else if (lowerCmd.includes('sudo ') && !lowerCmd.includes('apt-get update')) {
      score = 40;
      match = "Sudo usage detected";
    }

    this.history.push(lowerCmd);
    if (this.history.length > 10) this.history.shift();

    let level = 'safe';
    if (score >= 70) level = 'dangerous';
    else if (score >= 30) level = 'warning';

    return {
      level,
      score,
      match: match || "no specific pattern",
      context: {
        cwd,
        git: gitContext,
        docker: dockerContext,
        osPlatform,
        isDangerousPath
      }
    };
  }
}

module.exports = new Analyzer();
