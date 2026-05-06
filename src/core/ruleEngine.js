const BUILT_IN_RULES = [
  {
    id: "git-push-force",
    pattern: "git push --force",
    score: 90,
    level: "dangerous",
    saferAlternative: "git push --force-with-lease",
    explanation: "Force pushing can overwrite remote commits.",
  },
  {
    id: "git-reset-hard",
    pattern: "git reset --hard",
    score: 85,
    level: "dangerous",
    saferAlternative: null,
    explanation: "Hard reset discards local changes.",
  },
  {
    id: "terraform-destroy",
    pattern: "terraform destroy",
    score: 95,
    level: "critical",
    saferAlternative: "terraform plan -destroy",
    explanation: "Terraform destroy removes managed infrastructure.",
  },
  {
    id: "rm-rf-root",
    pattern: "rm -rf /",
    score: 100,
    level: "critical",
    saferAlternative: null,
    explanation: "Recursive deletion from root can destroy the system.",
  },
];

const DANGEROUS_GIT_COMMANDS = ["git push --force", "git reset --hard", "git clean -fdx"];

function normalizeCommand(command) {
  return String(command || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function analyzeCommand(command, policy, context) {
  const normalized = normalizeCommand(command);
  const blockedRules = stringArray(policy && policy.blocked);
  const warnRules = stringArray(policy && policy.warn);
  const protectedBranches = stringArray(policy && policy.protectedBranches);
  const currentBranch = context && context.currentBranch;
  const matchedRule = BUILT_IN_RULES.find((rule) => normalized.includes(rule.pattern)) || null;
  const blockedByPolicy = blockedRules.some((pattern) => normalized.includes(normalizeCommand(pattern)));
  const warnedByPolicy = warnRules.some((pattern) => normalized.includes(normalizeCommand(pattern)));
  const protectedBranchMatch =
    typeof currentBranch === "string" &&
    protectedBranches.includes(currentBranch) &&
    DANGEROUS_GIT_COMMANDS.some((pattern) => normalized.includes(pattern));

  return {
    blocked: blockedByPolicy || protectedBranchMatch,
    warned: warnedByPolicy,
    score: protectedBranchMatch ? Math.max(matchedRule ? matchedRule.score : 0, 95) : matchedRule ? matchedRule.score : 0,
    matchedRule,
    saferAlternative: matchedRule ? matchedRule.saferAlternative : null,
    explanation: protectedBranchMatch
      ? `Protected branch detected: ${currentBranch}`
      : matchedRule
        ? matchedRule.explanation
        : null,
  };
}

module.exports = {
  BUILT_IN_RULES,
  analyzeCommand,
};
