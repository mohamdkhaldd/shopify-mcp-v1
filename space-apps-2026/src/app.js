/* ================= STATE ================= */
const store = {get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const A = {screen:"lhome", simple:true, mode:"solo", players:["Player 1"], team:"StellarOps", mi:0, d:null, sandbox:false, unlockAll:false, tab:"planner",
  trainRole:"planner", trainIdx:{planner:0,engineer:0,science:0,comms:0}, trained:{}, flight:null, lastScore:{}, voice:true,
  progress: store.get("ma.progress3",{stars:{},best:{}}), flights:0};
const $ = s => document.querySelector(s);
const fmt = (n,dp=0) => Number(n).toLocaleString("en-US",{maximumFractionDigits:dp,minimumFractionDigits:dp});
const esc = s => String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const M = () => MISSIONS[A.mi];
const ROLE_IMG = {planner:1, engineer:2, science:3, comms:4};
const portrait = (role,m) => `img/${m&&m.crew?"crew":"ctrl"}_${ROLE_IMG[role]}.jpg`;
function playerFor(role){ if(A.mode==="solo") return A.players[0]; const n=A.players.length; return A.players[(ROLE_IDS.indexOf(role)+A.flights)%n]; }
const DECIDE = {Easy:60, Medium:45, Hard:30};
const REAL_IDS = ["delta","storm","moon","telescope","mars"];

/* ================= VOICE (browser speech) ================= */
const Voice = (()=>{
  const ok = "speechSynthesis" in window; let voices=[];
  let arVoices=[];
  const load=()=>{ try{ const all=speechSynthesis.getVoices(); voices=all.filter(v=>/^en/i.test(v.lang)); arVoices=all.filter(v=>/^ar/i.test(v.lang)); }catch(e){} };
  if(ok){ load(); try{ speechSynthesis.onvoiceschanged=load; }catch(e){} }
  const P={planner:[0,1,1.02],engineer:[1,1.08,1.04],science:[2,1.18,1.02],comms:[3,.92,1]};
  return { say(role,text,onend){ if(true){ onend&&setTimeout(onend,1200); return; } try{ speechSynthesis.cancel(); const ar=LANG==="ar"; const u=new SpeechSynthesisUtterance(ar?tr(text):text); const [i,p,r]=P[role]||P.planner; const vs=ar?arVoices:voices; if(vs.length) u.voice=vs[i%vs.length]; if(ar) u.lang="ar-EG"; u.pitch=p; u.rate=r; u.onend=()=>onend&&onend(); speechSynthesis.speak(u);}catch(e){ onend&&onend(); } },
           stop(){ try{ ok&&speechSynthesis.cancel(); }catch(e){} } };
})();

/* ================= MODEL ================= */
function compute(m,d){
  let orb = m.orbits.find(o=>o.id===d.orbit)||m.orbits[0];
  const capClass0 = orb.capClass||m.capClass;
  if(d.lv==="rideshare" && m.ride && capClass0==="LEO") orb = m.ride;
  const capClass = orb.capClass||m.capClass;
  const L = LV[d.lv], launches = m.multiLaunch ? d.launches : 1, cap = L.cap[capClass]*launches;
  let cm = m.extraMass, pw = 30+m.basePower, cost = m.baseCost+L.c*launches;
  const add = o=>{cm+=o.m||0; pw+=o.p||0; cost+=o.c||0;};
  d.instr.forEach(k=>add(INSTR[k]));
  [BATT[d.battery],COMPUTER[d.computer],ADCS[d.adcs],SHIELD[d.shield],ANT[d.antenna]].forEach(add);
  let LS, HS;
  if(m.crew){ LS=LSS[d.lss]; HS=HEAT[d.heatshield]; cm+=400+LS.m+HS.m+(d.shelter?SHELTER.m:0); pw+=LS.p; cost+=LS.c+HS.c+(d.shelter?SHELTER.c:0)+(d.abort?ABORT.c:0);
    if(m.multiLaunch && d.engine==="ntp"){ cm+=ENGINE.ntp.m; cost+=ENGINE.ntp.c; } }
  let gen;
  if(d.power==="solar"){ cm+=d.panel*4; cost+=d.panel*1; gen=d.panel*300*m.sun*(orb.dust||1); }
  else { const n=d.power==="rtg2"?2:1; cm+=45*n; cost+=80*n; gen=110*n; }
  const S = STRUCT[d.structure]; cm += cm*S.f; cost += S.c;
  const ntp = m.multiLaunch && d.engine==="ntp";
  const needDays = m.crew ? (orb.days || Math.round(orb.transit*(ntp?.7:1)+orb.stay)) : 0;
  const supplies = m.crew ? 4*d.days*LS.perDay : 0;
  const dry = cm + supplies, entry = m.entry ? cm*m.entry : 0;
  const ve = m.multiLaunch ? ENGINE[d.engine].isp*0.00980665 : VE;
  const dv = (orb.dv||0) + (m.crew?0:(orb.keep||0)*d.life);
  const prop = (dry+entry)*(Math.exp(dv/ve)-1)*1.08;
  const wet = dry+entry+prop;
  const ecl = orb.ecl||0, load = m.nightLoad??1;
  const avgNeed = pw*((1-ecl)+ecl*load);
  const avgGen = d.power==="solar" ? gen*(1-ecl) : gen;
  const margin = avgGen/avgNeed;
  const eclWh = pw*load*(orb.eclH||0)/0.7;
  const battOk = d.power!=="solar" || BATT[d.battery].wh*(m.crew?20:1) >= eclWh;
  const gb = d.instr.reduce((s,k)=>s+(INSTR[k].gb||0),0)*(d.compress?.5:1);
  const dlCap = m.dl[d.antenna]*d.stations*(d.relay?10:1);
  const dataFrac = gb>0 ? Math.min(1,dlCap/gb) : 1;
  const opsYear = m.opsYear + m.stationCost*d.stations + (d.relay?8:0);
  const years = m.crew ? needDays/365 : d.life;
  const buildCost = cost; cost += opsYear*years;
  const budget = A.sandbox ? Infinity : m.budget;
  let effLife = m.crew ? m.life : d.life;
  if(!m.crew && cost>budget) effLife = Math.max(0,Math.min(d.life,(budget-buildCost)/opsYear));
  const has = k => d.instr.includes(k);
  const precise = d.adcs==="precise";
  let sci = 0; const ideal = Object.values(m.instr).reduce((a,b)=>a+b,0);
  d.instr.forEach(k=>{ let v=m.instr[k]||0; if(INSTR[k].precise&&!precise) v*=.3; if(k==="ir_tel" && !(has("sunshield")&&orb.cold)) v*=.2; sci+=v; });
  sci *= (orb.sciF??1);
  const imaging = d.instr.filter(k=>INSTR[k].res).map(k=>INSTR[k].res*(orb.resF||1));
  const bestRes = imaging.length?Math.min(...imaging):Infinity;
  const hits = !m.impact || (has("navcam") && (!orb.aimHard || precise));
  const deflect = m.impact ? 0.009*dry*(orb.speed||0) : 0;
  const lifeF = Math.min(1,effLife/m.life);
  const battF = battOk?1:.5;
  const heatOk = !m.crew || HS.max >= m.reentry;
  const suppliesOk = !m.crew || d.days >= needDays;
  const dose = m.id==="marscrew" ? (orb.transit*(ntp?.7:1)*1.8 + orb.stay*.7)*({none:1,light:.9,heavy:.72}[d.shield]) : m.crew ? needDays*.9 : 0;
  const sciPct = Math.min(100, 100*Math.min(1.2,sci/ideal)*dataFrac*lifeF*battF*(m.impact?(hits?1:0):1));
  const c = {m,d,orb,capClass,L,launches,cap,dry,entry,prop,wet,gen,avgGen,avgNeed,pw,margin,eclWh,battOk,gb,dlCap,dataFrac,opsYear,buildCost,cost,budget,effLife,has,precise,sci,ideal,sciPct,bestRes,hits,deflect,lifeF,battF,heatOk,suppliesOk,needDays,dose,supplies};
  c.goals = m.goals.map(g=>({t:g.t,ok:!!g.f(c),why:g.why}));
  const I=[];
  if(cap<=0) I.push(["bad",`The ${L.name.toLowerCase()} can't reach ${CAPNAME[capClass]}.`,"Choose a bigger rocket."]);
  else if(wet>cap) I.push(["bad",`Too heavy: ${fmt(wet)} kg, but ${launches>1?launches+" launches lift":"the rocket lifts"} ${fmt(cap)} kg to ${CAPNAME[capClass]}.`, m.multiLaunch?"Add launches, use nuclear engines, recycle supplies, or pick the long-stay path.":"Remove parts, or pick a bigger rocket."]);
  if(margin<1) I.push(["bad",`Not enough power: you make ${fmt(avgGen)} W on average but need ${fmt(avgNeed)} W.`,"Bigger solar panels, an RTG, or fewer power-hungry parts."]);
  else if(margin<1.2) I.push(["warn",`Power margin only ${Math.round((margin-1)*100)}%.`,"Engineers keep at least 20% spare because panels age."]);
  if(!battOk) I.push(["warn",`Battery too small for ${orb.eclH} h of darkness (needs ${fmt(eclWh)} Wh).`,"The spacecraft will shut down in every shadow: half the science."]);
  if(m.crew && !suppliesOk) I.push(["bad",`Supplies last ${d.days} days, but this path takes ${needDays} days.`,"Pack more days of supplies (Mission Planner)."]);
  if(m.crew && !heatOk) I.push(["bad",`Heat shield rated for ${HS.max} km/s, but you come home at ${m.reentry} km/s.`,"Choose a stronger heat shield (Spacecraft Engineer)."]);
  if(m.id==="artemis" && !d.abort) I.push(["warn","No launch escape system.","If the rocket fails, the crew has no way out."]);
  if(m.id==="marscrew" && dose>=1000) I.push(["warn",`Crew radiation dose ${fmt(dose)} mSv.`,"Heavy shielding, nuclear engines (faster) or a different path lower it."]);
  if(dataFrac<1) I.push(["warn",`Only ${Math.round(dataFrac*100)}% of your data can reach Earth (${fmt(gb,1)} GB/day made, ${fmt(dlCap,2)} GB/day sent).`,"Bigger antenna, more ground stations, or compression."]);
  const blurry = d.instr.filter(k=>INSTR[k].precise&&!precise);
  if(blurry.length) I.push(["warn",`${blurry.map(k=>INSTR[k].name).join(", ")} needs precise pointing.`,"Without it, pictures are blurry (30% of the science)."]);
  if(cost>budget) I.push(["bad",`Over budget by $${fmt(cost-budget)}M.`, m.crew?"The project goes over budget.":`Money runs out after ${fmt(effLife,1)} of ${d.life} years.`]);
  if(m.id==="mars" && orb.hazard && !precise) I.push(["bad","Landing in a rocky crater without precise navigation.","The rover can't see and dodge rocks as it lands."]);
  if(m.impact && !hits) I.push(["bad",has("navcam")?"At 6 km/s you need precise pointing to aim.":"No navigation camera: you can't find the asteroid.","You will miss the target."]);
  if(!d.instr.length) I.push(["bad","No instruments on board.","No instruments, no science."]);
  c.issues = I;
  return c;
}

/* ================= RENDER ================= */
let flightView=null, previewView=null;
function go(screen){ if(screen!=="flight"&&screen!=="sfly"&&screen!=="lfly"){ Voice.stop(); if(FLY()) SEQ++; } A.screen=screen; render(); window.scrollTo({top:0}); }
function render(){
  const navBtns = [];
  const simpleScr = A.screen in SIMPLE;
  if(simpleScr) navBtns.push(`<button class="btn ghost" data-act="expert" type="button">${L({en:"Expert mode",ar:"وضع الخبراء"})}</button>`);
  else navBtns.push(`<button class="btn ghost" data-act="easy" type="button">${L({en:"Easy mode",ar:"الوضع السهل"})}</button>`);
  if(!simpleScr && !["home","setup"].includes(A.screen)){
    navBtns.push(`<button class="btn ghost" data-go="select" type="button">Missions</button>`);
    navBtns.push(`<button class="btn ghost" data-go="training" type="button">Training</button>`);
  }
  if(!FLY()) navBtns.push(`<button class="btn ghost langbtn" data-act="lang" type="button">${LANG==="ar"?"English":"عربي"}</button>`);
  if(Space3D.ok) navBtns.push(`<button class="btn ghost" data-act="gfx" type="button">Graphics: ${Space3D.quality}</button>`);
  $("#nav").innerHTML = navBtns.join("");
  const fn = ({home,setup,training,select,briefing,design,flight,report,...SIMPLE})[A.screen];
  $("#app").innerHTML = fn();
  (after[A.screen]||SIMPLE_AFTER[A.screen])?.();
}
const after = {};

function home(){
  return `<div class="row" style="justify-content:space-between"><span class="eyebrow">Expert mode · all 8 missions, every number</span></div><section class="hero">
   <canvas id="heroView" class="herocanvas" aria-label="Earth from orbit"></canvas>
   <div class="herotext">
    <div class="eyebrow">NASA Space Apps 2026 · Space Mission Design Game</div>
    <h1>Design it. Launch it.<br><span>See if it survives.</span></h1>
    <p class="lede">You and up to three friends are a real mission team: four specialists in Mission Control, or four astronauts in the capsule. Build a spacecraft within limits on mass, power, money and data, then fly it through solar storms, space junk and dust storms.</p>
    <div class="row"><button class="btn big" data-act="solo" type="button">Play solo</button><button class="btn big ghost2" data-act="team" type="button">Play as a team (2–4)</button></div>
   </div>
  </section>
  <section class="crewrow">${ROLE_IDS.map(r=>`<figure class="crewcard"><img src="${portrait(r,{crew:true})}" alt="" loading="lazy"><figcaption><b>${ROLES[r].name}</b><span>${ROLES[r].does}</span></figcaption></figure>`).join("")}</section>
  <section class="cols2">
   ${[["1 · Learn your role","Short hands-on lessons for the Planner, Engineer, Science Lead and Comms Lead."],["2 · Design the mission","Pick an orbit, rocket, instruments, power and antenna. Your spacecraft is built in 3D as you choose."],["3 · Fly and decide","Watch it launch and fly past real planets. Surprise events give the team time to read, then vote."],["4 · Learn from the result","A report explains why you succeeded or failed and compares you with a real mission."]]
     .map(([t,s])=>`<div class="panel"><h3 style="color:var(--amber)">${t}</h3><p class="help" style="font-size:14px">${s}</p></div>`).join("")}
  </section>`;
}
after.home = () => {
  const cv=$("#heroView"); if(!Space3D.ok||!cv) return;
  const v=Space3D.createView(cv,{}); if(!v) return; const m=MISSIONS[0]; const d=structuredClone(m.def); d.instr=["multispec","thermal"]; d.antenna="medium";
  v.setMission(m,d,compute(m,d)); v.setProgress(.6);
};

function setup(){
  const n = A.players.length;
  return `<section class="panel" style="gap:16px">
   <div class="eyebrow">Mission team</div><h2>Who is on the team?</h2>
   <p class="help" style="font-size:14px">Each player gets a role. Roles rotate after every flight so everyone learns every job. Sit together around one laptop: you share one budget, one rocket and one spacecraft, so you will need to negotiate.</p>
   <div class="field" style="max-width:360px"><label for="teamname">Team name</label><input type="text" id="teamname" value="${esc(A.team)}" maxlength="24"></div>
   <div class="field"><span class="flabel">Players</span>
    <div class="row">${[2,3,4].map(k=>`<button class="btn ghost" data-act="np" data-n="${k}" type="button" ${k===n?'style="border-color:var(--amber)"':""}>${k} players</button>`).join("")}</div></div>
   <div class="cols2">${A.players.map((p,i)=>`<div class="field"><label for="pl${i}">Player ${i+1} · starts as ${ROLES[ROLE_IDS[i%4]].name}${n<4&&i<4-n?" + "+ROLES[ROLE_IDS[i+n]].name:""}</label><input type="text" id="pl${i}" data-pl="${i}" value="${esc(p)}" maxlength="16"></div>`).join("")}</div>
   <div class="row">${A.simple?`<button class="btn" data-go="spick" type="button">${L({en:"Choose a mission",ar:"اختار مهمة"})}</button>`:`<button class="btn" data-go="training" type="button">Start training</button><button class="btn ghost" data-go="select" type="button">Skip to missions</button>`}</div>
  </section>`;
}

function training(){
  const r = A.trainRole, i = A.trainIdx[r], card = CARDS[r][i];
  const tabs = ROLE_IDS.map(id=>`<button class="tab" role="tab" type="button" data-trole="${id}" aria-selected="${id===r}"><img src="${portrait(id)}" alt="">${ROLES[id].name} ${A.trained[id]?'<span class="done">✓</span>':""}<small>${esc(playerFor(id))}</small></button>`).join("");
  return `<section class="panel" style="gap:14px">
   <div class="eyebrow">Training · 3 short lessons per role</div>
   <h2>${A.mode==="solo"?"Learn all four jobs":"Each player: open your role and do your three lessons"}</h2>
   <div class="tabs" role="tablist">${tabs}</div>
  </section>
  <section class="panel card">
   <div class="row" style="justify-content:space-between"><div class="eyebrow">${ROLES[r].name} · lesson ${i+1} of 3</div><div class="dots">${[0,1,2].map(k=>`<i class="${k<=i?"on":""}"></i>`).join("")}</div></div>
   <h2>${card.title}</h2>
   <p style="max-width:65ch;font-size:16px">${card.text}</p>
   <div class="lab" id="lab"><div class="eyebrow" style="color:var(--cyan)">Try it</div><div id="labBody"></div></div>
   <p class="take"><b>Remember:</b> ${card.take}</p>
   <div class="row">
    ${i>0?`<button class="btn ghost" data-act="tprev" type="button">Back</button>`:""}
    ${i<2?`<button class="btn" data-act="tnext" type="button">Next lesson</button>`:`<button class="btn" data-act="tdone" type="button">${ROLE_IDS.every(id=>A.trained[id]||id===r)?"Training done: pick a mission":"Done: next role"}</button>`}
    <button class="btn ghost" data-go="select" type="button">Skip to missions</button>
   </div>
  </section>`;
}
after.training = () => LABS[CARDS[A.trainRole][A.trainIdx[A.trainRole]].lab]($("#labBody"));

function readout(items){return `<div class="readout">${items.map(([l,v,col])=>`<div><div class="l">${l}</div><div class="v" ${col?`style="color:${col}"`:""}>${v}</div></div>`).join("")}</div>`;}
function slider(id,label,min,max,step,val){return `<div class="field"><label for="${id}">${label} <output id="${id}o"></output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;}
const LABS = {
 orbit(el){ el.innerHTML = slider("h","Orbit height",300,1000,10,500)+`<div id="ro"></div>`;
   const f=()=>{const h=+$("#h").value; $("#ho").textContent=h+" km"; const life=Math.pow(10,(h-400)/125);
     $("#ro").innerHTML=readout([["Picture sharpness",fmt(10*h/600,1)+" m"],["Strip seen per pass",fmt(h*.27)+" km"],["Years before air drag",life>100?"100+":fmt(life,life<1?1:0)]]);}; $("#h").oninput=f; f(); },
 rocket(el){ el.innerHTML = slider("ms","Spacecraft mass (with fuel)",100,30000,100,2000)+`<div class="tablewrap" id="ro"></div>`;
   const f=()=>{const m=+$("#ms").value; $("#mso").textContent=fmt(m)+" kg";
     $("#ro").innerHTML=`<table><tr><th>Rocket</th><th>Price</th><th>Low orbit</th><th>Geostationary</th><th>Moon / Mars</th></tr>${Object.values(LV).map(l=>`<tr><td>${l.name}</td><td>$${fmt(l.c)}M</td>${["LEO","GTO","ESC"].map(k=>`<td style="color:${l.cap[k]>=m?"var(--ok)":"var(--bad)"}">${l.cap[k]>=m?"✓":"✗"} ${fmt(l.cap[k])}</td>`).join("")}</tr>`).join("")}</table>`;}; $("#ms").oninput=f; f(); },
 length(el){ el.innerHTML = slider("y","Mission length",1,10,1,3)+`<div id="ro"></div>`;
   const f=()=>{const y=+$("#y").value; $("#yo").textContent=y+" years";
     $("#ro").innerHTML=readout([["Science collected",y*100+" units"],["Ground team cost","$"+y*15+"M"],["Fuel to keep orbit",y*5+" kg"]]);}; $("#y").oninput=f; f(); },
 sun(el){ el.innerHTML = slider("au","Distance from the Sun (Earth = 1)",.7,5.2,.01,1)+`<div id="ro"></div>`;
   const f=()=>{const a=+$("#au").value; const nm=a<.85?"near Venus":a<1.2?"Earth":a<1.8?"Mars":a<3.3?"asteroid belt":"Jupiter"; $("#auo").textContent=fmt(a,2)+" AU · "+nm;
     const w=300/a/a; $("#ro").innerHTML=readout([["Power from 1 m² panel",fmt(w)+" W"],["Panel area for 500 W",fmt(500/w,1)+" m²"],["Sunlight vs Earth",fmt(100/a/a)+"%"]]);}; $("#au").oninput=f; f(); },
 battery(el){ el.innerHTML = `<p class="help">Your satellite uses 400 W and spends 36 minutes of every 95-minute orbit in Earth's shadow.</p><div class="opts">${["small","medium","large"].map(k=>`<label class="opt"><input type="radio" name="lb" value="${k}" ${k==="small"?"checked":""}><span class="t">${BATT[k].name}</span><span class="k">${BATT[k].wh} Wh · ${BATT[k].m} kg</span></label>`).join("")}</div><div id="ro"></div>`;
   const f=()=>{const k=el.querySelector("input:checked").value; const need=400*.6/.7; const ok=BATT[k].wh>=need; const left=Math.max(0,100-100*need/BATT[k].wh);
     $("#ro").innerHTML=readout([["Energy needed in shadow",fmt(need)+" Wh"],["Battery left at sunrise",ok?fmt(left)+"%":"EMPTY",ok?"var(--ok)":"var(--bad)"],["Result",ok?"Survives":"Shuts down",ok?"var(--ok)":"var(--bad)"]]);};
   el.querySelectorAll("input").forEach(i=>i.onchange=f); f(); },
 radiation(el){ el.innerHTML = `<div class="opts">${Object.keys(SHIELD).map(k=>`<label class="opt"><input type="radio" name="ls" value="${k}" ${k==="none"?"checked":""}><span class="t">${SHIELD[k].name}</span><span class="k">${SHIELD[k].m} kg</span></label>`).join("")}<label class="opt"><input type="checkbox" id="lbk"><span class="t">Backup computer</span><span class="k">+4 kg</span></label></div><div class="row"><button class="btn" type="button" id="hit">Simulate a radiation hit</button></div><div id="ro"></div>`;
   $("#hit").onclick=()=>{const s=el.querySelector("input[name=ls]:checked").value, b=$("#lbk").checked; const dmg={none:25,light:10,heavy:0}[s];
     $("#ro").innerHTML=readout([["Damage",dmg+"%",dmg?"var(--warn)":"var(--ok)"],["Computer",dmg>=25&&!b?"Crashed":"Working",dmg>=25&&!b?"var(--bad)":"var(--ok)"],["Why",dmg===0?"Shield blocked it":b?"Backup took over":dmg>=25?"No protection":"Partly blocked"]]);}; },
 instr(el){ const L=["cam_high","multispec","thermal"]; el.innerHTML=`<div class="opts">${L.map(k=>`<label class="opt"><input type="checkbox" value="${k}" ${k==="multispec"?"checked":""}><span class="t">${INSTR[k].name}</span><span class="s">${INSTR[k].what}</span></label>`).join("")}</div><div id="ro"></div>`;
   const f=()=>{const s=[...el.querySelectorAll("input:checked")].map(i=>INSTR[i.value]); const t=k=>s.reduce((a,b)=>a+b[k],0);
     $("#ro").innerHTML=readout([["Mass",t("m")+" kg"],["Power",t("p")+" W"],["Cost","$"+t("c")+"M"],["Data",t("gb")+" GB/day"],["Science",s.length*10+" pts"]]);};
   el.querySelectorAll("input").forEach(i=>i.onchange=f); f(); },
 res(el){ el.innerHTML = slider("rs","Pixel size (smaller = sharper)",1,100,1,30)+`<div id="ro"></div>`;
   const f=()=>{const r=+$("#rs").value; $("#rso").textContent=r+" m"; const gb=2.5e10/r/r*26/1e9;
     $("#ro").innerHTML=readout([["Can you see a car?",r<=3?"Yes":"No"],["Can you see a field?",r<=30?"Yes":"Barely"],["Data for one Delta photo",gb>=1?fmt(gb,1)+" GB":fmt(gb*1000)+" MB"]]);}; $("#rs").oninput=f; f(); },
 quiz(el){ const Q=[["thermal","Heat camera"],["multispec","Plant-health camera"],["lightning","Lightning mapper"],["laser","Laser altimeter"]];
   el.innerHTML=`<p><b>Question:</b> Which instrument can tell healthy crops from thirsty ones?</p><div class="opts">${Q.map(([k,n])=>`<button class="choice" type="button" data-q="${k}"><span class="t">${n}</span></button>`).join("")}</div><div id="ro" class="result" hidden></div>`;
   el.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{const ok=b.dataset.q==="multispec"; const r=$("#ro"); r.hidden=false;
     r.innerHTML=ok?`<b style="color:var(--ok)">Correct.</b> Healthy leaves reflect lots of near-infrared light. The plant-health camera measures that colour, which our eyes can't see.`:`<b style="color:var(--warn)">Not quite.</b> ${INSTR[b.dataset.q].what}. Healthy plants reflect near-infrared light, so you need the plant-health camera.`;}); },
 dist(el){ const D=[["Low Earth orbit",300],["The Moon",50],["Sun–Earth L2",30],["Mars",2],["Jupiter",.1]];
   el.innerHTML=`<div class="opts">${D.map(([n,r],i)=>`<label class="opt"><input type="radio" name="ld" value="${i}" ${i===0?"checked":""}><span class="t">${n}</span></label>`).join("")}</div><div id="ro"></div>`;
   const f=()=>{const [n,r]=D[+el.querySelector("input:checked").value]; const s=400/r;
     $("#ro").innerHTML=readout([["Typical data rate",r>=1?fmt(r)+" Mbit/s":fmt(r*1000)+" kbit/s"],["Time to send 50 MB of photos",s<60?fmt(s,1)+" s":s<3600?fmt(s/60,1)+" min":fmt(s/3600,1)+" h"]]);};
   el.querySelectorAll("input").forEach(i=>i.onchange=f); f(); },
 stations(el){ el.innerHTML = slider("st","Ground stations",1,3,1,1)+`<div id="ro"></div>`;
   const f=()=>{const n=+$("#st").value; $("#sto").textContent=n; const min=n*4*10;
     $("#ro").innerHTML=readout([["Contact time per day",min+" min"],["Data downloaded",fmt(min*60*37.5/1000)+" GB/day"],["Yearly cost","$"+n+"M"]]);}; $("#st").oninput=f; f(); },
 databudget(el){ el.innerHTML = slider("gen","Data your instruments make",5,100,5,60)+`<label class="opt" style="max-width:280px"><input type="checkbox" id="cmp"><span class="t">Compress data</span><span class="s">Needs an advanced computer</span></label><div id="ro"></div>`;
   const f=()=>{const g=+$("#gen").value*($("#cmp").checked?.5:1); $("#geno").textContent=$("#gen").value+" GB/day"; const sent=Math.min(g,30);
     $("#ro").innerHTML=`<p class="help">Your antenna can send 30 GB per day.</p>`+readout([["Data to send",fmt(g)+" GB/day"],["Delivered",fmt(sent)+" GB/day","var(--ok)"],["Lost forever",fmt(g-sent)+" GB/day",g>sent?"var(--bad)":"var(--ok)"]]);};
   $("#gen").oninput=f; $("#cmp").onchange=f; f(); }
};

