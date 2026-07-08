const RULES_KEY = "zp:payment-rules";
const memoryRules = globalThis.__payrollPaymentRules ?? {};
globalThis.__payrollPaymentRules = memoryRules;

export async function getPaymentRules() {
  if (!hasRedis()) return { ...memoryRules };

  try {
    const response = await redis(["GET", RULES_KEY]);
    return response.result ? JSON.parse(response.result) : {};
  } catch {
    return { ...memoryRules };
  }
}

export async function savePaymentRule(calculator, month, rule) {
  const rules = await getPaymentRules();
  const safeCalculator = cleanKey(calculator);
  const safeMonth = cleanKey(month);
  rules[safeCalculator] = {
    ...(rules[safeCalculator] ?? {}),
    [safeMonth]: normalizeRule(rule)
  };
  Object.assign(memoryRules, rules);

  if (hasRedis()) {
    await redis(["SET", RULES_KEY, JSON.stringify(rules)]).catch(() => {});
  }
  return rules;
}

export async function deletePaymentRule(calculator, month) {
  const rules = await getPaymentRules();
  if (rules[calculator]) {
    delete rules[calculator][month];
    if (Object.keys(rules[calculator]).length === 0) delete rules[calculator];
  }

  Object.keys(memoryRules).forEach((key) => delete memoryRules[key]);
  Object.assign(memoryRules, rules);

  if (hasRedis()) {
    await redis(["SET", RULES_KEY, JSON.stringify(rules)]).catch(() => {});
  }
  return rules;
}

function normalizeRule(rule) {
  return {
    firstHalfAmount: toMoney(rule.firstHalfAmount),
    firstHalfHours: toHours(rule.firstHalfHours),
    secondHalfAmount: toMoney(rule.secondHalfAmount),
    secondHalfHours: toHours(rule.secondHalfHours),
    nextMonthAmount: toOptionalMoney(rule.nextMonthAmount),
    tenureAmount: toOptionalMoney(rule.tenureAmount),
    tenureHours: toOptionalHours(rule.tenureHours),
    note: String(rule.note || "").slice(0, 160)
  };
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command])
  });
  if (!response.ok) throw new Error("Redis request failed");
  return (await response.json())[0];
}

function cleanKey(value) {
  return String(value || "").slice(0, 40);
}

function toMoney(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function toOptionalMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  return toMoney(value);
}

function toHours(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function toOptionalHours(value) {
  if (value === "" || value === null || value === undefined) return null;
  return toHours(value);
}
