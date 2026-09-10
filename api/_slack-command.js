import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {waitUntil} from '@vercel/functions';
import {redis} from './_redis.js';
import {slack} from './_slack-api.js';
import {slackLoginEnabled} from './_slack-auth.js';
import {connectSlackProfileUser} from './_slack-profile.js';

export function validSlackSignature(body,timestamp,signature,now=Date.now()) {
  const secret=process.env.SLACK_SIGNING_SECRET;
  if (!secret || !/^\d{10}$/.test(timestamp || '') || Math.abs(now/1000-Number(timestamp))>300 || !/^v0=[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected='v0='+createHmac('sha256',secret).update(`v0:${timestamp}:${body}`).digest('hex');
  return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
const reply=(status,text)=>Response.json({response_type:'ephemeral',text},{status,headers:{'Cache-Control':'no-store'}});

export function makeSlackCommandHandler({send=slack,store=redis,runLater=waitUntil,now=Date.now}={}) {
  return async request=>{
    if(request.method!=='POST') return reply(405,'Method not allowed');
    if(!process.env.SLACK_SIGNING_SECRET || !slackLoginEnabled()) return reply(503,'Підключення Slack ще налаштовується.');
    if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return reply(415,'Unsupported content type');
    if(Number(request.headers.get('content-length'))>65536) return reply(413,'Request too large');
    const raw=await request.text();
    if(Buffer.byteLength(raw)>65536) return reply(413,'Request too large');
    const signature=request.headers.get('x-slack-signature');
    if(!validSlackSignature(raw,request.headers.get('x-slack-request-timestamp'),signature,now())) return reply(401,'Invalid signature');
    const form=new URLSearchParams(raw);
    if(['team_id','user_id','command','text'].some(key=>form.getAll(key).length>1)) return reply(400,'Invalid command');
    const id=form.get('user_id');
    if(form.get('team_id')!==process.env.SLACK_TEAM_ID || !/^[UW][A-Z0-9]{2,79}$/.test(id || '')) return reply(403,'Unexpected workspace or sender');
    if(form.get('command')!=='/zp') return reply(400,'Unknown command');
    if(form.get('text')?.trim()) return reply(200,'Виконайте /zp без аргументів. LDAP визначиться з вашого профілю.');
    // Acknowledge within Slack's 3-second window. Work remains attached to the
    // Vercel invocation; never trust a client-supplied response_url or login.
    runLater((async()=>{
      const replayKey=`zp:slack-command:request:${createHash('sha256').update(signature).digest('hex')}`;
      const [first]=await store([['SET',replayKey,'1','EX',600,'NX']]);
      if(first!=='OK') return;
      const rateKey=`zp:slack-command:rate:${process.env.SLACK_TEAM_ID}:${id}`;
      const [count]=await store([['INCR',rateKey],['EXPIRE',rateKey,900,'NX']]);
      let text='Зачекайте 15 хвилин перед повторним підключенням.';
      if(Number(count)<=5) {
        const connected=await connectSlackProfileUser(id,{send,store});
        text=connected ? 'Slack підключено до калькулятора ЗП. Поверніться на сайт, введіть свій LDAP та натисніть «Отримати код у Slack».'
          : 'Не вдалося підключити акаунт. Перевірте LDAP у своєму профілі або зверніться до адміністратора калькулятора.';
      }
      await send('chat.postMessage',{channel:id,text,unfurl_links:false,unfurl_media:false});
    })().catch(async()=>{
      // No signatures, request bodies or employee profiles in deployment logs.
      console.error('[Slack connect] Request could not be completed');
      try { await send('chat.postMessage',{channel:id,text:'Підключення не завершилося. Спробуйте /zp пізніше.',unfurl_links:false,unfurl_media:false}); }
      catch { console.error('[Slack connect] Notification could not be delivered'); }
    }));
    return reply(200,'Перевіряю ваш профіль. Результат надішлю особистим повідомленням.');
  };
}
