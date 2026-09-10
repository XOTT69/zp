import {jsonResponse,readJsonBody} from './_auth.js';
import {slackLoginEnabled,startChallenge} from './_slack-auth.js';
export default async function handler(req,res) {
  if(req.method!=='POST') return jsonResponse(res,405,{error:'Method not allowed'});
  if(!slackLoginEnabled()) return jsonResponse(res,503,{error:'Корпоративний вхід ще не підключено.'});
  try {
    const {login:raw,slackUserId:rawId}=await readJsonBody(req);
    const login=String(raw||'').trim().toLowerCase();
    const slackUserId=String(rawId||'').trim().toUpperCase();
    if(!/^[a-z0-9._-]{2,80}$/.test(login)) return jsonResponse(res,400,{error:'Перевірте робочий логін.'});
    if(slackUserId && !/^[UW][A-Z0-9]{2,79}$/.test(slackUserId)) return jsonResponse(res,400,{error:'Вставте Slack Member ID, що починається з U або W.'});
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const result=await startChallenge(login,ip,{slackUserId:slackUserId || undefined});
    if(result.status===429) return jsonResponse(res,429,{error:'Зачекайте перед новою спробою.'},{'Retry-After':String(result.retryAfter)});
    jsonResponse(res,200,{challengeId:result.id,expiresIn:result.expiresIn,message:'Якщо логін активний і пов’язаний зі Slack, код надіслано в особисті повідомлення.'});
  } catch(error) {
    if(error.code === 'SLACK_ID_REQUIRED') return jsonResponse(res,409,{needsSlackId:true,error:'Для першого входу додайте свій Slack Member ID. Профіль Slack → ⋯ → Copy member ID.'});
    jsonResponse(res,503,{error:'Не вдалося надіслати код. Спробуйте пізніше.'});
  }
}
