'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../core');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
const datasets=Object.fromEntries(Object.keys(R.STAGES).map(stage=>[stage,R.validateDataset(R.stageFilenames(stage).flatMap(file=>read(`exercises/${file}`)),stage)]));
const infancy=[...datasets.infancy,...datasets.toddlerhood],adults=datasets.early_adulthood,catalog=Object.values(datasets).flat();
test('Every stage validates, covers four domains, and resolves all graph references',()=>{for(const s of Object.keys(R.STAGES)){const list=R.validateDataset(read(`exercises/${R.stageFilename(s)}`),s);assert.equal(new Set(list.map(x=>x.domainType)).size,4);}assert.equal(R.validateCatalog(catalog).size,172);});
test('All imagery and source references exist',()=>{const sources=read('sources.json');catalog.forEach(ex=>{assert.ok(fs.existsSync(path.join(__dirname,'..',ex.imageUrl)));ex.sources.forEach(s=>assert.ok(sources[s]));});});

test('Infant standing, gestures and feeding use current readiness without parallel-skill locks',()=>{
  const p=R.newProfile();p.ages.infancy=18;
  for(const id of ['EX-LAT-001','EX-024','EX-LAT-002','EX-LAT-005','EX-027']){
    const ex=infancy.find(x=>x.id===id);
    assert.deepEqual(ex.prerequisites,[]);
    p.activeStage=ex.lifespanStage;p.ages[ex.lifespanStage]=18;assert.ok(R.eligible(ex,p,catalog),id);
  }
  assert.ok(infancy.find(x=>x.id==='EX-LAT-001').relatedActivities.includes('EX-019'));
  assert.ok(infancy.every(ex=>ex.prerequisites.length===0));
  assert.equal(infancy.find(x=>x.id==='EX-006').minAge,0);
  assert.equal(infancy.find(x=>x.id==='EX-008').minAge,0);
});

test('Review preserves all original image references and supplies only the 25 additions with new artwork',{skip:!fs.existsSync(path.join(__dirname,'../exercises/catalog_review_2026-10-23.json'))?'Historical review manifest omitted; provenance cannot be verified':false},()=>{
  const review=read('exercises/catalog_review_2026-10-23.json'),jobs=read('assets/REVIEW_IMAGE_JOBS.json');
  assert.equal(review.changes.filter(x=>x.status==='added').length,25);
  assert.equal(jobs.length,25);
  assert.equal(new Set(jobs.map(x=>x.imageUrl)).size,25);
  for(const row of review.changes){
    const ex=catalog.find(x=>x.id===row.id);assert.ok(ex,row.id);
    if(row.status==='revised')assert.equal(ex.imageUrl,row.originalImageUrl,row.id);
    else {const job=jobs.find(x=>x.id===row.id);assert.equal(ex.imageUrl,job.imageUrl);assert.equal(job.status,'generated-and-reviewed');}
  }
});

test('Source registry is strict UTF-8 and related references cannot point to missing records',()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'..','sources.json'));
  assert.doesNotThrow(()=>new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const clone=structuredClone(catalog);clone[0].relatedActivities=['missing'];
  assert.throws(()=>R.validateCatalog(clone),/related activity/);
});

test('All additions have reciprocal directional links without new completion locks',()=>{
  const added=catalog.filter(x=>x.imageUrl.includes('reviewed-2026-10-23'));
  assert.equal(added.length,25);
  for(const row of added){
    const ex=catalog.find(x=>x.id===row.id);
    assert.ok(Array.isArray(ex.preparationActivities),ex.id);
    assert.ok(Array.isArray(ex.leadsTo),ex.id);
    assert.ok(ex.preparationActivities.length+ex.leadsTo.length>0,ex.id);
    for(const id of ex.preparationActivities)assert.ok(catalog.find(x=>x.id===id).leadsTo.includes(ex.id));
    for(const id of ex.leadsTo)assert.ok(catalog.find(x=>x.id===id).preparationActivities.includes(ex.id));
  }
  const transfer=catalog.find(x=>x.id==='EX-NEW-003');
  assert.ok(transfer.preparationActivities.includes('EX-016'));
  assert.ok(transfer.leadsTo.includes('EX-023'));
  const p=R.newProfile();p.ages.infancy=7;
  assert.ok(R.eligible(transfer,p,catalog));assert.equal(p.completions.length,0);
});

