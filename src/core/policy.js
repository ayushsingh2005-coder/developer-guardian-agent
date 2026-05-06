const fs = require("fs");
const path = require("path");

const DEFAULT_POLICY = {
  safeMode: true,
  protectedBranches: [],
  productionKeywords: ["prod", "production"],
  blocked: [],
  warn: [],
};

function findPolicyFile() {
  const policyPath = path.resolve(process.cwd(), ".guardianrc");
  return fs.existsSync(policyPath) ? policyPath : null;
}

function cloneDefaultPolicy() {
  return {
    safeMode: DEFAULT_POLICY.safeMode,
    protectedBranches: [...DEFAULT_POLICY.protectedBranches],
    productionKeywords: [...DEFAULT_POLICY.productionKeywords],
    blocked: [...DEFAULT_POLICY.blocked],
    warn: [...DEFAULT_POLICY.warn],
  };
}

function hasUnsafeKey(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  return Object.keys(value).some((key) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return true;
    }

    return hasUnsafeKey(value[key], seen);
  });
}

function stringArrayOrDefault(value, fallback) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : [...fallback];
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== "object" || hasUnsafeKey(policy)) {
    return cloneDefaultPolicy();
  }

  return {
    safeMode: typeof policy.safeMode === "boolean" ? policy.safeMode : DEFAULT_POLICY.safeMode,
    protectedBranches: stringArrayOrDefault(
      policy.protectedBranches,
      DEFAULT_POLICY.protectedBranches
    ),
    productionKeywords: stringArrayOrDefault(
      policy.productionKeywords,
      DEFAULT_POLICY.productionKeywords
    ),
    blocked: stringArrayOrDefault(policy.blocked, DEFAULT_POLICY.blocked),
    warn: stringArrayOrDefault(policy.warn, DEFAULT_POLICY.warn),
  };
}

function loadPolicy() {
  const policyFile = findPolicyFile();

  if (!policyFile) {
    return cloneDefaultPolicy();
  }

  try {
    return validatePolicy(JSON.parse(fs.readFileSync(policyFile, "utf8")));
  } catch (_) {
    return cloneDefaultPolicy();
  }
}

module.exports = {
  DEFAULT_POLICY,
  findPolicyFile,
  loadPolicy,
  validatePolicy,
};
