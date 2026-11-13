/* ===== MISSION LAB: video briefings, 4 CML levels, teams on one device or online (Supabase) =====
   Facts used in the videos and here: Landsat 8 OLI (30 m, near-infrared, 185 km swath), MODIS (250 m, 2,330 km, whole Earth every 1-2 days),
   X-band 384 Mbit/s, 705 km sun-synchronous orbit, ~10 a.m. crossing, Atlas V 401 launched Landsat 8 (2013), Pegasus XL ~450 kg to low orbit. */
const SB_URL = "https://sruvvklwlixpzjyhhnit.supabase.co", SB_KEY = "sb_publishable_FPsD1Xy-KmR_CrrkSwIdnQ_TP92c6Zh";
const CREW = {
  director: { name: "Mohamed", title: { en: "Mission Director", ar: "مدير المهمة" }, img: "ctrl_2.jpg", col: "#ffc26b" },
  science: { name: "Ayat", title: { en: "Science Lead", ar: "رئيسة العلماء" }, img: "crew_1.jpg", col: "#5fd8ff" },
  comms: { name: "Adham", title: { en: "Communications Lead", ar: "مسؤول الاتصالات" }, img: "crew_4.jpg", col: "#c79bff" },
  engineer: { name: "Abdelrahman", title: { en: "Spacecraft Engineer", ar: "مهندس المركبة" }, img: "crew_2.jpg", col: "#ffb35f" },
  planner: { name: "Ahmed", title: { en: "Mission Planner", ar: "مخطط المهمة" }, img: "ctrl_4.jpg", col: "#7dffb0" } };
const TEAM_ROLES = ["science", "comms", "engineer", "planner"];
const SEGMENT = { science: { en: "Space segment · instruments", ar: "جزء الفضاء · الأجهزة" }, comms: { en: "Ground segment", ar: "الجزء الأرضي" }, engineer: { en: "Space segment · spacecraft", ar: "جزء الفضاء · المركبة" }, planner: { en: "Launch segment", ar: "جزء الإطلاق" } };
const lopt = (k, icon, en, ar, v) => Object.assign({ k, icon, n: { en, ar } }, v);
const DELTA = {
  id: "delta", budget: 100, model: "landsat8",
  name: { en: "Nile Delta Crop Watch", ar: "مراقب محاصيل الدلتا" },
  user: { en: "Egypt's Ministry of Agriculture and the farmers of the Nile Delta", ar: "وزارة الزراعة وفلاحين دلتا النيل" },
  rules: [{ k: "fields", en: "See each small field", ar: "نشوف كل أرض صغيرة" }, { k: "health", en: "See plant health", ar: "نشوف صحة النبات" },
          { k: "light", en: "Same fields, same light", ar: "نفس الأراضي ونفس الإضاءة" }, { k: "life", en: "Work for 5 years", ar: "يشتغل 5 سنين" }, { k: "budget", en: "Budget: 100 points", ar: "الميزانية: 100 نقطة" }],
  decisions: {
    science: [
      { k: "cam", t: { en: "Which camera?", ar: "أنهي كاميرا؟" }, o: [
        lopt("A", "leaf", "Camera A · OLI", "الكاميرا A · OLI", { mass: .45, power: 3, cost: 30, data: 3, res: 30, nir: true }),
        lopt("B", "cam3", "Camera B · MODIS", "الكاميرا B · MODIS", { mass: .23, power: 2, cost: 20, data: 2, res: 250, nir: true }),
        lopt("C", "cam1", "Camera C · Normal", "الكاميرا C · عادية", { mass: .2, power: 1, cost: 10, data: 2, res: 30, nir: false })] },
      { k: "time", t: { en: "When do we take pictures?", ar: "بنصوّر إمتى؟" }, o: [
        lopt("A", "weather", "Morning, ~10 a.m.", "الصبح، حوالي 10", { light: true, day: true }),
        lopt("B", "cam1", "Any time of day", "أي وقت في اليوم", { light: false, day: true }),
        lopt("C", "radar", "At night", "بالليل", { light: false, day: false })] }],
    comms: [
      { k: "ant", t: { en: "Which antenna?", ar: "أنهي هوائي؟" }, o: [
        lopt("A", "dish1", "Antenna A · S-band", "الهوائي A · S-band", { cap: 1, power: 1, cost: 3, mass: .02 }),
        lopt("B", "dish2", "Antenna B · X-band", "الهوائي B · X-band", { cap: 4, power: 2, cost: 6, mass: .05 }),
        lopt("C", "dish3", "Antenna C · Ka-band", "الهوائي C · Ka-band", { cap: 8, power: 3, cost: 12, mass: .08 })] },
      { k: "st", t: { en: "How many ground stations?", ar: "كام محطة أرضية؟" }, o: [
        lopt("A", "relay", "1 station", "محطة واحدة", { n: 1, cost: 4 }), lopt("B", "relay", "2 stations", "محطتين", { n: 2, cost: 8 }), lopt("C", "relay", "3 stations", "3 محطات", { n: 3, cost: 12 })] }],
    engineer: [
      { k: "pan", t: { en: "Which solar panels?", ar: "أنهي ألواح شمسية؟" }, o: [
        lopt("A", "panel1", "Small panels", "ألواح صغيرة", { supply: 5, mass: .1, cost: 4 }), lopt("B", "panel2", "Medium panels", "ألواح متوسطة", { supply: 8, mass: .2, cost: 7 }), lopt("C", "panel3", "Large panels", "ألواح كبيرة", { supply: 12, mass: .35, cost: 11 })] },
      { k: "bat", t: { en: "Which battery?", ar: "أنهي بطارية؟" }, o: [
        lopt("A", "rtg", "Small battery", "بطارية صغيرة", { min: 20, mass: .06, cost: 3 }), lopt("B", "rtg", "Medium battery", "بطارية متوسطة", { min: 45, mass: .12, cost: 5 }), lopt("C", "rtg", "Large battery", "بطارية كبيرة", { min: 90, mass: .3, cost: 8 })] }],
    planner: [
      { k: "orb", t: { en: "How high is the orbit?", ar: "المدار على ارتفاع كام؟" }, o: [
        lopt("A", "ice", "Orbit A · 400 km", "المدار A · 400 كم", { alt: 400, fuel: .8, cost: 10, resF: .57, life: 2, sso: false }),
        lopt("B", "ice", "Orbit B · 705 km", "المدار B · 705 كم", { alt: 705, fuel: .4, cost: 6, resF: 1, life: 5, sso: true }),
        lopt("C", "ice", "Orbit C · 1,500 km", "المدار C · 1,500 كم", { alt: 1500, fuel: .5, cost: 8, resF: 2.13, life: 5, sso: false, rad: true })] },
      { k: "rkt", t: { en: "Which rocket?", ar: "أنهي صاروخ؟" }, o: [
        lopt("A", "rocket1", "Pegasus XL", "Pegasus XL", { lift: .45, cost: 8, lv: "small" }), lopt("B", "rocket2", "Atlas V 401", "Atlas V 401", { lift: 6, cost: 25, lv: "medium" }), lopt("C", "rocket3", "Falcon Heavy", "Falcon Heavy", { lift: 30, cost: 50, lv: "heavy" })] },
      { k: "eom", t: { en: "End of the mission?", ar: "نهاية المهمة؟" }, o: [
        lopt("A", "rocket1", "Save fuel, bring it down", "نسيب وقود وننزّله", { mass: .05, cost: 2, clean: true }), lopt("B", "cam3", "Use all fuel for pictures", "نصرف الوقود كله على الصور", { clean: false, more: true }), lopt("C", "radar", "Just leave it up there", "نسيبه فوق", { clean: false })] }] },
  facts: { en: "The real Landsat 8 has flown since 2013 at 705 km, crossing the equator around 10 a.m. Its OLI camera sees near-infrared at 30 m, and it sends data with X-band at 384 Mbit/s.", ar: "Landsat 8 الحقيقي بيطير من 2013 على ارتفاع 705 كم، وبيعدّي خط الاستوا حوالي الساعة 10 الصبح. كاميرته OLI بتشوف الأشعة تحت الحمرا بدقة 30 متر، وبيبعت الداتا بـ X-band بسرعة 384 ميجابت في الثانية." }
};
const CML = [
  { n: 1, t: { en: "CML 1 · The idea", ar: "CML 1 · الفكرة" }, d: { en: "Science Lead only: pick what the satellite sees. Are we answering the right question?", ar: "رئيسة العلماء بس: تختار القمر الصناعي هيشوف إيه. هل بنجاوب على السؤال الصح؟" }, roles: ["science"] },
  { n: 2, t: { en: "CML 2 · Can it work?", ar: "CML 2 · هل تنفع؟" }, d: { en: "The whole team builds the full mission, reviews it, and launches.", ar: "التيم كله يبني المهمة كاملة، ويراجعها، ويطلقها." }, roles: TEAM_ROLES },
  { n: 3, t: { en: "CML 3 · Trade study", ar: "CML 3 · المقارنة" }, d: { en: "Build two different designs, compare them, and fly the better one.", ar: "ابنوا تصميمين مختلفين، قارنوهم، وطيّروا الأحسن." }, roles: TEAM_ROLES },
  { n: 4, t: { en: "CML 4 · Point design", ar: "CML 4 · التصميم التفصيلي" }, d: { en: "Every part and real number, for advanced players (expert mode).", ar: "كل القطع والأرقام الحقيقية، للاعبين المتقدمين (وضع الخبراء)." }, roles: [] }];