function select(){
  const st=A.progress.stars;
  const unlocked = i => A.unlockAll||A.sandbox||i===0||(st[MISSIONS[i-1].id]||0)>=1;
  return `<section class="panel"><div class="eyebrow">Choose a mission</div><h2>Mission board</h2>
   <p class="help" style="font-size:14px">Finish a mission with at least one star to unlock the next. Three stars: survive, meet every goal, and finish healthy and on budget. Missions marked <b>Crewed</b> put your team inside the capsule; the rest are flown from Mission Control.</p>
   <div class="row"><label class="opt" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="sbx" ${A.sandbox?"checked":""}><span class="t">Sandbox mode</span><span class="s">· no budget limit, no surprise events</span></label>
   <label class="opt" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="ula" ${A.unlockAll?"checked":""}><span class="t">Unlock all</span><span class="s">· for judges and teachers</span></label></div></section>
   <div class="mgrid">${MISSIONS.map((m,i)=>`<button class="mcard" type="button" data-mi="${i}" ${unlocked(i)?"":"disabled"}>
     <span class="row" style="justify-content:space-between;width:100%"><span class="row" style="gap:6px"><span class="lvl ${m.level}">${m.level}</span>${m.crew?'<span class="lvl Crew">Crewed</span>':'<span class="lvl Free">Mission Control</span>'}</span><span class="stars">${"★".repeat(st[m.id]||0)}${"☆".repeat(3-(st[m.id]||0))}</span></span>
     <span class="t">${m.name}</span><span class="s">${m.place} · budget $${fmt(m.budget)}M</span><span class="s" style="color:var(--ink)">${m.story}</span>
     ${unlocked(i)?"":`<span class="s">Locked: earn a star on ${MISSIONS[i-1].name}</span>`}</button>`).join("")}</div>`;
}