test('Progression validation rejects missing, nonreciprocal, cyclic and contradictory edges',()=>{
  const fixture=()=>structuredClone(infancy.slice(0,2)).map(ex=>({...ex,prerequisites:[],suggestedBefore:[],relatedActivities:[],preparationActivities:[],leadsTo:[]}));
  let [a,b]=fixture();a.leadsTo=['missing'];assert.throws(()=>R.validateCatalog([a,b]),/Invalid progression/);
  [a,b]=fixture();a.leadsTo=[b.id];assert.throws(()=>R.validateCatalog([a,b]),/Nonreciprocal progression/);
  [a,b]=fixture();a.leadsTo=[b.id];b.preparationActivities=[a.id];b.leadsTo=[a.id];a.preparationActivities=[b.id];
  assert.throws(()=>R.validateCatalog([a,b]),/Progression cycle/);
  [a,b]=fixture();a.leadsTo=[b.id];b.preparationActivities=[a.id];a.prerequisites=[b.id];b.suggestedBefore=[a.id];a.complexity=2;
  assert.throws(()=>R.validateCatalog([a,b]),/Progression cycle/);
  assert.throws(()=>R.validateDataset([{...infancy[0],leadsTo:['EX-002','EX-002']}],'infancy'),/invalid leadsTo/);
});