/* ---- lab state ---- */
const LB = { mode: "solo", level: 2, room: null, me: null, myRole: null, picks: {}, designA: null, reviews: 0, rewatch: 0, watched: {}, players: [], chat: [], online: false, sb: null, chan: null, flight: null, revealed: null, votes: {} };
const myId = (() => { try { let v = sessionStorage.getItem("ma.cid"); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("ma.cid", v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const lvl = () => CML[LB.level - 1];
const rolesInPlay = () => lvl().roles;
const isHost = () => LB.mode === "online" && LB.room && LB.room.state.host === myId;
const myRoles = () => { if (LB.mode !== "online") return rolesInPlay(); // online: my role, and the host also covers empty roles
  const mine = rolesInPlay().filter(r => r === LB.myRole || (isHost() && !LB.players.some(p => p.role === r))); return mine; };
function allPicks() { // merge picks from every player in online mode
  if (LB.mode !== "online") return LB.picks;
  const p = {}; LB.players.forEach(pl => Object.assign(p, (pl.data && pl.data.picks) || {})); return p;
}
const pickOpt = (picks, role, k) => { const d = DELTA.decisions[role].find(x => x.k === k); const v = picks[role + "." + k]; return d && v ? d.o.find(o => o.k === v) : null; };

/* ---- the model: hidden numbers, checked against the 5 rules ---- */
function lCompute(picks) {
  const g = (r, k) => pickOpt(picks, r, k) || {};
  const cam = g("science", "cam"), time = g("science", "time"), ant = g("comms", "ant"), st = g("comms", "st"), pan = g("engineer", "pan"), bat = g("engineer", "bat"), orb = g("planner", "orb"), rkt = g("planner", "rkt"), eom = g("planner", "eom");
  const mass = 1.4 + (cam.mass || 0) + (ant.mass || 0) + (pan.mass || 0) + (bat.mass || 0) + (orb.fuel || 0) + (eom.mass || 0);
  const need = 2 + (cam.power || 0) + (ant.power || 0), supply = pan.supply || 0;
  const cost = 10 + ["cost"].reduce(() => [cam, time, ant, st, pan, bat, orb, rkt, eom].reduce((a, o) => a + (o.cost || 0), 0), 0);
  const down = (ant.cap || 0) * ({ 1: 1, 2: 1.6, 3: 2 }[st.n] || 0), made = cam.data || 0;
  const ring = { mass: rkt.lift ? mass / rkt.lift : 0, power: supply ? need / supply : 0, money: cost / DELTA.budget, data: down ? made / down : 0 };
  const res = (cam.res || 0) * (orb.resF || 1);
  const rules = { fields: !!cam.k && res <= 50, health: !!cam.nir && time.day !== false, light: !!time.light && !!orb.sso, life: (orb.life || 0) >= 5 && cost <= DELTA.budget && (bat.min || 0) >= 35, budget: cost <= DELTA.budget };
  const fatal = !rkt.k ? null : mass > rkt.lift ? "mass" : supply && need > supply ? "power" : null;
  let sci = (cam.nir ? 1 : .15) * (res <= 50 ? 1 : .35) * (time.day === false ? 0 : time.light && orb.sso ? 1 : .6) * Math.min(1, down ? down / Math.max(made, .01) : 0) * ((bat.min || 0) >= 35 ? 1 : .5) * (eom.more ? 1.1 : 1);
  const issues = [];
  if (rkt.k && mass > rkt.lift) issues.push({ en: "Mass: the rocket cannot lift this satellite.", ar: "الوزن: الصاروخ مش هيقدر يشيل القمر ده." });
  if (pan.k && need > supply) issues.push({ en: "Power: the panels make less power than the parts need.", ar: "الكهربا: الألواح بتعمل كهربا أقل من اللي القطع محتاجاها." });
  if (bat.k && bat.min < 35) issues.push({ en: "Battery: it runs out before the satellite leaves Earth's shadow.", ar: "البطارية: بتخلص قبل ما القمر يخرج من ضل الأرض." });
  if (ant.k && cam.k && made > down) issues.push({ en: "Data: the pictures cannot all reach Earth.", ar: "الداتا: الصور مش هتوصل الأرض كلها." });
  if (cost > DELTA.budget) issues.push({ en: "Money: the design costs more than 100 points.", ar: "الفلوس: التصميم أغلى من 100 نقطة." });
  DELTA.rules.slice(0, 4).forEach(r => { if (!rules[r.k]) issues.push({ en: `Rule not met: ${r.en}.`, ar: `قاعدة متحققتش: ${r.ar}.` }); });
  return { mass, need, supply, cost, made, down, ring, res, rules, fatal, sci: Math.max(0, Math.min(1.1, sci)), issues, eom, orb, st, bat, cam, ant, rkt, time, pan };
}
const decisionsFor = roles => roles.flatMap(r => DELTA.decisions[r].map(d => ({ role: r, d })));
const allChosen = (picks, roles) => decisionsFor(roles).every(({ role, d }) => picks[role + "." + d.k]);

/* ---- Supabase (online rooms) ---- */
function sbClient() { if (LB.sb) return LB.sb; if (!window.supabase || !window.supabase.createClient) return null; LB.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }); return LB.sb; }
async function onlineAvailable() { const sb = sbClient(); if (!sb) return false; try { const { error } = await sb.from("rooms").select("code").limit(1); return !error; } catch (e) { return false; } }
const newCode = () => "SO-" + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
async function roomCreate(name, role) {
  const sb = sbClient(); const code = newCode();
  const { error } = await sb.from("rooms").insert({ code, mission: "delta", level: LB.level, state: { phase: "lobby", host: myId, reviews: 0 } }); if (error) throw error;
  return roomJoin(code, name, role);
}
async function roomJoin(code, name, role) {
  const sb = sbClient(); code = code.trim().toUpperCase();
  const { data: room, error: e1 } = await sb.from("rooms").select("*").eq("code", code).maybeSingle(); if (e1 || !room) throw new Error(L({ en: "No room with that code.", ar: "مفيش غرفة بالكود ده." }));
  const { data: me, error: e2 } = await sb.from("players").insert({ room: code, name, role, data: { cid: myId, picks: {} } }).select().single();
  if (e2) throw new Error(L({ en: "That role is taken in this room. Pick another one.", ar: "الدور ده متاخد في الغرفة دي. اختار دور تاني." }));
  LB.room = room; LB.me = me; LB.myRole = role; LB.level = room.level; LB.mode = "online"; LB.online = true;
  await roomRefresh(); roomSubscribe(); return code;
}
async function roomRefresh() {
  const sb = sbClient(); if (!sb || !LB.room) return;
  const [r, p, m] = await Promise.all([sb.from("rooms").select("*").eq("code", LB.room.code).single(), sb.from("players").select("*").eq("room", LB.room.code), sb.from("messages").select("*").eq("room", LB.room.code).order("id").limit(200)]);
  if (r.data) LB.room = r.data; if (p.data) LB.players = p.data; if (m.data) LB.chat = m.data; onRoomChange();
}
let pollT = null;
function roomSubscribe() {
  const sb = sbClient(); const code = LB.room.code;
  if (LB.chan) sb.removeChannel(LB.chan);
  LB.chan = sb.channel("room-" + code)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => roomRefresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room=eq.${code}` }, () => roomRefresh())
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room=eq.${code}` }, () => roomRefresh()).subscribe();
  clearInterval(pollT); pollT = setInterval(roomRefresh, 4000); // safety net if realtime drops
}
async function roomState(patch) { const sb = sbClient(); const st = Object.assign({}, LB.room.state, patch); LB.room.state = st; await sb.from("rooms").update({ state: st, updated_at: new Date().toISOString() }).eq("code", LB.room.code); }
async function myData(patch) { const sb = sbClient(); const d = Object.assign({}, LB.me.data, patch); LB.me.data = d; await sb.from("players").update({ data: d, last_seen: new Date().toISOString() }).eq("id", LB.me.id); }
async function sendChat(body) { const sb = sbClient(); body = body.trim().slice(0, 300); if (!body) return; await sb.from("messages").insert({ room: LB.room.code, name: LB.me.name, role: LB.myRole, body }); }
function onRoomChange() {
  if (!LB.room) return; const ph = LB.room.state.phase;
  const RANK = { lonline: 0, lroom: 1, lvideo: 2, ldesign: 3, lfly: 4, lusers: 5, lreport: 6 }, target = { lobby: "lroom", video: "lvideo", flight: "lfly" }[ph];
  if (target && (RANK[A.screen] ?? 0) < RANK[target]) { if (target === "lvideo") LB.vi = 0; go(target); if (target === "lfly") lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return; }
  if (isHost() && ph !== "flight" && LB.players.length && LB.players.every(p => p.data && p.data.ready) && allChosen(allPicks(), rolesInPlay())) { roomState({ phase: "flight", at: Date.now() }); }
  if (A.screen === "lroom" || A.screen === "ldesign") lPartial();
  if (A.screen === "lfly") lVoteCheck();
  lChatPaint();
}

