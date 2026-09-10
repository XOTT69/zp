import {directoryEnabled,authorizedDirectoryRequest,scheduleDirectorySync,directoryStatus} from './_slack-directory.js';
import options from './_auth-options.js';
import requestCode from './_auth-code.js';
import verifyCode from './_auth-verify.js';
import {readJsonBody,jsonResponse} from './_auth.js';
export default async function handler(req,res) {
  const action=new URL(req.url,'https://local.invalid').searchParams.get('action');
  if(action==='directory-sync' || action==='directory-status') {
    if(!directoryEnabled() || !authorizedDirectoryRequest(req)) return jsonResponse(res,401,{error:'Unauthorized'});
    if(!['GET','POST'].includes(req.method)) return jsonResponse(res,405,{error:'Method not allowed'});
    if(action==='directory-status') return jsonResponse(res,200,await directoryStatus());
    scheduleDirectorySync({force:true});return jsonResponse(res,202,{accepted:true});
  }
  if(req.method === 'GET') return options(req,res);
  if (req.headers.origin) {
    try { if(new URL(req.headers.origin).host !== req.headers.host) return jsonResponse(res,403,{error:'Недозволене джерело запиту.'}); }
    catch { return jsonResponse(res,403,{error:'Недозволене джерело запиту.'}); }
  }
  if(req.method !== 'POST') return jsonResponse(res,405,{error:'Method not allowed'});
  try { req.body=await readJsonBody(req); } catch { return jsonResponse(res,400,{error:'Невірний запит.'}); }
  if(req.body.action === 'request') return requestCode(req,res);
  if(req.body.action === 'verify') return verifyCode(req,res);
  return jsonResponse(res,400,{error:'Невідома дія.'});
}
