export async function fetchSession() {
  return requestJson("/api/session", { credentials: "same-origin" });
}

export async function loginWithCode(role, code) {
  return requestJson("/api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, code })
  });
}

export async function endSession() {
  const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  if (!response.ok) throw new Error('Не вдалося завершити сесію на сервері.');
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}