/* ---- screens ---- */
const roleTag = r => `<span class="rolechip" style="--sc:${CREW[r].col}">${L(CREW[r].title)}</span>`;
function crewImg(r) { return `<img src="img/${CREW[r].img}" alt="">`; }
function lhome() {
  return `<section class="cine notr">
    <canvas id="holoHome" class="holo" aria-label="Hologram of NASA's Landsat 8"></canvas>
    <div class="cine-txt"><div class="kick">NASA SPACE APPS 2026 · TEAM STELLAROPS</div>
      <h1 class="cine-h">MISSION <span>LAB</span></h1>
      <p class="cine-p">${L({ en: "You are a NASA-style mission team. Watch your specialist's briefing, remember the facts, talk with your team, and design a real satellite for Egypt's farmers.", ar: "انتوا تيم مهمة زي ناسا. اتفرجوا على شرح المتخصص بتاعكم، افتكروا المعلومات، اتكلموا مع بعض، وصمموا قمر صناعي حقيقي لفلاحين مصر." })}</p>
      <div class="row"><button class="hbtn" type="button" data-lmode="solo">${L({ en: "Play solo", ar: "العب لوحدك" })}</button>
        <button class="hbtn ghost" type="button" data-lmode="local">${L({ en: "Team on one computer", ar: "تيم على جهاز واحد" })}</button>
        <button class="hbtn ghost" type="button" data-lmode="online">${L({ en: "Online team (each on own laptop)", ar: "تيم أونلاين (كل واحد على اللابتوب بتاعه)" })}</button></div></div>
    <div class="how">${[[1, { en: "Watch the briefing", ar: "اتفرج على الشرح" }], [2, { en: "Each role decides", ar: "كل دور يقرر" }], [3, { en: "Review and launch", ar: "راجع واطلق" }], [4, { en: "See who your data helped", ar: "شوف الداتا ساعدت مين" }]].map(([n, t]) => `<div><span>0${n}</span><b>${L(t)}</b></div>`).join("")}</div>
  </section>`;
}
function llevel() {
  const st = A.progress.stars;
  return `<section class="hpanel notr"><div class="kick">${L(DELTA.name)} · ${L({ en: "choose a maturity level", ar: "اختار مستوى النضج" })}</div>
    <h2 class="hh">${L({ en: "How mature is your mission idea?", ar: "فكرة مهمتك ناضجة لحد فين؟" })}</h2>
    <p class="needline">${L({ en: "NASA's JPL measures mission ideas with Concept Maturity Levels (CML). Start at CML 1 and climb.", ar: "معمل JPL بتاع ناسا بيقيس أفكار المهمات بمستويات نضج اسمها CML. ابدأ من CML 1 واطلع." })}</p>
    <div class="planets">${CML.map(c => { const locked = c.n > 1 && !A.unlockAll && (st["cml_delta"] || 0) < c.n - 1 && c.n !== 4;
      return `<button class="pcard" type="button" data-llevel="${c.n}" ${locked ? "disabled" : ""}><span class="cmlnum">CML ${c.n}</span><b>${L(c.t)}</b><span class="psub">${L(c.d)}</span>${locked ? `<span class="psub">🔒 ${L({ en: "Finish the level before", ar: "خلّص المستوى اللي قبله" })}</span>` : ""}</button>`; }).join("")}</div>
    <label class="opt inline"><input type="checkbox" id="ula2" ${A.unlockAll ? "checked" : ""}> ${L({ en: "Unlock all levels (judges and teachers)", ar: "افتح كل المستويات (للحكام والمدرسين)" })}</label></section>`;
}
function lonline() {
  return `<section class="hpanel notr"><div class="kick">${L({ en: "Online team", ar: "تيم أونلاين" })}</div><h2 class="hh">${L({ en: "Create or join a mission room", ar: "اعمل أو ادخل غرفة مهمة" })}</h2>
    <div id="olstat" class="needline">${L({ en: "Checking the connection…", ar: "بنشيك على الاتصال…" })}</div>
    <div class="cols2"><div class="hcard"><h3>${L({ en: "Your name", ar: "اسمك" })}</h3><input type="text" id="oname" maxlength="24" value="${esc(A.lastName || "")}">
      <h3>${L({ en: "Your role", ar: "دورك" })}</h3><div class="rolepick">${TEAM_ROLES.map(r => `<label class="rolecard" style="--sc:${CREW[r].col}"><input type="radio" name="orole" value="${r}" ${r === "science" ? "checked" : ""}>${crewImg(r)}<b>${L(CREW[r].title)}</b><span>${L(SEGMENT[r])}</span></label>`).join("")}</div></div>
    <div class="hcard"><h3>${L({ en: "Start a new room", ar: "ابدأ غرفة جديدة" })}</h3><p class="psub">${L({ en: "You choose the level. Share the code with your team.", ar: "انت اللي هتختار المستوى. ابعت الكود للتيم." })}</p>
      <select id="olevel">${CML.slice(0, 3).map(c => `<option value="${c.n}" ${c.n === LB.level ? "selected" : ""}>${L(c.t)}</option>`).join("")}</select>
      <button class="hbtn" type="button" data-act="ocreate">${L({ en: "Create room", ar: "اعمل غرفة" })}</button>
      <h3>${L({ en: "Or join with a code", ar: "أو ادخل بكود" })}</h3><input type="text" id="ocode" maxlength="16" placeholder="SO-XXXX">
      <button class="hbtn ghost" type="button" data-act="ojoin">${L({ en: "Join room", ar: "ادخل الغرفة" })}</button><p class="bad" id="oerr"></p></div></div></section>`;
}
function lroom() {
  const st = LB.room.state, host = st.host === myId;
  return `<section class="hpanel notr"><div class="kick">${L({ en: "Mission room", ar: "غرفة المهمة" })}</div>
    <h2 class="hh">${L({ en: "Room code", ar: "كود الغرفة" })}: <span class="code">${LB.room.code}</span></h2>
    <p class="needline">${L({ en: "Send this code to your team. Each player joins from their own laptop and takes one role.", ar: "ابعت الكود ده للتيم. كل لاعب يدخل من اللابتوب بتاعه وياخد دور." })} · ${L(lvl().t)}</p>
    <div id="lroomlist" class="rolepick">${lRoomList()}</div>
    ${host ? `<button class="hbtn" type="button" data-act="ostart">${L({ en: "Start the briefing for everyone", ar: "ابدأ الشرح للكل" })}</button>` : `<p class="psub">${L({ en: "Waiting for the room creator to start…", ar: "مستنيين اللي عمل الغرفة يبدأ…" })}</p>`}
  </section>${lChatBox()}`;
}
function lRoomList() { return TEAM_ROLES.map(r => { const p = LB.players.find(x => x.role === r); return `<div class="rolecard ${p ? "taken" : ""}" style="--sc:${CREW[r].col}">${crewImg(r)}<b>${L(CREW[r].title)}</b><span>${p ? esc(p.name) + (p.data && p.data.cid === myId ? " (" + L({ en: "you", ar: "انت" }) + ")" : "") : L({ en: "empty", ar: "فاضي" })}</span></div>`; }).join(""); }
function lChatBox() { if (LB.mode !== "online") return ""; return `<section class="hpanel notr chat"><div class="kick">${L({ en: "Team chat", ar: "شات التيم" })}</div><div id="chatlog" class="chatlog"></div><form id="chatform" class="row"><input type="text" id="chatin" maxlength="300" placeholder="${L({ en: "Tell your team what you found…", ar: "قول للتيم انت لقيت إيه…" })}"><button class="hbtn" type="submit">${L({ en: "Send", ar: "ابعت" })}</button></form></section>`; }
function lChatPaint() { const el = $("#chatlog"); if (!el) return; el.innerHTML = LB.chat.map(m => `<div><b style="color:${(CREW[m.role] || CREW.director).col}">${esc(m.name)}</b> <span class="psub">${esc(L((CREW[m.role] || CREW.director).title))}</span><br>${esc(m.body)}</div>`).join(""); el.scrollTop = 1e9; }
function lVideoList() { const roles = myRoles(); return ["director", ...roles]; }
function lvideo() {
  const list = lVideoList(); const i = Math.min(LB.vi || 0, list.length - 1), r = list[i];
  return `<section class="hpanel notr"><div class="kick">${L({ en: "Mission briefing", ar: "شرح المهمة" })} · ${i + 1}/${list.length}</div>
    <h2 class="hh">${CREW[r].name} · ${L(CREW[r].title)}</h2>
    <p class="needline">${L({ en: "Watch carefully and remember the numbers. You will not see them again on the cards.", ar: "اتفرج كويس وافتكر الأرقام. مش هتشوفها تاني على الكروت." })}</p>
    <video id="brief" class="briefvid" src="video/delta_${r}.mp4" controls playsinline preload="auto"></video>
    <div class="row">${i < list.length - 1 ? `<button class="hbtn" type="button" data-act="vnext" id="vnext" ${LB.watched[r] ? "" : "disabled"}>${L({ en: "Next briefing", ar: "الشرح اللي بعده" })}</button>`
      : `<button class="hbtn" type="button" data-act="vdone" id="vnext" ${LB.watched[r] ? "" : "disabled"}>${L({ en: "I'm ready to design", ar: "أنا جاهز أصمم" })}</button>`}
      <span class="psub">${L({ en: "The button unlocks when the video ends.", ar: "الزرار بيتفتح لما الفيديو يخلص." })}</span></div></section>`;
}
function lCard(role, d, o, picks, mine) {
  const sel = picks[role + "." + d.k] === o.k;
  return `<button type="button" class="ccard ${sel ? "sel" : ""}" ${mine ? `data-lpick="${role}.${d.k}.${o.k}"` : "disabled"}><span class="cnum">${o.k}</span><span class="cicon">${sIcon(o.icon)}</span><b>${L(o.n)}</b></button>`;
}
function ldesign() {
  const picks = allPicks(), mine = myRoles(), c = lCompute(picks), roles = rolesInPlay();
  const tabs = roles.map(r => `<button type="button" class="stp ${LB.tab === r ? "cur" : ""} ${decisionsFor([r]).every(({ role, d }) => picks[role + "." + d.k]) ? "done" : ""}" data-ltab="${r}" style="--sc:${CREW[r].col}"><span>${crewImg(r)}</span>${L(CREW[r].title)}</button>`).join("");
  const r = roles.includes(LB.tab) ? LB.tab : (mine[0] || roles[0]); LB.tab = r; const canEdit = mine.includes(r);
  const other = LB.mode === "online" ? LB.players.filter(p => p.role !== LB.myRole) : [];
  return `<section class="build notr">
    <div class="buildhead"><div><div class="kick">${L(DELTA.name)} · ${L(lvl().t)}${LB.level === 3 ? " · " + (LB.designA ? L({ en: "Design B", ar: "التصميم B" }) : L({ en: "Design A", ar: "التصميم A" })) : ""}</div>
      <div class="rulesrow">${DELTA.rules.map(x => `<span class="rulechip">${L(x)}</span>`).join("")}</div>
      <div class="stepper">${tabs}</div></div></div>
    <div class="buildgrid"><div class="holowrap"><canvas id="holoBuild" class="holo"></canvas><div class="holotag">${L({ en: "Your satellite", ar: "قمرك الصناعي" })}</div></div>
      <div class="choose"><div class="steptitle" style="--sc:${CREW[r].col}">${roleTag(r)}<h2 class="hh">${CREW[r].name}</h2><span class="psub">${L(SEGMENT[r])}</span></div>
        ${canEdit ? "" : `<p class="needline">${L({ en: "This is a teammate's job. Ask them in the chat.", ar: "ده شغل حد تاني في التيم. اسأله في الشات." })}</p>`}
        ${DELTA.decisions[r].map(d => `<div class="dec"><h3>${L(d.t)}</h3><div class="cards3">${d.o.map(o => lCard(r, d, o, picks, canEdit)).join("")}</div></div>`).join("")}
        <div class="nav2"><button class="hbtn ghost" type="button" data-act="rewatch">${L({ en: "Rewatch my briefing (−20 points)", ar: "اتفرج على الشرح تاني (−20 نقطة)" })}</button></div></div></div>
    <div class="reviewbar"><button class="hbtn ghost" type="button" data-act="review">${L({ en: "Design review", ar: "مراجعة التصميم" })} ${(LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews) ? L({ en: "(−30 points)", ar: "(−30 نقطة)" }) : L({ en: "(first one free)", ar: "(أول مرة ببلاش)" })}</button>
      ${lLaunchBtn(picks)}</div>
    <div id="reviewbox">${lReviewHtml()}</div>
  </section>${lChatBox()}`;
}
function lLaunchBtn(picks) {
  const roles = rolesInPlay(), done = allChosen(picks, roles);
  if (LB.level === 1) return `<button class="hbtn launch" type="button" data-act="concept" ${done ? "" : "disabled"}>${L({ en: "Submit the concept", ar: "قدّم الفكرة" })}</button>`;
  if (LB.level === 3 && !LB.designA) return `<button class="hbtn launch" type="button" data-act="saveA" ${done ? "" : "disabled"}>${L({ en: "Save design A, make design B", ar: "احفظ التصميم A واعمل B" })}</button>`;
  if (LB.level === 3) return `<button class="hbtn launch" type="button" data-act="compare" ${done ? "" : "disabled"}>${L({ en: "Compare A and B", ar: "قارن A و B" })}</button>`;
  if (LB.mode === "online") { const ready = LB.players.filter(p => p.data && p.data.ready).length, meReady = LB.me.data && LB.me.data.ready;
    return `<button class="hbtn launch" type="button" data-act="oready" ${done ? "" : "disabled"}>${meReady ? L({ en: "Waiting for team", ar: "مستنيين التيم" }) : L({ en: "I'm ready to launch", ar: "أنا جاهز للإطلاق" })} (${ready}/${LB.players.length})</button>`; }
  return `<button class="hbtn launch" type="button" data-act="llaunch" ${done ? "" : "disabled"}>${L({ en: "Launch!", ar: "اطلق!" })}</button>`;
}
function lReviewHtml() {
  const rv = LB.mode === "online" ? LB.room.state.lastReview : LB.revealed; if (!rv) return `<p class="ringhelp">${L({ en: "The 4 meters stay hidden until you ask for a design review, like a real NASA review.", ar: "الأربع عدادات متخفية لحد ما تطلبوا مراجعة تصميم، زي مراجعات ناسا الحقيقية." })}</p>`;
  const c = lCompute(allPicks());
  return `${ringsRow({ ring: c.ring })}<div class="hcard"><h3>${L({ en: "Review findings", ar: "نتايج المراجعة" })}</h3><ul>${(c.issues.length ? c.issues : [{ en: "No problems found. The design closes.", ar: "مفيش مشاكل. التصميم مظبوط." }]).map(x => `<li>${L(x)}</li>`).join("")}</ul><p class="psub">${L({ en: "The review tells you what is wrong, not how to fix it.", ar: "المراجعة بتقولك إيه الغلط، مش بتقولك تصلّحه إزاي." })}</p></div>`;
}
function lPartial() {
  if (A.screen === "lroom") { const el = $("#lroomlist"); if (el) el.innerHTML = lRoomList(); return; }
  if (A.screen === "ldesign") { const keep = document.activeElement && document.activeElement.id === "chatin"; const val = keep ? $("#chatin").value : "";
    const ch = document.querySelector(".choose"); if (!ch) return; const picks = allPicks();
    document.querySelectorAll("[data-lpick]").forEach(b => { const [r, k, o] = b.dataset.lpick.split("."); b.classList.toggle("sel", picks[r + "." + k] === o); });
    document.querySelectorAll(".ccard[disabled]").forEach(b => { /* teammate's cards */ });
    const rb = document.querySelector(".reviewbar"); if (rb) rb.lastElementChild.outerHTML = lLaunchBtn(picks);
    const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); lHolo();
    if (keep) { $("#chatin").value = val; $("#chatin").focus(); } }
}
let holoL = null;
function lHolo() { if (!holoL) return; const c = lCompute(allPicks()); const base = MISSIONS.find(x => x.id === "delta"); const d = Object.assign(structuredClone(base.def), { orbit: "sso600", lv: (c.rkt && c.rkt.lv) || "medium", panel: c.pan && c.pan.supply ? c.pan.supply * .8 : 2, antenna: c.ant && c.ant.k ? { A: "small", B: "medium", C: "large" }[c.ant.k] : "small", instr: c.cam && c.cam.k ? [{ A: "multispec", B: "cam_med", C: "cam_high" }[c.cam.k]] : [], shield: "light" });
  holoL.setDesign(base, d, { dry: 400 }); }