test('Planning examples agree with structured defaults without claiming a clinical dose',()=>{
  for(const ex of catalog){
    assert.ok(ex.reps.includes(`${ex.schedule.daysPerWeek} days per week`),ex.id);
    assert.ok(ex.duration.includes(`Up to ${ex.schedule.minutes} minutes`),ex.id);
    assert.equal(ex.reviewStatus,'source-informed-not-clinically-validated');
  }
  const plan=catalog.find(x=>x.id==='LS-ADO-024').steps.join(' ');
  assert.match(plan,/12–17.*60 minutes/);assert.match(plan,/At age 18.*150–300/);
});
test('Zero-age legacy migration preserves IDs and does not invent dates',()=>{const s=R.normalizeState({activeStage:'infancy',chronologicalAgeWeeks:0,completedExercises:['EX-001','EX-001','LS-INF-001',3]});assert.equal(s.profiles[0].ages.infancy,0);assert.deepEqual(s.profiles[0].observations,[{exerciseId:'EX-001',at:null,kind:'legacy'},{exerciseId:'LS-INF-001',at:null,kind:'legacy'}]);});
test('Invalid stage and out-of-bounds age are safely normalized',()=>{const s=R.normalizeState({activeStage:'__proto__',chronologicalAgeWeeks:1000,completedExercises:[]});assert.equal(s.profiles[0].activeStage,'infancy');assert.equal(s.profiles[0].ages.infancy,12);assert.equal(s.profiles[0].activeStage,'infancy');});
test('Version 4 round-trip retains independent profiles, sessions, skips and routine settings',()=>{const s=R.emptyState();s.profiles.push(R.newProfile('Second','second'));s.profiles[0].sessions=[{id:'s1',exerciseId:'EX-001',at:'2026-09-12T10:00:00.000Z',minutes:2,note:'A quiet moment'}];s.profiles[0].skipped=['EX-002'];s.profiles[0].planned=['EX-003'];s.profiles[0].routineSettings={'EX-003':{daysPerWeek:2,minutes:1}};assert.deepEqual(R.normalizeState(JSON.parse(JSON.stringify(s))),s);});
test('Malformed and future backups fail without mutating an existing journal',()=>{const s=R.emptyState();for(const bad of [null,{},[],{schemaVersion:9},{schemaVersion:4,profiles:[null]}])assert.throws(()=>R.normalizeState(bad));assert.deepEqual(s,R.emptyState());});
test('Duplicate profile IDs are rejected',()=>{assert.throws(()=>R.normalizeState({schemaVersion:4,profiles:[R.newProfile(),R.newProfile()]}),/Duplicate/);});
test('Bad sessions are removed and oversized notes are bounded',()=>{const s=R.emptyState();s.profiles[0].sessions=[null,{id:'s1',exerciseId:'EX-001',at:'2026-09-12T00:00:00Z',minutes:-3,note:'x'.repeat(2000)},{id:'s2',exerciseId:'EX-001',at:'garbage'}];const p=R.normalizeState(s).profiles[0];assert.equal(p.sessions.length,1);assert.equal(p.sessions[0].minutes,0);assert.equal(p.sessions[0].note.length,1000);});
test('Validation rejects malformed objects, unsafe paths, missing units and domains',()=>{for(const update of [{ageUnit:'weeks'},{domainType:'mental'},{imageUrl:'javascript:alert(1)'},{minAge:-1},{prerequisites:null},{sources:[]},{lifespanStage:'other'}])assert.throws(()=>R.validateDataset([{...infancy[0],...update}],'infancy'));assert.throws(()=>R.validateDataset({},'infancy'));});
test('Graph validation detects missing dependencies and cycles',()=>{const [a,b]=structuredClone(infancy);a.prerequisites=['missing'];assert.throws(()=>R.validateCatalog([a,b]),/Unknown/);a.prerequisites=[b.id];b.prerequisites=[a.id];assert.throws(()=>R.validateCatalog([a,b]),/cycle|hierarchy/);});
test('Common-unit ordering puts 18 months before 2 years',()=>{assert.ok(R.ageInMonths({minAge:18,ageUnit:'months'})<R.ageInMonths({minAge:2,ageUnit:'years'}));});
test('Future activities are not routine eligible; earlier ranges remain available',()=>{const p=R.newProfile();p.ages.infancy=0;assert.equal(R.eligible(infancy.find(x=>x.id==='EX-022'),p),false);p.skipped=['EX-001'];assert.equal(R.eligible(infancy[0],p),true);p.skipped=[];p.ages.infancy=24;assert.equal(R.status(infancy[0],p),'earlier');assert.equal(R.eligible(infancy[0],p),true);});
test('Counts do not interpret observations as developmental age',()=>{const p=R.newProfile();p.activeStage='early_adulthood';p.observations=[{exerciseId:'LS-EAD-001'}];const metrics=R.metrics(catalog,p);assert.equal(metrics.find(x=>x.domain==='physical_motor').observed,1);assert.equal(metrics.find(x=>x.domain==='cognitive').observed,0);assert.ok(metrics.every(x=>!('age' in x)));});
test('Routine uses explicit selections, overrides and real local dates',()=>{const p=R.newProfile();p.planned=['EX-001','EX-022'];p.routineSettings={'EX-001':{daysPerWeek:2,minutes:1.5}};const days=R.makePlan(catalog,p,new Date(2026,8,12,23));assert.equal(days.length,7);assert.equal(R.localDay(days[0].date),'2026-09-12');assert.equal(R.localDay(days[6].date),'2026-09-18');assert.equal(days.flatMap(x=>x.items).length,2);assert.equal(days.reduce((n,d)=>n+d.minutes,0),3);});
test('Strength sessions are separated within the seven-day plan',()=>{const p=R.newProfile();p.activeStage='adolescence';p.planned=['LS-ADO-001'];p.routineSettings={'LS-ADO-001':{daysPerWeek:7,minutes:5}};const days=R.makePlan(catalog,p);const indexes=days.flatMap((d,i)=>d.items.length?[i]:[]);assert.equal(indexes.length,3);assert.ok(indexes.slice(1).every((n,i)=>n-indexes[i]>1));});
test('Failure removes stale stage data and retry recovers it',async()=>{let fail=false;const store=new R.DatasetStore(async()=>({ok:!fail,status:404,json:async()=>adults}));await store.load('early_adulthood');assert.ok(store.data.has('early_adulthood'));fail=true;await store.load('early_adulthood');assert.ok(!store.data.has('early_adulthood'));assert.match(store.errors.get('early_adulthood'),/404/);fail=false;await store.load('early_adulthood');assert.equal(store.errors.size,0);});
test('Malformed JSON and invalid data surface as load errors',async()=>{const store=new R.DatasetStore(async()=>({ok:true,json:async()=>{throw Error('bad JSON');}}));await store.load('infancy');assert.equal(store.errors.get('infancy'),'bad JSON');assert.equal(store.catalog().length,0);});
test('An older same-stage response cannot replace a newer result',async()=>{const pending=[];const store=new R.DatasetStore(()=>new Promise(resolve=>pending.push(resolve)));const first=store.load('early_adulthood'),second=store.load('early_adulthood');const newer=structuredClone(adults);newer[0].title='New revision';pending[1]({ok:true,json:async()=>newer});await second;pending[0]({ok:true,json:async()=>adults});await first;assert.equal(store.data.get('early_adulthood')[0].title,'New revision');});
test('Independent stage responses cannot overwrite one another',async()=>{const pending={};const store=new R.DatasetStore(url=>new Promise(resolve=>{pending[url]=resolve;}));const a=store.load('middle_adulthood'),b=store.load('early_adulthood');pending['exercises/exercises_adulthood_early.json']({ok:true,json:async()=>adults});await b;pending['exercises/exercises_adulthood_middle.json']({ok:true,json:async()=>datasets.middle_adulthood});await a;assert.equal(store.data.get('middle_adulthood').length,13);assert.equal(store.data.get('early_adulthood').length,13);});