function briefing(){
  const m=M(); const pool=m.events.map(k=>EVENTS[k]);
  return `<section class="panel" style="gap:14px">
   <div class="row" style="justify-content:space-between"><span class="row" style="gap:6px"><span class="lvl ${m.level}">${m.level}</span>${m.crew?'<span class="lvl Crew">Crewed</span>':""}</span><span class="eyebrow">${m.place}</span></div>
   <h1 style="font-size:clamp(28px,5vw,44px)">${m.name}</h1>
   <p class="lede" style="color:var(--ink)">${m.story}</p>
   <div class="readout">${[["Budget",A.sandbox?"Unlimited":"$"+fmt(m.budget)+"M"],["Mission length",m.crew?"Set by your path":m.life+" years"],["Your team",m.crew?"Astronauts in the capsule":"Flight controllers in Mission Control"],["Decision time",DECIDE[m.level]+" s per event"]].map(([l,v])=>`<div><div class="l">${l}</div><div class="v">${v}</div></div>`).join("")}</div>
  </section>
  <div class="cols2">
   <section class="panel"><h3>Mission goals</h3><ul class="goals">${m.goals.map(g=>`<li><span class="g q">GOAL</span><span>${g.t}<br><small class="help">${g.why}</small></span></li>`).join("")}</ul></section>
   <section class="panel"><h3>New idea in this mission</h3><p style="font-size:15px">${m.concept}</p><h3 style="margin-top:6px">Rules of thumb</h3><ul class="plain">${m.rules.map(r=>`<li>${r}</li>`).join("")}</ul></section>
  </div>
  <section class="panel"><h3>Dangers you may face</h3><p class="help">Three of these will happen during the flight. First you read the problem and the four choices with no clock running. When the team is ready, you get ${DECIDE[m.level]} seconds to vote. If time runs out, the game keeps going as planned. Good design makes that the safe choice.</p>
   <div class="cols2">${pool.map(e=>`<div class="risk"><b>${e.title}</b><span>${e.text}</span><span style="color:var(--cyan)">Lead: ${ROLES[e.lead].name}</span></div>`).join("")}</div></section>
  <section class="panel"><h3>Your team today</h3><div class="crewrow small">${ROLE_IDS.map(r=>`<figure class="crewcard"><img src="${portrait(r,m)}" alt=""><figcaption><b>${esc(playerFor(r))}</b><span>${ROLES[r].name} · ${ROLES[r].does}</span></figcaption></figure>`).join("")}</div>
   <div class="row"><button class="btn big" data-go="design" type="button">Start designing</button></div></section>`;
}

