'use strict';
const R = window.Roadmap;
const STATE_KEY = 'human_lifespan_roadmap_state_v4';
const LEGACY_KEY = 'human_lifespan_roadmap_state_v3';
let userState = R.emptyState();
let sources = {};
let sourceError = '';
let activeTab = 'today';
let exerciseView = 'todo';
let sessionTarget = null;
let sessionMode = 'practice';
let sessionOpener = null;
let recoveryBackup = null;
const $ = id => document.getElementById(id);
const profile = () => userState.profiles.find(p => p.id === userState.activeProfileId);
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function button(text, action, className = 'secondary') { const el = node('button', text, className); el.type = 'button'; el.addEventListener('click', action); return el; }
function option(value, text) { const el = node('option', text); el.value = value; return el; }
function announce(message) { $('liveStatus').textContent = message; }
async function request(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); return { ok: true, json: async () => data }; }
  finally { clearTimeout(timeout); }
}
const store = new R.DatasetStore(request);
function storageWarning(message) {
  $('storageWarning').textContent = message; $('storageWarning').hidden = !message;
  if (message && recoveryBackup !== null) $('storageWarning').append(button('Download original saved data',()=>downloadText(recoveryBackup,'lifespan-recovery.json')));
}
function loadUserState() {
  try {
    const current = localStorage.getItem(STATE_KEY);
    const old = current === null ? localStorage.getItem(LEGACY_KEY) : null;
    if (current !== null || old !== null) {
      recoveryBackup = current ?? old;
      userState = R.normalizeState(JSON.parse(current ?? old));
      recoveryBackup = null;
      if (old !== null) { saveUserState(); announce('Previous completion records imported as historical observations.'); }
    }
  } catch (error) { storageWarning('Saved data could not be read. This session starts with an empty journal. Download the original saved data for recovery before continuing; it has not been overwritten.'); }
}
function saveUserState() {
  try {
    if (recoveryBackup !== null) {
      localStorage.setItem(`${STATE_KEY}_recovery`, recoveryBackup);
      localStorage.setItem(STATE_KEY, JSON.stringify(userState));
      storageWarning('The new journal was saved. The unreadable original was retained in a recovery storage key; you can download it here.');
    } else { localStorage.setItem(STATE_KEY, JSON.stringify(userState)); storageWarning(''); }
    return true;
  }
  catch { storageWarning('This browser could not save the journal. Changes remain in memory for this session. Export a backup before leaving.'); return false; }
}
function change(action, message, focusKey) {
  action(profile()); saveUserState(); render();
  if (focusKey) { const target = document.querySelector(`[data-focus-key="${focusKey}"]`); (target || $('searchInput')).focus({preventScroll:true}); }
  announce(message);
}
function syncControls() {
  const p = profile(), s = R.STAGES[p.activeStage];
  $('stagePartLabel').hidden=!['infancy','adolescence'].includes(p.activeStage);
  $('profileSelect').replaceChildren(...userState.profiles.map(p => option(p.id,p.name)));
  $('profileSelect').value = p.id; $('stageSelect').value = p.activeStage;
  Object.assign($('ageInput'), { min:s.min, max:s.max, step:s.step, value:p.ages[p.activeStage] });
  $('ageInput').setAttribute('aria-valuetext', R.formatAge(p.ages[p.activeStage],s.unit));
  $('ageValueText').textContent = R.formatAge(p.ages[p.activeStage],s.unit);
  $('ageMinus').disabled = p.ages[p.activeStage] <= s.min; $('agePlus').disabled = p.ages[p.activeStage] >= s.max;
}
function selectTab(name, focus = false) {
  activeTab = name;
  document.querySelectorAll('[data-tab]').forEach(tab => { const selected = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected && focus) tab.focus(); });
  document.querySelectorAll('main > [role=tabpanel]').forEach(panel => { panel.hidden = panel.id !== `panel-${name}`; });
  if (name === 'calendar') renderCalendar(store.catalog(), profile());
}
function safeLink(source) {
  const a = node('a', source.title); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
async function loadSources() {
  try {
    const data = await (await request('sources.json')).json();
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) throw new Error('Invalid source library.');
    for (const s of Object.values(data)) {
      if (!s || typeof s.title !== 'string' || typeof s.scope !== 'string' || typeof s.url !== 'string') throw new Error('Invalid source record.');
      const url = new URL(s.url);
      if (url.protocol !== 'https:' || !['www.cdc.gov','www.who.int','www.healthychildren.org','www.nia.nih.gov','www.nhs.uk','www.consumerfinance.gov','medlineplus.gov','pubmed.ncbi.nlm.nih.gov','cdn.who.int'].includes(url.hostname)) throw new Error('Unexpected source URL.');
    }
    sources = data; sourceError = '';
  } catch (error) { sources = {}; sourceError = error.message; }
}
function renderWarnings() {
  const issues = [...store.errors.entries()].map(([stage, error]) => `${R.STAGES[stage].name}: ${error}`);
  if (sourceError) issues.push(`Source library: ${sourceError}`);
  const missingRefs = store.catalog().some(ex => ex.sources.some(id => !sources[id]));
  if (!sourceError && Object.keys(sources).length && missingRefs) issues.push('Some activity sources are unavailable.');
  $('dataWarning').replaceChildren(); $('dataWarning').hidden = !issues.length;
  if (issues.length) {
    $('dataWarning').append(node('span',`Some content could not load (${issues.join('; ')}). Unavailable stages are not shown as completed. Use an HTTP server, check the files, and retry.`), button('Retry unavailable content',retry));
  }
}
async function retry() {
  const stages = [...store.errors.keys()];
  const tasks = stages.map(stage=>store.load(stage));
  if (sourceError) tasks.push(loadSources());
  render(); await Promise.allSettled(tasks); render(); announce('Content retry finished.');
}
function listBlock(parent,title,items,ordered=false) { parent.append(node('h4',title)); const list=node(ordered?'ol':'ul'); items.forEach(text=>list.append(node('li',text))); parent.append(list); }

