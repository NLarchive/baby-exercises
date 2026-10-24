'use strict';
let routineView = 'custom';
function selectRoutineView(view, focus = false) {
  routineView = view === 'suggested' ? 'suggested' : 'custom';
  for (const name of ['custom','suggested']) {
    const tab=document.getElementById(`routine-tab-${name}`), selected=name===routineView;
    tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    document.getElementById(`routine-panel-${name}`).hidden=!selected;
    if(selected&&focus)tab.focus();
  }
}
function renderRoutineSuggestions(catalog, p) {
  const grid=document.getElementById('suggestedRoutineGrid'),summary=document.getElementById('routineSuggestionSummary'),balance=document.getElementById('suggestedDomainBalance');grid.replaceChildren();balance.replaceChildren();
  let problem=store.pending.size?'Suggestions will appear when the catalog finishes loading.':store.errors.size?'Suggestions are unavailable until the catalog loads successfully. Use Retry above.':'';
  if(!problem)try{Roadmap.validateCatalog(catalog);}catch{problem='Suggestions are unavailable while activity relationships cannot be verified.';}
  if(problem){document.getElementById('suggestedRoutineCount').textContent='…';summary.textContent=problem;return;}
  const plan=Roadmap.makeSuggestedPlan(catalog,p);
  document.getElementById('suggestedRoutineCount').textContent=String(plan.activities.length);
  const repeats=plan.activities.filter(item=>item.repeat).length;
  summary.textContent='A seven-day practice series for '+Roadmap.formatAge(p.ages[p.activeStage],Roadmap.STAGES[p.activeStage].unit)+'. Unfinished activities within their browsing range come first in each domain. '+(repeats?repeats+' completed activities fill sparse domains as repeat practice. ':'')+'Up to one activity per domain each day, rotating up to two choices per domain. Future, out-of-range and prerequisite-blocked activities are excluded. This is an optional plan, not a developmental prescription.';
  for(const row of plan.domains){
    const item=node('div',undefined,'domain-balance-item');
    item.append(node('strong',Roadmap.DOMAINS[row.domain]),node('p',row.available?row.sessions+' sessions across '+row.available+' activities':'No activity fits this age and readiness. This domain is left open.','small'));balance.append(item);
  }
  if(!plan.activities.length){grid.append(node('p','No activities fit the current age range and readiness. The calendar stays open; it will not fill gaps with future activities.','empty'));return;}
  for(const day of plan.days){
    const col=node('article',undefined,'day-column'),heading=node('h3'),date=node('time',day.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));date.dateTime=Roadmap.localDay(day.date);heading.append(date);col.append(heading,node('p',day.minutes+' optional minutes'));
    if(!day.items.length)col.append(node('p','Open day — choose rest or everyday play.'));
    for(const {exercise:ex,repeat,preparation} of day.items){
      const item=node('div',undefined,'suggested-activity');item.dataset.exerciseId=ex.id;
      item.append(node('span',Roadmap.DOMAINS[ex.domainType],'tag domain-'+ex.domainType),button(ex.title,()=>showExercise(ex.id)),node('p',repeat?'Repeat practice · completed':'New practice · not yet complete','routine-practice-kind'),node('p','Browsing range: '+Roadmap.formatAgeRange(ex),'small'));
      if(preparation.length)item.append(node('p','Builds on completed: '+preparation.map(id=>catalog.find(ex=>ex.id===id).title).join('; ')+'.','small'));
      const added=p.planned.includes(ex.id),add=button(added?'In My routine':'Add to my routine',()=>{
        change(current=>{if(!current.planned.includes(ex.id))current.planned.push(ex.id);},'Added to My routine.');
        document.getElementById('routine-tab-suggested').focus();
      });add.disabled=added;item.append(add);col.append(item);
    }
    grid.append(col);
  }
}
function renderCalendar(catalog, p) {
  const grid=document.getElementById('weeklyPlannerGrid'),timeline=document.getElementById('timelineContainer');grid.replaceChildren();timeline.replaceChildren();
  selectRoutineView(routineView);
  const custom=document.getElementById('customRoutineList');custom.replaceChildren();
  const chosen=catalog.filter(ex=>p.planned.includes(ex.id)&&ex.lifespanStage===p.activeStage);
  document.getElementById('customRoutineCount').textContent=String(chosen.length);
  for(const ex of chosen){
    const item=node('article',undefined,'routine-item'),copy=node('div');
    copy.append(node('h4',ex.title),node('p',Roadmap.eligible(ex,p,catalog)?'Included in the seven-day plan.':'Kept in your routine; currently outside age or prerequisite readiness.','muted'));
    const actions=node('div',undefined,'actions');actions.append(button('View exercise',()=>showExercise(ex.id)),button('Remove',()=>{
      change(current=>{current.planned=current.planned.filter(id=>id!==ex.id);},'Removed from My routine.');
      document.getElementById('routine-tab-custom').focus();
    }));item.append(copy,actions);custom.append(item);
  }
  renderRoutineSuggestions(catalog,p);
  const selected=catalog.filter(ex=>p.planned.includes(ex.id)&&Roadmap.eligible(ex,p,catalog));
  const missing=p.planned.filter(id=>!catalog.some(ex=>ex.id===id)).length;
  document.getElementById('planSummary').textContent=`${selected.length} eligible activities selected for this stage. ${missing?`${missing} selected activities are unavailable. `:''}Future and other-stage activities are not scheduled. Choose fewer activities if the week feels too full. Strength sessions for the same activity are separated within this seven-day view; this is not an individualized recovery plan.`;
  if(!selected.length)grid.append(node('p','Your routine is empty for this stage. Add an activity from Explore when you want to make room for it.','empty'));
  else for(const day of Roadmap.makePlan(catalog,p)) {
    const col=node('article',undefined,'day-column'),heading=node('h3'),date=node('time',day.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));date.dateTime=Roadmap.localDay(day.date);heading.append(date);col.append(heading,node('p',`${day.minutes} suggested minutes`));
    if(!day.items.length)col.append(node('p','Open day — choose rest or everyday activity.'));
    for(const ex of day.items){const logged=p.sessions.some(s=>s.exerciseId===ex.id&&Roadmap.localDay(new Date(s.at))===Roadmap.localDay(day.date));const b=button(`${ex.title}${logged?' · logged':''}`,()=>showExercise(ex.id));col.append(b);}grid.append(col);
  }
  const list=catalog.filter(ex=>ex.lifespanStage===p.activeStage).sort((a,b)=>a.minAge-b.minAge);
  if(!list.length)timeline.append(node('p','No timeline data is loaded for this stage.','empty'));
  for(const ex of list){const row=node('div',undefined,'timeline-row');row.append(node('strong',ex.title),node('p',`${Roadmap.formatAgeRange(ex)} · ${Roadmap.status(ex,p,catalog)==='upcoming'?'upcoming browsing idea':'adapt to current readiness'}`));timeline.append(row);}
}