/* ---------- design ---------- */
function opt(name,key,cur,t,s,k,disabled,type="radio"){return `<label class="opt"><input type="${type}" name="${name}" value="${key}" ${(type==="radio"?cur===key:cur)?"checked":""} ${disabled?"disabled":""}><span class="t">${t}</span>${s?`<span class="s">${s}</span>`:""}${k?`<span class="k">${k}</span>`:""}</label>`;}
function group(title,help,inner){return `<div class="field"><span class="flabel"><b style="color:var(--ink);font-size:14px">${title}</b></span>${help?`<p class="help">${help}</p>`:""}<div class="opts">${inner}</div></div>`;}
function designTab(){
  const m=M(), d=A.d, r=A.tab; const orb=m.orbits.find(o=>o.id===d.orbit);
  if(r==="planner") return [
    group(m.surface?"Landing site":m.impact||m.crew?"Trajectory":"Orbit", m.surface?"Where the rover lands decides the science and the danger.":m.impact?"How you meet the asteroid decides the push and the difficulty.":m.crew?"Your path decides how long the crew is away, how much fuel you need and how risky it is.":"Your orbit decides what you see, how often, and what it takes to get there.",
      m.orbits.map(o=>opt("orbit",o.id,d.orbit,o.name,o.s,o.capClass==="GTO"?"Needs GTO rocket + 1.8 km/s":o.dv?`Δv ${o.dv} km/s`:"")).join("")),
    group("Launch vehicle", `This mission needs a rocket that reaches <b>${CAPNAME[(orb.capClass)||m.capClass]}</b>.`,
      Object.entries(LV).map(([k,l])=>opt("lv",k,d.lv,l.name,l.s+(k==="rideshare"?" · fixed 550 km orbit":""),`$${fmt(l.c)}M · LEO ${fmt(l.cap.LEO)} · GTO ${fmt(l.cap.GTO)} · Escape ${fmt(l.cap.ESC)} kg`)).join("")),
    m.multiLaunch?slider("launches","Number of launches (assembled in orbit)",1,8,1,d.launches)+`<p class="help">Huge ships are launched in pieces and joined in low Earth orbit. Each launch costs $${fmt(LV[d.lv].c)}M.</p>`:"",
    m.crew?slider("days","Supplies packed (days)",m.id==="artemis"?6:400,m.id==="artemis"?24:1100,m.id==="artemis"?1:10,d.days)+`<p class="help">Air, water and food for four astronauts. Your path needs <b>${compute(m,d).needDays} days</b>. Every extra day is extra mass.</p>`
      :slider("life","Mission length (years)",m.lifeRange[0],m.lifeRange[1],1,d.life)+`<p class="help">Longer = more science, but more ground-team cost and more fuel to stay in orbit.</p>`].join("");
  if(r==="engineer") return [
    m.crew?group("Life support","What keeps four people breathing, drinking and eating.",Object.entries(LSS).map(([k,b])=>opt("lss",k,d.lss,b.name,b.s,`${b.perDay} kg/person/day · ${fmt(b.m)} kg · ${fmt(b.p)} W · $${b.c}M`)).join("")):"",
    m.crew?group("Heat shield",`Coming home, you hit the air at <b>${m.reentry} km/s</b>.`,Object.entries(HEAT).map(([k,b])=>opt("heatshield",k,d.heatshield,b.name,b.s,`${fmt(b.m)} kg · $${b.c}M`)).join("")):"",
    m.crew?group("Crew safety","",opt("shelter","1",!!d.shelter,"Storm shelter","Water-walled room for solar flares",`${SHELTER.m} kg · $${SHELTER.c}M`,false,"checkbox")+(m.id==="artemis"?opt("abort","1",!!d.abort,"Launch escape system","Pulls the capsule away if the rocket fails",`$${ABORT.c}M`,false,"checkbox"):"")):"",
    m.multiLaunch?group("Main engines","",Object.entries(ENGINE).map(([k,b])=>opt("engine",k,d.engine,b.name,b.s,`${fmt(b.m)} kg · $${fmt(b.c)}M`)).join("")):"",
    group("Power source","Solar panels are cheap and light near the Sun. An RTG (nuclear battery) gives 110 W day and night, anywhere.",
      [["solar","Solar panels","Area set below","Cheap, weaker far from the Sun"],["rtg1","1 RTG","110 W, 45 kg","$80M"],["rtg2","2 RTGs","220 W, 90 kg","$160M"]].map(([k,t,s,kk])=>opt("power",k,d.power,t,s,kk)).join("")),
    d.power==="solar"?slider("panel","Solar panel area (m²)",0,m.panelMax,m.panelMax>30?1:.5,d.panel)+`<p class="help">At this destination each m² gives about <b>${fmt(300*m.sun*(orb.dust||1))} W</b> in sunlight · 4 kg and $1M per m².</p>`:"",
    group("Battery","Keeps you alive in shadow or at night.",Object.entries(BATT).map(([k,b])=>opt("battery",k,d.battery,b.name,"",`${b.wh} Wh · ${b.m} kg · $${b.c}M`)).join("")),
    group("Computer","",Object.entries(COMPUTER).map(([k,b])=>opt("computer",k,d.computer,b.name,b.s,`${b.m} kg · ${b.p} W · $${b.c}M`)).join("")),
    group("Pointing control","Sharp cameras, big telescopes and precise landings need precise pointing.",Object.entries(ADCS).map(([k,b])=>opt("adcs",k,d.adcs,b.name,b.s,`${b.m} kg · ${b.p} W · $${b.c}M`)).join("")),
    group("Structure","The frame adds mass in proportion to everything it carries.",Object.entries(STRUCT).map(([k,b])=>opt("structure",k,d.structure,b.name,b.s,`+${Math.round(b.f*100)}% mass · $${b.c}M`)).join("")),
    group("Radiation shielding","",Object.entries(SHIELD).map(([k,b])=>opt("shield",k,d.shield,b.name,b.s||"",`${b.m} kg · $${b.c}M`)).join(""))].join("");
  if(r==="science") return group("Instruments",`Pick the instruments that answer the goals. Science value shown for this mission.`,
      Object.keys(m.instr).map(k=>{const I=INSTR[k];return opt("instr",k,d.instr.includes(k),I.name,I.what,`${fmt(I.m)} kg · ${I.p} W · $${fmt(I.c)}M · ${I.gb} GB/day · science ${m.instr[k]}/10`,false,"checkbox");}).join(""));
  if(r==="comms") return [
    group("Antenna",`For this destination: small ${m.dl.small}, medium ${m.dl.medium}, large ${m.dl.large} GB/day per ground station.`,Object.entries(ANT).map(([k,b])=>opt("antenna",k,d.antenna,b.name,b.s,`${b.m} kg · ${b.p} W · $${b.c}M`)).join("")),
    slider("stations","Ground stations",1,3,1,d.stations)+`<p class="help">Each station multiplies contact time. Costs $${m.stationCost}M per station per year.</p>`,
    group("Data handling","",opt("compress","1",!!d.compress,"Compress data","Halves the data. Needs an advanced computer.","",d.computer==="basic","checkbox")+(m.relay?opt("relay","1",!!d.relay,"Relay via Mars orbiters","10× faster than talking to Earth directly","$8M per year",false,"checkbox"):""))].join("");
}
function design(){
  const m=M();
  const tabs=ROLE_IDS.map(id=>`<button class="tab" role="tab" type="button" data-tab="${id}" aria-selected="${id===A.tab}"><img src="${portrait(id,m)}" alt="">${ROLES[id].name}<small>${esc(playerFor(id))}</small></button>`).join("");
  return `<section class="panel" style="gap:10px"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">${m.level} · ${m.place}</div><h2>${m.name}</h2></div>
   <div class="row"><button class="btn ghost" data-act="share" type="button">Save / share design</button><button class="btn ghost" data-go="briefing" type="button">Briefing</button></div></div>
   <div id="sharebox" hidden></div>
   <ul class="goals" id="goals"></ul></section>
  <div class="cols">
   <section class="panel" style="gap:16px"><div class="tabs" role="tablist">${tabs}</div><div id="tabBody" style="display:flex;flex-direction:column;gap:16px">${designTab()}</div></section>
   <aside class="rail"><section class="panel"><h3>Your spacecraft</h3>${Space3D.ok?`<canvas class="craft" id="craft3d" aria-label="Your spacecraft in 3D. Drag to turn it."></canvas><p class="help">Drag to turn it, scroll to zoom. It changes with every choice.</p>${REAL_IDS.includes(m.id)?`<button class="btn ghost" type="button" data-act="real" id="realBtn">${A.previewReal?"Show my design":"Show the real NASA spacecraft"}</button>${A.previewReal?`<p class="help">Real NASA 3D model (NASA 3D Resources). In flight you always see the real spacecraft.</p>`:""}`:""}`:`<p class="help">3D view needs WebGL, which this browser doesn't offer.</p>`}<h3>Mission resources</h3><div id="meters"></div></section>
    <section class="panel"><h3>Design review</h3><ul class="issues" id="issues"></ul><button class="btn big" data-act="launch" type="button">Launch</button>
    <p class="help">You can launch even with problems. The flight will show you what goes wrong.</p></section></aside>
  </div>`;
}
function meter(label,val,frac,col){return `<div class="meter"><div class="mt"><span>${label}</span><span>${val}</span></div><div class="bar"><i style="width:${Math.min(100,Math.max(2,frac*100))}%;background:${col}"></i></div></div>`;}
function refresh(){
  const m=M(), c=compute(m,A.d); const hard=m.level==="Hard"; const sbx=A.sandbox;
  const rows=[
    meter("Mass vs rocket limit", `${fmt(c.wet)} / ${fmt(c.cap)} kg`, c.cap?c.wet/c.cap:1, c.wet>c.cap?"var(--bad)":c.wet>.9*c.cap?"var(--warn)":"var(--cyan)"),
    meter("Power: made / needed", `${fmt(c.avgGen)} / ${fmt(c.avgNeed)} W`, c.margin/1.6, c.margin<1?"var(--bad)":c.margin<1.2?"var(--warn)":"var(--ok)"),
    meter("Budget used", sbx?`$${fmt(c.cost)}M · no limit`:`$${fmt(c.cost)} / ${fmt(c.budget)}M`, sbx?.3:c.cost/c.budget, c.cost>c.budget?"var(--bad)":c.cost>.9*c.budget?"var(--warn)":"var(--cyan)"),
    meter("Data reaching Earth", `${fmt(c.dataFrac*100)}% · ${fmt(c.gb,c.gb<1?2:0)} GB/day made`, c.dataFrac, c.dataFrac<.7?"var(--bad)":c.dataFrac<.95?"var(--warn)":"var(--ok)")];
  if(m.crew){ rows.push(meter("Supplies", `${A.d.days} / ${c.needDays} days`, A.d.days/c.needDays, c.suppliesOk?"var(--ok)":"var(--bad)"));
    rows.push(meter("Heat shield", `${HEAT[A.d.heatshield].max} / ${m.reentry} km/s`, HEAT[A.d.heatshield].max/m.reentry, c.heatOk?"var(--ok)":"var(--bad)"));
    if(m.id==="marscrew") rows.push(meter("Crew radiation dose", `${fmt(c.dose)} mSv (goal < 1,000)`, c.dose/1500, c.dose<1000?"var(--ok)":"var(--bad)")); }
  else rows.push(meter("Mission lifetime", `${fmt(c.effLife,1)} / ${m.life} yr`, c.effLife/m.life, c.effLife<m.life?"var(--warn)":"var(--ok)"));
  rows.push(meter("Expected science", `${fmt(c.sciPct)}%`, c.sciPct/100, "var(--amber)"));
  $("#meters").innerHTML = rows.join("") + `<p class="help">Fuel ${fmt(c.prop)} kg · dry ${fmt(c.dry)} kg${c.supplies?` (incl. ${fmt(c.supplies)} kg supplies)`:""}${c.entry?` · heat shield & landing system ${fmt(c.entry)} kg`:""}${m.impact?` · predicted orbit change ${fmt(c.hits?c.deflect:0,1)} min`:""}</p>`;
  $("#goals").innerHTML = c.goals.map(g=>`<li><span class="g ${hard?"q":g.ok?"ok":"no"}">${hard?"GOAL":g.ok?"MET":"NOT YET"}</span><span>${g.t}</span></li>`).join("");
  if(hard){ const n=c.issues.length; $("#issues").innerHTML = `<li class="${n?"warn":"ok"}">${n?`Review found ${n} possible problem${n>1?"s":""}. Hard missions don't tell you which. Check the meters.`:"No problems found."}</li>`; }
  else $("#issues").innerHTML = c.issues.length ? c.issues.map(([s,t,w])=>`<li class="${s}">${t}<small>${w}</small></li>`).join("") : `<li class="ok">Design closes: mass, power, data and budget all work.</li>`;
  if(previewView) previewView.setMission(m,A.d,c);
}
after.design = () => { previewView = Space3D.ok && $("#craft3d") ? Space3D.createView($("#craft3d"),{preview:true}) : null; if(previewView&&A.previewReal) previewView.setReal(true); refresh(); };

/* ---------- flight ---------- */
const CAPSULE_SVG = `<svg viewBox="0 0 1600 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1f2b"/><stop offset=".6" stop-color="#0c0f16"/><stop offset="1" stop-color="#05070b"/></linearGradient><radialGradient id="glw" cx=".5" cy=".9" r=".6"><stop offset="0" stop-color="#f2a93b" stop-opacity=".18"/><stop offset="1" stop-color="#f2a93b" stop-opacity="0"/></radialGradient></defs>
<path fill="url(#cab)" fill-rule="evenodd" d="M0 0H1600V900H0Z M360 110 Q800 70 1240 110 Q1290 116 1300 166 L1350 560 Q1356 612 1300 620 Q800 680 300 620 Q244 612 250 560 L300 166 Q310 116 360 110Z"/>
<path fill="none" stroke="#3b4458" stroke-width="16" d="M360 110 Q800 70 1240 110 Q1290 116 1300 166 L1350 560 Q1356 612 1300 620 Q800 680 300 620 Q244 612 250 560 L300 166 Q310 116 360 110Z"/>
<path fill="none" stroke="#00000088" stroke-width="5" d="M372 126 Q800 88 1228 126 L1334 558 Q800 662 266 558Z"/>
<g fill="#2a3142">${Array.from({length:14},(_,i)=>`<circle cx="${330+i*72}" cy="${i%2?96:92}" r="6"/>`).join("")}</g>
<rect x="0" y="700" width="1600" height="200" fill="url(#glw)"/>
<g>${[[180,730,250,120],[470,744,300,110],[830,744,300,110],[1170,730,250,120]].map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#0a1220" stroke="#2a3a5c" stroke-width="3"/><rect x="${x+14}" y="${y+14}" width="${w-28}" height="${h-28}" rx="4" fill="#0f2a44" opacity=".9"/><path d="M${x+24} ${y+h-30} l${(w-48)*.25} -${h*.3} l${(w-48)*.25} ${h*.12} l${(w-48)*.25} -${h*.28} l${(w-48)*.25} ${h*.1}" stroke="#5fd0e0" stroke-width="3" fill="none"/>`).join("")}</g>
<g fill="#f2a93b">${Array.from({length:10},(_,i)=>`<rect x="${560+i*50}" y="868" width="22" height="8" rx="2" opacity="${i%3?0.9:0.35}"/>`).join("")}</g></svg>`;
function flight(){
  const m=M(); const crew=!!m.crew;
  return `<section class="stage ${crew?"capsule":"control"}">
   <div class="stagehead"><div><div class="eyebrow">${crew?"Crew capsule":"Mission Control"} · ${esc(A.team)}</div><h2>${m.name}</h2></div>
    <div class="health"><div class="meter"><div class="mt"><span>${crew?"Crew & ship health":"Spacecraft health"}</span><span id="hp">100%</span></div><div class="bar"><i id="hpBar" style="width:100%;background:var(--ok)"></i></div></div></div></div>
   <div class="screen" id="screen">
    ${Space3D.ok?`<canvas id="view3d" aria-label="Live 3D view of the mission. Drag to look around."></canvas>`:`<div class="nogl">3D view needs WebGL. The mission log still runs.</div>`}
    <div class="sky" id="sky" aria-hidden="true"></div><div class="windowframe" aria-hidden="true">${crew?CAPSULE_SVG:""}</div>
    <div class="hud tl"><span class="eyebrow" id="phase">LAUNCH PAD</span><span class="clock" id="clock">T−00:10</span></div>
    <div class="hud tr" id="feedlabel">${crew?"":"● LIVE"}</div>
    <div class="hud br views">${[["ship","Chase camera"],["window",crew?"Window":"Onboard camera"],["map","Trajectory map"]].map(([k,n])=>`<button type="button" class="vbtn" data-view="${k}" aria-pressed="${k==="ship"}">${n}</button>`).join("")}</div>
   </div>
   <div class="crewbar">${ROLE_IDS.map(r=>`<figure class="crewcard live" id="cc_${r}"><img src="${portrait(r,m)}" alt=""><figcaption><b>${esc(playerFor(r))}</b><span>${ROLES[r].name}</span></figcaption></figure>`).join("")}</div>
  </section>
  <section class="panel"><h3>Mission log</h3><div class="log" id="log" aria-live="polite"></div></section>
  <div id="modal"></div>`;
}
let SEQ=0;
const FLY = () => A.screen==="flight"||A.screen==="sfly"||A.screen==="lfly";
const wait = ms => { const my=SEQ; return new Promise((r,j)=>setTimeout(()=> my===SEQ&&FLY()?r():j("abort"), matchMedia("(prefers-reduced-motion: reduce)").matches?ms/3:ms)); };
let curP=0;
function skyLoop(){ const el=$("#sky"); if(!el||!flightView) return; const i=flightView.info(); const a=i.world==="earth"&&i.seg==="ascent"&&i.alt>=0?Math.max(0,Math.min(1,1-i.alt/110)):0; el.style.opacity=(a*a*.9).toFixed(3); requestAnimationFrame(skyLoop); }
function animTo(to,ms){ const my=SEQ; return new Promise((res,rej)=>{ const from=curP, t0=performance.now(); const step=n=>{ if(!FLY()||my!==SEQ) return rej("abort"); const k=Math.min(1,(n-t0)/ms); const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; curP=from+(to-from)*e; flightView&&flightView.setProgress(curP); updateClock(); k<1?requestAnimationFrame(step):res(); }; requestAnimationFrame(step); }); }
let totalDays=1;
let ascentEnd=.12;
function updateClock(){ const el=$("#clock"); if(!el) return; if(curP<=ascentEnd){ el.textContent=`T+${fmt(curP/ascentEnd*9,0)} min`; return; } const d=(curP-ascentEnd)/(1-ascentEnd)*totalDays; el.textContent = d<1/24? `T+${Math.round(d*1440)} min` : d<2? `T+${fmt(d*24,0)} h` : `T+${fmt(d,0)} days`; }
function setPhase(t){ const el=$("#phase"); if(el) el.textContent=t; }
function log(msg,cls=""){ const el=document.createElement("div"); el.innerHTML=`<span class="tm">${$("#clock")?$("#clock").textContent:""}</span> <span class="${cls}">${msg}</span>`; const L=$("#log"); if(L){L.appendChild(el); L.scrollTop=1e9;} if(A.flight) A.flight.log.push([msg,cls]); }
function setHealth(h){ $("#hp").textContent=Math.round(h)+"%"; const b=$("#hpBar"); b.style.width=h+"%"; b.style.background=h>70?"var(--ok)":h>40?"var(--warn)":"var(--bad)"; }
function speak(role,text){ document.querySelectorAll(".crewcard.live").forEach(x=>x.classList.remove("talk")); const cc=$("#cc_"+role); if(cc) cc.classList.add("talk"); Voice.say(role,text,()=>cc&&cc.classList.remove("talk")); }

function eventModal(e,c,m){
  return new Promise(res=>{
    const letters="ABCD"; const lead=playerFor(e.lead); const T=DECIDE[m.level];
    const el=$("#modal");
    el.innerHTML=`<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="evt"><div class="modal">
      <div class="evhead"><img src="${portrait(e.lead,m)}" alt=""><div><div class="eyebrow">Surprise event · ${ROLES[e.lead].name}: ${esc(lead)}</div><h2 id="evt">${e.title}</h2></div></div>
      <p style="font-size:16px">${e.text}</p>
      <div id="phasebox" class="phasebox"><b>Step 1: read.</b> No clock yet. Read every option together: what each one protects and what it costs.</div>
      <div class="choices">${e.opts.map((o,i)=>`<button class="choice" type="button" data-ch="${i}"><span class="ltr">${letters[i]}${i===3?" · auto-picked if time runs out":""}</span><span class="t">${o.l}</span><span class="gain">✓ ${o.g}</span><span class="risk2">✗ ${o.r}</span></button>`).join("")}</div>
      <div class="row" id="readyrow"><button class="btn" type="button" id="ready">We're ready: start the ${T}-second vote</button></div>
      <div class="timer" id="timerwrap" hidden><i id="tbar"></i></div>
    </div></div>`;
    speak(e.lead, e.say||e.text);
    let done=false, t0=0;
    const tick=()=>{ if(done) return; const left=Math.max(0,T-(performance.now()-t0)/1000); const b=$("#tbar"), pb=$("#phasebox"); if(!b) return; b.style.width=(left/T*100)+"%"; pb.innerHTML=`<b>Step 2: vote.</b> ${Math.ceil(left)} seconds left. If time runs out: <b>D, keep going as planned</b>.`; if(left<=0) pick(3,true); else requestAnimationFrame(tick); };
    $("#ready").onclick=()=>{ $("#readyrow").hidden=true; $("#timerwrap").hidden=false; t0=performance.now(); requestAnimationFrame(tick); };
    const pick=(i,auto)=>{ if(done) return; done=true; const o=e.opts[i]; const r=o.f(c);
      el.querySelector(".modal").innerHTML=`<div class="evhead"><img src="${portrait(e.lead,m)}" alt=""><div><div class="eyebrow">${auto?"Time ran out: kept going as planned":"Team chose "+letters[i]}</div><h2>${e.title}</h2></div></div><p><b>${o.l}</b></p>
        <div class="result"><p>${r.why}</p></div>
        <div class="readout">${[["Health",(r.h||0)===0?"no change":r.h+"",(r.h||0)<0?"var(--warn)":"var(--ok)"],["Science",r.sci?"−"+Math.round(r.sci*100)+"%":"no change",r.sci?"var(--warn)":"var(--ok)"],["Budget",r.cost?"−$"+fmt(r.cost)+"M":"no change",r.cost?"var(--warn)":"var(--ok)"]].map(([l,v,col])=>`<div><div class="l">${l}</div><div class="v" style="color:${col}">${v}</div></div>`).join("")}</div>
        <div class="row"><button class="btn" type="button" id="evok">Continue mission</button></div>`;
      speak(e.lead, r.why);
      $("#evok").focus(); $("#evok").onclick=()=>{ Voice.stop(); el.innerHTML=""; res({i,auto,r,o}); }; };
    el.querySelectorAll("[data-ch]").forEach(b=>b.onclick=()=>pick(+b.dataset.ch,false));
  });
}

async function runFlight(){
  SEQ++; const m=M(), d=A.d, c=compute(m,d);
  const F = A.flight = {c, health:100, sciLoss:1, extraCost:0, log:[], lost:null, events:[], lessons:[]};
  curP=0; totalDays = m.crew? c.needDays : {delta:3*365,storm:8*365,moon:2*365+4,telescope:30+5*365,mars:205+700,dart:300}[m.id]||365;
  if(Space3D.ok && $("#view3d")){ flightView=Space3D.createView($("#view3d"),{}); flightView.setMission(m,d,c); }
  const marks = flightView ? flightView.marks() : {ascent:.12}; ascentEnd=marks.ascent||.12; skyLoop();
  const names = Object.keys(marks);
  const fail=(phase,msg,why,flag)=>{ F.lost={phase,msg,why}; if(flag&&flightView) flightView.flag(flag); setPhase("MISSION LOST"); log(msg,"bad"); log(why,"warn"); };
  const events = pickEvents(m);
  let evI=0; const nextEvent=async()=>{ if(evI<events.length && !F.lost){ await doEvent(events[evI++],c,F,m); } };
  setPhase("COUNTDOWN"); log(`${c.L.name}${c.launches>1?` (×${c.launches} launches)`:""} on the pad. Total mass ${fmt(c.wet)} kg.`);
  speak("planner","Three, two, one. Ignition. And liftoff!"); await wait(2600);
  setPhase("ASCENT");
  if(c.cap<=0){ await animTo(.03,2500); fail("launch",`The ${c.L.name.toLowerCase()} lifted off but could never reach ${CAPNAME[c.capClass]}. It fell back.`,"Each rocket can reach only certain orbits. Farther destinations need bigger rockets.","fall"); await wait(3000); return finish(); }
  if(c.wet>c.cap){ await animTo(.045,3500); fail("launch",`The rocket strained under ${fmt(c.wet)} kg, ran out of fuel before orbit and fell into the ocean.`,`It can lift only ${fmt(c.cap)} kg to ${CAPNAME[c.capClass]}. Remove mass or choose a bigger rocket.`,"fall"); await wait(3500); return finish(); }
  log("Liftoff! Rocket performing normally.","good");
  await animTo(marks.ascent,6500);
  flightView&&flightView.flag("separated"); log(m.crew?"Engines cut off. The crew is in space!":"Spacecraft separated. Solar panels and antenna deploying.","good");
  setPhase(m.crew?"IN SPACE":"IN ORBIT");
  if(c.margin<1){ await animTo(marks.ascent+.02,2000); fail("power",`${c.orb.ecl>0?"First pass through darkness":"Systems switched on"}: power fell below what the ${m.crew?"capsule":"spacecraft"} needs. Batteries emptied and it went silent.`,`You made ${fmt(c.avgGen)} W on average but needed ${fmt(c.avgNeed)} W. Bigger panels, an RTG, or fewer power-hungry parts would fix it.`,"tumble"); await wait(3000); return finish(); }
  log(`Power check: making ${fmt(c.avgGen)} W, using ${fmt(c.avgNeed)} W.`,"good");
  if(!c.battOk){ F.sciLoss*=.5; log(`Battery too small for ${c.orb.eclH} h of darkness: the spacecraft shuts down in every shadow.`,"warn"); F.lessons.push(`Your battery stored less than the ${fmt(c.eclWh)} Wh needed for each dark period, so you lost half your observing time.`); }
  await nextEvent();
  const rest = names.slice(1);
  for(let k=0;k<rest.length;k++){
    const nm=rest[k], isLast=k===rest.length-1; if(F.lost) break;
    setPhase({transfer:"TRANSFER",depart:"LEAVING EARTH",cruise:"DEEP SPACE CRUISE",approach:"APPROACH",orbit:"OPERATIONS",outbound:"OUTBOUND",return:"COMING HOME",landing:"ENTRY, DESCENT & LANDING"}[nm]||nm.toUpperCase());
    if(nm==="landing"){
      log("Entering the atmosphere at 20,000 km/h. Seven minutes of terror begin…");
      if(c.orb.hazard && !c.precise){ await animTo(marks.landing-.01,6000); fail("landing","The rover landed on a boulder field and tipped over.","Landing among rocks needs precise navigation to see hazards and steer away. Perseverance did exactly this.","crash"); await wait(2500); break; }
      await animTo(marks.landing,7000); log("Touchdown confirmed! The rover is on Mars.","good"); setPhase("SURFACE OPERATIONS");
      await nextEvent(); await nextEvent(); continue;
    }
    if(nm==="approach" && m.impact){
      await animTo(marks[nm]-.08,4500); await nextEvent(); log("Final approach. Impact in 4 hours.");
      await animTo(marks[nm]-.002,5000);
      if(!c.hits){ fail("impact",c.has("navcam")?"At 6 km/s the spacecraft couldn't steer precisely enough. It missed by 2 km.":"With no navigation camera the spacecraft never found the moonlet. It flew past.",c.has("navcam")?"Head-on intercepts leave only seconds to aim: precise pointing is required.":"A smart navigation camera finds the target and steers to it automatically."); await wait(2000); break; }
      await animTo(marks[nm],600); flightView&&flightView.flag("impact"); flightView&&flightView.flag("gone"); log(`IMPACT! The moonlet's orbit changed by ${fmt(c.deflect,1)} minutes.`,"good"); setPhase("IMPACT");
      flightView&&flightView.setView("ship"); await wait(4500); await nextEvent(); continue;
    }
    const dur = nm==="cruise"?3500:nm==="orbit"&&isLast?9000:6000;
    if(m.crew && nm===(m.id==="artemis"?"outbound":"orbit")){ await animTo(marks[nm]-.04,dur*.6);
      if(!c.suppliesOk){ fail("supplies",`Day ${d.days}: supplies ran out. Mission Control ordered an emergency return.`,`This path takes ${c.needDays} days, but you packed supplies for ${d.days}. The crew must come home early and the mission fails.`); await wait(2500); break; }
      await nextEvent(); await animTo(marks[nm],dur*.4); continue; }
    if(isLast){ await animTo(marks[nm]-.35*(marks[nm]-(k?marks[rest[k-1]]:marks.ascent)),dur*.5); await nextEvent(); await nextEvent();
      if(m.crew && !c.heatOk){ await animTo(marks[nm]-.004,3000); fail("reentry",`Reentry at ${m.reentry} km/s: the heat shield was not rated for it. The capsule would not survive.`,`Your heat shield handles ${HEAT[d.heatshield].max} km/s. A ${m.id==="artemis"?"lunar":"Mars"}-return shield is needed. (In this game, the mission simply fails.)`,"tumble"); await wait(2500); break; }
      await animTo(marks[nm],dur*.5); continue; }
    await animTo(marks[nm],dur);
    if(k===Math.floor(rest.length/2)-1 || (rest.length<=2 && k===0)) await nextEvent();
  }
  if(!F.lost){
    while(evI<events.length) await nextEvent();
    if(m.crew) log("Splashdown! All four astronauts are home safe.","good"), speak("comms","Splashdown confirmed. Welcome home, crew.");
    if(c.dataFrac<1){ log(`Only ${fmt(c.dataFrac*100)}% of the data made it to Earth.`,"warn"); F.lessons.push(`Your instruments made ${fmt(c.gb,1)} GB a day but you could send only ${fmt(c.dlCap,2)}. A bigger antenna, more ground stations${m.relay?", the Mars relay":""} or compression would deliver more.`); }
    if(!m.crew && c.effLife<d.life && !A.sandbox){ log(`Money ran out after ${fmt(c.effLife,1)} years. Operations ended early.`,"warn"); F.lessons.push("You spent more than the budget, so the ground team had to stop early. Budget for operations, not only for building."); }
    curP=1; updateClock(); log("Mission complete. Final data received.","good"); setPhase("MISSION COMPLETE");
  }
  return finish();
}
const MUST_AT={artemis:1, mars:2, telescope:1, marscrew:1};
function pickEvents(m){
  if(A.sandbox) return [];
  let pool=[...m.events].filter(k=>k!==m.mustEvent).sort(()=>Math.random()-.5).slice(0,3);
  if(m.mustEvent){ pool.splice(MUST_AT[m.id]??0,0,m.mustEvent); pool=pool.slice(0,3); }
  if(m.impact){ pool=pool.filter(k=>k!=="target_drift"); pool.splice(1,0,"target_drift"); pool=pool.slice(0,3); }
  return pool.map(k=>({k,...EVENTS[k]}));
}
async function doEvent(e,c,F,m){
  log(`ALERT: ${e.title}`,"warn"); await wait(600);
  const res = await eventModal(e,c,m);
  F.health=Math.max(5,F.health+(res.r.h||0)); F.sciLoss*=1-(res.r.sci||0); F.extraCost+=res.r.cost||0;
  setHealth(F.health);
  F.events.push({title:e.title, choice:res.o.l, auto:res.auto, why:res.r.why, h:res.r.h||0, sci:res.r.sci||0, cost:res.r.cost||0});
  log(`${res.auto?"No decision in time: kept going":"Decision: "+res.o.l}. ${res.r.why}`, (res.r.h||0)<=-15?"warn":"");
}
function finish(){
  const F=A.flight, c=F.c, m=c.m;
  const ok=!F.lost;
  let sciPct = ok ? c.sciPct*F.sciLoss*(F.health/100) : 0;
  const spent = c.cost+F.extraCost;
  const reserve = A.sandbox?0:Math.max(0,(c.budget-spent)/c.budget);
  const goals = c.goals.map(g=>({...g, ok: ok && g.ok}));
  const allGoals = goals.every(g=>g.ok);
  let stars = ok?1:0; if(ok&&allGoals) stars=2; if(stars===2&&F.health>=70&&spent<=c.budget&&sciPct>=55) stars=3;
  const parts = {success: ok?400:0, science: Math.round(sciPct*4), efficiency: ok?Math.round(Math.min(100,reserve*250)):0, decisions: ok?Math.round(F.health):0};
  const total = parts.success+parts.science+parts.efficiency+parts.decisions;
  F.result = {ok,sciPct,spent,reserve,goals,stars,parts,total};
  A.flights++;
  if(!A.sandbox){
    const P=A.progress; P.stars[m.id]=Math.max(P.stars[m.id]||0,stars);
    const b=P.best[m.id]||[]; b.push({team:A.team,score:total,stars,date:new Date().toISOString().slice(0,10)}); b.sort((x,y)=>y.score-x.score); P.best[m.id]=b.slice(0,5); store.set("ma.progress3",P);
  }
  const btn=document.createElement("div"); btn.className="row"; btn.innerHTML=`<button class="btn big" type="button" data-go="report">See mission report</button>`; const L=$("#log"); if(L) L.parentNode.appendChild(btn);
  setTimeout(()=>{ if(A.screen==="flight" && A.flight===F) go("report"); }, 9000);
}

