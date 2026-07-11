import { escapeHtml } from "./safe-html.js";

export function reportHtml(rows, title) {
  return `
    <div class="report-header">
      <span>Звіт</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="report-table">
      ${rows.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

export function buildTextReport(result, config, options) {
  const totalGrossLabel = options.isGross
    ? "Разом з податком (ЗП + стаж)"
    : "Орієнтовно з податком";
  const paymentLines = options.hasReliablePaymentSchedule
    ? [
        `15 число: ${options.formatCurrency(result.paymentSchedule.midMonthPay)}`,
        `31 число: ${options.formatCurrency(result.paymentSchedule.monthEndPay)}`,
        `07 число: ${options.formatCurrency(result.paymentSchedule.nextMonthRatingPay)}`,
        `9/10 число стаж: ${options.formatCurrency(result.paymentSchedule.tenurePay)}`
      ]
    : ["Виплати по датах: у донавчанні"];

  return [
    `${config.title}, ${result.input.month}`,
    `Загальна сума до виплати: ${options.formatCurrency(result.totalPay)}`,
    `ЗП: ${options.formatCurrency(result.basePay)}`,
    `Стаж: ${options.formatCurrency(result.tenurePay)}`,
    `Податки: ${options.formatCurrency(result.tax)}`,
    `${totalGrossLabel}: ${options.formatCurrency(result.totalGross)}`,
    ...paymentLines,
    `Середня ЗП за день: ${options.formatCurrency(result.absencePayments.averageDailyPay)}`,
    `Відпустка/лікарняні/декретні: ${options.formatCurrency(result.absencePayments.total)}`,
    `Години: ${options.roundMoney(result.effectiveHours)} / норма ${result.normHours}`,
    `Рейтинг: зона ${result.input.ratingZone}, ${options.formatCurrency(result.ratingBonus)}`,
    `Рівень: ${options.levelLabel(result.input.level)}, ${options.formatCurrency(result.levelBonus)}`
  ].join("\n");
}
