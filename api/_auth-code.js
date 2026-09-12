import {scheduleDirectorySync} from './_slack-directory.js';
import {queueCodeRequest,pollCodeRequest} from './_slack-code-queue.js';
import {jsonResponse,readJsonBody} from './_auth.js';
import {slackLoginEnabled,startChallenge} from './_slack-auth.js';
function respond(res,result) {
  if(result.pending) return jsonResponse(res,202,result,{'Retry-After':String(result.retryAfter)});
  if(result.error) return jsonResponse(res,result.status,{error:result.error});
  if(result.status===429) return jsonResponse(res,429,{error:'Забагато запитів коду. Зачекайте перед новою спробою.'},{'Retry-After':String(result.retryAfter)});
  return jsonResponse(res,200,{challengeId:result.id,expiresIn:result.expiresIn,message:'Якщо логін активний, код надіслано в особисті повідомлення Slack.'});
}
export default async function handler(req,res) {
  if(req.method!=='POST') return jsonResponse(res,405,{error:'Method not allowed'});
  if(!slackLoginEnabled()) return jsonResponse(res,503,{error:'Корпоративний вхід ще не підключено.'});
  try {
    const body=await readJsonBody(req);
    if(body.action==='poll') return respond(res,await pollCodeRequest(body.requestId));
    const login=String(body.login||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{2,80}$/.test(login)) return jsonResponse(res,400,{error:'Перевірте робочий логін.'});
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    let result;
    try { result=await startChallenge(login,ip); }
    catch(error) {
      if(error.code!=='SLACK_DIRECTORY_PENDING' && !error.retryAfter) throw error;
      if(error.code==='SLACK_DIRECTORY_PENDING') scheduleDirectorySync({force:true});
      return respond(res,await queueCodeRequest(login,ip,{retryAfter:error.retryAfter || 5}));
    }
    if(result.reason==='cooldown') return respond(res,await queueCodeRequest(login,ip,{retryAfter:result.retryAfter}));
    scheduleDirectorySync();return respond(res,result);
  } catch(error) {
    if(error.code === 'SLACK_CONNECTION_REQUIRED') return jsonResponse(res,409,{error:process.env.SLACK_SIGNING_SECRET
      ? 'Для першого входу виконайте /zp у Slack, дочекайтеся підтвердження й повторіть запит коду тут.'
      : 'Одноразове підключення Slack ще налаштовується. Зверніться до адміністратора калькулятора.'});
    jsonResponse(res,503,{error:'Не вдалося надіслати код. Спробуйте пізніше.'});
  }
}
