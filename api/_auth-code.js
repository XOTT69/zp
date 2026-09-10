import {scheduleDirectorySync} from './_slack-directory.js';
import {jsonResponse,readJsonBody} from './_auth.js';
import {slackLoginEnabled,startChallenge} from './_slack-auth.js';
export default async function handler(req,res) {
  if(req.method!=='POST') return jsonResponse(res,405,{error:'Method not allowed'});
  if(!slackLoginEnabled()) return jsonResponse(res,503,{error:'Корпоративний вхід ще не підключено.'});
  try {
    const {login:raw}=await readJsonBody(req);
    const login=String(raw||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{2,80}$/.test(login)) return jsonResponse(res,400,{error:'Перевірте робочий логін.'});
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const result=await startChallenge(login,ip);
    scheduleDirectorySync();
    if(result.status===429) return jsonResponse(res,429,{error:'Зачекайте перед новою спробою.'},{'Retry-After':String(result.retryAfter)});
    jsonResponse(res,200,{challengeId:result.id,expiresIn:result.expiresIn,message:'Якщо логін активний і пов’язаний зі Slack, код надіслано в особисті повідомлення.'});
  } catch(error) {
    if(error.code === 'SLACK_DIRECTORY_PENDING') {
      scheduleDirectorySync({force:true});
      return jsonResponse(res,503,{error:'Оновлюємо довідник Slack для автоматичного пошуку LDAP. Спробуйте отримати код через кілька хвилин.'},{'Retry-After':'60'});
    }
    if(error.code === 'SLACK_CONNECTION_REQUIRED') return jsonResponse(res,409,{error:process.env.SLACK_SIGNING_SECRET
      ? 'Для першого входу виконайте /zp у Slack, дочекайтеся підтвердження й повторіть запит коду тут.'
      : 'Одноразове підключення Slack ще налаштовується. Зверніться до адміністратора калькулятора.'});
    jsonResponse(res,503,{error:'Не вдалося надіслати код. Спробуйте пізніше.'});
  }
}
