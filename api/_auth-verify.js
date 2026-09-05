import {createSessionCookie,jsonResponse,readJsonBody} from './_auth.js';
import {finishChallenge,slackLoginEnabled} from './_slack-auth.js';
import {getPayrollPayloadForRole,getSessionForRole} from './_payroll-data.js';
export default async function handler(req,res) {
  if(req.method!=='POST') return jsonResponse(res,405,{error:'Method not allowed'});
  if(!slackLoginEnabled()) return jsonResponse(res,503,{error:'Корпоративний вхід ще не підключено.'});
  try {
    const body=await readJsonBody(req);
    const identity=await finishChallenge(String(body.challengeId||''),String(body.code||''));
    if(!identity) return jsonResponse(res,401,{error:'Код недійсний або термін його дії минув.'});
    jsonResponse(res,200,{authenticated:true,session:{...getSessionForRole(identity.role),subject:identity.sub,label:identity.displayName},payroll:getPayrollPayloadForRole(identity.role)}, {'Set-Cookie':await createSessionCookie(identity.role,identity)});
  } catch { jsonResponse(res,503,{error:'Не вдалося завершити вхід. Спробуйте ще раз.'}); }
}