/* ---- concept (CML 1) and trade study (CML 3) ---- */
function lconcept() {
  const c = lCompute(allPicks()); const ok = c.rules.fields && c.rules.health && c.rules.light === !!(c.time && c.time.light) && c.time && c.time.light;
  const pass = c.rules.fields && c.rules.health && c.time && c.time.light;
  if (pass) { A.progress.stars["cml_delta"] = Math.max(A.progress.stars["cml_delta"] || 0, 1); store.set("ma.progress3", A.progress); }
  return `<section class="hpanel notr result"><div class="kick">CML 1 · ${L({ en: "Concept review", ar: "مراجعة الفكرة" })}</div>
    <h2 class="hh">${pass ? L({ en: "Concept approved! It answers the question.", ar: "الفكرة اتقبلت! بتجاوب على السؤال." }) : L({ en: "Not yet. The concept doesn't answer the question.", ar: "لسه. الفكرة مش بتجاوب على السؤال." })}</h2>
    <ul class="starkey">${[["fields", c.rules.fields], ["health", c.rules.health], ["light", !!(c.time && c.time.light)]].map(([k, v]) => `<li class="${v ? "on" : ""}">${v ? "✓" : "✗"} ${L(DELTA.rules.find(x => x.k === k))}</li>`).join("")}</ul>
    <p class="needline">${pass ? L({ en: "At CML 1, NASA only asks: is this the right idea? Next, CML 2 checks if the whole mission can really work.", ar: "في CML 1 ناسا بتسأل بس: هل دي الفكرة الصح؟ وبعدين CML 2 بيشوف المهمة كلها تنفع فعلاً ولا لأ." }) : L({ en: "Think again about what each camera can see, and about the light.", ar: "فكّر تاني في كل كاميرا بتشوف إيه، وفي الإضاءة." })}</p>
    <div class="row"><button class="hbtn" type="button" data-act="${pass ? "tocml2" : "redesign"}">${pass ? L({ en: "Go to CML 2", ar: "روح لـ CML 2" }) : L({ en: "Try again", ar: "جرّب تاني" })}</button><button class="linkbtn" type="button" data-go="llevel">${L({ en: "Levels", ar: "المستويات" })}</button></div></section>`;
}
function lcompare() {
  const a = lCompute(LB.designA), b = lCompute(allPicks()); const row = (lab, fa, fb) => `<tr><td>${L(lab)}</td><td>${fa}</td><td>${fb}</td></tr>`;
  const pc = v => Math.round(v * 100) + "%"; const rulesN = c => Object.values(c.rules).filter(Boolean).length + " / 5";
  return `<section class="hpanel notr"><div class="kick">CML 3 · ${L({ en: "Trade study", ar: "دراسة المقارنة" })}</div><h2 class="hh">${L({ en: "Which design should fly?", ar: "أنهي تصميم يطير؟" })}</h2>
    <div class="tablewrap"><table><tr><th></th><th>${L({ en: "Design A", ar: "التصميم A" })}</th><th>${L({ en: "Design B", ar: "التصميم B" })}</th></tr>
    ${row({ en: "Rules met", ar: "القواعد المتحققة" }, rulesN(a), rulesN(b))}${row({ en: "Mass vs rocket", ar: "الوزن مقابل الصاروخ" }, pc(a.ring.mass), pc(b.ring.mass))}${row({ en: "Power used", ar: "الكهربا المستخدمة" }, pc(a.ring.power), pc(b.ring.power))}${row({ en: "Budget used", ar: "الميزانية المستخدمة" }, pc(a.ring.money), pc(b.ring.money))}${row({ en: "Data sent", ar: "الداتا اللي بتتبعت" }, pc(Math.min(1, 1 / Math.max(a.ring.data, .01))), pc(Math.min(1, 1 / Math.max(b.ring.data, .01))))}</table></div>
    <p class="needline">${L({ en: "This is what NASA's Mission Design Lab calls a trade study: compare options, then choose.", ar: "ده اللي معمل تصميم المهمات في ناسا بيسميه Trade study: تقارن الاختيارات، وبعدين تختار." })}</p>
    <div class="row"><button class="hbtn" type="button" data-act="flyA">${L({ en: "Fly design A", ar: "طيّر التصميم A" })}</button><button class="hbtn" type="button" data-act="flyB">${L({ en: "Fly design B", ar: "طيّر التصميم B" })}</button></div></section>`;
}

