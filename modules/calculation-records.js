export function createCalculationRecord({ type, inputs, result, payroll, version, name }) {
  return structuredClone({ schemaVersion: 2, id: crypto.randomUUID(), type, name,
    inputs, result, totalPay: result.totalPay, effectiveHourlyPay: result.effectiveHourlyPay,
    payroll, version, createdAt: new Date().toISOString() });
}

export function resolveRateVersion(settings, period) {
  const candidates = [...(settings.rateVersions || []), {
    version: settings.version, overrides: settings.overrides, templates: settings.templates
  }].filter(v => (v.version?.effectiveFrom || '2026-03-01') <= `${period}-01`);
  candidates.sort((a,b) => (a.version?.effectiveFrom || '2026-03-01').localeCompare(b.version?.effectiveFrom || '2026-03-01'));
  return candidates.at(-1) || null;
}