function report(){
  if(!A.flight||!A.flight.result) return select();
  const F=A.flight, R=F.result, c=F.c, m=c.m; const prev=A.lastScore[m.id];
  if(!F.reported){ F.prevShown=prev; A.lastScore[m.id]=R.total; F.reported=true; }
  const lessons=[...F.lessons];
  if(F.lost) lessons.unshift(F.lost.why);
  F.events.forEach(e=>{ if(e.h<=-15) lessons.push(`${e.title}: ${e.why}`); });
  if(!F.lost && !lessons.length) lessons.push("Every system held. Margin in mass, power, data and budget is how real missions succeed.");
  const board=(A.progress.best[m.id]||[]); const pv=F.prevShown;
  return `<section class="panel" style="gap:14px"><div class="eyebrow">Mission report · ${esc(A.team)}</div>
   <div class="row" style="gap:20px"><div class="grade" aria-label="${R.stars} stars">${"★".repeat(R.stars)}${"☆".repeat(3-R.stars)}</div>
   <div><h2>${F.lost?"Mission lost":"Mission complete"}: ${m.name}</h2><p class="help" style="font-size:14px">${F.lost?F.lost.msg:`Science returned ${fmt(R.sciPct)}% · health ${Math.round(F.health)}% · spent $${fmt(R.spent)}M${A.sandbox?"":" of $"+fmt(c.budget)+"M"}${m.id==="marscrew"?` · crew dose ${fmt(c.dose)} mSv`:""}`}</p>
   ${pv!==undefined?`<p class="help">Last attempt: ${fmt(pv)} points → now ${fmt(R.total)} (${R.total>=pv?"+":""}${fmt(R.total-pv)})</p>`:""}</div></div>
   <div class="score">${[["Mission success",R.parts.success,400],["Science",R.parts.science,400],["Resource efficiency",R.parts.efficiency,100],["Team decisions",R.parts.decisions,100],["Total score",R.total,1000]].map(([l,v,mx])=>`<div><div class="l">${l}</div><div class="v">${fmt(v)}<small style="font-size:13px;color:var(--dim)"> / ${mx}</small></div></div>`).join("")}</div>
  </section>
  <div class="cols2">
   <section class="panel"><h3>Goals</h3><ul class="goals">${R.goals.map(g=>`<li><span class="g ${g.ok?"ok":"no"}">${g.ok?"MET":"MISSED"}</span><span>${g.t}${g.ok?"":`<br><small class="help">${g.why}</small>`}</span></li>`).join("")}</ul></section>
   <section class="panel"><h3>Why it turned out this way</h3><ul class="plain">${lessons.map(l=>`<li>${l}</li>`).join("")}</ul></section>
  </div>
  ${F.events.length?`<section class="panel"><h3>Your team's decisions</h3><div class="tablewrap"><table><tr><th>Event</th><th>Choice</th><th>Health</th><th>Science</th><th>Budget</th></tr>${F.events.map(e=>`<tr><td>${e.title}</td><td>${e.auto?"(time ran out) ":""}${e.choice}</td><td>${e.h||"0"}</td><td>${e.sci?"−"+Math.round(e.sci*100)+"%":"0"}</td><td>${e.cost?"−$"+fmt(e.cost)+"M":"0"}</td></tr>`).join("")}</table></div></section>`:""}
  <div class="cols2">
   <section class="panel"><h3>The real mission: ${m.real.name}</h3><p>${m.real.text}</p><p class="help">Yours: ${fmt(c.wet)} kg at launch, $${fmt(R.spent)}M.</p></section>
   <section class="panel"><h3>Leaderboard on this device</h3>${board.length?`<div class="tablewrap"><table><tr><th>#</th><th>Team</th><th>Stars</th><th>Score</th></tr>${board.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.team)}</td><td class="stars">${"★".repeat(b.stars)}</td><td>${fmt(b.score)}</td></tr>`).join("")}</table></div>`:`<p class="help">${A.sandbox?"Sandbox flights aren't ranked.":"No scores yet."}</p>`}</section>
  </div>
  <section class="panel"><div class="row">
   <button class="btn" data-go="design" type="button">Change design and fly again</button>
   ${A.mi<MISSIONS.length-1?`<button class="btn ghost" data-act="next" type="button" ${R.stars>=1||A.unlockAll||A.sandbox?"":"disabled"}>Next mission</button>`:""}
   <button class="btn ghost" data-go="select" type="button">Mission board</button></div>
   ${A.mode==="team"?`<p class="help">Roles rotate on the next flight. ${ROLE_IDS.map(r=>`${ROLES[r].name}: ${esc(playerFor(r))}`).join(" · ")}</p>`:""}</section>`;
}