function confirm(p,ex){p.completions.push({exerciseId:ex.id,at:'2026-09-12T00:00:00Z',criteria:ex.completionCriteria});}
test('Observations do not unlock success prerequisites; completions do',()=>{const p=R.newProfile(),ex=catalog.find(x=>x.id==='LS-ADO-005');p.activeStage='adolescence';p.ages.adolescence=ex.minAge;p.observations=[{exerciseId:'LS-ADO-002'}];assert.equal(R.status(ex,p),'locked');confirm(p,catalog.find(x=>x.id==='LS-ADO-002'));assert.equal(R.status(ex,p),'available');});
test('Completion snapshots and observation notes survive export/import',()=>{const s=R.emptyState(),p=s.profiles[0];confirm(p,infancy[0]);p.observations=[{exerciseId:'EX-001',at:'2026-09-12T00:00:00Z',kind:'observation',note:'Comfortable with support'}];assert.deepEqual(R.normalizeState(JSON.parse(JSON.stringify(s))),s);});
test('Recommendations exclude completed exercises and preview the next sequence when age-ready work is complete',()=>{const p=R.newProfile();p.ages.infancy=0;for(const ex of infancy.filter(x=>x.minAge<=0))confirm(p,ex);const next=R.recommendations(catalog,p);assert.ok(next.length);assert.ok(next.every(x=>!R.completed(x,p)));assert.ok(next.every(x=>x.prerequisites.every(id=>p.completions.some(c=>c.exerciseId===id))));assert.equal(p.ages.infancy,0);});
test('Later adulthood starts supported movement before dynamic balance regardless of chronological range',()=>{const p=R.newProfile();p.activeStage='late_adulthood';p.ages.late_adulthood=90;const list=datasets.late_adulthood,chair=list.find(x=>x.id==='LS-LAD-006'),balance=list.find(x=>x.id==='LS-LAD-001');assert.ok(chair.complexity<balance.complexity);assert.equal(R.status(balance,p),'locked');confirm(p,chair);assert.equal(R.status(balance,p),'available');});
test('All complete produces no invented next activity',()=>{const p=R.newProfile();infancy.forEach(ex=>confirm(p,ex));assert.deepEqual(R.recommendations(catalog,p),[]);});

