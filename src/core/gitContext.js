const { execSync } = require("child_process");

function getCurrentBranch() {
  try {
    return execSync("git branch --show-current", { stdio: "pipe" }).toString().trim();
  } catch (_) {
    return null;
  }
}

module.exports = {
  getCurrentBranch,
};