function lSay(role, text) { const el = $("#subt"); if (el) { el.innerHTML = `<b style="color:${CREW[role].col}">${CREW[role].name}:</b> ${text}`; el.classList.add("on"); } }
/* ---- flight (reuses the 3D engine with real NASA models) ---- */
const L_EVENTS = [
  { role: "comms", t: { en: "Ground station offline", ar: "المحطة الأرضية وقعت" }, x: { en: "A storm on Earth broke your main ground station for a week.", ar: "عاصفة على الأرض وقّعت المحطة الأرضية الرئيسية أسبوع." },
    o: [{ t: { en: "Use another station", ar: "استخدم محطة تانية" }, f: c => c.st.n >= 2 ? { h: 0, sci: 0, w: { en: "Your second station took over. Nothing was lost.", ar: "المحطة التانية استلمت. مفيش حاجة ضاعت." } } : { h: 0, sci: -.15, w: { en: "You built only one station, so there was no other station. A week of pictures was lost.", ar: "انت عامل محطة واحدة بس، فمكانش فيه محطة تانية. صور أسبوع ضاعت." } } },
        { t: { en: "Keep pictures in memory, send later", ar: "خزّن الصور في الذاكرة وابعتها بعدين" }, f: c => c.ring.data <= .8 ? { h: 0, sci: 0, w: { en: "Your antenna had spare speed, so it sent the saved pictures later. Landsat 8 really has a 3.14-terabit memory for this.", ar: "الهوائي كان عنده سرعة زيادة، فبعت الصور المتخزنة بعدين. وLandsat 8 فعلاً عنده ذاكرة 3.14 تيرابت علشان كده." } } : { h: 0, sci: -.1, w: { en: "Your antenna was already busy, so it could not catch up. Some pictures were lost.", ar: "الهوائي كان مشغول أصلاً، فملحقش. شوية صور ضاعت." } } },
        { t: { en: "Rent a partner's station", ar: "أجّر محطة من شريك" }, f: c => ({ h: 0, sci: 0, cost: 5, w: { en: "Space agencies share antennas. It cost 5 budget points, and nothing was lost.", ar: "وكالات الفضاء بتشارك الهوائيات. كلّف 5 نقط من الميزانية، ومفيش حاجة ضاعت." } }) }] },
  { role: "engineer", t: { en: "Solar storm!", ar: "عاصفة شمسية!" }, x: { en: "The Sun threw out a cloud of charged particles. They can confuse the computer.", ar: "الشمس رمت سحابة جزيئات مشحونة، ممكن تلخبط الكمبيوتر." },
    o: [{ t: { en: "Safe mode for a day", ar: "الوضع الآمن يوم" }, f: c => ({ h: 0, sci: -.03, w: { en: "The computer was protected. You lost one day of pictures. Real satellites do this.", ar: "الكمبيوتر اتحمى. خسرت صور يوم. والأقمار الحقيقية بتعمل كده." } }) },
        { t: { en: "Keep going", ar: "كمّل عادي" }, f: c => c.orb.rad ? { h: -30, sci: 0, w: { en: "At 1,500 km the radiation is stronger. The particles damaged the computer badly.", ar: "على 1,500 كم الإشعاع أقوى. الجزيئات بوّظت الكمبيوتر جامد." } } : { h: -15, sci: 0, w: { en: "Some particles hit the computer and broke a few parts.", ar: "شوية جزيئات خبطت الكمبيوتر وبوّظت كام قطعة." } } },
        { t: { en: "Turn so the body shields the computer", ar: "لف علشان جسم القمر يحمي الكمبيوتر" }, f: c => ({ h: -5, sci: 0, w: { en: "The satellite's body blocked most particles. Small damage.", ar: "جسم القمر صد أغلب الجزيئات. ضرر بسيط." } }) }] }];