test('Changed success criteria and undone ancestors block descendant readiness',()=>{const p=R.newProfile();p.activeStage='adolescence';p.ages.adolescence=18;const chain=['LS-ADO-002','LS-ADO-005','LS-ADO-017'];for(const id of chain)confirm(p,catalog.find(x=>x.id===id));const target=catalog.find(x=>x.id==='LS-ADO-017');assert.ok(R.eligible(target,p,catalog));p.completions[0].criteria='Outdated criteria';assert.equal(R.eligible(target,p,catalog),false);p.completions=p.completions.filter(x=>x.exerciseId!=='LS-ADO-002');assert.equal(R.eligible(target,p,catalog),false);});
test('Archive current snapshots match every active exercise',(t)=>{const archivePath=path.join(__dirname,'..','exercises/exercises_version_archive.json');if(!fs.existsSync(archivePath))return t.skip('Archive file omitted');const archive=JSON.parse(fs.readFileSync(archivePath,'utf8'));for(const ex of catalog)assert.deepEqual(archive.find(x=>x.id===ex.id).currentVersion,ex);});

test('Every exercise has unique valid PNG, WebP or SVG artwork in its life-stage folder',()=>{
  assert.equal(new Set(catalog.map(ex=>ex.imageUrl)).size,catalog.length);
  for(const ex of catalog){
    assert.equal(path.dirname(ex.imageUrl).replaceAll('\\','/'),R.stageAssetDirectory(ex.lifespanStage,ex.stagePart),ex.id);
    assert.ok(path.basename(ex.imageUrl).startsWith(ex.id+'-'),ex.id);
    if(ex.stagePart)assert.ok(ex.imageUrl.includes('/'+ex.stagePart+'/'),ex.id);
    const data=fs.readFileSync(path.join(__dirname,'..',ex.imageUrl));
    const info=require('../tools/asset-info').assetInfo(data);
    assert.equal(path.extname(ex.imageUrl).slice(1),info.format,ex.id);
    assert.ok(info.width>=512 && info.height>=512,ex.imageUrl);
  }
});

test('Split catalogs are authoritative, atomic on failure, and match compatibility snapshots',async()=>{
  for(const stage of ['infancy','adolescence']){
    const files=R.stageFilenames(stage);
    assert.deepEqual(files.flatMap(file=>read(`exercises/${file}`)),read(`exercises/${R.stageFilename(stage)}`));
    let fail=false;const requested=[];
    const store=new R.DatasetStore(async url=>{requested.push(url);return {ok:!(fail&&url.endsWith('_middle.json')),status:503,json:async()=>read(url)};});
    await store.load(stage);assert.equal(store.data.get(stage).length,datasets[stage].length);
    assert.deepEqual(requested,files.map(file=>`exercises/${file}`));
    fail=true;await store.load(stage);assert.ok(!store.data.has(stage));assert.match(store.errors.get(stage),/middle.*503/);
  }
});
test('Every stage can progress from empty history to completion through valid next tiers',()=>{
  for(const stage of Object.keys(R.STAGES)){
    const p=R.newProfile();p.activeStage=stage;p.ages[stage]=R.STAGES[stage].min;
    for(let n=0;n<datasets[stage].length;n++){
      const next=R.recommendations(catalog,p);assert.ok(next.length,`${stage} stalled at ${n}`);
      const ex=next[0];assert.ok(R.prerequisitesMet(ex,p,catalog));assert.ok(!R.completed(ex,p,catalog));confirm(p,ex);
    }
    assert.deepEqual(R.recommendations(catalog,p),[]);
    assert.equal(datasets[stage].filter(ex=>R.completed(ex,p,catalog)).length,datasets[stage].length);
  }
});
test('Removing a foundation invalidates downstream progress until the chain is restored',()=>{
  const p=R.newProfile();p.activeStage='adolescence';datasets.adolescence.forEach(ex=>confirm(p,ex));
  const foundation=catalog.find(ex=>ex.id==='LS-ADO-026'),descendant=catalog.find(ex=>ex.id==='LS-ADO-009');
  assert.ok(R.completed(descendant,p,catalog));p.completions=p.completions.filter(c=>c.exerciseId!==foundation.id);
  assert.equal(R.completed(descendant,p,catalog),false);assert.ok(R.recommendations(catalog,p).some(ex=>ex.id===foundation.id));
  confirm(p,foundation);assert.ok(R.completed(descendant,p,catalog));
});

