/* Integration smoke tests run production scripts with a minimal DOM and storage.
   These test state/event wiring, not visual layout or browser accessibility. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const R=require('../core');
const root=path.join(__dirname,'..');
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.dataset={};this.value='';this.hidden=false;this.isConnected=true;this.textContent='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  addEventListener(type,listener){(this.events[type]??=[]).push(listener);}
  setAttribute(k,v){this[k]=v;}
  showModal(){this.open=true;} close(){this.open=false;for(const fn of this.events.close||[])fn();}
  focus(){} scrollIntoView(){} querySelector(){return new Element('button');}
  get childElementCount(){return this.children.length;}
}
async function boot({saved=null,denyStorage=false}={}){
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  for(const id of ['domainFilter','archiveFilter'])$(id).value='all';$('availabilityFilter').value='ready';
  const tabs=['today','calendar','metrics','archive','guide'].map(name=>{const el=$(`tab-${name}`);el.dataset.tab=name;return el;});
  const panels=tabs.map(tab=>{const el=$(`panel-${tab.dataset.tab}`);el.id=`panel-${tab.dataset.tab}`;return el;});
  const storage=new Map(saved?[['human_lifespan_roadmap_state_v3',JSON.stringify(saved)]]:[]);
  const context={Roadmap:R,window:{Roadmap:R,confirm:()=>true,alert(){},addEventListener(){}},document:{createElement:tag=>new Element(tag),getElementById:$,querySelectorAll:selector=>selector==='[role=tab]'?tabs:panels,querySelector:()=>new Element(),addEventListener(){}},localStorage:{getItem(key){if(denyStorage)throw Error('denied');return storage.get(key)??null;},setItem(key,value){if(denyStorage)throw Error('denied');storage.set(key,value);}},fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url),'utf8'))}),AbortController,setTimeout,clearTimeout,console,crypto:webcrypto,URL,Blob};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'calendar.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
  return {context,$,storage,run:code=>vm.runInContext(code,context)};
}
test('Boot loads all stages and produces source-safe cards',async()=>{const app=await boot();assert.equal(app.run('store.catalog().length'),172);assert.ok(app.$('exerciseGrid').childElementCount>0);assert.equal(app.$('dataWarning').hidden,true);});
test('Repeated resets do not duplicate button listeners or age increments',async()=>{const app=await boot();app.run('resetProgress(); resetProgress();');assert.equal(app.$('agePlus').events.click.length,1);app.$('agePlus').events.click[0]();assert.equal(app.run('profile().ages.infancy'),2.5);});

test('Infant related ideas do not block recording a readiness-based practice completion',async()=>{
  const app=await boot();app.run("profile().ages.infancy=12;showExercise('EX-LAT-001')");
  app.run("openSession('EX-LAT-001','completion')");assert.equal(app.$('sessionDialog').open,true);
  app.$('sessionForm').events.submit[0]({preventDefault(){}});
  assert.ok(app.run("profile().completions.some(c=>c.exerciseId==='EX-LAT-001')"));
  assert.equal(app.run("profile().completions.some(c=>c.exerciseId==='EX-019')"),false);
});
test('New cards expose clickable before and after links without requiring earlier completions',async()=>{
  const app=await boot();app.run("profile().ages.infancy=7;showExercise('EX-NEW-003')");
  const card=app.run("createExerciseCard(store.catalog().find(x=>x.id==='EX-NEW-003'))");
  const body=card.children[1];
  const relation=label=>body.children.find(x=>x.className==='exercise-relations'&&x.children[0].textContent===label);
  const earlier=relation('Helpful before (optional)'),later=relation('Can lead to (optional)');
  assert.ok(earlier);assert.ok(later);
  earlier.children[1].events.click[0]();assert.equal(app.$('searchInput').value,'Midline Toy Grab');
  later.children[1].events.click[0]();assert.equal(app.$('searchInput').value,'Two-Toy Tapping');
  app.run("openSession('EX-NEW-003','completion')");assert.equal(app.$('sessionDialog').open,true);
});

test('Denied storage does not prevent catalog use or in-memory observations',async()=>{const app=await boot({denyStorage:true});assert.equal(app.run('store.catalog().length'),172);app.run("change(p=>p.observations.push({exerciseId:'EX-001',at:null,kind:'legacy'}),'Saved')");assert.equal(app.run('profile().observations.length'),1);assert.equal(app.$('storageWarning').hidden,false);});
test('Zero age and cross-stage historical records survive boot',async()=>{const app=await boot({saved:{activeStage:'infancy',chronologicalAgeWeeks:0,completedExercises:['EX-001','LS-EAD-001','LS-INF-001']}});assert.equal(app.run('profile().ages.infancy'),0);assert.equal(app.$('completedGrid').childElementCount,3);app.run("profile().activeStage='early_adulthood';render()");assert.equal(app.$('completedGrid').childElementCount,3);});
test('Upcoming-only filtering renders without the old scope error',async()=>{const app=await boot();app.$('availabilityFilter').value='upcoming';app.run('renderExerciseGrid()');assert.ok(app.$('exerciseGrid').childElementCount>0);});
test('Removing an observation leaves a recorded session untouched',async()=>{const app=await boot();app.run("profile().observations=[{exerciseId:'EX-001',at:null,kind:'legacy'}];profile().sessions=[{id:'test',exerciseId:'EX-001',at:'2026-09-12T01:00:00Z',minutes:1,note:''}];change(p=>{p.observations=[]},'Removed')");assert.equal(app.run('profile().sessions.length'),1);});
test('Import preview cancellation leaves existing data intact',async()=>{const app=await boot();app.context.window.confirm=()=>false;const incoming=R.emptyState();incoming.profiles[0].name='Imported';app.context.importEvent={target:{files:[{size:100,text:async()=>JSON.stringify(incoming)}],value:'file'}};await app.run('importState(importEvent)');assert.equal(app.run('profile().name'),'My journal');});
test('Confirmed import restores another profile and actual session notes',async()=>{const app=await boot();const incoming=R.emptyState();incoming.profiles[0].name='Imported';incoming.profiles[0].sessions=[{id:'session',exerciseId:'EX-001',at:'2026-09-12T00:00:00Z',minutes:2,note:'<b>plain text</b>'}];app.context.importEvent={target:{files:[{size:100,text:async()=>JSON.stringify(incoming)}],value:'file'}};await app.run('importState(importEvent)');assert.equal(app.run('profile().name'),'Imported');assert.equal(app.run('profile().sessions[0].note'),'<b>plain text</b>');});
test('Invalid import is atomic and does not overwrite stored records',async()=>{const app=await boot();app.context.importEvent={target:{files:[{size:100,text:async()=>'{broken'}],value:'file'}};await app.run('importState(importEvent)');assert.equal(app.run('profile().name'),'My journal');assert.equal(app.run('profile().sessions.length'),0);});
test('Unreadable saved data has a recoverable raw copy before subsequent save',async()=>{const app=await boot({saved:{unrecognized:true}});assert.equal(app.$('storageWarning').hidden,false);app.run('saveUserState()');assert.equal(app.storage.get('human_lifespan_roadmap_state_v4_recovery'),'{"unrecognized":true}');});

test('Completion saves criteria and survives normalization without a confirmation checkbox',async()=>{const app=await boot();app.run("openSession('EX-001','completion')");const submit=app.$('sessionForm').events.submit[0];submit({preventDefault(){}});assert.equal(app.run('profile().completions.length'),1);const saved=JSON.parse(app.storage.get('human_lifespan_roadmap_state_v4'));assert.equal(R.normalizeState(saved).profiles[0].completions.length,1);assert.ok(app.$('nextExercises').childElementCount>1);});
test('Observation saves actual text without completing or unlocking an exercise',async()=>{const app=await boot();app.run("openSession('EX-002','observation')");app.$('sessionNote').value='Followed briefly, then rested';app.$('sessionForm').events.submit[0]({preventDefault(){}});assert.equal(app.run('profile().observations[0].note'),'Followed briefly, then rested');assert.equal(app.run('profile().completions.length'),0);assert.equal(app.run('profile().sessions.length'),0);});
test('Cancelling a completion leaves the journal untouched',async()=>{const app=await boot();app.run("openSession('EX-001','completion')");app.$('cancelSession').events.click[0]();assert.equal(app.run('profile().completions.length'),0);});
test('Storage failure does not announce successful persistence',async()=>{const app=await boot({denyStorage:true});app.run("openSession('EX-001','completion')");app.$('sessionForm').events.submit[0]({preventDefault(){}});assert.match(app.$('liveStatus').textContent,/memory only/);});

test('Prerequisite navigation opens the target and locked completion cannot bypass the graph',async()=>{
  const app=await boot();app.run("showExercise('LS-ADO-009')");
  assert.equal(app.$('searchInput').value,'Risk-Benefit Probabilistic Decision Matrix');
  app.run("openSession('LS-ADO-009','completion')");assert.notEqual(app.$('sessionDialog').open,true);
  app.run("showExercise('LS-ADO-026')");assert.equal(app.run('profile().activeStage'),'adolescence');
  assert.equal(app.$('availabilityFilter').value,'all');
});

test('Completion without practice details does not add an empty session',async()=>{
  const app=await boot();app.run("openSession('EX-002','completion')");
  app.$('sessionForm').events.submit[0]({preventDefault(){}});
  assert.equal(app.run('profile().completions.length'),1);assert.equal(app.run('profile().sessions.length'),0);
});
test('Stage-part filter counts the selected split and prerequisite navigation clears it',async()=>{
  const app=await boot();app.$('availabilityFilter').value='all';app.$('stagePartFilter').value='late';app.run('renderExerciseGrid()');
  assert.equal(app.$('exerciseGrid').childElementCount,13);assert.match(app.$('partProgress').textContent,/0 \/ 13/);
  app.run("showExercise('EX-001')");assert.equal(app.$('stagePartFilter').value,'all');
  assert.equal(app.$('exerciseGrid').childElementCount,1);
});

test('Toddler stage ignores hidden part filters and navigates across stages',async()=>{
  const app=await boot();app.$('availabilityFilter').value='all';app.$('stagePartFilter').value='early';
  app.run("profile().activeStage='toddlerhood';render()");
  assert.equal(app.$('stagePartLabel').hidden,true);assert.equal(app.$('exerciseGrid').childElementCount,30);
  assert.equal(app.$('ageInput').min,12);assert.equal(app.$('ageInput').max,36);
  app.run("showExercise('EX-022')");assert.equal(app.run('profile().activeStage'),'toddlerhood');
  app.run("showExercise('EX-001')");assert.equal(app.run('profile().activeStage'),'infancy');
});
test('Toddler browsing reaches 36 months and saved two-year-old journals reopen there',async()=>{
  const saved=R.emptyState();saved.profiles[0].activeStage='early_childhood';saved.profiles[0].ages.early_childhood=2.5;
  const app=await boot({saved});assert.equal(app.run('profile().activeStage'),'toddlerhood');assert.equal(app.$('ageInput').value,30);
  app.run("profile().ages.toddlerhood=35.5;render()");app.$('agePlus').events.click[0]();
  assert.equal(app.run('profile().ages.toddlerhood'),36);assert.equal(app.$('agePlus').disabled,true);
  app.run("showExercise('LS-ECH-001')");assert.equal(app.run('profile().activeStage'),'toddlerhood');
  app.run("showExercise('LS-ECH-002')");assert.equal(app.run('profile().activeStage'),'early_childhood');assert.equal(app.$('ageInput').min,3);
});
test('Slider updates age output, accessibility text and age-sensitive exercise results',async()=>{
  const app=await boot();app.$('availabilityFilter').value='ready';
  app.$('ageInput').events.input[0]({target:{value:'1.5'}});
  assert.equal(app.run('profile().ages.infancy'),1.5);assert.equal(app.$('ageValueText').textContent,'1.5 months');assert.equal(app.$('ageInput')['aria-valuetext'],'1.5 months');
  const before=app.$('exerciseGrid').childElementCount;
  app.$('ageInput').events.input[0]({target:{value:'6'}});
  assert.ok(app.$('exerciseGrid').childElementCount>before);
  app.run("profile().activeStage='toddlerhood';render()");app.$('ageInput').events.input[0]({target:{value:'30'}});
  assert.equal(app.$('ageValueText').textContent,'30 months (2 years 6 months)');assert.equal(app.$('ageInput')['aria-valuetext'],app.$('ageValueText').textContent);
});
test('Every rendered age note and timeline use the same canonical range across all stages',async()=>{
  const app=await boot();
  for(const stage of Object.keys(R.STAGES)){
    app.run("profile().activeStage='"+stage+"';document.getElementById('availabilityFilter').value='all';render()");
    const notes=app.$('exerciseGrid').children.map(card=>card.children[1].children.find(x=>x.className==='age-note'));
    const items=app.run("store.data.get('"+stage+"').slice().sort((a,b)=>a.complexity-b.complexity||a.minAge-b.minAge||a.id.localeCompare(b.id))");
    assert.equal(notes.length,items.length);
    notes.forEach((note,i)=>{assert.ok(note.textContent.includes('Browsing range: '+R.formatAgeRange(items[i])+'.'),items[i].id);assert.match(note.textContent,/not a milestone deadline/);});
    const timelineRanges=app.$('timelineContainer').children.map(row=>row.children[1].textContent);
    for(const item of items)assert.ok(timelineRanges.some(text=>text.startsWith(R.formatAgeRange(item)+' ·')),item.id);
  }
});
test('Clicking a completed optional preparation opens its completed card with filters cleared',async()=>{
  const app=await boot();
  app.run("const target=store.catalog().find(x=>x.id==='EX-015');profile().completions.push({exerciseId:target.id,at:'2026-10-23T12:00:00Z',criteria:target.completionCriteria});showExercise('EX-NEW-002')");
  const source=app.$('exerciseGrid').children[0];
  const relation=source.children[1].children.find(x=>x.className==='exercise-relations'&&x.children[0].textContent==='Helpful before (optional)');
  const link=relation.children.find(x=>x.tag==='button'&&x.textContent==='Forearm Prop Tummy Time - Completed');
  assert.ok(link);
  app.$('domainFilter').value='cognitive';app.$('stagePartFilter').value='early';app.$('availabilityFilter').value='upcoming';
  link.events.click[0]();
  assert.equal(app.run('exerciseView'),'completed');assert.equal(app.run('activeTab'),'today');
  assert.equal(app.$('exerciseGrid')['aria-labelledby'],'exercise-tab-completed');
  assert.equal(app.$('exerciseGrid').childElementCount,1);assert.equal(app.$('exerciseGrid').children[0].id,'card-EX-015');
  for(const id of ['domainFilter','stagePartFilter','availabilityFilter'])assert.equal(app.$(id).value,'all');
});
test('Required relation navigation selects Completed, then next incomplete target selects To do',async()=>{
  const app=await boot();
  app.run("const foundation=store.catalog().find(x=>x.id==='LS-ADO-026');profile().completions.push({exerciseId:foundation.id,at:'2026-10-23T12:00:00Z',criteria:foundation.completionCriteria});");
  const source=app.run("createExerciseCard(store.catalog().find(x=>x.prerequisites.includes('LS-ADO-026')))");
  const before=source.children[1].children.find(x=>x.className==='exercise-relations'&&x.children[0].textContent==='Complete before this exercise');
  const link=before.children.find(x=>x.tag==='button'&&x.textContent.endsWith(' - Completed'));
  app.run("selectTab('calendar')");link.events.click[0]();
  assert.equal(app.run('activeTab'),'today');assert.equal(app.run('exerciseView'),'completed');
  assert.equal(app.run('profile().activeStage'),'adolescence');
  const completed=app.$('exerciseGrid').children[0];assert.equal(completed.id,'card-LS-ADO-026');
  const next=completed.children[1].children.find(x=>x.className==='exercise-relations'&&x.children[0].textContent==='Next exercises');
  next.children[1].events.click[0]();
  assert.equal(app.run('exerciseView'),'todo');assert.equal(app.$('exerciseGrid')['aria-labelledby'],'exercise-tab-todo');
  assert.equal(app.$('exerciseGrid').childElementCount,1);assert.notEqual(app.$('exerciseGrid').children[0].id,'card-LS-ADO-026');
});
test('Routine tabs switch panels and support keyboard navigation without changing the journal',async()=>{
  const app=await boot();const before=app.run('JSON.stringify(profile())');
  assert.equal(app.$('routine-panel-custom').hidden,false);assert.equal(app.$('routine-panel-suggested').hidden,true);
  app.$('routine-tab-suggested').events.click[0]();assert.equal(app.run('routineView'),'suggested');
  assert.equal(app.$('routine-panel-custom').hidden,true);assert.equal(app.$('routine-tab-suggested')['aria-selected'],'true');assert.equal(app.$('routine-tab-custom').tabIndex,-1);
  let prevented=false;app.$('routine-tab-suggested').events.keydown[0]({key:'Home',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(app.run('routineView'),'custom');assert.equal(app.$('routine-panel-custom').hidden,false);
  assert.equal(app.run('JSON.stringify(profile())'),before);
});
test('Suggested calendar additions persist without changing the generated week',async()=>{
  const app=await boot();app.run("selectTab('calendar');selectRoutineView('suggested')");
  const slots=()=>app.$('suggestedRoutineGrid').children.flatMap(day=>day.children.filter(x=>x.className==='suggested-activity'));
  const item=slots()[0],id=item.dataset.exerciseId;item.children.at(-1).events.click[0]();
  assert.equal(app.run('routineView'),'suggested');assert.equal(app.run('profile().planned.length'),1);assert.equal(app.run('profile().planned[0]'),id);
  assert.equal(app.$('customRoutineCount').textContent,'1');assert.equal(app.$('customRoutineList').childElementCount,1);
  assert.ok(slots().filter(x=>x.dataset.exerciseId===id).every(x=>x.children.at(-1).disabled));
  assert.ok(JSON.parse(app.storage.get('human_lifespan_roadmap_state_v4')).profiles[0].planned.includes(id));
  const custom=app.$('customRoutineList').children[0];custom.children[1].children.find(x=>x.textContent==='Remove').events.click[0]();
  assert.equal(app.run('profile().planned.length'),0);assert.equal(app.$('customRoutineCount').textContent,'0');
});
test('Suggested week refreshes with age and uses completed practice when unfinished choices are sparse',async()=>{
  const app=await boot();app.run("profile().ages.infancy=6;const prep=store.catalog().find(x=>x.id==='EX-015');profile().completions.push({exerciseId:prep.id,at:'2026-10-23T12:00:00Z',criteria:prep.completionCriteria});render()");
  const slots=()=>app.$('suggestedRoutineGrid').children.flatMap(day=>day.children.filter(x=>x.className==='suggested-activity'));
  assert.equal(app.$('suggestedRoutineGrid').childElementCount,7);assert.equal(app.$('suggestedDomainBalance').childElementCount,4);
  const next=slots().find(x=>x.dataset.exerciseId==='EX-NEW-002');assert.ok(next);assert.ok(next.children.some(x=>/Forearm Prop Tummy Time/.test(x.textContent)));
  app.$('ageInput').events.input[0]({target:{value:'0'}});assert.ok(!slots().some(x=>x.dataset.exerciseId==='EX-NEW-002'));
  app.run("for(const ex of store.catalog().filter(x=>x.lifespanStage==='infancy'&&x.minAge<=0))profile().completions.push({exerciseId:ex.id,at:'2026-10-23T12:00:00Z',criteria:ex.completionCriteria});render()");
  assert.equal(app.$('suggestedRoutineGrid').childElementCount,7);assert.ok(slots().length);
  assert.ok(slots().every(x=>x.children.some(child=>child.textContent==='Repeat practice · completed')));
  assert.match(app.$('routineSuggestionSummary').textContent,/repeat practice/);
});
test('Routine preserves chosen but ineligible items and suppresses suggestions on load errors',async()=>{
  const app=await boot();app.run("profile().planned=['EX-001'];profile().ages.infancy=0;selectRoutineView('suggested');render()");
  app.run("store.errors.set('adolescence','HTTP 503');render()");
  assert.equal(app.$('suggestedRoutineGrid').childElementCount,0);assert.match(app.$('routineSuggestionSummary').textContent,/unavailable/);assert.equal(app.run('profile().planned[0]'),'EX-001');
  app.run("store.errors.clear();profile().planned=['EX-020'];render()");
  assert.equal(app.$('customRoutineList').childElementCount,1);assert.match(app.$('customRoutineList').children[0].children[0].children[1].textContent,/outside age/);
  assert.match(app.$('weeklyPlannerGrid').children[0].textContent,/empty/);
});
test('Weekly routine links open completed exercises in their correct Explorer view',async()=>{
  const app=await boot();app.run("const ex=store.catalog().find(x=>x.id==='EX-001');profile().planned=[ex.id];profile().completions.push({exerciseId:ex.id,at:'2026-10-23T12:00:00Z',criteria:ex.completionCriteria});selectTab('calendar');render()");
  const day=app.$('weeklyPlannerGrid').children.find(col=>col.children.some(x=>x.tag==='button'));
  day.children.find(x=>x.tag==='button').events.click[0]();
  assert.equal(app.run('activeTab'),'today');assert.equal(app.run('exerciseView'),'completed');assert.equal(app.$('exerciseGrid').children[0].id,'card-EX-001');
});
test('Suggested week labels all domains and opens completed repeat practice in Completed',async()=>{
  const app=await boot();app.run("profile().ages.infancy=0;for(const ex of store.catalog().filter(x=>x.lifespanStage==='infancy'&&x.minAge<=0))profile().completions.push({exerciseId:ex.id,at:'2026-10-23T12:00:00Z',criteria:ex.completionCriteria});selectTab('calendar');selectRoutineView('suggested');render()");
  const labels=app.$('suggestedDomainBalance').children.map(row=>row.children[0].textContent);
  assert.deepEqual(labels,Object.values(R.DOMAINS));
  const item=app.$('suggestedRoutineGrid').children.flatMap(day=>day.children.filter(x=>x.className==='suggested-activity'))[0];
  assert.ok(item);item.children.find(x=>x.tag==='button').events.click[0]();
  assert.equal(app.run('activeTab'),'today');assert.equal(app.run('exerciseView'),'completed');assert.equal(app.$('exerciseGrid').children[0].id,'card-'+item.dataset.exerciseId);
});