function lfly() { return sfly(); }
async function lRunFlight() {
  SEQ++; const picks = LB.flyPicks || allPicks(), c = lCompute(picks); const base = MISSIONS.find(x => x.id === "delta");
  const d = Object.assign(structuredClone(base.def), { orbit: "sso600", lv: c.rkt.lv, antenna: { A: "small", B: "medium", C: "large" }[c.ant.k], instr: [{ A: "multispec", B: "cam_med", C: "cam_high" }[c.cam.k]], panel: c.pan.supply * .8 });
  const F = LB.flight = { health: 100, sci: 1, cost: 0, events: [], lost: null, c, picks };
  curP = 0; totalDays = 365 * 5;
  if (Space3D.ok && $("#view3d")) { flightView = Space3D.createView($("#view3d"), {}); flightView.setMission(base, d, { dry: c.mass * 1000, prop: 200 }); skyLoop(); }
  const marks = flightView ? flightView.marks() : { ascent: .12, orbit: 1 }; ascentEnd = marks.ascent || .12;
  lSay("planner", L({ en: "Three, two, one... liftoff!", ar: "تلاتة، اتنين، واحد... انطلقنا!" })); await wait(2600); setPhase(L({ en: "LIFTOFF", ar: "الإطلاق" }));
  if (c.fatal === "mass") { await animTo(.045, 3500); flightView && flightView.flag("fall"); F.lost = { en: `The ${L(c.rkt.n)} could not lift this satellite. It ran out of fuel before space and fell into the ocean.`, ar: `صاروخ ${c.rkt.n.ar} مقدرش يشيل القمر ده. الوقود خلص قبل الفضاء ووقع في المحيط.` }; lSay("planner", L(F.lost)); await wait(4500); return lFinish(F); }
  await animTo(ascentEnd, 6500); flightView && flightView.flag("separated"); setPhase(L({ en: "IN ORBIT", ar: "في المدار" }));
  lSay("engineer", L({ en: "We are in orbit! Opening the solar panels.", ar: "إحنا في المدار! بنفتح الألواح الشمسية." })); await wait(2400);
  if (c.fatal === "power") { await animTo(ascentEnd + .03, 2500); flightView && flightView.flag("tumble"); F.lost = { en: "The camera, antenna and computer needed more power than the panels made. The satellite went silent.", ar: "الكاميرا والهوائي والكمبيوتر كانوا محتاجين كهربا أكتر من اللي الألواح بتعمله. القمر سكت." }; lSay("engineer", L(F.lost)); await wait(4500); return lFinish(F); }
  if (c.bat.min < 35) { lSay("engineer", L({ en: "First shadow... the battery is empty before sunrise. We shut down every orbit.", ar: "أول ضل... البطارية فضيت قبل الشمس ما تطلع. هنطفي في كل لفة." })); await wait(3500); }
  await animTo(.5, 5000); for (let i = 0; i < L_EVENTS.length; i++) { await lEvent(i, F); await animTo(.5 + (i + 1) * .22, 3500); }
  lSay("comms", L({ en: "Five years later... the mission is complete.", ar: "بعد 5 سنين... المهمة خلصت." })); setPhase(L({ en: "MISSION COMPLETE", ar: "المهمة خلصت" })); await animTo(1, 2500); await wait(1500);
  return lFinish(F);
}
function lEvent(i, F) {
  const e = L_EVENTS[i];
  return new Promise(res => {
    const el = $("#modal"); lSay(e.role, L(e.x)); LB.evRes = res; LB.evI = i;
    const online = LB.mode === "online";
    el.innerHTML = `<div class="overlay notr" role="dialog" aria-modal="true"><div class="hmodal">
      <div class="evhead">${crewImg(e.role)}<div><div class="kick">${L({ en: "Surprise!", ar: "مفاجأة!" })} · ${CREW[e.role].name}</div><h2 class="hh">${L(e.t)}</h2></div></div>
      <p class="evx">${L(e.x)}</p><p class="evq">${online ? L({ en: "Everyone votes. The most votes wins.", ar: "الكل يصوّت، والأكتر أصوات يكسب." }) : L({ en: "Talk with the team, then choose.", ar: "اتكلموا مع بعض، وبعدين اختاروا." })}</p>
      <div class="cards3">${e.o.map((o, j) => `<button type="button" class="ccard" data-lev="${j}"><span class="cnum">${"ABC"[j]}</span><b>${L(o.t)}</b></button>`).join("")}</div><p class="psub" id="votes"></p></div></div>`;
    el.querySelectorAll("[data-lev]").forEach(b => b.onclick = async () => { const j = +b.dataset.lev;
      if (online) { el.querySelectorAll("[data-lev]").forEach(x => x.classList.toggle("sel", x === b)); const v = Object.assign({}, LB.me.data.votes || {}); v[i] = j; await myData({ votes: v }); lVoteCheck(); }
      else lEventResolve(j, F); });
    if (online) lVoteCheck();
  });
}
function lVoteCheck() {
  const i = LB.evI; if (i == null || !LB.evRes || LB.mode !== "online") return; const votes = LB.players.map(p => p.data && p.data.votes ? p.data.votes[i] : undefined).filter(v => v !== undefined);
  const vt = $("#votes"); if (vt) vt.textContent = `${L({ en: "Votes", ar: "الأصوات" })}: ${votes.length} / ${LB.players.length}`;
  if (votes.length >= LB.players.length) { const cnt = [0, 0, 0]; votes.forEach(v => cnt[v]++); const lead = LB.players.find(p => p.role === L_EVENTS[i].role); const lv = lead && lead.data.votes ? lead.data.votes[i] : 0; const max = Math.max(...cnt); const pick = cnt[lv] === max ? lv : cnt.indexOf(max); lEventResolve(pick, LB.flight); }
}
function lEventResolve(j, F) {
  const i = LB.evI, e = L_EVENTS[i], o = e.o[j], r = o.f(F.c), res = LB.evRes; if (!res) return; LB.evRes = null;
  F.health = Math.max(5, F.health + r.h); F.sci *= 1 + r.sci; F.cost += r.cost || 0; setHealth(F.health); F.events.push({ e, o, r });
  const el = $("#modal"); const good = !r.h && !r.sci && !r.cost;
  el.querySelector(".hmodal").innerHTML = `<div class="evhead">${crewImg(e.role)}<div><div class="kick">${L(e.t)} · ${L({ en: "the team chose", ar: "التيم اختار" })} ${"ABC"[j]}</div><h2 class="hh">${good ? L({ en: "Great choice!", ar: "اختيار ممتاز!" }) : L({ en: "Here's what happened", ar: "ده اللي حصل" })}</h2></div></div>
    <p class="evx">${L(r.w)}</p><div class="row"><button class="hbtn" type="button" id="levok">${L({ en: "Continue", ar: "كمّل" })}</button></div>`;
  lSay(e.role, L(r.w)); $("#levok").onclick = () => { el.innerHTML = ""; res(); };
}
function lFinish(F) {
  const c = F.c, ok = !F.lost, cost = c.cost + F.cost, rules = Object.assign({}, c.rules, { budget: cost <= DELTA.budget });
  const met = Object.values(rules).filter(Boolean).length;
  let stars = ok ? 1 : 0; if (ok && met === 5) stars = 2; if (stars === 2 && F.health >= 70 && c.eom.clean) stars = 3;
  const reviews = LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews;
  const parts = { success: ok ? 300 : 0, rules: ok ? met * 60 : 0, budget: ok ? Math.max(0, Math.round((DELTA.budget - cost) * 5)) : 0, decisions: ok ? Math.round(F.health) : 0, space: ok && c.eom.clean ? 100 : 0, penalty: -(Math.max(0, reviews - 1) * 30 + LB.rewatch * 20) };
  const total = Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0));
  F.result = { ok, rules, met, stars, parts, total, sciPct: ok ? Math.round(c.sci * F.sci * (F.health / 100) * 100) : 0, cost };
  if (ok) { A.progress.stars["cml_delta"] = Math.max(A.progress.stars["cml_delta"] || 0, LB.level >= 3 ? 3 : 2); store.set("ma.progress3", A.progress); }
  setTimeout(() => { if (A.screen === "lfly" && LB.flight === F) go("lusers"); }, 800);
}
function lusers() {
  const F = LB.flight; if (!F || !F.result) return lhome(); const R = F.result, c = F.c;
  const msg = !R.ok ? { en: "The satellite never sent any data. The farmers are still guessing which fields need water.", ar: "القمر الصناعي مبعتش أي داتا. والفلاحين لسه بيخمّنوا أنهي أرض محتاجة مية." }
    : R.rules.health && R.rules.fields ? { en: `The Ministry of Agriculture received ${R.sciPct}% of the planned pictures. Farmers could see which fields were thirsty, and water them before the crops were damaged.`, ar: `وزارة الزراعة استلمت ${R.sciPct}% من الصور المطلوبة. والفلاحين قدروا يشوفوا أنهي أرض عطشانة ويسقوها قبل ما المحصول يتضرر.` }
    : R.rules.health ? { en: "The pictures showed plant health, but only for big areas. Farmers knew a region was thirsty, but not which field.", ar: "الصور بيّنت صحة النبات، بس لمناطق كبيرة. الفلاحين عرفوا إن المنطقة عطشانة، بس مش أنهي أرض بالظبط." }
    : { en: "The pictures were beautiful, but they could not show plant health. The Ministry could not use them for crops.", ar: "الصور كانت حلوة، بس مكانتش بتبيّن صحة النبات. والوزارة مقدرتش تستخدمها للمحاصيل." };
  return `<section class="hpanel notr result"><div class="kick">${L({ en: "User segment", ar: "جزء المستخدمين" })} · ${L({ en: "who used your data?", ar: "مين استخدم الداتا بتاعتك؟" })}</div>
    <h2 class="hh">${L(DELTA.user)}</h2><p class="evx">${L(msg)}</p>
    <p class="needline">${L({ en: "NASA splits every mission into four segments: launch, space, ground, and users. A mission only matters when its data helps people.", ar: "ناسا بتقسم أي مهمة لأربع أجزاء: الإطلاق، والفضاء، والأرض، والمستخدمين. والمهمة بتبقى ليها قيمة بس لما الداتا بتاعتها تساعد الناس." })}</p>
    <div class="row"><button class="hbtn" type="button" data-go="lreport">${L({ en: "See the mission report", ar: "شوف تقرير المهمة" })}</button></div></section>`;
}
function lreport() {
  const F = LB.flight; if (!F || !F.result) return lhome(); const R = F.result, c = F.c;
  const fix = []; if (F.lost) fix.push(F.lost);
  DELTA.rules.forEach(r => { if (!R.rules[r.k]) fix.push({ en: `Rule missed: ${r.en}.`, ar: `قاعدة متحققتش: ${r.ar}.` }); });
  if (!c.eom.clean) fix.push({ en: "Your satellite becomes space junk at the end. NASA plans how every mission ends.", ar: "القمر بتاعك هيبقى زبالة فضائية في الآخر. ناسا بتخطط لنهاية كل مهمة." });
  const good = []; DELTA.rules.forEach(r => { if (R.rules[r.k]) good.push(r); }); F.events.forEach(ev => { if (!ev.r.h && !ev.r.sci && !ev.r.cost) good.push({ en: `Smart decision: ${ev.e.t.en}.`, ar: `قرار ذكي: ${ev.e.t.ar}.` }); });
  return `<section class="hpanel notr result"><div class="kick">${L({ en: "Mission report", ar: "تقرير المهمة" })} · ${L(lvl().t)}</div>
    <div class="resgrid"><div><div class="bigstars">${"★".repeat(R.stars)}<span>${"★".repeat(3 - R.stars)}</span></div>
      <h2 class="hh">${R.ok ? L({ en: "Mission complete", ar: "المهمة نجحت" }) : L({ en: "Mission lost", ar: "المهمة فشلت" })} · ${R.total} ${L({ en: "points", ar: "نقطة" })}</h2>
      <p class="sciline">${L({ en: "Rules met", ar: "القواعد المتحققة" })}: <b>${R.met}/5</b> · ${L({ en: "Health", ar: "الصحة" })}: <b>${Math.round(F.health)}%</b> · ${L({ en: "Budget", ar: "الميزانية" })}: <b>${R.cost}/100</b></p>
      <ul class="starkey"><li class="${R.stars >= 1 ? "on" : ""}">★ ${L({ en: "The satellite reached orbit and worked", ar: "القمر وصل المدار واشتغل" })}</li><li class="${R.stars >= 2 ? "on" : ""}">★ ${L({ en: "All 5 mission rules met", ar: "الـ 5 قواعد اتحققوا" })}</li><li class="${R.stars >= 3 ? "on" : ""}">★ ${L({ en: "Healthy, and a clean end of mission", ar: "بصحة كويسة، ونهاية مهمة نضيفة" })}</li></ul>
      <p class="psub">${L({ en: "Points", ar: "النقط" })}: ${Object.entries(R.parts).map(([k, v]) => `${k} ${v}`).join(" · ")}</p></div>
    <div class="resholo"><canvas id="holoRes" class="holo"></canvas><div class="holotag">Landsat 8 · NASA 3D model</div></div></div>
    <div class="cols2"><div class="hcard"><h3>${L({ en: "What you did well", ar: "اللي عملته صح" })}</h3><ul>${(good.length ? good : [{ en: "You tried. Every NASA team learns from its first design.", ar: "انت جرّبت. وكل تيم في ناسا بيتعلم من أول تصميم." }]).slice(0, 5).map(x => `<li>${L(x)}</li>`).join("")}</ul></div>
      <div class="hcard"><h3>${L({ en: "Fix next time", ar: "صلّحه المرة الجاية" })}</h3><ul>${(fix.length ? fix : [{ en: "Nothing! Try the next CML level.", ar: "ولا حاجة! جرّب مستوى CML اللي بعده." }]).slice(0, 5).map(x => `<li>${L(x)}</li>`).join("")}</ul></div></div>
    <div class="hcard fact"><h3>${L({ en: "The real mission", ar: "المهمة الحقيقية" })}</h3><p>${L(DELTA.facts)}</p>
      <p class="psub">${L({ en: "Explore real mission trajectories in", ar: "استكشف مسارات المهمات الحقيقية في" })} <a href="https://nasa.github.io/mission-viz/" target="_blank" rel="noopener">NASA Mission Viz</a> · ${L({ en: "Sources", ar: "المصادر" })}: <a href="https://www.usgs.gov/landsat-missions/landsat-8" target="_blank" rel="noopener">USGS Landsat 8</a> · <a href="https://modis.gsfc.nasa.gov/about/" target="_blank" rel="noopener">NASA MODIS</a></p></div>
    <div class="row"><button class="hbtn" type="button" data-act="redesign">${L({ en: "Change the design and fly again", ar: "غيّر التصميم وطير تاني" })}</button><button class="hbtn ghost" type="button" data-go="llevel">${L({ en: "Next level", ar: "المستوى اللي بعده" })}</button></div></section>`;
}
Object.assign(SIMPLE, { lhome, llevel, lonline, lroom, lvideo, ldesign, lconcept, lcompare, lfly, lusers, lreport });
Object.assign(SIMPLE_AFTER, {
  lhome() { const cv = $("#holoHome"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel("landsat8"); },
  lonline() { onlineAvailable().then(ok => { const el = $("#olstat"); if (!el) return; el.innerHTML = ok ? L({ en: "Connected. Choose your name and role.", ar: "متوصل. اختار اسمك ودورك." }) : L({ en: "Online play can't connect here. Open the public game link (GitHub Pages), or play on one computer.", ar: "اللعب الأونلاين مش قادر يتوصل هنا. افتح لينك اللعبة العام (GitHub Pages)، أو العبوا على جهاز واحد." }); if (!ok) document.querySelectorAll("[data-act=ocreate],[data-act=ojoin]").forEach(b => b.disabled = true); }); },
  lroom() { lChatPaint(); }, lvideo() { const v = $("#brief"); const list = lVideoList(), r = list[Math.min(LB.vi || 0, list.length - 1)]; if (v) v.onended = () => { LB.watched[r] = true; const b = $("#vnext"); if (b) b.disabled = false; }; },
  ldesign() { const cv = $("#holoBuild"); holoL = Space3D.ok && cv ? Space3D.createHolo(cv) : null; lHolo(); lChatPaint(); },
  lreport() { const cv = $("#holoRes"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel("landsat8"); }
});
function lStartDesign() { LB.tab = myRoles()[0] || rolesInPlay()[0]; LB.revealed = null; go("ldesign"); }
function lClick(t) {
  const a = t.dataset.act;
  if (t.dataset.lmode) { LB.mode = t.dataset.lmode; LB.picks = {}; LB.designA = null; LB.reviews = 0; LB.rewatch = 0; LB.watched = {}; if (LB.mode === "online") go("lonline"); else go("llevel"); return true; }
  if (t.dataset.llevel) { LB.level = +t.dataset.llevel; if (LB.level === 4) { A.simple = false; go("home"); return true; } LB.vi = 0; LB.picks = {}; LB.designA = null; LB.flyPicks = null; go("lvideo"); return true; }
  if (t.dataset.ltab) { LB.tab = t.dataset.ltab; render(); return true; }
  if (t.dataset.lpick) { const [r, k, o] = t.dataset.lpick.split("."); if (LB.mode === "online") { const p = Object.assign({}, (LB.me.data && LB.me.data.picks) || {}); p[r + "." + k] = o; LB.me.data.picks = p; myData({ picks: p, ready: false }); } else LB.picks[r + "." + k] = o; lPartial(); return true; }
  if (a === "vnext") { LB.vi = (LB.vi || 0) + 1; render(); return true; }
  if (a === "vdone") { if (LB.mode === "online") { myData({ watched: true }); } lStartDesign(); return true; }
  if (a === "rewatch") { LB.rewatch++; LB.vi = lVideoList().length - 1; go("lvideo"); return true; }
  if (a === "review") { const n = LB.mode === "online" ? (LB.room.state.reviews || 0) : LB.reviews; if (LB.mode === "online") roomState({ reviews: n + 1, lastReview: Date.now() }); else { LB.reviews = n + 1; LB.revealed = Date.now(); } const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); return true; }
  if (a === "llaunch") { LB.flyPicks = null; go("lfly"); lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return true; }
  if (a === "concept") { go("lconcept"); return true; }
  if (a === "tocml2") { LB.level = 2; LB.vi = 0; LB.watched = {}; go("lvideo"); return true; }
  if (a === "redesign") { LB.designA = null; LB.flyPicks = null; lStartDesign(); return true; }
  if (a === "saveA") { LB.designA = Object.assign({}, allPicks()); if (LB.mode !== "online") LB.picks = {}; lStartDesign(); return true; }
  if (a === "compare") { go("lcompare"); return true; }
  if (a === "flyA" || a === "flyB") { LB.flyPicks = a === "flyA" ? LB.designA : Object.assign({}, allPicks()); go("lfly"); lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return true; }
  if (a === "oready") { myData({ ready: true }).then(() => { if (LB.players.every(p => p.data && (p.data.ready || p.id === LB.me.id))) roomState({ phase: "flight", at: Date.now() }); }); return true; }
  if (a === "ocreate" || a === "ojoin") { const name = ($("#oname").value || "").trim(); const role = (document.querySelector("input[name=orole]:checked") || {}).value; const err = $("#oerr");
    if (!name) { err.textContent = L({ en: "Write your name first.", ar: "اكتب اسمك الأول." }); return true; } A.lastName = name;
    if (a === "ocreate") LB.level = +$("#olevel").value;
    (a === "ocreate" ? roomCreate(name, role) : roomJoin($("#ocode").value, name, role)).then(() => go("lroom")).catch(e => { err.textContent = e.message || String(e); }); return true; }
  if (a === "ostart") { roomState({ phase: "video" }); return true; }
  return false;
}
document.addEventListener("submit", e => { if (e.target.id === "chatform") { e.preventDefault(); const i = $("#chatin"); sendChat(i.value); i.value = ""; } });
document.addEventListener("change", e => { if (e.target.id === "ula2") { A.unlockAll = e.target.checked; render(); } });

window.LB = LB; render(); applyLang();