function setupCardImage(img, ex) {
  img.src = ex.imageUrl;
  img.alt = ex.imageAlt;
  img.loading = 'lazy'; img.decoding = 'async';
  img.width = 1536; img.height = 1024; img.className = 'card-art';
  img.addEventListener('error', () => {
    img.replaceWith(node('p', 'This exercise illustration could not load. Follow the written instructions below.', 'notice'));
  }, { once: true });
}

function showExercise(id) {
  const ex=store.catalog().find(x=>x.id===id);if(!ex)return;
  profile().activeStage=ex.lifespanStage;
  exerciseView=R.completed(ex,profile(),store.catalog())?'completed':'todo';
  $('stagePartFilter').value='all';
  $('searchInput').value=ex.title;$('domainFilter').value='all';$('availabilityFilter').value='all';
  selectTab('today');
  render();
  const card=$(`card-${id}`);card?.scrollIntoView({block:'center'});card?.querySelector('button')?.focus({preventScroll:true});
}
function appendRelations(parent,label,ids) {
  if(!ids.length)return;
  const section=node('div',undefined,'exercise-relations');section.append(node('h4',label));
  for(const id of ids) {
    const ex=store.catalog().find(x=>x.id===id);
    const state=ex ? (R.completed(ex,profile(),store.catalog())?'Completed':R.prerequisitesMet(ex,profile(),store.catalog())?'Ready for review':'Locked') : 'Unavailable';
    const link=button(`${ex?.title||id} - ${state}`,()=>showExercise(id));link.disabled=!ex;section.append(link);
  }
  parent.append(section);
}

