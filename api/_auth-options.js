import {jsonResponse} from './_auth.js';
import {slackLoginEnabled} from './_slack-auth.js';
export default function handler(req,res) {
  if(req.method!=='GET') return jsonResponse(res,405,{error:'Method not allowed'});
  jsonResponse(res,200,{ldapSlack:slackLoginEnabled(),roleCode:process.env.ROLE_CODE_LOGIN_ENABLED!=='false'});
}
