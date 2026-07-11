import { escapeHtml } from "./safe-html.js";

export function adminStatsHtml(stats) {
  const counters = stats.counters ?? {};
  return [
    ["Успішні входи", counters.loginSuccess],
    ["Невдалі входи", counters.loginFailed],
    ["Перегляди", counters.views],
    ["Копії", counters.copies],
    ["PDF", counters.pdfs],
    ["Спроби входу", counters.loginAttempts]
  ].map(([label, value]) => `
    <article class="admin-stat">
      <span>${label}</span>
      <strong>${formatCount(value)}</strong>
    </article>
  `).join("");
}

export function adminRolesHtml(roles, calculators) {
  return Object.entries(roles).map(([key, role]) => {
    const allowed = role.allowedCalculators.map((calculator) => calculators[calculator]?.title ?? calculator).join(", ");
    const statusClass = role.configured ? "" : " is-warning";
    return `
      <article class="admin-row">
        <div>
          <strong>${escapeHtml(role.label)}</strong>
          <small>${escapeHtml(key)}${role.isAdmin ? " · повний доступ" : ""}</small>
        </div>
        <small>${escapeHtml(allowed || "Немає доступних калькуляторів")}</small>
        <span class="status-pill${statusClass}">${role.configured ? "env задано" : "env не задано"}</span>
      </article>
    `;
  }).join("");
}

export function adminRecentHtml(recent) {
  if (!recent?.length) return `<p class="empty-state">Подій ще немає.</p>`;
  return recent.map((event) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(eventLabel(event.type))}</strong>
        <small>${escapeHtml(formatDateTime(event.at))}</small>
      </div>
      <small>Роль: ${escapeHtml(event.role || "unknown")} · Розділ: ${escapeHtml(event.calculator || event.path || "login")}</small>
      <span class="status-pill">${event.success === false ? "відмова" : "ok"}</span>
    </article>
  `).join("");
}

export function adminPaymentRulesHtml(rules, formatCurrency, roundMoney) {
  const entries = Object.entries(rules ?? {}).flatMap(([calculator, byMonth]) =>
    Object.entries(byMonth).map(([month, rule]) => ({ calculator, month, rule }))
  );
  if (!entries.length) return `<p class="empty-state">Правил ще немає. Додайте факт виплат за місяць, щоб прогноз калібрувався автоматично.</p>`;
  return entries.map(({ calculator, month, rule }) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(calculator.toUpperCase())} · ${escapeHtml(month)}</strong>
        <small>${escapeHtml(rule.note || "Калібрування по фактичних виплатах")}</small>
      </div>
      <small>
        15: ${escapeHtml(formatCurrency(rule.firstHalfAmount))} / ${escapeHtml(roundMoney(rule.firstHalfHours))} год ·
        31: ${escapeHtml(formatCurrency(rule.secondHalfAmount))} / ${escapeHtml(roundMoney(rule.secondHalfHours))} год ·
        07: ${rule.nextMonthAmount === null ? "авто" : escapeHtml(formatCurrency(rule.nextMonthAmount))} ·
        стаж: ${rule.tenureAmount === null ? "авто" : escapeHtml(formatCurrency(rule.tenureAmount))}
      </small>
      <button class="ghost-button danger-button" type="button" data-delete-rule="${escapeHtml(`${calculator}:${month}`)}">Видалити</button>
    </article>
  `).join("");
}

export function settingsHistoryHtml(history) {
  if (!history?.length) return `<p class="empty-state">Історія з'явиться після першої зміни ставок або шаблонів.</p>`;
  return history.map((revision) => `
    <article class="admin-row">
      <div>
        <strong>${revision.action === "rollback" ? "Відкат налаштувань" : "Зміна налаштувань"}</strong>
        <small>${escapeHtml(formatDateTime(revision.at))}</small>
      </div>
      <small>${escapeHtml(revision.summary)}</small>
      <button class="ghost-button" type="button" data-rollback-settings="${escapeHtml(revision.id)}">Відновити</button>
    </article>
  `).join("");
}

function eventLabel(type) {
  return ({ login_success: "Вхід", login_failed: "Невдалий вхід", view: "Перегляд", copy: "Копія", pdf: "PDF" })[type] ?? type;
}

function formatCount(value) {
  return new Intl.NumberFormat("uk-UA").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(date);
}