function createExerciseCard(ex) {
  const p=profile(), status=R.status(ex,p,store.catalog()), observed=p.observations.some(o=>o.exerciseId===ex.id), planned=p.planned.includes(ex.id);
  const card=node('article',undefined,'exercise-card'); card.id=`card-${ex.id}`;
  const img=node('img');
  setupCardImage(img, ex);
  card.append(img);

  const body=node('div',undefined,'card-body'), top=node('div',undefined,'card-top');
  top.append(node('span',R.DOMAINS[ex.domainType],`tag domain-${ex.domainType}`));
  body.append(top,node('h3',ex.title),node('p',ex.goal,'goal'),node('p',`Browsing range: ${R.formatAgeRange(ex)}. Editorial guidance, not a milestone deadline.${ex.maxAge>R.STAGES[ex.lifespanStage].max?' Spans adjacent stages.':''} ${ex.domainSubType.replaceAll('_',' ')}.`,'age-note'));

  /* Prominent Success Criteria block */
  const successBox = node('div', undefined, 'success-criteria');
  successBox.append(node('strong', 'Success criteria:'), node('p', ex.completionCriteria));
  body.append(successBox);

  const statusLabels={completed:'Success criteria completed.',upcoming:'Upcoming idea — check readiness before trying.',earlier:'Earlier browsing range — adapt if still useful.',locked:'Readiness record needed: '+ex.prerequisites.map(id=>store.catalog().find(x=>x.id===id)?.title||id).join(', '),available:'Available to explore — follow readiness and safety notes.'};
  body.append(node('p',R.completed(ex,p,store.catalog())?statusLabels.completed:statusLabels[status],'card-state'));
  appendRelations(body, 'Complete before this exercise', ex.prerequisites);
  appendRelations(body, 'Next exercises', ex.suggestedBefore);
  appendRelations(body, 'Helpful before (optional)', ex.preparationActivities || []);
  appendRelations(body, 'Can lead to (optional)', ex.leadsTo || []);
  appendRelations(body, 'Related ideas (optional)', ex.relatedActivities || []);
  if(!ex.prerequisites.length && !(ex.preparationActivities || []).length) body.append(node('p','No earlier exercise is required. Start with current readiness.','small'));
  if(!['infancy','toddlerhood'].includes(ex.lifespanStage) && !ex.suggestedBefore.length && !(ex.leadsTo || []).length) body.append(node('p','No specific later exercise is listed. Continue practice or explore another branch.','small'));
  if(observed) body.append(node('p','Observation recorded. Practice can continue.','card-state'));
  const details=node('details'); details.append(node('summary','How to try it · safety · sources'));
  details.append(node('h4','Before you begin'),node('p',ex.readiness)); listBlock(details,'Try it',ex.steps,true); listBlock(details,'Safety and stopping',ex.safety); listBlock(details,'Adaptations',ex.adaptations);
  details.append(node('h4','Success criteria & evaluation record'),node('p',ex.completionCriteria),node('h4','Purpose'),node('p',ex.benefits),node('h4','Optional routine starting point'),node('p',`${ex.schedule.daysPerWeek} days per week, about ${ex.schedule.minutes} minutes or less. Adjust these in your routine preferences.`));
  const settings=p.routineSettings[ex.id]||ex.schedule;
  const routineDays=node('input'),routineMinutes=node('input');
  Object.assign(routineDays,{type:'number',min:1,max:ex.schedule.strenuous?3:7,step:1,value:settings.daysPerWeek});
  Object.assign(routineMinutes,{type:'number',min:0.5,max:120,step:0.5,value:settings.minutes});
  const dayLabel=node('label','My days per week'),minuteLabel=node('label','My suggested minutes');dayLabel.append(routineDays);minuteLabel.append(routineMinutes);
  const saveRoutine=button('Save routine preferences',()=>{const days=Number(routineDays.value),minutes=Number(routineMinutes.value);if(!Number.isInteger(days)||days<1||days>(ex.schedule.strenuous?3:7)||!Number.isFinite(minutes)||minutes<=0||minutes>120){window.alert('Choose valid days and minutes within the displayed limits.');return;}change(p=>{p.routineSettings[ex.id]={daysPerWeek:days,minutes};},'Routine preferences saved.',`plan-${ex.id}`);});
  details.append(dayLabel,minuteLabel,saveRoutine);
  details.append(node('h4','Guidance context'));
  ex.sources.forEach(id=>{ const source=sources[id]; if(source){const para=node('p');para.append(safeLink(source),node('span',` — ${source.scope}`));details.append(para);} else details.append(node('p',`Source ${id} is unavailable; use Guidance or retry.`)); });
  details.append(node('p',`Sources checked ${ex.reviewedAt}.`,'small'));
  body.append(details);
  const actions=node('div',undefined,'actions');
  const log=button('Log practice',()=>openSession(ex.id), ''); log.disabled=!canTry(ex); log.dataset.focusKey=`log-${ex.id}`;
  const observe=button('Record observation',()=>openSession(ex.id,'observation'));observe.dataset.focusKey=`observe-${ex.id}`;
  const plan=button(planned?'Remove from routine':'Add to routine',()=>change(p=>{p.planned=planned?p.planned.filter(id=>id!==ex.id):[...p.planned,ex.id];},planned?'Removed from routine.':'Added to routine.',`plan-${ex.id}`));plan.disabled=!planned&&!R.eligible(ex,p,store.catalog());plan.dataset.focusKey=`plan-${ex.id}`;
  const complete=button(R.completed(ex,p,store.catalog())?'Undo completion':'Complete',()=>{
    if(R.completed(ex,profile(),store.catalog())) change(p=>{p.completions=p.completions.filter(c=>c.exerciseId!==ex.id);},'Completion removed. Observation and practice history kept.',`complete-${ex.id}`);
    else openSession(ex.id,'completion');
  });
  complete.disabled=!R.completed(ex,p,store.catalog())&&!canTry(ex);
  complete.dataset.focusKey=`complete-${ex.id}`;
  actions.append(log,observe,plan,complete);body.append(actions);card.append(body);return card;
}
function renderExerciseGrid() {
  const grid=$('exerciseGrid'),p=profile();grid.replaceChildren();
  const list=store.data.get(p.activeStage)||[],s=R.STAGES[p.activeStage];
  $('stageSummary').textContent=`${s.name} - ${list.filter(ex=>R.completed(ex,p,store.catalog())).length} / ${list.length} completed - four areas to explore`;
  const doneCount=list.filter(ex=>R.completed(ex,p,store.catalog())).length;
  $('todoCount').textContent=store.data.has(p.activeStage)?String(list.length-doneCount):'…';
  $('completedCount').textContent=store.data.has(p.activeStage)?String(doneCount):'…';
  $('recommendedCount').textContent=store.data.has(p.activeStage)?String(list.length-doneCount):'…';
  document.querySelectorAll('[data-exercise-view]').forEach(tab=>{const selected=tab.dataset.exerciseView===exerciseView;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  $('exerciseGrid').setAttribute('aria-labelledby',`exercise-tab-${exerciseView}`);
  $('nextExercises').hidden=exerciseView==='completed';
  $('availabilityFilter').disabled=exerciseView==='completed';
  if(!store.data.has(p.activeStage)) { const message=store.pending.has(p.activeStage)?'Loading this stage…':'This stage is unavailable. Use Retry above; your journal records are preserved.';grid.append(node('p',message,'empty'));$('filterSummary').textContent=message;return; }
  const search=$('searchInput').value.trim().toLocaleLowerCase(),domain=$('domainFilter').value,filter=$('availabilityFilter').value;
  const part=['infancy','adolescence'].includes(p.activeStage)?($('stagePartFilter').value||'all'):'all';
  const partList=list.filter(ex=>!ex.stagePart||part==='all'||ex.stagePart===part);
  $('partProgress').textContent=part!=='all'&&['infancy','adolescence'].includes(p.activeStage)?`${partList.filter(ex=>R.completed(ex,p,store.catalog())).length} / ${partList.length} completed in the ${part} part`:'';
  const matches=partList.filter(ex=>{const status=R.status(ex,p,store.catalog()),completed=R.completed(ex,p,store.catalog());return (exerciseView==='completed'?completed:!completed)&&(domain==='all'||ex.domainType===domain)&&`${ex.title} ${ex.goal} ${ex.domainSubType} ${R.DOMAINS[ex.domainType]}`.toLocaleLowerCase().includes(search)&&(exerciseView==='completed'||filter==='all'||filter==='ready'&&R.eligible(ex,p,store.catalog())||filter===status);}).sort((a,b)=>a.complexity-b.complexity||a.minAge-b.minAge||a.id.localeCompare(b.id));
  $('filterSummary').textContent=`${matches.length} ${exerciseView==='completed'?'completed':'to do'} activities shown. Readiness is listed on each activity.`;
  if(!matches.length)grid.append(node('p',exerciseView==='completed'?'No completed activities match these filters yet.':'No activities to do match these filters. Try another domain, stage part, or readiness level.','empty'));
  matches.forEach(ex=>grid.append(createExerciseCard(ex)));
}
function renderArchive() {
  const p=profile(),catalog=new Map(store.catalog().map(ex=>[ex.id,ex])),filter=$('archiveFilter').value;
  const matches=id=>filter==='all'||catalog.get(id)?.lifespanStage===filter;
  $('archiveCount').textContent=String(p.completions.length+p.observations.length+p.sessions.length);
  const grid=$('completedGrid');grid.replaceChildren();
  for(const c of p.completions.filter(c=>matches(c.exerciseId))) {
    const ex=catalog.get(c.exerciseId),entry=node('article',undefined,'journal-entry');
    const copy=node('div');copy.append(node('h4',ex?.title||c.exerciseId),node('p',`Completed ${new Date(c.at).toLocaleString()}`),node('p',c.criteria));entry.append(copy);
    if(ex&&!R.completed(ex,p,store.catalog())) copy.append(node('p','Criteria changed; review and complete again.'));
    entry.append(button('Undo completion',()=>change(p=>{p.completions=p.completions.filter(x=>x.exerciseId!==c.exerciseId);},'Completion removed. History kept.')));grid.append(entry);
  }
  for(const o of p.observations.filter(o=>matches(o.exerciseId)).slice().reverse()) {
    const ex=catalog.get(o.exerciseId),entry=node('article',undefined,'journal-entry'),copy=node('div');
    copy.append(node('h4',ex?.title||`Historical or unavailable activity: ${o.exerciseId}`),node('p',`${o.exerciseId} · ${o.kind==='legacy'?'Historical completion; original criteria may differ':'Observation'} · ${o.at?new Date(o.at).toLocaleString():'date not recorded'}`));
    if(o.note)copy.append(node('p',o.note));
    if(!ex)copy.append(node('p','The original ID is preserved. It is not automatically mapped to a different activity. Select All stages to see unresolved records.'));
    const remove=button('Remove observation',()=>change(p=>{p.observations=p.observations.filter(x=>x!==o);},'Observation removed; practice history retained.'));remove.setAttribute('aria-label',`Remove observation for ${ex?.title||o.exerciseId}`);
    remove.addEventListener('click',()=> $('archiveFilter').focus({preventScroll:true}));
    entry.append(copy,remove);grid.append(entry);
  }
  if(!grid.childElementCount)grid.append(node('p','No observations match this filter.','empty'));
  const sessions=$('sessionGrid');sessions.replaceChildren();
  for(const s of p.sessions.filter(s=>matches(s.exerciseId)).slice().sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))) {
    const ex=catalog.get(s.exerciseId),entry=node('article',undefined,'journal-entry'),copy=node('div');
    copy.append(node('h4',ex?.title||`Unavailable activity: ${s.exerciseId}`),node('p',`${new Date(s.at).toLocaleString()} · ${s.minutes?`${s.minutes} minutes`:'duration not recorded'}`));if(s.note)copy.append(node('p',s.note));
    const remove=button('Delete session',()=>{if(window.confirm('Delete this practice session and its note?')){change(p=>{p.sessions=p.sessions.filter(x=>x.id!==s.id);},'Session deleted.');$('archiveFilter').focus({preventScroll:true});}},'danger');remove.setAttribute('aria-label',`Delete session for ${ex?.title||s.exerciseId}`);entry.append(copy,remove);sessions.append(entry);
  }
  if(!sessions.childElementCount)sessions.append(node('p','No practice sessions match this filter.','empty'));
}
function renderMetrics() {
  const container=$('domainBreakdown');container.replaceChildren();
  if(!store.data.has(profile().activeStage)){container.append(node('p','Activity counts are unavailable while this stage is not loaded.','empty'));return;}
  for(const metric of R.metrics(store.catalog(),profile())) { const card=node('article',undefined,'metric');card.append(node('span',R.DOMAINS[metric.domain],`tag domain-${metric.domain}`),node('p',`${metric.observed} / ${metric.total}`,'metric-number'),node('p','Catalog activities with an observation'),node('p',`${metric.completed} activities with confirmed success criteria`),node('p',`${metric.sessions} practice sessions logged. ${metric.observed===0&&metric.sessions===0?'No entries yet.':''}`));container.append(card); }
}
function renderSources() {
  $('sourceList').replaceChildren();$('milestoneLinks').replaceChildren();
  for(const [id,source] of Object.entries(sources)) {const item=node('article');item.append(safeLink(source),node('p',source.scope));$('sourceList').append(item);if(/^cdc-\d/.test(id))$('milestoneLinks').append(safeLink(source));}
  if(!Object.keys(sources).length)$('sourceList').append(node('p','Source library unavailable. The direct guidance links above remain available. Retry loading the library.','empty'));
}
function render() {syncControls();renderRecommendations();renderWarnings();renderExerciseGrid();renderArchive();renderMetrics();renderCalendar(store.catalog(),profile());renderSources();}
function canTry(ex) {
  if(store.pending.size||store.errors.size) return false;
  try {R.validateCatalog(store.catalog());} catch {return false;}
  return R.eligible(ex,profile(),store.catalog()) || R.recommendations(store.catalog(),profile()).some(x=>x.id===ex.id);
}
function renderRecommendations() {
  const box=$('nextExercises');box.replaceChildren();
  if(store.pending.size || store.errors.size) {box.append(node('p','Next suggestions will appear when the complete catalog is loaded.'));return;}
  try {R.validateCatalog(store.catalog());} catch(error) {box.append(node('p',`Exercise relationships unavailable: ${error.message}`));return;}
  const next=R.recommendations(store.catalog(),profile());
  box.append(node('h3','Suggested next exercises'));
  if(!next.length) {
    const remaining=store.catalog().filter(ex=>ex.lifespanStage===profile().activeStage&&!R.completed(ex,profile(),store.catalog()));
    box.append(node('p',remaining.length?'Remaining exercises require earlier success criteria. Open their prerequisite links to continue.':'All exercises in this stage are complete. Continue practice or browse another life stage manually; no higher-complexity exercise remains in this catalog.'));return;
  }
  for(const ex of next) {
    const advanced=profile().ages[ex.lifespanStage]<ex.minAge;
    box.append(button(`${ex.title} - complexity ${ex.complexity}${advanced?' - advance preview: check readiness':''}`,()=>{
      exerciseView='todo';$('searchInput').value=ex.title;$('domainFilter').value='all';$('stagePartFilter').value='all';$('availabilityFilter').value='all';renderExerciseGrid();
      const card=$(`card-${ex.id}`);card.scrollIntoView({block:'center'});card.querySelector('button')?.focus();
    }));
  }
}
function openSession(id,mode='practice') {
  const ex=store.catalog().find(ex=>ex.id===id);if(!ex||(mode!=='observation'&&!canTry(ex)))return;
  sessionTarget=id;sessionMode=mode;sessionOpener=document.activeElement;
  $('sessionTitle').textContent=`${mode==='completion'?'Complete':mode==='observation'?'Observe':'Log practice'}: ${ex.title}`;
  $('completionFields').hidden=mode!=='completion';
  $('completionText').textContent=ex.completionCriteria;
  $('readinessText').textContent=`Readiness: ${ex.readiness} Safety: ${ex.safety.join(' ')}`;
  $('sessionNote').required=mode==='observation';
  $('sessionMinutes').disabled=mode==='observation';
  $('saveSession').textContent=mode==='completion'?'Save completion':mode==='observation'?'Save observation':'Save practice';
  const now=new Date();$('sessionDate').value=`${R.localDay(now)}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  $('sessionMinutes').value='0';$('sessionNote').value='';$('sessionDialog').showModal();$('sessionTitle').focus();
}
function resetProgress() {
  if(!window.confirm('Reset this journal’s age, observations, routine, and sessions? Other journals stay unchanged. Export a backup first if needed.'))return;
  const old=profile();userState.profiles=userState.profiles.map(p=>p.id===old.id?R.newProfile(old.name,old.id):p);
  saveUserState();render();announce('Current journal reset.');
}
function downloadText(text, filename) {
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportState() {
  downloadText(JSON.stringify(userState,null,2),`lifespan-journals-${R.localDay(new Date())}.json`);announce('Backup exported. It contains all journals and notes.');
}
async function importState(event) {
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('Backup exceeds 10 MB.');
    const raw=JSON.parse(await file.text());
    if(raw.profiles?.length>50||raw.profiles?.some(p=>p.sessions?.length>10000||p.observations?.length>10000||p.completions?.length>10000))throw new Error('Backup exceeds supported record limits.');
    const incoming=R.normalizeState(raw),records=incoming.profiles.reduce((sum,p)=>sum+p.completions.length+p.observations.length+p.sessions.length,0);
    if(!window.confirm(`Import ${incoming.profiles.length} journal(s) with ${records} records? This replaces all current journals. Cancel and export first if you need a backup.`))return;
    userState=incoming;saveUserState();render();announce('Backup imported. Unknown activity IDs are preserved in the journal.');
  }catch(error){window.alert(`Could not import: ${error.message}. Current journals were not replaced.`);}finally{event.target.value='';}
}
function bindListeners() {
  for(const [stage,s] of Object.entries(R.STAGES)){ $('stageSelect').append(option(stage,`${s.name} (${R.formatStageRange(stage)})`));$('archiveFilter').append(option(stage,s.name)); }
  for(const [domain,label] of Object.entries(R.DOMAINS))$('domainFilter').append(option(domain,label));
  $('stageSelect').addEventListener('change',event=>change(p=>{p.activeStage=event.target.value;},'Browsing stage changed.'));
  $('profileSelect').addEventListener('change',event=>{userState.activeProfileId=event.target.value;saveUserState();render();announce('Journal changed.');});
  $('addProfile').addEventListener('click',()=>{if(userState.profiles.length>=50){window.alert('Up to 50 journals are supported.');return;}const name=window.prompt('Name for this journal (a nickname is fine):');if(!name?.trim())return;const p=R.newProfile(name.trim().slice(0,60),crypto.randomUUID());userState.profiles.push(p);userState.activeProfileId=p.id;saveUserState();render();announce('New journal created.');});
  $('ageInput').addEventListener('input',event=>change(p=>{p.ages[p.activeStage]=R.age(Number(event.target.value),p.activeStage);},'Browsing age updated.'));
  for(const [id,dir] of [['ageMinus',-1],['agePlus',1]])$(id).addEventListener('click',()=>change(p=>{p.ages[p.activeStage]=R.age(p.ages[p.activeStage]+dir*R.STAGES[p.activeStage].step,p.activeStage);},'Browsing age updated.'));
  for(const id of ['searchInput','domainFilter','availabilityFilter'])$(id).addEventListener(id==='searchInput'?'input':'change',renderExerciseGrid);
  $('archiveFilter').addEventListener('change',renderArchive);$('resetBtn').addEventListener('click',resetProgress);$('exportBtn').addEventListener('click',exportState);$('importInput').addEventListener('change',importState);
  const tabs=[...document.querySelectorAll('[data-tab]')];
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectTab(tab.dataset.tab));tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=(index+1)%tabs.length;if(event.key==='ArrowLeft')target=(index+tabs.length-1)%tabs.length;if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;if(target!==undefined){event.preventDefault();selectTab(tabs[target].dataset.tab,true);}});});
  $('guideLink').addEventListener('click',event=>{event.preventDefault();selectTab('guide',true);$('panel-guide').scrollIntoView();});
  $('cancelSession').addEventListener('click',()=>$('sessionDialog').close());
  $('sessionDialog').addEventListener('close',()=>{if(sessionOpener?.isConnected)sessionOpener.focus();sessionTarget=null;});
  $('stagePartFilter').addEventListener('change',renderExerciseGrid);
  const exerciseTabs=[...document.querySelectorAll('[data-exercise-view]')];
  exerciseTabs.forEach((tab,index)=>{tab.addEventListener('click',()=>{exerciseView=tab.dataset.exerciseView;renderExerciseGrid();});tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight'||event.key==='ArrowLeft')target=(index+1)%exerciseTabs.length;if(event.key==='Home')target=0;if(event.key==='End')target=exerciseTabs.length-1;if(target!==undefined){event.preventDefault();exerciseView=exerciseTabs[target].dataset.exerciseView;renderExerciseGrid();exerciseTabs[target].focus();}});});
  const routineTabs=['custom','suggested'].map(name=>$('routine-tab-'+name));
  routineTabs.forEach((tab,index)=>{
    const view=index===0?'custom':'suggested';
    tab.addEventListener('click',()=>selectRoutineView(view));
    tab.addEventListener('keydown',event=>{
      let target;
      if(event.key==='ArrowRight'||event.key==='ArrowLeft')target=1-index;
      if(event.key==='Home')target=0;
      if(event.key==='End')target=1;
      if(target!==undefined){event.preventDefault();selectRoutineView(target===0?'custom':'suggested',true);}
    });
  });
  $('sessionForm').addEventListener('submit',event=>{
    event.preventDefault();
    const date=new Date($('sessionDate').value),minutes=Number($('sessionMinutes').value),note=$('sessionNote').value.trim().slice(0,1000);
    const ex=store.catalog().find(x=>x.id===sessionTarget),mode=sessionMode;
    if(!ex||!Number.isFinite(date.getTime())||date.getTime()>Date.now()+60000||!Number.isFinite(minutes)||minutes<0||minutes>1440){window.alert('Use a valid time no later than now and a duration from 0 to 1440 minutes.');return;}
    if(mode==='observation'&&!note){window.alert('Describe what you observed.');return;}
    if(mode==='completion'&&!canTry(ex)){window.alert('This exercise is no longer eligible for completion.');return;}
    const id=ex.id,at=date.toISOString(),p=profile();
    if(mode==='observation') {
      p.observations.push({exerciseId:id,at,kind:'observation',note});
    } else {
      if(mode==='practice'||minutes>0||note) p.sessions.push({id:crypto.randomUUID(),exerciseId:id,at,minutes,note});
      if(mode==='completion') {
        p.completions=p.completions.filter(c=>c.exerciseId!==id);
        p.completions.push({exerciseId:id,at,criteria:ex.completionCriteria});
      }
    }
    const saved=saveUserState();$('sessionDialog').close();render();
    document.querySelector(`[data-focus-key="${mode==='completion'?'complete':mode==='observation'?'observe':'log'}-${id}"]`)?.focus({preventScroll:true});
    announce(saved ? (mode==='completion'?'Completion saved. Suggested next exercises updated.':mode==='observation'?'Observation saved.':'Practice session saved.') : 'Recorded in memory only. Browser storage failed; export a backup.');
  });
  window.addEventListener('storage',event=>{if(event.key===STATE_KEY)storageWarning('Another tab changed this journal. Export this tab’s unsaved work if needed, then reload to use the other tab’s version.');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeTab==='calendar')renderCalendar(store.catalog(),profile());});
}
async function initializeApp() {
  loadUserState();bindListeners();
  const tasks=[loadSources(),...Object.keys(R.STAGES).map(stage=>store.load(stage))];render();
  await Promise.allSettled(tasks);render();
}
initializeApp();
