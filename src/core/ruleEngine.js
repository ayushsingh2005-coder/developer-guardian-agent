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

function normalizeCommand(command) {
  return String(command || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function analyzeCommand(command, policy) {
  const normalized = normalizeCommand(command);
  const blockedRules = stringArray(policy && policy.blocked);
  const warnRules = stringArray(policy && policy.warn);
  const matchedRule = BUILT_IN_RULES.find((rule) => normalized.includes(rule.pattern)) || null;

  return {
    blocked: blockedRules.some((pattern) => normalized.includes(normalizeCommand(pattern))),
    warned: warnRules.some((pattern) => normalized.includes(normalizeCommand(pattern))),
    score: matchedRule ? matchedRule.score : 0,
    matchedRule,
    saferAlternative: matchedRule ? matchedRule.saferAlternative : null,
    explanation: matchedRule ? matchedRule.explanation : null,
  };
}

module.exports = {
  BUILT_IN_RULES,
  analyzeCommand,
};
