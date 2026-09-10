import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {redis} from '../api/_redis.js';
import {VERIFY_CHALLENGE_SCRIPT} from '../api/_slack-auth.js';
import {CHECKPOINT_DIRECTORY,PUBLISH_DIRECTORY,RELEASE_DIRECTORY} from '../api/_slack-directory.js';
import {REMEMBER_PROFILE_SCRIPT} from '../api/_slack-profile.js';

// Explicit integration check. Only isolated random test keys are written.
export async function verifyRedisOtp() {
  const prefix = `zp:integration:otp:${randomUUID()}`;
  const keys = ['single','attempts','concurrent','expired','binding','lease','snapshot','job'].map(suffix=>`${prefix}:${suffix}`);
  const record = JSON.stringify({digest:'integration-test-digest',attempts:0});
  const verify = async(key,digest='integration-test-digest') =>
    (await redis([['EVAL',VERIFY_CHALLENGE_SCRIPT,1,key,digest]]))[0];
  try {
    await redis(keys.slice(0,4).map(key=>['SET',key,record,'EX',60]));
    assert.equal(await verify(keys[0]),record);
    assert.equal(await verify(keys[0]),null);
    for (let i=1;i<=4;i++) {
      assert.equal(await verify(keys[1],'wrong'),null);
      const [raw,ttl] = await redis([['GET',keys[1]],['TTL',keys[1]]]);
      assert.equal(JSON.parse(raw).attempts,i);
      assert.ok(ttl>0 && ttl<=60,'A wrong attempt must preserve expiry');
    }
    assert.equal(await verify(keys[1],'wrong'),null);
    assert.equal(await verify(keys[1]),null,'Five wrong attempts must invalidate a code');
    const results = await Promise.all(Array.from({length:4},()=>verify(keys[2])));
    assert.equal(results.filter(Boolean).length,1,'Only one concurrent request can consume a code');
    await redis([['PEXPIRE',keys[3],1]]);
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(await verify(keys[3]),null);
    const bind=async id=>(await redis([['EVAL',REMEMBER_PROFILE_SCRIPT,1,keys[4],id,60]]))[0];
    assert.equal(await bind('UALICE'),1);
    assert.equal(await bind('UBOB'),0);
    assert.equal(await bind('UALICE'),1);
    assert.equal((await redis([['GET',keys[4]]]))[0],'UALICE');
    await redis([['SET',keys[5],'owner','EX',60]]);
    const checkpoint=owner=>redis([['EVAL',CHECKPOINT_DIRECTORY,2,keys[5],keys[7],owner,'checkpoint',60]]);
    assert.deepEqual(await checkpoint('other'),[0]);
    assert.deepEqual(await checkpoint('owner'),[1]);
    assert.deepEqual(await redis([['EVAL',PUBLISH_DIRECTORY,3,keys[5],keys[6],keys[7],'other','complete',60]]),[0]);
    assert.deepEqual(await redis([['GET',keys[7]]]),['checkpoint']);
    assert.deepEqual(await redis([['EVAL',PUBLISH_DIRECTORY,3,keys[5],keys[6],keys[7],'owner','complete',60]]),[1]);
    assert.deepEqual(await redis([['GET',keys[6]],['GET',keys[7]]]),['complete',null]);
    assert.deepEqual(await redis([['EVAL',RELEASE_DIRECTORY,1,keys[5],'other']]),[0]);
    assert.deepEqual(await redis([['EVAL',RELEASE_DIRECTORY,1,keys[5],'owner']]),[1]);
    console.log('[Redis directory] Lease fencing, atomic publish, checkpoint and release passed.');
    console.log('[Redis OTP] Single use, attempt limit, expiry, concurrent consumption and binding collision checks passed.');
  } finally {
    await redis([['DEL',...keys]]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await verifyRedisOtp();
