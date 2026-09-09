export async function slack(method, body = {}) {
  const json = method === 'chat.postMessage';
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': json ? 'application/json; charset=utf-8' : 'application/x-www-form-urlencoded'},
    body: json ? JSON.stringify(body) : new URLSearchParams(body),
    signal: AbortSignal.timeout(7000)
  });
  const result = await response.json();
  if (response.ok && method === 'users.lookupByEmail' && result.error === 'users_not_found') return {user:null};
  if (!response.ok || !result.ok) throw new Error('Slack request failed');
  return result;
}
