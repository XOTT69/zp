const RULES_KEY = "zp:payment-rules";
const ALLOWED_CALCULATORS = new Set(["service", "iron"]);
const ALLOWED_MONTHS = new Set(["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"]);
const memoryRules = globalThis.__payrollPaymentRules ?? {};
globalThis.__payrollPaymentRules = memoryRules;

export async function getPaymentRules() {
  if (!hasRedis()) return { ...memoryRules };

  try {
    const response = await redis(["GET", RULES_KEY]);
    return response.result ? JSON.parse(response.result) : {};
  } catch {
    throw new Error("Сховище правил виплат недоступне.");
  }
}

export async function savePaymentRule(calculator, month, rule) {
  if (process.env.NODE_ENV === "production" && !hasRedis()) throw new Error("Для збереження потрібне постійне сховище Redis.");
  const rules = await getPaymentRules();
  const safeCalculator = cleanKey(calculator);
  const safeMonth = cleanKey(month);
  validateRuleKey(safeCalculator, safeMonth);
  rules[safeCalculator] = {
    ...(rules[safeCalculator] ?? {}),
    [safeMonth]: normalizeRule(rule)
  };
  if (hasRedis()) {
    await redis(["SET", RULES_KEY, JSON.stringify(rules)]);
  }
  replaceMemoryRules(rules);
  return rules;
}

export async function deletePaymentRule(calculator, month) {
  validateRuleKey(calculator, month);
  if (process.env.NODE_ENV === "production" && !hasRedis()) throw new Error("Для збереження потрібне постійне сховище Redis.");
  const rules = await getPaymentRules();
  if (rules[calculator]) {
    delete rules[calculator][month];
    if (Object.keys(rules[calculator]).length === 0) delete rules[calculator];
  }

  if (hasRedis()) {
    await redis(["SET", RULES_KEY, JSON.stringify(rules)]);
  }
  replaceMemoryRules(rules);
  return rules;
}

function replaceMemoryRules(rules) {
  Object.keys(memoryRules).forEach((key) => delete memoryRules[key]);
  Object.assign(memoryRules, rules);
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
  const result = (await response.json())[0];
  if (!result || result.error) throw new Error("Redis command failed");
  return result;
}

function cleanKey(value) {
  return String(value || "").slice(0, 40);
}

function validateRuleKey(calculator, month) {
  if (!ALLOWED_CALCULATORS.has(calculator)) throw new Error("Невідомий калькулятор правила виплат.");
  if (!ALLOWED_MONTHS.has(month)) throw new Error("Невідомий місяць правила виплат.");
}

function toMoney(value) {
  return boundedNumber(value, 0, 100_000_000, "Сума");
}

function toOptionalMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  return toMoney(value);
}

function toHours(value) {
  return boundedNumber(value, 0, 400, "Години");
}

function toOptionalHours(value) {
  if (value === "" || value === null || value === undefined) return null;
  return toHours(value);
}

function boundedNumber(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} має бути числом від ${min} до ${max}.`);
  }
  return Math.round(number * 100) / 100;
}
