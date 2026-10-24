/* Shared, dependency-free data and state rules; also used by Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Roadmap = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STAGES = {
    infancy: { name: 'Infancy', min: 0, max: 12, step: 0.5, unit: 'months', default: 2 },
    toddlerhood: { name: 'Toddlerhood', min: 12, max: 36, step: 0.5, unit: 'months', default: 18 },
    early_childhood: { name: 'Early childhood', min: 3, max: 6, step: 0.5, unit: 'years', default: 3 },
    middle_childhood: { name: 'Middle childhood', min: 6, max: 12, step: 0.5, unit: 'years', default: 8 },
    adolescence: { name: 'Adolescence', min: 12, max: 18, step: 0.5, unit: 'years', default: 14 },
    early_adulthood: { name: 'Early adulthood', min: 18, max: 40, step: 1, unit: 'years', default: 25 },
    middle_adulthood: { name: 'Middle adulthood', min: 40, max: 65, step: 1, unit: 'years', default: 50 },
    late_adulthood: { name: 'Later adulthood', min: 65, max: 120, step: 1, unit: 'years', default: 72 }
  };
  const DOMAINS = {
    physical_motor: 'Movement & physical activity', cognitive: 'Learning & thinking',
    language_comm: 'Language & communication', social_emotional: 'Relationships & emotions'
  };
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(x) && !['__proto__','constructor','prototype'].includes(x);
  const ids = x => Array.isArray(x) ? [...new Set(x.filter(validId))].slice(0, 10000) : [];
  const validDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));

  function stageFilename(stage) {
    const fileMap = {
      infancy: 'exercises_infancy.json',
      toddlerhood: 'exercises_toddlerhood.json',
      early_childhood: 'exercises_childhood_early.json',
      middle_childhood: 'exercises_childhood_middle.json',
      adolescence: 'exercises_adolescence.json',
      early_adulthood: 'exercises_adulthood_early.json',
      middle_adulthood: 'exercises_adulthood_middle.json',
      late_adulthood: 'exercises_adulthood_late.json'
    };
    return fileMap[stage] || `exercises_${stage}.json`;
  }

  function stageAssetDirectory(stage, part) {
    const dirs = { infancy:'infancy', toddlerhood:'toddlerhood', early_childhood:'childhood/early', middle_childhood:'childhood/middle', adolescence:'adolescence', early_adulthood:'adulthood/early', middle_adulthood:'adulthood/middle', late_adulthood:'adulthood/late' };
    if (!own(dirs, stage)) throw new Error('Unknown asset stage.');
    return 'assets/' + dirs[stage] + (['infancy','adolescence'].includes(stage) && part ? '/' + part : '');
  }

  function stageFilenames(stage) {
    return ['infancy','adolescence'].includes(stage) ? ['early','middle','late'].map(part=>`exercises_${stage}_${part}.json`) : [stageFilename(stage)];
  }

  function age(value, stage) {
    const s = STAGES[stage];
    const n = typeof value === 'number' ? value : Number.NaN;
    return Math.round(Math.min(s.max, Math.max(s.min, Number.isFinite(n) ? n : s.default)) * 10) / 10;
  }
  function newProfile(name = 'My journal', id = 'default') {
    return { id, name, activeStage: 'infancy', ages: Object.fromEntries(Object.entries(STAGES).map(([k, s]) => [k, s.default])), completions: [], observations: [], sessions: [], skipped: [], planned: [], routineSettings: {} };
  }
  function emptyState() { return { schemaVersion: 4, activeProfileId: 'default', profiles: [newProfile()] }; }
  function normalizeProfile(input, index) {
    const p = newProfile(typeof input.name === 'string' ? input.name.trim().slice(0, 60) || 'My journal' : 'My journal', validId(input.id) ? input.id : `profile-${index}`);
    p.activeStage = own(STAGES, input.activeStage) ? input.activeStage : 'infancy';
    for (const k of Object.keys(STAGES)) p.ages[k] = age(input.ages?.[k], k);
    // Older journals stored toddler browsing age under infancy. Keep their history by ID.
    if (!own(input.ages || {}, 'toddlerhood') && Number.isFinite(input.ages?.infancy) && input.ages.infancy >= 12) {
      p.ages.toddlerhood = age(input.ages.infancy, 'toddlerhood');
      if (p.activeStage === 'infancy') p.activeStage = 'toddlerhood';
    }
    // Two-year-old browsing formerly lived in early childhood (years).
    if (input.activeStage === 'early_childhood' && Number.isFinite(input.ages?.early_childhood) && input.ages.early_childhood >= 2 && input.ages.early_childhood < 3) {
      p.activeStage = 'toddlerhood';
      p.ages.toddlerhood = age(input.ages.early_childhood * 12, 'toddlerhood');
    }
    if (input.routineSettings && typeof input.routineSettings === 'object') for (const [id, settings] of Object.entries(input.routineSettings)) {
      if (validId(id) && id !== '__proto__' && settings && Number.isInteger(settings.daysPerWeek) && settings.daysPerWeek >= 1 && settings.daysPerWeek <= 7 && Number.isFinite(settings.minutes) && settings.minutes > 0 && settings.minutes <= 120) p.routineSettings[id] = { daysPerWeek: settings.daysPerWeek, minutes: settings.minutes };
    }
    p.completions = (Array.isArray(input.completions) ? input.completions : []).filter(c => c && validId(c.exerciseId) && validDate(c.at) && typeof c.criteria === 'string' && c.criteria.trim()).filter((c,i,a)=>a.findIndex(x=>x.exerciseId===c.exerciseId)===i).map(c=>({exerciseId:c.exerciseId,at:c.at,criteria:c.criteria.slice(0,4000)}));
    p.skipped = ids(input.skipped); p.planned = ids(input.planned);
    p.observations = (Array.isArray(input.observations) ? input.observations : []).filter(o => o && validId(o.exerciseId)).slice(0, 10000).map(o => ({ exerciseId: o.exerciseId, at: validDate(o.at) ? o.at : null, kind: o.kind === 'legacy' ? 'legacy' : 'observation', ...(typeof o.note === 'string' ? {note:o.note.slice(0,1000)} : {}) }));
    const sessionIds = new Set();
    p.sessions = (Array.isArray(input.sessions) ? input.sessions : []).filter(s => s && validId(s.id) && validId(s.exerciseId) && validDate(s.at) && !sessionIds.has(s.id) && sessionIds.add(s.id)).slice(-10000).map(s => ({ id: s.id, exerciseId: s.exerciseId, at: s.at, minutes: Number.isFinite(s.minutes) ? Math.max(0, Math.min(1440, s.minutes)) : 0, note: typeof s.note === 'string' ? s.note.slice(0, 1000) : '' }));
    return p;
  }
  function normalizeState(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a journal object.');
    if (input.schemaVersion !== undefined && input.schemaVersion !== 4) throw new Error('Unsupported journal version.');
    if (input.schemaVersion === 4) {
      if (!Array.isArray(input.profiles) || !input.profiles.length || input.profiles.some(p => !p || typeof p !== 'object')) throw new Error('No valid profiles found.');
      const profiles = input.profiles.slice(0, 50).map(normalizeProfile);
      if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Duplicate profile IDs.');
      return { schemaVersion: 4, profiles, activeProfileId: profiles.some(p => p.id === input.activeProfileId) ? input.activeProfileId : profiles[0].id };
    }
    if (!Array.isArray(input.completedExercises)) throw new Error('Unrecognized legacy journal.');
    const result = emptyState(), p = result.profiles[0];
    p.activeStage = own(STAGES, input.activeStage) ? input.activeStage : 'infancy';
    p.ages[p.activeStage] = age(typeof input.chronologicalAgeWeeks === 'number' ? input.chronologicalAgeWeeks : Number(input.chronologicalAgeWeeks), p.activeStage);
    if (input.activeStage === 'infancy' && p.ages.infancy >= 12) {
      p.ages.toddlerhood = age(Number(input.chronologicalAgeWeeks), 'toddlerhood');
      p.activeStage = 'toddlerhood';
    }
    const legacyChildAge = Number(input.chronologicalAgeWeeks);
    if (input.activeStage === 'early_childhood' && Number.isFinite(legacyChildAge) && legacyChildAge >= 2 && legacyChildAge < 3) {
      p.activeStage = 'toddlerhood';
      p.ages.toddlerhood = age(legacyChildAge * 12, 'toddlerhood');
    }
    p.observations = ids(input.completedExercises).map(exerciseId => ({ exerciseId, at: null, kind: 'legacy' }));
    return result;
  }

  function validateDataset(list, stage) {
    if (!Array.isArray(list) || !list.length) throw new Error('Dataset must be a nonempty array.');
    const seen = new Set(), s = STAGES[stage];
    for (let i = 0; i < list.length; i++) {
      const ex = list[i];
      if (!ex || !validId(ex.id) || seen.has(ex.id)) throw new Error('Invalid or duplicate activity ID.');
      seen.add(ex.id);
      if(['infancy','adolescence'].includes(stage) && !['early','middle','late'].includes(ex.stagePart)) throw new Error(ex.id+': invalid stage part.');
      if (ex.schemaVersion !== 1 || ex.lifespanStage !== stage || ex.ageUnit !== s.unit || !own(DOMAINS, ex.domainType)) throw new Error(`${ex.id}: invalid stage, unit, or domain.`);
      // Transition activities keep their original participation windows after regrouping.
      if (!Number.isFinite(ex.minAge) || !Number.isFinite(ex.maxAge) || ex.minAge < s.min || ex.maxAge > (stage === 'infancy' ? 24 : stage === 'toddlerhood' ? 72 : s.max) || ex.maxAge < ex.minAge) throw new Error(`${ex.id}: invalid age window.`);
      if (!Number.isInteger(ex.complexity) || ex.complexity < 1) throw new Error(`${ex.id}: invalid complexity.`);
      for (const k of ['title', 'goal', 'domainSubType', 'benefits', 'completionCriteria', 'readiness', 'imageAlt', 'imagePrompt', 'reps', 'duration']) if (typeof ex[k] !== 'string' || !ex[k].trim()) throw new Error(`${ex.id}: missing ${k}.`);
      for (const k of ['steps', 'safety', 'adaptations', 'sources']) if (!Array.isArray(ex[k]) || !ex[k].length || ex[k].some(v => typeof v !== 'string' || !v.trim())) throw new Error(`${ex.id}: invalid ${k}.`);
      for (const k of ['prerequisites', 'suggestedBefore']) if (!Array.isArray(ex[k]) || ex[k].some(v => !validId(v))) throw new Error(`${ex.id}: invalid ${k}.`);
      if (ex.relatedActivities !== undefined && (!Array.isArray(ex.relatedActivities) || ex.relatedActivities.some(v => !validId(v)))) throw new Error(`${ex.id}: invalid related activities.`);
      for (const k of ['preparationActivities', 'leadsTo']) if (ex[k] !== undefined && (!Array.isArray(ex[k]) || ex[k].some(v => !validId(v)) || new Set(ex[k]).size !== ex[k].length)) throw new Error(`${ex.id}: invalid ${k}.`);
      if (ex.kind !== 'activity' || ex.reviewStatus !== 'source-informed-not-clinically-validated' || !/^\d{4}-\d{2}-\d{2}$/.test(ex.reviewedAt)) throw new Error(`${ex.id}: invalid content status.`);
      if (!/^assets\/[a-zA-Z0-9_/-]+\.(svg|png|webp|jpe?g)$/i.test(ex.imageUrl) || ex.imageUrl.includes('..')) throw new Error(`${ex.id}: unsafe image path or type.`);
      if (ex.imageUrl.slice(0, ex.imageUrl.lastIndexOf('/')) !== stageAssetDirectory(stage, ex.stagePart)) throw new Error(`${ex.id}: artwork outside stage folder.`);
      if (stage === 'toddlerhood' && ex.stagePart !== undefined) throw new Error(`${ex.id}: toddlerhood has no stage parts.`);
      if (!Number.isInteger(ex.schedule?.daysPerWeek) || ex.schedule.daysPerWeek < 1 || ex.schedule.daysPerWeek > 7 || !Number.isFinite(ex.schedule.minutes) || ex.schedule.minutes <= 0 || ex.schedule.minutes > 120 || typeof ex.schedule.strenuous !== 'boolean') throw new Error(`${ex.id}: invalid routine suggestion.`);
    }
    return list;
  }
  function validateCatalog(list) {
    const map = new Map(list.map(x => [x.id, x]));
    if (map.size !== list.length) throw new Error('Duplicate ID across stages.');
    const visiting = new Set(), done = new Set();
    function visit(id) {
      if (visiting.has(id)) throw new Error(`Prerequisite cycle at ${id}.`);
      if (done.has(id)) return;
      visiting.add(id);
      for (const dep of map.get(id).prerequisites) { if (!map.has(dep)) throw new Error(`Unknown prerequisite ${dep}.`); if(map.get(dep).complexity >= map.get(id).complexity) throw new Error(`Invalid complexity hierarchy at ${id}.`); visit(dep); }
      visiting.delete(id); done.add(id);
    }
    list.forEach(x => { visit(x.id); x.prerequisites.forEach(id=>{if(!map.get(id).suggestedBefore.includes(x.id)) throw new Error(`Missing reverse relation ${id}.`);}); x.suggestedBefore.forEach(id => { if (!map.has(id)) throw new Error(`Unknown suggestion ${id}.`); if(!map.get(id).prerequisites.includes(x.id)) throw new Error(`Nonreciprocal suggestion ${id}.`); }); });
    list.forEach(x => (x.relatedActivities || []).forEach(id => { if (!map.has(id) || id === x.id) throw new Error(`Invalid related activity ${id}.`); }));
    list.forEach(x => {
      for (const [field, reverse] of [['preparationActivities', 'leadsTo'], ['leadsTo', 'preparationActivities']]) {
        for (const id of x[field] || []) {
          if (!map.has(id) || id === x.id) throw new Error(`Invalid progression ${x.id}: ${id}.`);
          if (!(map.get(id)[reverse] || []).includes(x.id)) throw new Error(`Nonreciprocal progression ${x.id}: ${id}.`);
        }
      }
    });
    // Optional progression arrows must not contradict required arrows or point back in a cycle.
    const progressing = new Set(), progressed = new Set();
    function visitProgression(id) {
      if (progressing.has(id)) throw new Error(`Progression cycle at ${id}.`);
      if (progressed.has(id)) return;
      progressing.add(id);
      const ex = map.get(id);
      for (const before of [...ex.prerequisites, ...(ex.preparationActivities || [])]) visitProgression(before);
      progressing.delete(id); progressed.add(id);
    }
    list.forEach(x => visitProgression(x.id));
    return map;
  }
  function status(ex, p, catalog = []) {
    const a = p.ages[ex.lifespanStage];
    if (a < ex.minAge) return 'upcoming';
    if (!ex.prerequisites.every(id => catalog.length ? catalog.some(dep=>dep.id===id && completed(dep,p) && prerequisitesMet(dep,p,catalog)) : p.completions.some(c=>c.exerciseId===id))) return 'locked';
    return a > ex.maxAge ? 'earlier' : 'available';
  }
  function prerequisitesMet(ex,p,catalog,seen=new Set()) {
    if(seen.has(ex.id)) return false;
    const path=new Set(seen);path.add(ex.id);
    return ex.prerequisites.every(id=>catalog.some(dep=>dep.id===id&&completed(dep,p)&&prerequisitesMet(dep,p,catalog,path)));
  }
  const completed = (ex,p,catalog=[]) => p.completions.some(c=>c.exerciseId===ex.id && c.criteria===ex.completionCriteria) && (!catalog.length || prerequisitesMet(ex,p,catalog));
  function recommendations(catalog,p) {
    const list=catalog.filter(ex=>ex.lifespanStage===p.activeStage);
    const ready=list.filter(ex=>eligible(ex,p,catalog)&&!completed(ex,p,catalog));
    const next=ready.length ? ready : list.filter(ex=>!completed(ex,p,catalog)&&prerequisitesMet(ex,p,catalog));
    return next.sort((a,b)=>a.complexity-b.complexity||a.minAge-b.minAge||a.id.localeCompare(b.id)).slice(0,4);
  }
  const eligible = (ex, p, catalog = []) => ex.lifespanStage === p.activeStage && ['available', 'earlier'].includes(status(ex, p, catalog));
  function routineSuggestions(catalog, p, limit = 8) {
    const byId = new Map(catalog.map(ex => [ex.id, ex]));
    const candidates = catalog.filter(ex => ex.lifespanStage===p.activeStage && p.ages[p.activeStage]>=ex.minAge && p.ages[p.activeStage]<=ex.maxAge && prerequisitesMet(ex,p,catalog) && !p.skipped.includes(ex.id)).map(ex => {
      const preparation = [...new Set([...ex.prerequisites, ...(ex.preparationActivities || [])])].filter(id => byId.has(id) && completed(byId.get(id),p,catalog));
      return { exercise:ex, preparation, inRange:true, repeat:completed(ex,p,catalog) };
    }).sort((a,b) => Number(a.repeat)-Number(b.repeat) || Number(b.preparation.length>0)-Number(a.preparation.length>0) || a.exercise.complexity-b.exercise.complexity || b.exercise.minAge-a.exercise.minAge || a.exercise.id.localeCompare(b.exercise.id));
    const domains=Object.keys(DOMAINS), buckets=domains.map(domain=>candidates.filter(x=>x.exercise.domainType===domain).slice(0,Math.ceil(limit/domains.length))), selected=[];
    for(let n=0;selected.length<limit&&buckets.some(bucket=>n<bucket.length);n++)for(const bucket of buckets)if(bucket[n]&&selected.length<limit)selected.push(bucket[n]);
    return selected;
  }
  function makeSuggestedPlan(catalog, p, today = new Date()) {
    const activities=routineSuggestions(catalog,p);
    const days=Array.from({length:7},(_,n)=>({date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+n,12),items:[],minutes:0}));
    const assigned=new Map(activities.map(item=>[item.exercise.id,[]]));
    for(const day of days)for(const domain of Object.keys(DOMAINS)){
      const index=days.indexOf(day);
      const choices=activities.filter(item=>{
        const ex=item.exercise, previous=assigned.get(ex.id), settings=p.routineSettings?.[ex.id]||ex.schedule;
        const frequency=ex.schedule.strenuous?Math.min(3,settings.daysPerWeek):settings.daysPerWeek;
        return ex.domainType===domain && previous.length<frequency && (!ex.schedule.strenuous||previous.every(i=>index-i>1));
      }).sort((a,b)=>assigned.get(a.exercise.id).length-assigned.get(b.exercise.id).length||Number(a.repeat)-Number(b.repeat)||activities.indexOf(a)-activities.indexOf(b));
      if(!choices.length)continue;
      const item=choices[0],ex=item.exercise;assigned.get(ex.id).push(index);day.items.push(item);day.minutes+=(p.routineSettings?.[ex.id]||ex.schedule).minutes;
    }
    return {days,activities,domains:Object.keys(DOMAINS).map(domain=>({domain,available:activities.filter(item=>item.exercise.domainType===domain).length,sessions:days.reduce((sum,day)=>sum+day.items.filter(item=>item.exercise.domainType===domain).length,0)}))};
  }
  function formatAge(value, unit) {
    const label = value === 1 ? unit.slice(0, -1) : unit;
    if (unit !== 'months' || value < 24) return value + ' ' + label;
    const years = Math.floor(value / 12), months = Math.round((value % 12) * 10) / 10;
    return value + ' months (' + years + (years === 1 ? ' year' : ' years') + (months ? ' ' + months + (months === 1 ? ' month' : ' months') : '') + ')';
  }
  function formatAgeRange(ex) {
    if (ex.lifespanStage === 'late_adulthood' && ex.maxAge === STAGES.late_adulthood.max) return ex.minAge + '+ years';
    const range = ex.minAge + '–' + ex.maxAge + ' ' + ex.ageUnit;
    return ex.ageUnit === 'months' && ex.minAge >= 24 ? range + ' (' + ex.minAge / 12 + '–' + ex.maxAge / 12 + ' years)' : range;
  }
  function formatStageRange(stage) {
    const s = STAGES[stage];
    return formatAgeRange({lifespanStage:stage,minAge:s.min,maxAge:s.max,ageUnit:s.unit});
  }
  const ageInMonths = ex => ex.minAge * (ex.ageUnit === 'years' ? 12 : 1);
  function localDay(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function makePlan(catalog, p, today = new Date()) {
    const days = Array.from({ length: 7 }, (_, n) => { const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 12); return { date, items: [], minutes: 0 }; });
    const selected = catalog.filter(ex => p.planned.includes(ex.id) && eligible(ex, p, catalog));
    for (const ex of selected) {
      const assigned = [];
      const settings = p.routineSettings?.[ex.id] || ex.schedule;
      const frequency = ex.schedule.strenuous ? Math.min(3, settings.daysPerWeek) : settings.daysPerWeek;
      for (let n = 0; n < frequency; n++) {
        const candidates = days.map((d, i) => ({ d, i })).filter(({ i }) => !assigned.includes(i) && (!ex.schedule.strenuous || assigned.every(j => Math.abs(j - i) > 1)));
        candidates.sort((a, b) => a.d.minutes - b.d.minutes || a.i - b.i);
        if (!candidates.length) break;
        const { d, i } = candidates[0]; assigned.push(i); d.items.push(ex); d.minutes += settings.minutes;
      }
    }
    return days;
  }
  function metrics(catalog, p) {
    return Object.keys(DOMAINS).map(domain => {
      const items = catalog.filter(ex => ex.lifespanStage === p.activeStage && ex.domainType === domain);
      return { domain, total: items.length, completed: items.filter(ex=>completed(ex,p,catalog)).length, observed: items.filter(ex => p.observations.some(o => o.exerciseId === ex.id)).length, sessions: p.sessions.filter(s => items.some(ex => ex.id === s.exerciseId)).length };
    });
  }
  class DatasetStore {
    constructor(fetcher) { this.fetcher = fetcher; this.data = new Map(); this.errors = new Map(); this.pending = new Set(); this.versions = new Map(); }
    async load(stage) {
      const version = (this.versions.get(stage) || 0) + 1; this.versions.set(stage, version); this.pending.add(stage); this.errors.delete(stage);
      try {
        const parts = await Promise.all(stageFilenames(stage).map(async file => {
          const response = await this.fetcher(`exercises/${file}`);
          if (!response?.ok) throw new Error(`${file}: HTTP ${response?.status || 404}`);
          return validateDataset(await response.json(), stage);
        }));
        const list = validateDataset(parts.flat(), stage);
        if (this.versions.get(stage) !== version) return;
        const others = [...this.data.entries()].filter(([k]) => k !== stage).flatMap(([, v]) => v);
        if (new Set([...others, ...list].map(x => x.id)).size !== others.length + list.length) throw new Error('Duplicate ID across stages.');
        this.data.set(stage, list);
      } catch (error) { if (this.versions.get(stage) === version) { this.data.delete(stage); this.errors.set(stage, error.message); } }
      finally { if (this.versions.get(stage) === version) this.pending.delete(stage); }
    }
    catalog() { return [...this.data.values()].flat(); }
  }
  return { STAGES, DOMAINS, age, newProfile, emptyState, normalizeState, validateDataset, validateCatalog, status, completed, recommendations, routineSuggestions, makeSuggestedPlan, eligible, ageInMonths, localDay, makePlan, metrics, DatasetStore, stageFilename, stageFilenames, stageAssetDirectory, prerequisitesMet, formatAge, formatAgeRange, formatStageRange };
});
