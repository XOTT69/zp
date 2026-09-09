import {slack} from '../api/_slack-api.js';
import {syncProfileIndex} from '../api/_slack-profile.js';

try {
  if (process.argv.includes('--fields')) {
    const auth = await slack('auth.test');
    const result = await slack('team.profile.get');
    console.log(JSON.stringify({teamId:auth.team_id,fields:result.profile.fields.map(field=>({
      id:field.id,label:field.label,protected:field.options?.is_protected === true
    }))},null,2));
  } else {
    const result = await syncProfileIndex({progress:({scanned})=>{
      if (scanned % 100 === 0) console.log(`Перевірено профілів: ${scanned}`);
    }});
    console.log(`Готово: профілів ${result.scanned}, зіставлень ${result.mapped}, дубльованих логінів ${result.duplicates}. Індекс діє 24 години.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
