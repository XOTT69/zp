export function hasRedis() { return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN); }
export async function redis(commands) {
  if (!hasRedis()) throw new Error('Persistent storage is not configured');
  const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/,'')}/pipeline`, {
    method:'POST', headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify(commands), signal:AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error('Persistent storage unavailable');
  const results = await response.json();
  if (!Array.isArray(results) || results.length !== commands.length || results.some(r=>r.error)) throw new Error('Persistent storage rejected command');
  return results.map(r=>r.result);
}
