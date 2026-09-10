import {escapeHtml} from './safe-html.js';
// Structured fields stage changes in the existing JSON draft; the Save button is the only write.
export function mountRateEditor(root,textarea,getCalculators) {
  const types=getCalculators();
  const selected=root.querySelector('select')?.value || Object.keys(types)[0];
  root.innerHTML=`<label class="field"><span>Напрямок</span><select data-rate-type>${Object.entries(types).map(([key,cfg])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(cfg.shortTitle)}</option>`).join('')}</select></label><div data-rate-fields class="admin-rule-form"></div><p class="muted">Зміни поки що в чернетці. Натисніть «Переглянути вплив», потім «Зберегти ставки». Для нового періоду спочатку задайте дату чинності версії.</p>`;
  const picker=root.querySelector('[data-rate-type]');
  const fields=root.querySelector('[data-rate-fields]');
  function render() {
    let cfg;
    try {cfg=getCalculators()[picker.value];} catch { fields.textContent='Виправте JSON чернетки перед редагуванням полів.';return; }
    const field=(label,path,value,max=1000000,step='any')=>`<label class="field"><span>${escapeHtml(label)}</span><input type="number" min="0" max="${max}" step="${step}" value="${Number(value)||0}" data-rate-path="${escapeHtml(path)}" required /></label>`;
    const zones=cfg.ratingZones || Object.keys(cfg.ratingBonusByZone).map(Number);
    const colors=cfg.zoneLabels || (picker.value==='level4'?{1:'Зелена',2:'Жовта',3:'Червона'}:{1:'Зелена',2:'Салатова',3:'Жовта',4:'Рожева',5:'Червона'});
    fields.innerHTML=`<p class="field full">${cfg.taxMode==='gross'?'Суми до податку':'Суми чистими'} · етап від 3 місяців, якщо застосовується</p>` +
      field('Оклад','salary',cfg.defaultInputs.salary)+field('Податок, частка (0,23 = 23%)','taxRate',cfg.taxRate ?? .23,.6,'.001')+field('База стажу','tenureBase',cfg.tenureBase)+
      zones.map(zone=>field(`Рейтинг · ${colors[zone] || zone}`,`ratingBonusByZone.${zone}`,cfg.ratingBonusByZone[zone])).join('')+
      ['level1','level2','level3'].map((level,index)=>zones.map(zone=>field(`${index+1} рівень · ${colors[zone] || zone}`,`levelBonusByLevelAndZone.${level}.${zone}`,cfg.levelBonusByLevelAndZone?.[level]?.[zone] ?? cfg.levelBonusByLevelAndZone?.[level]?.default ?? cfg.levelBonusByLevel?.[level] ?? 0)).join('')).join('');
  }
  picker.addEventListener('change',render);
  fields.addEventListener('input',event=>{
    const path=event.target.dataset.ratePath;
    if(!path || !event.target.checkValidity()) return;
    try {
      const draft=JSON.parse(textarea.value || '{}');let target=draft[picker.value] ||= {};
      const keys=path.split('.');for(const key of keys.slice(0,-1)) target=target[key] ||= {};
      target[keys.at(-1)]=Number(event.target.value);textarea.value=JSON.stringify(draft,null,2);
    } catch { /* Keep the invalid JSON visible for correction. */ }
  });
  textarea.onchange=render;
  render();
}
