function pause(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted) return reject(new DOMException('Cancelled','AbortError'));
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
// Polling uses a server ticket; it never replays the initial send-code request.
export async function requestSlackCode(login,{request=fetch,wait=pause,signal,onPending=()=>{}}={}) {
  let body={action:'request',login};
  for(let polls=0;polls<240;polls++) {
    if(signal?.aborted) throw new DOMException('Cancelled','AbortError');
    const response=await request('/api/corporate-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Не вдалося отримати код.');
    if(!data.pending) {
      if(!data.challengeId) throw new Error('Не вдалося отримати код.');
      return data;
    }
    if(!/^[a-f0-9]{48}$/.test(data.requestId || '')) throw new Error('Не вдалося продовжити запит.');
    onPending(data.message);
    body={action:'poll',requestId:data.requestId};
    await wait(Math.min(180,Math.max(3,Number(data.retryAfter)||5))*1000,signal);
  }
  throw new Error('Пошук зайняв надто багато часу. Перевірте LDAP.');
}
