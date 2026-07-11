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
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // The client still clears its local session state when the network is unavailable.
  }
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