/* ================= WIRING ================= */
function startMission(i){ A.mi=i; const m=MISSIONS[i]; A.d=structuredClone(m.def); A.d.compress=!!A.d.compress; A.d.relay=!!A.d.relay; A.d.shelter=!!A.d.shelter; A.d.abort=!!A.d.abort; A.tab="planner"; go("briefing"); }
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-go],[data-act],[data-mi],[data-tab],[data-trole],[data-view],[data-smi],[data-sstep],[data-scard],[data-lmode],[data-llevel],[data-ltab],[data-lpick]"); if(!t) return;
  if(!t.dataset.go && !t.dataset.view && sClick(t)) return;
  if(t.dataset.view){ flightView&&flightView.setView(t.dataset.view); document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b===t)); $("#screen").dataset.view=t.dataset.view; return; }
  if(t.dataset.go){ if(t.dataset.go==="design"&&!A.d) return go("select"); return go(t.dataset.go); }
  if(t.dataset.mi!==undefined) return startMission(+t.dataset.mi);
  if(t.dataset.tab){ A.tab=t.dataset.tab; document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===A.tab)); $("#tabBody").innerHTML=designTab(); refresh(); return; }
  if(t.dataset.trole){ A.trainRole=t.dataset.trole; return render(); }
  const a=t.dataset.act;
  if(a==="real"){ A.previewReal=!A.previewReal; return render(); }
  if(a==="lang"){ setLang(LANG==="ar"?"en":"ar"); return render(); }
  if(a==="voice"){ A.voice=!A.voice; if(!A.voice) Voice.stop(); return render(); }
  if(a==="gfx"){ Space3D.setQuality(Space3D.quality==="high"?"low":"high"); if(A.screen!=="flight") return render(); return; }
  if(a==="solo"){ A.mode="solo"; A.players=["Player 1"]; A.team="StellarOps"; return go("training"); }
  if(a==="team"){ A.mode="team"; if(A.players.length<2) A.players=["Player 1","Player 2","Player 3","Player 4"]; A.team="StellarOps"; return go("setup"); }
  if(a==="np"){ const n=+t.dataset.n; A.players=Array.from({length:n},(_,i)=>A.players[i]||`Player ${i+1}`); return render(); }
  if(a==="tnext"){ A.trainIdx[A.trainRole]++; return render(); }
  if(a==="tprev"){ A.trainIdx[A.trainRole]--; return render(); }
  if(a==="tdone"){ A.trained[A.trainRole]=true; const nx=ROLE_IDS.find(r=>!A.trained[r]); if(nx){A.trainRole=nx; return render();} return go("select"); }
  if(a==="launch"){ go("flight"); runFlight().catch(err=>{ if(err!=="abort") console.error(err); }); return; }
  if(a==="next"){ return startMission(A.mi+1); }
  if(a==="share"){ const box=$("#sharebox"); box.hidden=!box.hidden; if(!box.hidden){ const code=btoa(JSON.stringify({m:M().id,d:A.d}));
     box.innerHTML=`<div class="field"><label for="codeOut">Your design code: copy it to save or share with another team</label><input type="text" id="codeOut" value="${code}" readonly></div><div class="row"><button class="btn ghost" type="button" id="copyCode">Copy code</button></div><div class="field"><label for="codeIn">Load a design code</label><input type="text" id="codeIn" placeholder="Paste a code here"></div><div class="row"><button class="btn ghost" type="button" id="loadCode">Load design</button><span class="help" id="codeMsg"></span></div>`;
     $("#copyCode").onclick=()=>{ try{ navigator.clipboard.writeText(code).then(()=>$("#codeMsg").textContent="Copied.",()=>{$("#codeOut").select();$("#codeMsg").textContent="Press Ctrl+C to copy.";}); }catch(err){ $("#codeOut").select(); $("#codeMsg").textContent="Press Ctrl+C to copy."; } };
     $("#loadCode").onclick=()=>{ try{ const o=JSON.parse(atob($("#codeIn").value.trim())); const i=MISSIONS.findIndex(x=>x.id===o.m); if(i<0) throw 0; A.mi=i; A.d=Object.assign(structuredClone(MISSIONS[i].def),o.d); render(); }catch(err){ $("#codeMsg").textContent="That code isn't valid. Copy the whole code and try again."; } }; } }
});
const SLIDERS={life:"",panel:" m²",stations:"",days:" days",launches:""};
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="teamname") A.team=t.value||"Team";
  if(t.dataset.pl!==undefined) A.players[+t.dataset.pl]=t.value||`Player ${+t.dataset.pl+1}`;
  if(A.screen==="design" && t.id in SLIDERS){ A.d[t.id]=+t.value; $("#"+t.id+"o").textContent=t.value+SLIDERS[t.id]; refresh(); }
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.id==="sbx"){ A.sandbox=t.checked; return render(); }
  if(t.id==="ula"){ A.unlockAll=t.checked; return render(); }
  if(A.screen!=="design"||!t.name) return;
  const d=A.d;
  if(t.name==="instr") d.instr=[...document.querySelectorAll("input[name=instr]:checked")].map(i=>i.value);
  else if(["compress","relay","shelter","abort"].includes(t.name)) d[t.name]=t.checked;
  else d[t.name]=t.value;
  if(d.computer==="basic") d.compress=false;
  $("#tabBody").innerHTML=designTab(); refresh();
});
new MutationObserver(()=>{ Object.keys(SLIDERS).forEach(id=>{const i=document.getElementById(id), o=document.getElementById(id+"o"); if(i&&o&&!o.textContent) o.textContent=i.value+SLIDERS[id];}); }).observe(document.getElementById("app"),{childList:true,subtree:true});
window.MA = {A, compute, MISSIONS, startMission, go};
