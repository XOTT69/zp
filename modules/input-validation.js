export function parseHours(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: 0 };
  const time = /^(\d{1,3}):(\d{2})$/.exec(text);
  if (time) {
    if (Number(time[2]) >= 60) return { error: 'Хвилини мають бути від 00 до 59.' };
    const value = Number(time[1]) + Number(time[2]) / 60;
    return value <= 744 ? { value } : { error: 'У місяці не може бути більше 744 годин.' };
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return { error: 'Введіть години як 8,5 або 8:30.' };
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || value > 744) return { error: 'Години мають бути від 0 до 744.' };
  const ambiguous = /^(\d+)[.,]([0-5]\d)$/.exec(text);
  return { value, ...(ambiguous ? { suggestion: Number(ambiguous[1]) + Number(ambiguous[2]) / 60, hint: `${text} — десяткові години. Для ${ambiguous[1]} год ${ambiguous[2]} хв введіть ${ambiguous[1]}:${ambiguous[2]}.` } : {}) };
}

export function validatePayrollInputs(input) {
  const errors = {};
  for (const field of ['actualHours', 'nightHours', 'holidayHours', 'doubleHours', 'tenureHours', 'firstHalfHours', 'secondHalfHours']) {
    const result = parseHours(input[field]);
    if (result.error) errors[field] = result.error;
  }
  const worked = parseHours(input.actualHours).value;
  for (const field of ['nightHours', 'holidayHours', 'doubleHours']) {
    if (parseHours(input[field]).value > worked) errors[field] = 'Не може бути більше фактично відпрацьованих годин.';
  }
  for (const field of ['fines', 'taxiAmount', 'wowCases', 'tenureYears']) {
    const value = Number(String(input[field] ?? 0).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) errors[field] = 'Введіть невід’ємне число.';
  }
  if (!Number.isInteger(Number(input.tenureYears)) || Number(input.tenureYears) > 15) errors.tenureYears = 'Стаж — ціле число від 0 до 15 років.';
  return errors;
}