test('Old combined-stage backups migrate toddler age and preserve journal records',()=>{
  const old=R.emptyState();const p=old.profiles[0];delete p.ages.toddlerhood;p.ages.infancy=20;
  p.planned=['EX-022'];p.observations=[{exerciseId:'EX-022',at:null,kind:'legacy'}];
  const migrated=R.normalizeState(old);const result=migrated.profiles[0];
  assert.equal(result.activeStage,'toddlerhood');assert.equal(result.ages.toddlerhood,20);
  assert.deepEqual(result.planned,p.planned);assert.deepEqual(result.observations,p.observations);
  assert.deepEqual(R.normalizeState(migrated),migrated);
  const legacy=R.normalizeState({activeStage:'infancy',chronologicalAgeWeeks:18,completedExercises:['EX-022']});
  assert.equal(legacy.profiles[0].activeStage,'toddlerhood');assert.equal(legacy.profiles[0].ages.toddlerhood,18);
});
test('Infancy and toddlerhood partition IDs while preserving transition age windows',()=>{
  assert.equal(datasets.infancy.length,43);assert.equal(datasets.toddlerhood.length,30);
  assert.ok(datasets.infancy.every(ex=>ex.minAge<12));assert.ok(datasets.toddlerhood.every(ex=>ex.minAge>=12));
  assert.equal(datasets.infancy.find(ex=>ex.id==='EX-LAT-005').maxAge,24);
});
test('Two-year-old profiles migrate from years to toddler months without losing history',()=>{
  const state=R.emptyState(),p=state.profiles[0];p.activeStage='early_childhood';p.ages.early_childhood=2.5;
  p.planned=['LS-ECH-001'];p.skipped=['LS-ECH-006'];p.routineSettings={'LS-ECH-001':{daysPerWeek:2,minutes:3}};
  confirm(p,catalog.find(ex=>ex.id==='LS-ECH-001'));
  p.sessions=[{id:'practice',exerciseId:'LS-ECH-001',at:'2026-10-23T12:00:00Z',minutes:3,note:'Jump play'}];
  const result=R.normalizeState(state),m=result.profiles[0];
  assert.equal(m.activeStage,'toddlerhood');assert.equal(m.ages.toddlerhood,30);assert.equal(m.ages.early_childhood,3);
  for(const field of ['planned','skipped','routineSettings','completions','sessions'])assert.deepEqual(m[field],p[field]);
  assert.deepEqual(R.normalizeState(result),result);
  const legacy=R.normalizeState({activeStage:'early_childhood',chronologicalAgeWeeks:2.5,completedExercises:['LS-ECH-001']});
  assert.equal(legacy.profiles[0].ages.toddlerhood,30);assert.equal(legacy.profiles[0].activeStage,'toddlerhood');
  p.ages.early_childhood=3;assert.equal(R.normalizeState(state).profiles[0].activeStage,'early_childhood');
});
test('Third-year activities retain age windows and use optional cross-stage preparation',()=>{
  const jump=catalog.find(ex=>ex.id==='LS-ECH-001'),balance=catalog.find(ex=>ex.id==='LS-ECH-002');
  assert.equal(jump.lifespanStage,'toddlerhood');assert.equal(jump.ageUnit,'months');assert.equal(jump.minAge,24);assert.equal(jump.maxAge,36);
  assert.ok(jump.leadsTo.includes(balance.id));assert.ok(balance.preparationActivities.includes(jump.id));assert.ok(!balance.prerequisites.includes(jump.id));
  const p=R.newProfile();p.activeStage='toddlerhood';p.ages.toddlerhood=30;
  assert.ok(R.eligible(jump,p,catalog));assert.ok(datasets.early_childhood.every(ex=>ex.minAge>=3));
  assert.equal(catalog.find(ex=>ex.id==='LS-ECH-019').maxAge,72);
});
test('Artwork ownership follows current stages and rejects old toddler and adolescence folders',()=>{
  const toddler=structuredClone(datasets.toddlerhood[0]);
  assert.equal(R.stageAssetDirectory('toddlerhood'),'assets/toddlerhood');
  for(const imageUrl of ['assets/infancy/late/'+path.basename(toddler.imageUrl),'assets/toddlerhood/nested/'+path.basename(toddler.imageUrl)])assert.throws(()=>R.validateDataset([{...toddler,imageUrl}],'toddlerhood'),/outside stage folder/);
  assert.throws(()=>R.validateDataset([{...toddler,stagePart:'late'}],'toddlerhood'),/no stage parts/);
  const teen=structuredClone(datasets.adolescence[0]);teen.imageUrl=teen.imageUrl.replace('/adolescence/','/adolecence/');
  assert.throws(()=>R.validateDataset([teen],'adolescence'),/outside stage folder/);
  for(const ex of catalog){assert.ok(ex.imageUrl.endsWith('.webp'),ex.id+' must publish WebP');assert.ok(fs.existsSync(path.join(__dirname,'..',ex.imageUrl)),ex.id+' webp');}
});
test('Age labels preserve units, singulars, transition windows and open-ended later life',()=>{
  assert.equal(R.formatAge(1,'months'),'1 month');assert.equal(R.formatAge(1.5,'months'),'1.5 months');
  assert.equal(R.formatAge(24,'months'),'24 months (2 years)');assert.equal(R.formatAge(30,'months'),'30 months (2 years 6 months)');
  assert.equal(R.formatAgeRange(catalog.find(x=>x.id==='LS-ECH-019')),'24–72 months (2–6 years)');
  assert.equal(R.formatAgeRange(catalog.find(x=>x.id==='LS-ECH-021')),'30–48 months (2.5–4 years)');
  assert.equal(R.formatStageRange('late_adulthood'),'65+ years');assert.equal(R.formatAgeRange(datasets.late_adulthood[0]),'65+ years');
  assert.equal(R.formatAgeRange(catalog.find(x=>x.id==='EX-003')),'0.5–1.5 months');
});
test('Routine suggestions enforce the current range and use completed practice without changing selections',()=>{
  const p=R.newProfile();p.ages.infancy=0;p.planned=['EX-001'];p.skipped=['EX-002'];
  confirm(p,catalog.find(ex=>ex.id==='EX-004'));const before=JSON.stringify(p);
  const suggested=R.routineSuggestions(catalog,p,172);
  assert.ok(suggested.length);assert.equal(JSON.stringify(p),before);
  assert.ok(suggested.every(({exercise:ex})=>ex.minAge<=0&&ex.maxAge>=0&&ex.lifespanStage===p.activeStage&&!p.skipped.includes(ex.id)));
  assert.ok(suggested.some(x=>x.exercise.id==='EX-001'));
  for(const ex of datasets.infancy.filter(ex=>ex.minAge<=0))confirm(p,ex);
  assert.ok(R.routineSuggestions(catalog,p).every(item=>item.repeat));
});
test('Routine suggestions prioritize valid completed preparation and respond to changed criteria',()=>{
  const p=R.newProfile();p.ages.infancy=6;const preparation=catalog.find(ex=>ex.id==='EX-015');
  p.observations=[{exerciseId:preparation.id,at:null,kind:'observation'}];
  assert.equal(R.routineSuggestions(catalog,p,172).find(x=>x.exercise.id==='EX-NEW-002').preparation.length,0);
  confirm(p,preparation);const suggested=R.routineSuggestions(catalog,p);
  assert.equal(suggested[0].exercise.id,'EX-NEW-002');assert.deepEqual(suggested[0].preparation,['EX-015']);
  p.completions[0].criteria='Old wording';assert.equal(R.routineSuggestions(catalog,p,172).find(x=>x.exercise.id==='EX-NEW-002').preparation.length,0);
});
test('Routine suggestions require actual prerequisite completion before recommending a next activity',()=>{
  const p=R.newProfile();p.activeStage='adolescence';p.ages.adolescence=14;
  assert.ok(!R.routineSuggestions(catalog,p,172).some(x=>x.exercise.id==='LS-ADO-008'));
  function completeBranch(id){const ex=catalog.find(item=>item.id===id);ex.prerequisites.forEach(completeBranch);confirm(p,ex);}
  catalog.find(ex=>ex.id==='LS-ADO-008').prerequisites.forEach(completeBranch);
  const next=R.routineSuggestions(catalog,p,172).find(x=>x.exercise.id==='LS-ADO-008');
  assert.ok(next);assert.ok(next.preparation.includes('LS-ADO-026'));
  p.completions=[];assert.ok(!R.routineSuggestions(catalog,p,172).some(x=>x.exercise.id==='LS-ADO-008'));
});
test('Suggested calendars enforce age bounds and one activity per domain per day across the lifespan',()=>{
  for(const stage of Object.keys(R.STAGES))for(const browsingAge of [R.STAGES[stage].min,R.STAGES[stage].default,R.STAGES[stage].max]){
    const p=R.newProfile();p.activeStage=stage;p.ages[stage]=browsingAge;
    catalog.forEach(ex=>confirm(p,ex));const before=JSON.stringify(p);
    const plan=R.makeSuggestedPlan(catalog,p,new Date(2026,9,23,12));
    assert.equal(plan.days.length,7);assert.equal(plan.domains.length,4);assert.equal(JSON.stringify(p),before);
    for(const day of plan.days){
      assert.equal(new Set(day.items.map(item=>item.exercise.domainType)).size,day.items.length);
      for(const item of day.items){const ex=item.exercise;assert.equal(ex.lifespanStage,stage);assert.ok(ex.minAge<=browsingAge&&ex.maxAge>=browsingAge,ex.id);assert.ok(R.prerequisitesMet(ex,p,catalog));assert.equal(item.repeat,true);}
    }
    for(const row of plan.domains){assert.ok(row.available<=2);assert.equal(row.sessions,plan.days.flatMap(day=>day.items).filter(item=>item.exercise.domainType===row.domain).length);}
    for(const item of plan.activities){
      const ex=item.exercise,indexes=plan.days.flatMap((day,i)=>day.items.some(x=>x.exercise.id===ex.id)?[i]:[]);
      assert.ok(indexes.length<=ex.schedule.daysPerWeek);
      if(ex.schedule.strenuous){assert.ok(indexes.length<=3);assert.ok(indexes.slice(1).every((index,i)=>index-indexes[i]>1));}
    }
  }
});
test('A completed fallback never displaces two unfinished age-appropriate activities in a domain',()=>{
  const p=R.newProfile();p.ages.infancy=6;
  const candidates=catalog.filter(ex=>ex.lifespanStage==='infancy'&&ex.domainType==='physical_motor'&&ex.minAge<=6&&ex.maxAge>=6);
  confirm(p,candidates[0]);
  const chosen=R.routineSuggestions(catalog,p).filter(item=>item.exercise.domainType==='physical_motor');
  assert.equal(chosen.length,2);assert.ok(chosen.every(item=>!item.repeat));
  candidates.forEach(ex=>confirm(p,ex));
  const repeated=R.routineSuggestions(catalog,p).filter(item=>item.exercise.domainType==='physical_motor');
  assert.equal(repeated.length,2);assert.ok(repeated.every(item=>item.repeat));
});
test('Missing-domain calendars stay open rather than borrowing younger or future activities',()=>{
  const p=R.newProfile();p.ages.infancy=0;
  const base=catalog.find(ex=>ex.id==='EX-008');
  const list=[{...base,id:'now',domainType:'physical_motor',minAge:0,maxAge:1,prerequisites:[]},{...base,id:'future',domainType:'cognitive',minAge:1,maxAge:2,prerequisites:[]}];
  const plan=R.makeSuggestedPlan(list,p);
  assert.ok(plan.days.flatMap(day=>day.items).every(item=>item.exercise.id==='now'));
  assert.equal(plan.domains.find(row=>row.domain==='cognitive').available,0);
  p.ages.infancy=3;assert.equal(R.makeSuggestedPlan(list,p).activities.length,0);
});
