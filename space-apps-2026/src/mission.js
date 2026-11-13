/* ===== MISSION LAB: a different mission per NASA Concept Maturity Level, teams on one device or online (Supabase) =====
   CML 1 Khamsin Storm Watch (words only) · CML 2 Moon landing map (coming next) · CML 3 Nile Delta Crop Watch (add up numbers) · CML 4 expert mode.
   Real facts are listed at the top of tts/scripts_storm.py and tts/scripts_delta.py; parts of our own satellite design are marked there. */
const SB_URL = "https://sruvvklwlixpzjyhhnit.supabase.co", SB_KEY = "sb_publishable_FPsD1Xy-KmR_CrrkSwIdnQ_TP92c6Zh";
const CREW = {
  director: { name: "Mohamed", title: { en: "Mission Director", ar: "مدير المهمة" }, img: "mohamed.jpg", col: "#ffc26b" },
  science: { name: "Ayat", title: { en: "Science Lead", ar: "رئيسة العلماء" }, img: "ayat.jpg", col: "#5fd8ff" },
  comms: { name: "Adham", title: { en: "Communications Lead", ar: "مسؤول الاتصالات" }, img: "adham.jpg", col: "#c79bff" },
  engineer: { name: "Abdelrahman", title: { en: "Spacecraft Engineer", ar: "مهندس المركبة" }, img: "abdelrahman.jpg", col: "#ffb35f" },
  planner: { name: "Ahmed", title: { en: "Mission Planner", ar: "مخطط المهمة" }, img: "ahmed.jpg", col: "#7dffb0" } };
const TEAM_ROLES = ["science", "comms", "engineer", "planner"];
const SEGMENT = { science: { en: "Space segment · instruments", ar: "جزء الفضاء · الأجهزة" }, comms: { en: "Ground segment", ar: "الجزء الأرضي" }, engineer: { en: "Space segment · spacecraft", ar: "جزء الفضاء · المركبة" }, planner: { en: "Launch segment", ar: "جزء الإطلاق" } };
const lopt = (k, icon, en, ar, v) => Object.assign({ k, icon, n: { en, ar } }, v);
const ok = (en, ar) => ({ en, ar });

/* ---------- CML 1: Khamsin Storm Watch (2 choices each, no numbers) ---------- */
const M_STORM = {
  id: "storm", base: "storm", model: "goes", days: 365 * 5,
  name: ok("Khamsin Storm Watch", "رادار عواصف الخماسين"),
  user: ok("Egypt's weather forecasters, airports, and people with asthma", "خبراء الأرصاد في مصر، والمطارات، والناس اللي عندهم حساسية صدر"),
  rules: [{ k: "always", en: "Watch Egypt all the time", ar: "يراقب مصر طول الوقت" }, { k: "night", en: "See storms day and night", ar: "يشوف العاصفة بالليل والنهار" }, { k: "fresh", en: "New picture every 15 minutes", ar: "صورة جديدة كل ربع ساعة" }],
  decisions: {
    science: [{ k: "cam", t: ok("Which camera?", "أنهي كاميرا؟"), o: [lopt("A", "cam1", "Color camera", "كاميرا ألوان", { ir: false }), lopt("B", "weather", "Infrared camera", "كاميرا إنفرا ريد", { ir: true })] }],
    comms: [{ k: "ant", t: ok("Which antenna?", "أنهي أنتينا؟"), o: [lopt("A", "dish1", "Slow antenna", "أنتينا بطيئة", { fast: false }), lopt("B", "dish3", "Fast antenna", "أنتينا سريعة", { fast: true })] }],
    engineer: [{ k: "pow", t: ok("Where does the power come from?", "الكهربا هتيجي منين؟"), o: [lopt("A", "panel2", "Solar panels", "سولار بانلز", { rtg: false }), lopt("B", "rtg", "RTG nuclear battery", "بطارية نووية RTG", { rtg: true })] }],
    planner: [{ k: "orb", t: ok("Which orbit?", "أنهي أوربت؟"), o: [lopt("A", "ice", "Low orbit · 700 km", "أوربت واطي · 700 كم", { geo: false }), lopt("B", "relay", "Geostationary · 36,000 km", "جيوستيشنري · 36,000 كم", { geo: true })] }] },
  compute(p) {
    const g = (r, k) => pickOpt(this, p, r, k) || {}; const cam = g("science", "cam"), ant = g("comms", "ant"), pow = g("engineer", "pow"), orb = g("planner", "orb");
    const rules = { always: !!orb.geo, night: !!cam.ir, fresh: !!ant.fast };
    const issues = [];
    this.rules.forEach(r => { if (!rules[r.k]) issues.push({ en: `Need not met: ${r.en}.`, ar: `طلب متحققش: ${r.ar}.` }); });
    const waste = []; if (pow.rtg) waste.push(ok("Power: an RTG works, but it uses very rare fuel where sunlight is strong.", "الكهربا: الـ RTG شغالة، بس بتصرف وقود نادر جداً في مكان الشمس فيه قوية."));
    const sci = (orb.geo ? 1 : .1) * (cam.ir ? 1 : .55) * (ant.fast ? 1 : .1);
    return { rules, issues, waste, fatal: null, sci, clean: true, efficient: !pow.rtg, cam, ant, pow, orb, ring: null };
  },
  engine(c) { return { orbit: c.orb.k ? (c.orb.geo ? "geo" : "polar") : "geo", lv: "medium", lab: { cam: c.cam.k ? (c.cam.ir ? "ir" : "color") : null, ant: c.ant.k ? (c.ant.fast ? "fast" : "slow") : null, rtg: !!c.pow.rtg, panelW: c.pow.k && !c.pow.rtg ? 2000 : 0, batMin: c.pow.k && !c.pow.rtg ? 40 : 0 } }; },
  events: [
    { role: "engineer", t: ok("Eclipse season", "موسم الكسوف"), x: ok("It is March. For about an hour each night, Earth's shadow covers the satellite. No sunlight.", "إحنا في مارس. كل يوم بالليل ضل الأرض بيغطي القمر حوالي ساعة، ومفيش شمس."),
      o: [{ t: ok("Run on the battery", "اشتغل على البطارية"), f: c => ({ h: 0, sci: 0, w: c.pow.rtg ? ok("The RTG doesn't need sunlight, so nothing changed.", "الـ RTG مش محتاجة شمس، فمفيش حاجة اتغيرت.") : ok("The battery kept everything running through the shadow. Real geostationary satellites do exactly this.", "البطارية شغّلت كل حاجة لحد ما الضل خلص. والأقمار الجيوستيشنري الحقيقية بتعمل كده بالظبط.") }) },
          { t: ok("Turn the camera off for an hour", "اطفي الكاميرا ساعة"), f: c => ({ h: 0, sci: -.06, w: ok("The camera was off for an hour every night. A storm could pass without anyone seeing it.", "الكاميرا كانت مطفية ساعة كل ليلة، وممكن عاصفة تعدّي من غير ما حد يشوفها.") }) }] },
    { role: "comms", t: ok("Khamsin at 2 a.m.!", "خماسين الساعة 2 بالليل!"), x: ok("A giant dust storm is growing in the Western Desert, in the middle of the night.", "عاصفة تراب ضخمة بتكبر في الصحرا الغربية، في نص الليل."),
      o: [{ t: ok("Warn the airports now", "حذّر المطارات دلوقتي"), f: c => c.rules.night && c.rules.always && c.rules.fresh ? { h: 0, sci: 0, w: ok("Your satellite saw it in the dark and sent fresh pictures. Airports got ready hours early.", "القمر بتاعك شافها في الضلمة وبعت صور جديدة، والمطارات استعدت قبلها بساعات.") } : { h: 0, sci: -.15, w: ok("You warned them, but your satellite could not really see the storm at night, so the warning was late and unclear.", "إنت حذّرتهم، بس القمر بتاعك مكانش شايف العاصفة كويس بالليل، فالتحذير جه متأخر ومش واضح.") } },
          { t: ok("Wait for morning to be sure", "استنى للصبح علشان تتأكد"), f: c => ({ h: 0, sci: -.12, w: ok("By morning the storm had already reached Cairo. Waiting cost people time to get ready.", "على الصبح كانت العاصفة وصلت القاهرة خلاص، والانتظار ضيّع على الناس وقت كانوا هيستعدوا فيه.") }) }] }],
  userMsg(R) { const r = R.rules; return r.always && r.night && r.fresh ? ok("Forecasters saw the Khamsin coming hours early, day and night. Airports and schools got ready, and people with asthma stayed inside.", "خبراء الأرصاد شافوا الخماسين جاية قبلها بساعات، بالليل والنهار. المطارات والمدارس استعدت، والناس اللي عندهم حساسية صدر قعدوا في البيت.")
    : !r.always ? ok("The satellite saw Egypt for only a few minutes at a time. Most storms started while it was somewhere else.", "القمر كان بيشوف مصر كام دقيقة بس كل مرة، وأغلب العواصف بدأت وهو في مكان تاني.")
    : !r.night ? ok("The satellite saw storms in the day, but the ones that started at night surprised everyone.", "القمر شاف العواصف اللي بالنهار، بس اللي بدأت بالليل فاجئت الكل.")
    : ok("The satellite saw the storms, but the pictures arrived too slowly to warn people in time.", "القمر شاف العواصف، بس الصور كانت بتوصل ببطء، فملحقناش نحذّر الناس في الوقت المناسب."); },
  real: { name: "Meteosat (EUMETSAT)", photos: [["GSFC_20171208_Archive_e002123", ok("A geostationary weather satellite (NASA/NOAA GOES) sees a whole side of Earth at once", "قمر طقس جيوستيشنري (GOES بتاع ناسا و NOAA) بيشوف نص الأرض مرة واحدة")], ["KSC-20161109-PH_JBS01_0076", ok("NASA's GOES-R weather satellite on its way to the launch pad, 2016", "قمر الطقس GOES-R بتاع ناسا وهو رايح منصة الإطلاق، 2016")]], picks: ok("Infrared camera · fast antenna · solar panels · geostationary orbit", "كاميرا إنفرا ريد · أنتينا سريعة · سولار بانلز · أوربت جيوستيشنري"),
    facts: ok("Europe's Meteosat satellites watch Egypt from geostationary orbit, 35,786 km up. Their infrared channels see dust and clouds day and night, and they send a new picture of Africa and Europe every 15 minutes. NASA and NOAA's GOES satellites do the same over the Americas.", "أقمار Meteosat الأوروبية بتراقب مصر من الأوربت الجيوستيشنري، على ارتفاع 35,786 كم. قنوات الإنفرا ريد بتاعتها بتشوف التراب والسحاب بالليل والنهار، وبتبعت صورة جديدة لأفريقيا وأوروبا كل ربع ساعة. وأقمار GOES بتاعة ناسا و NOAA بتعمل نفس الحكاية فوق أمريكا."),
    links: [["EUMETSAT Meteosat", "https://www.eumetsat.int/our-satellites/meteosat-series"], ["NASA GOES", "https://science.nasa.gov/mission/goes/"]] }
};

/* ---------- CML 3: Nile Delta Crop Watch (add up watts and kilograms) ---------- */
const nf = n => Number(n).toLocaleString("en-US");
const BODY_KG = 1500, BODY_W = 1400;
const M_DELTA = {
  id: "delta", base: "delta", model: "landsat8", days: 365 * 5, rings: true,
  name: ok("Nile Delta Crop Watch", "مراقب محاصيل الدلتا"),
  user: ok("Egypt's Ministry of Agriculture and the farmers of the Nile Delta", "وزارة الزراعة وفلاحين دلتا النيل"),
  rules: [{ k: "fields", en: "See each small field", ar: "يشوف كل أرض صغيرة" }, { k: "health", en: "See plant health", ar: "يشوف صحة الزرع" }, { k: "light", en: "Same place, same light", ar: "نفس المكان ونفس الإضاءة" }, { k: "life", en: "Work for 5 years", ar: "يشتغل 5 سنين" }],
  decisions: {
    science: [
      { k: "cam", t: ok("Which camera?", "أنهي كاميرا؟"), o: [lopt("A", "cam3", "MODIS", "MODIS", { res: 250, nir: true, mass: 230, w: 160, data: 10.6, instr: "cam_med" }), lopt("B", "weather", "TIRS", "TIRS", { res: 100, nir: false, mass: 240, w: 380, data: 3, instr: "thermal" }), lopt("C", "leaf", "OLI", "OLI", { res: 30, nir: true, mass: 470, w: 400, data: 200, instr: "multispec" })] },
      { k: "time", t: ok("When do we take pictures?", "هنصوّر إمتى؟"), o: [lopt("A", "radar", "At night", "بالليل", { day: false }), lopt("B", "weather", "10 a.m. every day", "10 الصبح كل يوم", { day: true, light: true }), lopt("C", "cam1", "Any time of day", "أي وقت", { day: true, light: false })] }],
    comms: [
      { k: "ant", t: ok("Which antenna?", "أنهي أنتينا؟"), o: [lopt("A", "dish3", "Ka-band", "Ka-band", { rate: 3500, w: 350, mass: 30, few: true, eng: "large" }), lopt("B", "dish1", "S-band", "S-band", { rate: .25, w: 50, mass: 10, eng: "small" }), lopt("C", "dish2", "X-band", "X-band", { rate: 384, w: 150, mass: 20, eng: "medium" })] },
      { k: "st", t: ok("How many ground stations?", "كام جراوند ستيشن؟"), o: [lopt("A", "relay", "1 station", "محطة واحدة", { n: 1 }), lopt("B", "relay", "2 stations", "محطتين", { n: 2 }), lopt("C", "relay", "3 stations", "3 محطات", { n: 3 })] }],
    engineer: [
      { k: "pan", t: ok("Which solar panel?", "أنهي سولار بانل؟"), o: [lopt("A", "panel2", "Panel A · 2,600 W", "البانل A · 2,600 وات", { supply: 2600, mass: 200 }), lopt("B", "panel3", "Panel B · 3,200 W", "البانل B · 3,200 وات", { supply: 3200, mass: 300 }), lopt("C", "panel1", "Panel C · 2,000 W", "البانل C · 2,000 وات", { supply: 2000, mass: 120 })] },
      { k: "bat", t: ok("Which battery?", "أنهي بطارية؟"), o: [lopt("A", "rtg", "Battery A · 60 min", "البطارية A · 60 دقيقة", { min: 60, mass: 150 }), lopt("B", "rtg", "Battery B · 40 min", "البطارية B · 40 دقيقة", { min: 40, mass: 70 }), lopt("C", "rtg", "Battery C · 25 min", "البطارية C · 25 دقيقة", { min: 25, mass: 40 })] }],
    planner: [
      { k: "orb", t: ok("Which orbit?", "أنهي أوربت؟"), o: [lopt("A", "ice", "Orbit A · 400 km", "الأوربت A · 400 كم", { resF: .57, life: false, sso: false }), lopt("B", "ice", "Orbit B · 705 km", "الأوربت B · 705 كم", { resF: 1, life: true, sso: true }), lopt("C", "ice", "Orbit C · 1,500 km", "الأوربت C · 1,500 كم", { resF: 2.13, life: true, sso: false, rad: true })] },
      { k: "rkt", t: ok("Which rocket?", "أنهي صاروخ؟"), o: [lopt("A", "rocket2", "Falcon 9", "Falcon 9", { lift: 10000, cost: 69, lv: "medium" }), lopt("B", "rocket1", "Pegasus XL", "Pegasus XL", { lift: 450, cost: 56, lv: "small" }), lopt("C", "rocket2", "Vega C", "Vega C", { lift: 2300, cost: 48, lv: "medium" })] },
      { k: "eom", t: ok("End of the mission?", "نهاية المهمة؟"), o: [lopt("A", "radar", "Leave it up there", "نسيبه فوق", { clean: false }), lopt("B", "cam3", "Use all fuel for pictures", "نصرف الوقود كله على الصور", { clean: false, more: true }), lopt("C", "rocket1", "Save fuel, bring it down", "نسيب وقود وننزّله", { clean: true })] }] },
  compute(p) {
    const g = (r, k) => pickOpt(this, p, r, k) || {};
    const cam = g("science", "cam"), time = g("science", "time"), ant = g("comms", "ant"), st = g("comms", "st"), pan = g("engineer", "pan"), bat = g("engineer", "bat"), orb = g("planner", "orb"), rkt = g("planner", "rkt"), eom = g("planner", "eom");
    const mass = BODY_KG + (cam.mass || 0) + (ant.mass || 0) + (pan.mass || 0) + (bat.mass || 0), need = BODY_W + (cam.w || 0) + (ant.w || 0), supply = pan.supply || 0;
    const made = cam.data || 0, down = ant.rate || 0, res = (cam.res || 0) * (orb.resF || 1);
    const rules = { fields: !!cam.k && res <= 50, health: !!cam.nir && time.day === true, light: !!time.light && !!orb.sso, life: !!orb.life && (bat.min || 0) >= 35 };
    const fatal = rkt.k && mass > rkt.lift ? "mass" : pan.k && need > supply ? "power" : null;
    const sci = (cam.nir ? 1 : .15) * (res <= 50 ? 1 : .35) * (time.day === false ? 0 : time.light && orb.sso ? 1 : .6) * Math.min(1, made ? down / made : 1) * ((bat.min || 0) >= 35 ? 1 : .5) * (eom.more ? 1.1 : 1);
    const lifts = this.decisions.planner[1].o.filter(o => o.lift >= mass), cheapest = lifts.length ? Math.min(...lifts.map(o => o.cost)) : null;
    const waste = [];
    if (pan.k && supply >= need && supply / need > 1.3) waste.push({ en: `Power: your panel makes ${nf(supply)} W, but the satellite uses only ${nf(need)} W. That is ${nf(supply - need)} W you carry for nothing.`, ar: `الكهربا: البانل بتاعك بيطلّع ${nf(supply)} وات، والقمر بياكل ${nf(need)} بس. يعني شايل ${nf(supply - need)} وات على الفاضي.` });
    if (bat.k && bat.min >= 60) waste.push(ok("Battery: the shadow lasts up to 35 minutes, and a 40-minute battery is enough. The 60-minute one adds 80 kg.", "البطارية: الضل بيقعد لحد 35 دقيقة، وبطارية الـ 40 دقيقة كفاية. بطارية الـ 60 دقيقة بتزوّد 80 كيلو."));
    if (ant.k && made && down >= made && down / made > 5) waste.push({ en: `Antenna: it sends ${nf(down)} Mbit/s, but the camera makes only ${made}. It uses extra power for speed you don't need.`, ar: `الأنتينا: بتبعت ${nf(down)} ميجابت في الثانية، والكاميرا بتطلّع ${made} بس. يعني بتاكل كهربا زيادة على سرعة إنت مش محتاجها.` });
    if (rkt.k && !fatal && cheapest != null && rkt.cost > cheapest) waste.push({ en: `Rocket: a cheaper rocket could lift your ${nf(Math.round(mass))} kg. You paid about ${rkt.cost - cheapest} million dollars extra.`, ar: `الصاروخ: كان فيه صاروخ أرخص يقدر يشيل الـ ${nf(Math.round(mass))} كيلو بتوعك، فإنت دفعت حوالي ${rkt.cost - cheapest} مليون دولار زيادة.` });
    const issues = [];
    if (fatal === "mass") issues.push({ en: `Mass: the satellite weighs ${nf(Math.round(mass))} kg. The rocket cannot lift it.`, ar: `الوزن: القمر وزنه ${nf(Math.round(mass))} كيلو، والصاروخ مش هيقدر يشيله.` });
    if (pan.k && need > supply) issues.push({ en: `Power: the satellite needs ${nf(need)} W, but the panel makes ${nf(supply)} W.`, ar: `الكهربا: القمر محتاج ${nf(need)} وات، والبانل بيطلّع ${nf(supply)} بس.` });
    if (bat.k && bat.min < 35) issues.push(ok("Battery: it runs out before the satellite leaves Earth's shadow.", "البطارية: بتخلص قبل ما القمر يخرج من ضل الأرض."));
    if (ant.k && cam.k && made > down) issues.push(ok("Data: the camera makes data faster than the antenna can send it.", "الداتا: الكاميرا بتطلّع داتا أسرع من ما الأنتينا تبعتها."));
    this.rules.forEach(r => { if (!rules[r.k]) issues.push({ en: `Rule not met: ${r.en}.`, ar: `قاعدة متحققتش: ${r.ar}.` }); });
    return { mass, need, supply, made, down, res, rules, fatal, sci: Math.max(0, Math.min(1.1, sci)), issues, waste, efficient: !waste.length, clean: !!eom.clean,
      ring: { mass: rkt.lift ? mass / rkt.lift : 0, power: supply ? need / supply : 0, money: (rkt.cost || 0) / 100, data: down ? made / down : 0 }, cam, time, ant, st, pan, bat, orb, rkt, eom };
  },
  engine(c) { return { orbit: "sso600", lv: c.rkt.lv || "medium", lab: { cam: { A: "modis", B: "tirs", C: "oli" }[c.cam.k], ant: { A: "Ka", B: "S", C: "X" }[c.ant.k], panelW: c.pan.supply || 0, batMin: c.bat.min || 0 } }; },
  events: [
    { role: "comms", t: ok("Ground station offline", "الجراوند ستيشن وقعت"), x: ok("A storm on Earth broke your main ground station for a week.", "عاصفة على الأرض وقّعت الجراوند ستيشن الرئيسية أسبوع."),
      o: [{ t: ok("Use another station", "استخدم محطة تانية"), f: c => c.st.n < 2 ? { h: 0, sci: -.15, w: ok("You built only one station, so there was no other one. A week of pictures was lost.", "إنت عامل محطة واحدة بس، فمكانش فيه غيرها. صور أسبوع ضاعت.") } : c.ant.few ? { h: 0, sci: -.1, w: ok("Your other station could not hear Ka-band. Only a few stations in the world can. Pictures were lost.", "المحطة التانية مقدرتش تسمع Ka-band، لأن محطات قليلة في العالم بس اللي بتسمعه. صور ضاعت.") } : { h: 0, sci: 0, w: ok("Your backup station took over. Nothing was lost.", "المحطة الاحتياطي استلمت، ومفيش حاجة ضاعت.") } },
          { t: ok("Keep pictures in memory, send later", "خزّن الصور وابعتها بعدين"), f: c => c.made && c.down >= c.made * 1.5 ? { h: 0, sci: 0, w: ok("Your antenna had spare speed, so it sent the saved pictures later.", "الأنتينا كان عندها سرعة زيادة، فبعتت الصور المتخزنة بعدين.") } : { h: 0, sci: -.1, w: ok("Your antenna was already busy, so it could not catch up. Some pictures were lost.", "الأنتينا كانت مشغولة أصلاً، فملحقتش. شوية صور ضاعت.") } },
          { t: ok("Rent a partner's station", "أجّر محطة من شريك"), f: c => c.ant.few ? { h: 0, sci: -.1, cost: 3, w: ok("You paid, but the partner's station could not hear Ka-band.", "إنت دفعت، بس محطة الشريك مقدرتش تسمع Ka-band.") } : { h: 0, sci: 0, cost: 3, w: ok("Space agencies rent antenna time by the minute. It cost a little money, and nothing was lost.", "وكالات الفضاء بتأجر وقت المحطات بالدقيقة. كلّفنا شوية فلوس، ومفيش حاجة ضاعت.") } }] },
    { role: "engineer", t: ok("Solar storm!", "عاصفة شمسية!"), x: ok("The Sun threw out a cloud of charged particles. They can confuse the computer.", "الشمس رمت سحابة جزيئات مشحونة، وممكن تلخبط الكمبيوتر."),
      o: [{ t: ok("Safe mode for a day", "سيف مود يوم"), f: c => ({ h: 0, sci: -.03, w: ok("The computer was protected. You lost one day of pictures. Real satellites do this.", "الكمبيوتر اتحمى، وخسرنا صور يوم واحد. والأقمار الحقيقية بتعمل كده.") }) },
          { t: ok("Keep going", "كمّل عادي"), f: c => c.orb.rad ? { h: -30, sci: 0, w: ok("At 1,500 km the radiation is stronger. The particles damaged the computer badly.", "على 1,500 كم الريدياشن أقوى، والجزيئات بوّظت الكمبيوتر جامد.") } : { h: -15, sci: 0, w: ok("Some particles hit the computer and broke a few parts.", "شوية جزيئات خبطت الكمبيوتر وبوّظت كام قطعة.") } },
          { t: ok("Turn so the body shields the computer", "لف علشان جسم القمر يحمي الكمبيوتر"), f: c => ({ h: -5, sci: 0, w: ok("The satellite's body blocked most particles. Small damage.", "جسم القمر صد أغلب الجزيئات، والضرر بسيط.") }) }] }],
  userMsg(R) { const r = R.rules; return r.health && r.fields ? { en: `The Ministry of Agriculture received ${R.sciPct}% of the planned pictures. Farmers saw which fields were thirsty, and watered them before the crops were damaged.`, ar: `وزارة الزراعة استلمت ${R.sciPct}% من الصور المطلوبة. والفلاحين شافوا أنهي أرض عطشانة وسقوها قبل ما المحصول يتضرر.` }
    : r.health ? ok("The pictures showed plant health, but only for big areas. Farmers knew a region was thirsty, but not which field.", "الصور بيّنت صحة الزرع، بس لمناطق كبيرة. الفلاحين عرفوا إن المنطقة عطشانة، بس مش أنهي أرض بالظبط.")
    : ok("The pictures could not show plant health. The Ministry could not use them for crops.", "الصور مكانتش بتبيّن صحة الزرع، والوزارة مقدرتش تستخدمها للمحاصيل."); },
  real: { name: "Landsat 8 (NASA + USGS)", photos: [["2013-1436", ok("An Atlas V rocket launches Landsat 8, 11 February 2013", "صاروخ Atlas V بيطلق Landsat 8، يوم 11 فبراير 2013")], ["KSC-2013-1127", ok("Engineers prepare Landsat 8 before launch", "المهندسين بيجهزوا Landsat 8 قبل الإطلاق")], ["iss072e905240", ok("Egypt's Nile Delta seen from the International Space Station", "دلتا النيل في مصر من محطة الفضاء الدولية")]], picks: ok("OLI camera · about 10 a.m. · X-band · 705 km sun-synchronous orbit", "كاميرا OLI · حوالي الساعة 10 · X-band · أوربت 705 كم صن سينكرونس"),
    facts: ok("Your mission is the real Landsat 8. It has flown since 2013 at 705 km, crossing the equator at about 10 a.m. Its OLI camera sees near-infrared with 30 m pixels, and it sends data on X-band at 384 Mbit/s. (It launched on an Atlas V rocket.)", "مهمتك هي Landsat 8 الحقيقي. بيطير من 2013 على ارتفاع 705 كم، وبيعدّي خط الاستوا حوالي الساعة 10 الصبح. كاميرته OLI بتشوف النير إنفرا ريد ببيكسل 30 متر، وبيبعت الداتا على X-band بسرعة 384 ميجابت في الثانية. (واتطلق على صاروخ Atlas V.)"),
    links: [["USGS Landsat 8", "https://www.usgs.gov/landsat-missions/landsat-8"], ["NASA MODIS", "https://modis.gsfc.nasa.gov/about/specifications.php"], ["ESA Vega C", "https://www.esa.int/Enabling_Support/Space_Transportation/Vega/Vega_capabilities"]] }
};
const M_MOON = {
  id: "moon", base: "moon", model: "lro", days: 365 * 2,
  name: ok("Moon Landing Map", "خريطة الهبوط على القمر"),
  user: ok("NASA's Artemis landing planners and the astronauts who will land", "مخططين الهبوط في برنامج Artemis بتاع ناسا، والرواد اللي هينزلوا"),
  rules: [{ k: "rocks", en: "See rocks 2 m wide", ar: "يشوف صخور عرضها 2 متر" }, { k: "dark", en: "Map inside dark craters", ar: "يعمل خريطة جوه الحفر الضلمة" }, { k: "pole", en: "Fly over the south pole", ar: "يعدّي فوق القطب الجنوبي" }, { k: "data", en: "Send 100 Mbit/s", ar: "يبعت 100 ميجابت في الثانية" }, { k: "survive", en: "Survive the cold shadow", ar: "يعدّي الضل البارد" }, { k: "budget", en: "Launch budget $150 million", ar: "ميزانية الإطلاق 150 مليون دولار" }],
  decisions: {
    science: [
      { k: "cam", t: ok("Which camera?", "أنهي كاميرا؟"), o: [lopt("A", "cam1", "Wide camera · 100 m", "كاميرا واسعة · 100 متر", { res: 100, lab: "wac" }), lopt("B", "cam3", "Narrow camera · 0.5 m", "كاميرا ضيقة · نص متر", { res: .5, lab: "nac" }), lopt("C", "cam1", "Medium camera · 10 m", "كاميرا متوسطة · 10 متر", { res: 10, lab: "color" })] },
      { k: "dark", t: ok("How do we see inside dark craters?", "إزاي نشوف جوه الحفر الضلمة؟"), o: [lopt("A", "weather", "Infrared camera", "كاميرا إنفرا ريد", { lab: "irdark", part: .5 }), lopt("B", "cam1", "Normal camera", "كاميرا عادية", { lab: "camdark", part: .2 }), lopt("C", "radar", "Laser altimeter", "ليزر ألتيميتر", { lab: "laser", laser: true })] }],
    comms: [
      { k: "ant", t: ok("Which antenna?", "أنهي أنتينا؟"), o: [lopt("A", "relay", "Laser link · 622 Mbit/s", "لينك ليزر · 622 ميجابت", { rate: 622, clouds: true, lab: "laser" }), lopt("B", "dish3", "Ka-band · 100 Mbit/s", "Ka-band · 100 ميجابت", { rate: 100, lab: "Ka" }), lopt("C", "dish1", "S-band · a few Mbit/s", "S-band · كام ميجابت", { rate: 2, lab: "S" })] },
      { k: "st", t: ok("How many ground stations?", "كام جراوند ستيشن؟"), o: [lopt("A", "relay", "3 stations around the world", "3 محطات حوالين العالم", { n: 3 }), lopt("B", "relay", "1 station", "محطة واحدة", { n: 1 }), lopt("C", "relay", "6 stations", "6 محطات", { n: 6 })] }],
    engineer: [
      { k: "bat", t: ok("Which battery?", "أنهي بطارية؟"), o: [lopt("A", "rtg", "Battery A · 30 min", "البطارية A · 30 دقيقة", { min: 30 }), lopt("B", "rtg", "Battery B · 60 min", "البطارية B · 60 دقيقة", { min: 60 }), lopt("C", "rtg", "Battery C · 120 min", "البطارية C · 120 دقيقة", { min: 120 })] },
      { k: "heat", t: ok("How do we stay warm?", "إزاي نفضل دافيين؟"), o: [lopt("A", "panel1", "Blanket + heaters", "بطانية حرارية + هيترز", { warm: true }), lopt("B", "radar", "No protection", "من غير حماية", { warm: false }), lopt("C", "rtg", "Extra RTG for heat", "RTG زيادة للتدفية", { warm: true, rtg: true })] }],
    planner: [
      { k: "orb", t: ok("Which orbit?", "أنهي أوربت؟"), o: [lopt("A", "ice", "Polar orbit · 50 km", "أوربت قطبي · 50 كم", { pole: true, resF: 1, eng: "polar50" }), lopt("B", "ice", "Equator orbit · 50 km", "أوربت خط الاستوا · 50 كم", { pole: false, resF: 1, eng: "eq100" }), lopt("C", "ice", "High polar orbit · 3,000 km", "أوربت قطبي عالي · 3,000 كم", { pole: true, resF: 60, eng: "polar100" })] },
      { k: "rkt", t: ok("Which rocket?", "أنهي صاروخ؟"), o: [lopt("A", "rocket3", "SLS", "SLS", { lift: 27000, cost: 2000, lv: "superheavy" }), lopt("B", "rocket1", "Electron", "Electron", { lift: 25, cost: 10, lv: "small" }), lopt("C", "rocket2", "Falcon 9", "Falcon 9", { lift: 1900, cost: 69, lv: "medium" })] }] },
  compute(p) {
    const g = (r, k) => pickOpt(this, p, r, k) || {};
    const cam = g("science", "cam"), dark = g("science", "dark"), ant = g("comms", "ant"), st = g("comms", "st"), bat = g("engineer", "bat"), heat = g("engineer", "heat"), orb = g("planner", "orb"), rkt = g("planner", "rkt");
    const mass = 1900, res = (cam.res || 0) * (orb.resF || 1);
    const rules = { rocks: !!cam.k && res <= 1, dark: !!dark.laser, pole: !!orb.pole, data: (ant.rate || 0) >= 100, survive: (bat.min || 0) >= 48 && heat.warm !== false && !!heat.k, budget: !!rkt.k && rkt.cost <= 150 };
    const fatal = rkt.k && mass > rkt.lift ? "mass" : heat.k && heat.warm === false ? "cold" : null;
    const sci = (rules.rocks ? 1 : .3) * (dark.laser ? 1 : dark.part || .2) * (orb.pole ? 1 : .1) * (rules.data ? 1 : .05) * ((bat.min || 0) >= 48 ? 1 : .6) * (st.n === 1 ? .5 : 1);
    const waste = [];
    if (bat.min >= 120) waste.push(ok("Battery: the shadow lasts up to 48 minutes, and the 60-minute battery is enough. The 120-minute one is heavy for nothing.", "البطارية: الضل بيقعد لحد 48 دقيقة، وبطارية الـ 60 دقيقة كفاية. بطارية الـ 120 دقيقة تقيلة على الفاضي."));
    if (heat.rtg) waste.push(ok("Heat: a blanket and heaters keep it warm. An extra RTG uses very rare fuel for a job a blanket can do.", "التدفية: البطانية والهيترز كفاية. الـ RTG الزيادة بيصرف وقود نادر جداً في شغلانة البطانية تعملها."));
    if (st.n >= 6) waste.push(ok("Ground stations: three stations already see the Moon all day. Six cost twice as much for the same thing.", "المحطات: 3 محطات بيشوفوا القمر طول اليوم أصلاً. والـ 6 بيكلّفوا الضعف على نفس الحاجة."));
    const issues = [];
    if (fatal === "mass") issues.push({ en: `Mass: the satellite weighs ${nf(mass)} kg. This rocket cannot send it to the Moon.`, ar: `الوزن: القمر وزنه ${nf(mass)} كيلو، والصاروخ ده مش هيقدر يوصّله للقمر.` });
    if (fatal === "cold") issues.push(ok("Cold: with no protection, the electronics freeze in the first shadow.", "البرد: من غير حماية، الإلكترونيات هتتجمد في أول ضل."));
    if (st.n === 1) issues.push(ok("Ground: one station sees the Moon only about half of each day.", "الأرض: محطة واحدة بتشوف القمر حوالي نص اليوم بس."));
    this.rules.forEach(r => { if (!rules[r.k]) issues.push({ en: `Need not met: ${r.en}.`, ar: `طلب متحققش: ${r.ar}.` }); });
    return { mass, res, rules, fatal, sci, issues, waste, efficient: !waste.length, clean: true, cam, dark, ant, st, bat, heat, orb, rkt, ring: null };
  },
  engine(c) { return { orbit: c.orb.eng || "polar50", lv: c.rkt.lv || "medium", lab: { cam: c.cam.lab, inst2: c.dark.lab, ant: c.ant.lab, batMin: c.bat.min, blanket: c.heat.k ? c.heat.warm !== false : undefined, rtg: !!c.heat.rtg, panelW: 1800 } }; },
  fatalMsg: { cold: ok("In the first shadow the temperature dropped far below zero. With no protection, the electronics froze and the satellite went silent.", "في أول ضل الحرارة نزلت تحت الصفر بكتير. ومن غير حماية، الإلكترونيات اتجمدت والقمر سكت.") },
  events: [
    { role: "comms", t: ok("Clouds over the station", "سحاب فوق المحطة"), x: ok("Thick clouds cover your main ground station for two days.", "سحاب تقيل غطّى الجراوند ستيشن الرئيسية يومين."),
      o: [{ t: ok("Wait for clear skies", "استنى لما السما تصفى"), f: c => c.ant.clouds ? { h: 0, sci: -.08, w: ok("Laser light cannot pass through clouds. Two days of maps were lost.", "ضوء الليزر مبيعدّيش من السحاب، فخرايط يومين ضاعت.") } : { h: 0, sci: 0, w: ok("Radio waves pass through clouds. Nothing was lost.", "موجات الراديو بتعدّي من السحاب، فمفيش حاجة ضاعت.") } },
          { t: ok("Switch to another station", "حوّل على محطة تانية"), f: c => c.st.n >= 3 ? { h: 0, sci: 0, w: ok("Another station somewhere else on Earth took over. Nothing was lost.", "محطة تانية في مكان تاني على الأرض استلمت، ومفيش حاجة ضاعت.") } : { h: 0, sci: -.1, w: ok("You have only one station. There was nowhere to switch.", "إنت عندك محطة واحدة بس، فمكانش فيه حاجة تحوّل عليها.") } },
          { t: ok("Store maps in memory", "خزّن الخرايط في الذاكرة"), f: c => ({ h: 0, sci: -.02, w: ok("The memory kept most maps, and sent them later. A few old ones were overwritten.", "الذاكرة حفظت أغلب الخرايط وبعتتها بعدين، وشوية قدام اتمسحوا.") }) }] },
    { role: "engineer", t: ok("Lunar eclipse!", "خسوف القمر!"), x: ok("Earth passes between the Sun and the Moon. The satellite will be in darkness for hours, much longer than a normal shadow.", "الأرض هتعدّي بين الشمس والقمر، والقمر الصناعي هيفضل في الضلمة ساعات، أطول بكتير من الضل العادي."),
      o: [{ t: ok("Turn off the science instruments", "اطفي أجهزة العلوم"), f: c => ({ h: 0, sci: -.01, w: ok("This is exactly what NASA's real Moon orbiter did in the 2014 eclipse. It saved power and survived.", "ده بالظبط اللي القمر الحقيقي بتاع ناسا عمله في خسوف 2014. وفّر كهربا وعدّاها.") }) },
          { t: ok("Keep everything on", "سيب كل حاجة شغالة"), f: c => c.bat.min >= 120 ? { h: -5, sci: 0, w: ok("Your big battery just made it. A little damage from the cold.", "البطارية الكبيرة بتاعتك لحقت على الآخر، وفيه ضرر بسيط من البرد.") } : { h: -30, sci: 0, w: ok("The battery ran out in the dark, and the cold damaged some parts.", "البطارية خلصت في الضلمة، والبرد بوّظ شوية قطع.") } },
          { t: ok("Turn on all heaters", "شغّل كل الهيترز"), f: c => ({ h: -15, sci: 0, w: ok("The heaters drained the battery fast. Some parts got too cold anyway.", "الهيترز سحبوا البطارية بسرعة، وبرضه شوية قطع بردت زيادة.") }) }] }],
  userMsg(R) { const r = R.rules; return r.rocks && r.dark && r.pole ? { en: `The Artemis team got ${R.sciPct}% of the planned maps. They found flat ground with no big rocks near the south pole, and a dark crater nearby to explore for ice.`, ar: `تيم Artemis استلم ${R.sciPct}% من الخرايط المطلوبة. لقوا أرض مستوية مفيهاش صخور كبيرة جنب القطب الجنوبي، وجنبها حفرة ضلمة يدوروا فيها على تلج.` }
    : !r.pole ? ok("The maps never showed the south pole. The landing planners still don't know where it is safe.", "الخرايط عمرها ما وصلت للقطب الجنوبي، ومخططين الهبوط لسه مش عارفين فين المكان الآمن.")
    : !r.rocks ? ok("The maps showed the area, but not rocks two meters wide. A lander could still tip over.", "الخرايط بيّنت المنطقة، بس مش الصخور اللي عرضها 2 متر، فالمركبة لسه ممكن تتقلب.")
    : ok("The maps showed rocks in sunlight, but the dark craters stayed a mystery.", "الخرايط بيّنت الصخور اللي في الشمس، بس الحفر الضلمة فضلت لغز."); },
  real: { name: "LRO (NASA, 2009)", photos: [["KSC-2009-3299", ok("LRO is prepared for launch, 2009", "LRO وهو بيتجهز للإطلاق، 2009")], ["PIA18163", ok("Artist's view of LRO flying over the Moon", "رسمة لـ LRO وهو بيطير فوق القمر")], ["PIA12893", ok("A real LRO photo: a fresh crater with bright boulders", "صورة حقيقية من LRO: حفرة جديدة حواليها صخور")]], picks: ok("Narrow cameras with 0.5 m pixels · LOLA laser altimeter · Ka-band 100 Mbit/s · polar orbit about 50 km", "كاميرات ضيقة ببيكسل نص متر · ليزر ألتيميتر LOLA · Ka-band بـ 100 ميجابت · أوربت قطبي حوالي 50 كم"),
    facts: ok("Your mission is NASA's Lunar Reconnaissance Orbiter. Since 2009 it has mapped the Moon from a polar orbit. Its narrow cameras see half-meter pixels, its LOLA laser measures height in dark craters, and it sends 100 Mbit/s home. Its maps help choose Artemis landing sites. (It launched on an Atlas V rocket.)", "مهمتك هي LRO بتاع ناسا. من 2009 وهو بيعمل خرايط للقمر من أوربت قطبي. كاميراته الضيقة البيكسل بتاعها نص متر، والليزر LOLA بيقيس الارتفاع جوه الحفر الضلمة، وبيبعت 100 ميجابت في الثانية. وخرايطه بتساعد في اختيار أماكن هبوط Artemis. (واتطلق على صاروخ Atlas V.)"),
    links: [["NASA LRO", "https://science.nasa.gov/mission/lro/"], ["NASA Deep Space Network", "https://www.nasa.gov/communicating-with-missions/dsn/"], ["NASA LLCD laser link", "https://www.nasa.gov/directorates/somd/space-communications-navigation-program/lunar-laser-communication-demonstration/"]] }
};

/* ---------- CML 4: Mars Life Hunter (add up kilograms and energy; choices depend on each other) ---------- */
const M_MARS = {
  id: "mars", base: "mars", model: "perseverance", days: 365 * 3, unit: "Wh/day", cruise: true,
  name: ok("Mars Life Hunter", "صياد الحياة على المريخ"),
  user: ok("Scientists around the world asking: was there ever life on Mars?", "العلماء في العالم كله اللي بيسألوا: هل كان فيه حياة على المريخ؟"),
  rules: [{ k: "life", en: "Find signs of ancient life", ar: "يدوّر على علامات حياة قديمة" }, { k: "land", en: "Land safely, then drive", ar: "ينزل بأمان ويقدر يمشي" }, { k: "years", en: "Work for years", ar: "يشتغل سنين" }, { k: "data", en: "Send data home every day", ar: "يبعت الداتا كل يوم" }, { k: "drive", en: "Drive safely despite the delay", ar: "يسوق بأمان رغم التأخير" }, { k: "launch", en: "Launch at the right time", ar: "يتطلق في الوقت الصح" }],
  decisions: {
    science: [
      { k: "site", t: ok("Where do we land?", "هننزل فين؟"), o: [lopt("A", "ice", "Jezero Crater", "Jezero Crater", { water: true, hazard: true, eng: "jezero" }), lopt("B", "radar", "Utopia Planitia", "Utopia Planitia", { water: false, eng: "plain" }), lopt("C", "rocket3", "Olympus Mons", "Olympus Mons", { water: false, thin: true, eng: "plain" })] },
      { k: "tool", t: ok("Which science tool?", "أنهي أداة علمية؟"), o: [lopt("A", "drill", "Drill + sample tubes", "دريل + أنابيب عينات", { mass: 80, wh: 500, life: .6, instr: ["drill"] }), lopt("B", "weather", "Weather station", "محطة طقس", { mass: 5, wh: 50, life: .15, instr: [] }), lopt("C", "leaf", "Rock scanner", "سكانر صخور", { mass: 40, wh: 300, life: 1, scan: true, instr: ["drill"] })] }],
    comms: [
      { k: "path", t: ok("How does data get home?", "الداتا هتوصل الأرض إزاي؟"), o: [lopt("A", "dish2", "Direct to Earth", "على الأرض على طول", { relay: false, direct: true }), lopt("B", "relay", "Through an orbiter", "عن طريق أوربيتر", { relay: true }), lopt("C", "dish3", "Both", "الاتنين", { relay: true, direct: true, mass: 5 })] },
      { k: "drive", t: ok("How do we drive?", "هنسوق إزاي؟"), o: [lopt("A", "radar", "Joystick from Earth", "جويستيك من الأرض", { ok: false, move: true }), lopt("B", "cam3", "Daily plan, rover drives itself", "خطة كل يوم، والروڤر بيسوق لوحده", { ok: true, move: true }), lopt("C", "ice", "Don't drive", "منسوقش خالص", { ok: false, move: false })] }],
    engineer: [
      { k: "power", t: ok("Which power?", "أنهي باور؟"), o: [lopt("A", "panel2", "Solar panels", "سولار بانلز", { mass: 70, make: 2000, solar: true }), lopt("B", "rtg", "RTG", "RTG", { mass: 45, make: 2700, rtg: true }), lopt("C", "panel3", "Both", "الاتنين", { mass: 115, make: 4700, solar: true, rtg: true })] },
      { k: "heat", t: ok("How do we stay warm?", "هنفضل دافيين إزاي؟"), o: [lopt("A", "rtg", "RTG heat pipes", "مواسير حرارة الـ RTG", { mass: 10, wh: 0, pipes: true }), lopt("B", "panel1", "Electric heaters", "هيترز كهربا", { mass: 15, wh: 1000 }), lopt("C", "radar", "Nothing", "ولا حاجة", { mass: 0, wh: 0, none: true })] }],
    planner: [
      { k: "land", t: ok("How do we land?", "هننزل إزاي؟"), o: [lopt("A", "relay", "Airbags", "إيرباجز", { max: 180, drive: true }), lopt("B", "rocket2", "Sky crane", "سكاي كرين", { max: 1000, drive: true }), lopt("C", "rocket1", "Legs and rockets", "رجول وصواريخ", { max: 1000, drive: false })] },
      { k: "danger", t: ok("How do we avoid danger?", "هنتفادى الخطر إزاي؟"), o: [lopt("A", "cam3", "Smart camera steers", "كاميرا ذكية بتوجّه", { trn: true, mass: 10 }), lopt("B", "radar", "No steering", "من غير توجيه", { trn: false })] },
      { k: "launch", t: ok("When do we launch?", "هنطلق إمتى؟"), o: [lopt("A", "rocket1", "Right now, any day", "دلوقتي، أي يوم", { win: false }), lopt("B", "rocket2", "In the next launch window", "في اللانش ويندو الجاية", { win: true }), lopt("C", "rocket3", "When Mars is farthest", "لما المريخ يبقى أبعد حاجة", { win: false })] }] },
  compute(p) {
    const g = (r, k) => pickOpt(this, p, r, k) || {};
    const site = g("science", "site"), tool = g("science", "tool"), path = g("comms", "path"), drv = g("comms", "drive"), pow = g("engineer", "power"), heat = g("engineer", "heat"), land = g("planner", "land"), dang = g("planner", "danger"), launch = g("planner", "launch");
    const mass = 800 + (tool.mass || 0) + (path.mass || 0) + (pow.mass || 0) + (heat.mass || 0) + (dang.mass || 0);
    const need = 1200 + (drv.move === false ? 0 : 600) + (tool.wh || 0) + (heat.wh || 0), supply = pow.make || 0;
    const cold = heat.k && (heat.none || (heat.pipes && !pow.rtg));
    const fatal = launch.k && !launch.win ? "window" : site.thin ? "air" : land.k && mass > land.max ? "land" : site.hazard && dang.k && !dang.trn ? "rocks" : cold ? "cold" : null;
    const energyOK = !!pow.k && need <= supply;
    const rules = { life: !!site.water && !!tool.scan, land: !!land.k && !!land.drive && !["air", "land", "rocks"].includes(fatal), years: !!pow.rtg && energyOK && !cold && !!heat.k, data: !!path.relay, drive: !!drv.ok, launch: !!launch.win };
    const sci = (site.water ? 1 : .3) * (tool.life || .1) * (path.relay ? 1 : .35) * (drv.ok ? 1 : drv.move ? .7 : .4) * (land.drive === false ? .4 : 1) * (energyOK ? 1 : .6);
    const waste = [];
    if (pow.rtg && pow.solar && need <= 2700) waste.push({ en: `Power: the RTG alone makes 2,700 Wh a day and you use ${nf(need)}. The solar panels add 70 kg for nothing.`, ar: `الباور: الـ RTG لوحده بيطلّع 2,700 وات-ساعة في اليوم، وإنت بتستخدم ${nf(need)}. فالسولار بانلز بيزوّدوا 70 كيلو على الفاضي.` });
    if (pow.rtg && heat.k && !heat.pipes && !heat.none) waste.push(ok("Heat: your RTG already makes free heat. Electric heaters burn 1,000 Wh every day.", "التدفية: الـ RTG بتاعك بيطلّع حرارة ببلاش أصلاً، والهيترز الكهربا بتحرق 1,000 وات-ساعة كل يوم."));
    const issues = [];
    if (fatal === "window") issues.push(ok("Launch: Earth and Mars are not lined up. The rocket cannot carry enough fuel to get there.", "الإطلاق: الأرض والمريخ مش في الوضع الصح، والصاروخ مش هيقدر يشيل وقود كفاية علشان يوصل."));
    if (fatal === "air") issues.push(ok("Landing: the air on top of Olympus Mons is too thin for the parachute.", "الهبوط: الهوا فوق Olympus Mons خفيف أوي على البراشوت."));
    if (fatal === "land") issues.push({ en: `Landing: the rover weighs ${nf(mass)} kg. Airbags only worked for about 180 kg.`, ar: `الهبوط: الروڤر وزنه ${nf(mass)} كيلو، والإيرباجز اشتغلت مع حوالي 180 كيلو بس.` });
    if (fatal === "rocks") issues.push(ok("Landing: this site has rocks and cliffs, and nothing steers the rover away from them.", "الهبوط: المكان ده فيه صخور وجروف، ومفيش حاجة بتبعّد الروڤر عنهم."));
    if (fatal === "cold") issues.push(ok(heat.none ? "Heat: with no heating, the electronics freeze on the first night." : "Heat: RTG heat pipes need an RTG. Without one, they carry no heat.", heat.none ? "التدفية: من غير تدفية، الإلكترونيات هتتجمد أول ليلة." : "التدفية: مواسير الحرارة محتاجة RTG، ومن غيره مش هتنقل أي حرارة."));
    if (pow.k && !energyOK) issues.push({ en: `Energy: the rover uses ${nf(need)} Wh a day, but makes only ${nf(supply)}.`, ar: `الطاقة: الروڤر بيستخدم ${nf(need)} وات-ساعة في اليوم، وبيطلّع ${nf(supply)} بس.` });
    if (pow.k && !pow.rtg) issues.push(ok("Power: solar panels make almost nothing in a dust storm.", "الباور: السولار بانلز تقريباً مبتطلّعش حاجة في العاصفة الترابية."));
    this.rules.forEach(r => { if (!rules[r.k]) issues.push({ en: `Not met: ${r.en}.`, ar: `شرط متحققش: ${r.ar}.` }); });
    return { mass, need, supply, rules, fatal, sci, issues, waste, efficient: !waste.length, clean: true, site, tool, path, drv, pow, heat, land, dang, launch, ring: null };
  },
  engine(c) { return { orbit: c.site.eng || "jezero", lv: "medium", power: c.pow.k ? (c.pow.rtg && c.pow.solar ? "both" : c.pow.rtg ? "rtg1" : "solar") : "none", panel: 4, instr: c.tool.instr || [], antenna: "medium", lab: { rover: true } }; },
  fatalAt: { window: "cruise", air: "landing", land: "landing", rocks: "landing", cold: "landing" },
  fatalMsg: {
    window: ok("Earth and Mars were not lined up. Halfway there, the fuel ran out, and the spacecraft drifted past Mars forever.", "الأرض والمريخ مكانوش في الوضع الصح. وفي نص الطريق الوقود خلص، والمركبة عدّت جنب المريخ وتاهت للأبد."),
    air: ok("On top of Olympus Mons the air is so thin that the parachute barely opened. The rover hit the ground too fast.", "فوق Olympus Mons الهوا خفيف أوي، فالبراشوت بالعافية فتح، والروڤر خبط في الأرض بسرعة كبيرة."),
    land: ok("The airbags burst under the heavy rover. Airbags only worked for rovers of about 180 kg.", "الإيرباجز فرقعت تحت الروڤر التقيل. الإيرباجز اشتغلت بس مع روڤرز وزنها حوالي 180 كيلو."),
    rocks: ok("With no steering, the rover came down on a field of boulders near a cliff, and tipped over.", "من غير توجيه، الروڤر نزل على حتة مليانة صخور جنب جرف، واتقلب."),
    cold: ok("The first Martian night dropped below minus 80 degrees. The electronics froze, and the rover never woke up.", "أول ليلة على المريخ الحرارة نزلت تحت سالب 80. الإلكترونيات اتجمدت، والروڤر مصحيش تاني.") },
  orbitLine: ok("We are on the way to Mars! Seven months to go.", "إحنا في الطريق للمريخ! فاضل سبع شهور."),
  events: [
    { role: "engineer", t: ok("Planet-wide dust storm!", "عاصفة ترابية على الكوكب كله!"), x: ok("A dust storm covers the whole planet. The sky stays dark for weeks.", "عاصفة ترابية غطّت الكوكب كله، والسما هتفضل ضلمة أسابيع."),
      o: [{ t: ok("Sleep and wait", "نام واستنى"), f: c => c.pow.rtg ? { h: 0, sci: -.02, w: ok("Your RTG did not need the Sun. You slept anyway, and lost a few days.", "الـ RTG بتاعك مكانش محتاج شمس، بس إنت نمت برضه وخسرت كام يوم.") } : { h: -25, sci: -.1, w: ok("The panels made almost nothing. The rover barely survived the cold. A real solar rover was lost in a storm like this in 2018.", "البانلز تقريباً مطلّعتش حاجة، والروڤر بالعافية عدّى البرد. وروڤر حقيقي شغال بالطاقة الشمسية ضاع في عاصفة زي دي سنة 2018.") } },
          { t: ok("Keep working", "كمّل شغل"), f: c => c.pow.rtg ? { h: 0, sci: 0, w: ok("The RTG kept everything running. The storm did not stop you.", "الـ RTG شغّل كل حاجة، والعاصفة موقفتكش.") } : { h: -60, sci: -.1, w: ok("The battery went empty in the dark. The cold damaged many parts.", "البطارية فضيت في الضلمة، والبرد بوّظ قطع كتير.") } },
          { t: ok("Study the storm with cameras", "ادرس العاصفة بالكاميرات"), f: c => c.pow.rtg ? { h: 0, sci: .04, w: ok("Great science! You measured how a Martian dust storm grows.", "علم جامد! إنت قست العاصفة الترابية على المريخ بتكبر إزاي.") } : { h: -40, sci: 0, w: ok("The cameras drained the battery. The rover got badly cold.", "الكاميرات سحبت البطارية، والروڤر برد جامد.") } }] },
    { role: "comms", t: ok("Stuck in sand!", "غرزان في الرملة!"), x: ok("The wheels are stuck in soft sand. Each message takes 15 minutes to arrive.", "العجل غرزان في رملة طرية، وكل رسالة بتاخد 15 دقيقة علشان توصل."),
      o: [{ t: ok("Spin the wheels hard by joystick", "لف العجل جامد بالجويستيك"), f: c => ({ h: -20, sci: -.05, w: ok("By the time each command arrived, the wheels had dug deeper. One wheel was damaged.", "لحد ما كل أمر يوصل، كان العجل غرز أكتر، وعجلة باظت.") }) },
          { t: ok("Test on a twin rover on Earth, then send a careful plan", "جرّب على روڤر توأم على الأرض، وبعدين ابعت خطة بالراحة"), f: c => ({ h: 0, sci: -.01, w: ok("NASA really does this: engineers rebuild the trap on Earth, test, then send the plan. The rover rolled free.", "ناسا بتعمل كده فعلاً: المهندسين بيعملوا نفس الحتة على الأرض، ويجرّبوا، وبعدين يبعتوا الخطة. والروڤر طلع.") }) },
          { t: ok("Give up and leave this area", "سيب المنطقة دي وامشي"), f: c => ({ h: -5, sci: -.1, w: ok("You backed out slowly, but lost the rocks you came for.", "رجعت لورا بالراحة، بس خسرت الصخور اللي إنت جاي علشانها.") }) }] }],
  userMsg(R) { const r = R.rules; return r.life ? { en: `Scientists received ${R.sciPct}% of the planned data. Your rock scanner found the kind of chemicals that ancient life can leave behind, in an old lake bed. The question is still open, but now we know where to look.`, ar: `العلماء استلموا ${R.sciPct}% من الداتا المطلوبة. السكانر بتاعك لقى نوع الكيماويات اللي الحياة القديمة ممكن تسيبها، في قاع بحيرة قديمة. السؤال لسه مفتوح، بس دلوقتي عرفنا ندوّر فين.` }
    : ok("The rover worked, but it could not look for signs of life where water once was. The big question is still unanswered.", "الروڤر اشتغل، بس مقدرش يدوّر على علامات حياة في مكان كان فيه مية. والسؤال الكبير لسه ملوش إجابة."); },
  real: { name: "Perseverance (NASA, 2021)", photos: [["NHQ202007300018", ok("Perseverance launches on an Atlas V, 30 July 2020", "Perseverance بيتطلق على Atlas V، يوم 30 يوليو 2020")], ["PIA23386", ok("Jezero Crater's ancient river delta, seen from orbit", "دلتا النهر القديم في Jezero Crater من الأوربت")], ["PIA24542", ok("Perseverance's selfie on Mars, with the Ingenuity helicopter", "سيلفي Perseverance على المريخ، ومعاه الهليكوبتر Ingenuity")]], picks: ok("Jezero Crater · rock scanners and a sample drill · orbiter relay + direct link · daily plans with self-driving · RTG with its heat piped around · sky crane · smart-camera landing · 2020 launch window", "Jezero Crater · سكانرز صخور ودريل عينات · أوربيتر + لينك مباشر · خطة كل يوم وسواقة ذاتية · RTG وحرارته متوزعة · سكاي كرين · هبوط بكاميرا ذكية · لانش ويندو 2020"),
    facts: ok("Your mission is NASA's Perseverance rover. It launched in the July 2020 window and landed in Jezero Crater in February 2021 with a sky crane, steering away from danger with Terrain Relative Navigation. An RTG powers and warms it. It scans rocks for signs of ancient life and stores samples for a future return to Earth.", "مهمتك هي الروڤر Perseverance بتاع ناسا. اتطلق في لانش ويندو يوليو 2020، ونزل في Jezero Crater في فبراير 2021 بالسكاي كرين، وكان بيبعد عن الخطر بنظام Terrain Relative Navigation. والـ RTG بيشغّله ويدفّيه. وهو بيعمل سكان للصخور يدوّر على علامات حياة قديمة، وبيخزّن عينات علشان ترجع الأرض في مهمة جاية."),
    links: [["NASA Perseverance", "https://science.nasa.gov/mission/mars-2020-perseverance/"], ["NASA: Mars dust storms", "https://science.nasa.gov/mars/"], ["NASA RTG", "https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/"]] }
};
const LAB_M = { storm: M_STORM, moon: M_MOON, delta: M_DELTA, mars: M_MARS };
/* ===== Points lost for each decision (every wrong choice costs points; stars come only from points) ===== */
const W = (p, en, ar) => [p, en, ar];
M_STORM.lose = {
  "science.cam": { A: W(250, "A color camera sees almost nothing at night, and many storms start at night.", "كاميرا الألوان تقريباً مش بتشوف حاجة بالليل، وعواصف كتير بتبدأ بالليل.") },
  "comms.ant": { A: W(250, "The slow antenna cannot send a new picture every 15 minutes.", "الأنتينا البطيئة مش هتقدر تبعت صورة جديدة كل ربع ساعة.") },
  "engineer.pow": { B: W(100, "An RTG works, but it uses very rare fuel where sunlight is strong.", "الـ RTG شغالة، بس بتصرف وقود نادر جداً في مكان الشمس فيه قوية.") },
  "planner.orb": { A: W(250, "A low orbit sees Egypt only a few minutes at a time.", "الأوربت الواطي بيشوف مصر كام دقيقة بس كل مرة.") } };
M_MOON.lose = {
  "science.cam": { A: W(150, "100 m pixels cannot show rocks 2 m wide.", "بيكسل 100 متر مش هيبيّن صخور عرضها 2 متر."), C: W(120, "10 m pixels are still too big for rocks 2 m wide.", "بيكسل 10 متر لسه أكبر من صخور عرضها 2 متر.") },
  "science.dark": { A: W(80, "An infrared camera finds cold places, but not the shape of the ground.", "كاميرا الإنفرا ريد بتلاقي الأماكن الباردة، بس مش بتقيس شكل الأرض."), B: W(150, "A normal camera needs light, and the dark craters have none.", "الكاميرا العادية محتاجة نور، والحفر الضلمة مفيهاش.") },
  "comms.ant": { A: W(40, "The laser link is fast, but clouds over the station can block it.", "لينك الليزر سريع، بس السحاب فوق المحطة ممكن يوقفه."), C: W(150, "A few Mbit/s is much less than the 100 Mbit/s we need.", "كام ميجابت أقل بكتير من الـ 100 ميجابت اللي محتاجينها.") },
  "comms.st": { B: W(100, "One station sees the Moon only about half of each day.", "محطة واحدة بتشوف القمر حوالي نص اليوم بس."), C: W(50, "Six stations cost twice as much as three, for the same coverage.", "6 محطات بيكلّفوا ضعف التلاتة، على نفس التغطية.") },
  "engineer.bat": { A: W(150, "30 minutes is shorter than the 48-minute shadow.", "30 دقيقة أقل من ضل الـ 48 دقيقة."), C: W(50, "60 minutes was enough; 120 minutes is heavy for nothing.", "60 دقيقة كانت كفاية، والـ 120 تقيلة على الفاضي.") },
  "engineer.heat": { B: W(300, "With no protection, the electronics freeze.", "من غير حماية، الإلكترونيات بتتجمد."), C: W(60, "An extra RTG uses rare fuel for a job a blanket can do.", "الـ RTG الزيادة بيصرف وقود نادر في شغلانة البطانية تعملها.") },
  "planner.orb": { B: W(200, "An equator orbit never flies over the south pole.", "أوربت خط الاستوا عمره ما بيعدّي فوق القطب الجنوبي."), C: W(150, "At 3,000 km every pixel is 60 times bigger.", "على 3,000 كم كل بيكسل بيبقى أكبر 60 مرة.") },
  "planner.rkt": { A: W(150, "SLS costs more than 2 billion dollars, far over our $150 million.", "SLS بيكلّف أكتر من 2 مليار دولار، أكتر بكتير من الـ 150 مليون بتوعنا."), B: W(300, "Electron can carry only about 25 kg to the Moon.", "Electron بيشيل حوالي 25 كيلو بس للقمر.") } };
M_DELTA.lose = {
  "science.cam": { A: W(150, "MODIS pixels are 250 m, too big for small fields.", "بيكسل MODIS 250 متر، أكبر من الأراضي الصغيرة."), B: W(150, "TIRS cannot see near-infrared, and its pixels are 100 m.", "TIRS مش بتشوف النير إنفرا ريد، والبيكسل بتاعها 100 متر.") },
  "science.time": { A: W(150, "At night there is no sunlight, so no plant health.", "بالليل مفيش شمس، فمش هنشوف صحة الزرع."), C: W(80, "At any time of day the light changes, so the pictures can't be compared.", "في أي وقت الإضاءة بتتغير، فالصور مش هتتقارن ببعض.") },
  "comms.ant": { A: W(50, "Ka-band is much faster than the camera needs, and uses 200 W more.", "Ka-band أسرع بكتير من اللي الكاميرا محتاجاه، وبياكل 200 وات زيادة."), B: W(150, "S-band is far too slow for the camera's data.", "S-band بطيء جداً على داتا الكاميرا.") },
  "comms.st": { A: W(60, "With one station, pictures must wait when it stops.", "بمحطة واحدة، الصور بتستنى لما تقف."), C: W(20, "Three stations cost more every year; two were enough.", "3 محطات بيكلّفوا أكتر كل سنة، واتنين كانوا كفاية.") },
  "engineer.pan": c => { if (!c.pan.k) return 0; if (c.need > c.supply) return W(300, `The panel makes ${nf(c.supply)} W, less than the ${nf(c.need)} W the satellite uses.`, `البانل بيطلّع ${nf(c.supply)} وات، أقل من الـ ${nf(c.need)} اللي القمر بياكلهم.`);
    if (c.supply / c.need > 1.3) return W(70, `${nf(c.supply)} W is much more than the ${nf(c.need)} W you need.`, `${nf(c.supply)} وات أكتر بكتير من الـ ${nf(c.need)} اللي محتاجهم.`);
    const smaller = M_DELTA.decisions.engineer[0].o.some(o => o.supply < c.supply && o.supply >= c.need); return smaller ? W(30, "A smaller panel would have been enough.", "بانل أصغر كان هيكفي.") : 0; },
  "engineer.bat": { A: W(40, "40 minutes was enough; 60 minutes adds 80 kg.", "40 دقيقة كانت كفاية، والـ 60 بتزوّد 80 كيلو."), C: W(150, "25 minutes is shorter than the 35-minute shadow.", "25 دقيقة أقل من ضل الـ 35 دقيقة.") },
  "planner.orb": { A: W(150, "At 400 km the satellite falls in a few years, and the time changes every day.", "على 400 كم القمر بيقع في كام سنة، والساعة بتتغير كل يوم."), C: W(120, "At 1,500 km the pixels are twice as big, and the time changes every day.", "على 1,500 كم البيكسل بيبقى الضعف، والساعة بتتغير كل يوم.") },
  "planner.rkt": c => { if (!c.rkt.k) return 0; if (c.mass > c.rkt.lift) return W(300, `This rocket cannot lift your ${nf(Math.round(c.mass))} kg satellite.`, `الصاروخ ده مش هيقدر يشيل القمر بتاعك اللي وزنه ${nf(Math.round(c.mass))} كيلو.`);
    const ok2 = M_DELTA.decisions.planner[1].o.filter(o => o.lift >= c.mass); const cheap = Math.min(...ok2.map(o => o.cost)); return c.rkt.cost > cheap ? W(40, `A cheaper rocket could lift ${nf(Math.round(c.mass))} kg.`, `كان فيه صاروخ أرخص يقدر يشيل ${nf(Math.round(c.mass))} كيلو.`) : 0; },
  "planner.eom": { A: W(100, "It stays up as space junk.", "هيفضل فوق زبالة فضائية."), B: W(100, "Using all the fuel leaves it up there as space junk.", "لما تصرف الوقود كله، بيفضل فوق زبالة فضائية.") } };
M_MARS.lose = {
  "science.site": { B: W(150, "Utopia Planitia has few clues of old water.", "Utopia Planitia فيها علامات قليلة لمية قديمة."), C: W(300, "On Olympus Mons the air is too thin to land, and there was no lake.", "فوق Olympus Mons الهوا خفيف أوي على الهبوط، ومكانش فيه بحيرة.") },
  "science.tool": { A: W(120, "The drill saves samples, but does not look for life's chemicals.", "الدريل بيحفظ عينات، بس مش بيدوّر على كيماويات الحياة."), B: W(150, "A weather station does not study rocks.", "محطة الطقس مش بتدرس الصخور.") },
  "comms.path": { A: W(120, "Direct to Earth is too slow for many big pictures.", "على الأرض على طول بطيء على صور كبيرة كتير.") },
  "comms.drive": { A: W(120, "Messages take 4 to 24 minutes, so live driving is dangerous.", "الرسالة بتاخد من 4 لـ 24 دقيقة، فالسواقة المباشرة خطر."), C: W(150, "Staying in one spot means seeing only one place.", "لو فضلت مكانك هتشوف مكان واحد بس.") },
  "engineer.power": { A: W(200, "Solar panels make almost nothing in dust storms.", "السولار بانلز تقريباً مبتطلّعش حاجة في العواصف الترابية."), C: W(70, "The RTG alone was enough; the solar panels add 70 kg.", "الـ RTG لوحده كان كفاية، والسولار بانلز بيزوّدوا 70 كيلو.") },
  "engineer.heat": c => { if (!c.heat.k) return 0; if (c.heat.none) return W(300, "With no heating, the electronics freeze on the first night.", "من غير تدفية، الإلكترونيات بتتجمد أول ليلة.");
    if (c.heat.pipes && !c.pow.rtg) return W(300, "Heat pipes need an RTG. Without one, they carry no heat.", "مواسير الحرارة محتاجة RTG، ومن غيره مش هتنقل حرارة.");
    if (!c.heat.pipes && c.pow.rtg) return W(70, "The RTG's heat was free; electric heaters burn 1,000 Wh a day.", "حرارة الـ RTG كانت ببلاش، والهيترز الكهربا بتحرق 1,000 وات-ساعة في اليوم."); return 0; },
  "planner.land": c => { if (!c.land.k) return 0; if (!c.land.drive) return W(200, "A lander with legs cannot drive off.", "اللاندر اللي برجول مبيقدرش يمشي.");
    if (c.mass > c.land.max) return W(300, `Airbags only worked for rovers of about 180 kg; yours weighs ${nf(Math.round(c.mass))} kg.`, `الإيرباجز اشتغلت بس مع روڤرز وزنها حوالي 180 كيلو، وبتاعك ${nf(Math.round(c.mass))} كيلو.`); return 0; },
  "planner.danger": c => c.dang.k && !c.dang.trn && c.site.hazard ? W(300, "Jezero has rocks and cliffs; with no steering the rover tipped over.", "Jezero فيها صخور وجروف، ومن غير توجيه الروڤر اتقلب.") : 0,
  "planner.launch": { A: W(300, "Outside the launch window there is not enough fuel to reach Mars.", "برّه اللانش ويندو مفيش وقود كفاية يوصّلنا المريخ."), C: W(300, "Outside the launch window there is not enough fuel to reach Mars.", "برّه اللانش ويندو مفيش وقود كفاية يوصّلنا المريخ.") } };
function lDecisionRows(m, c, picks) {
  return TEAM_ROLES.flatMap(r => m.decisions[r].map(d => { const o = pickOpt(m, picks, r, d.k); const T = (m.lose || {})[r + "." + d.k];
    const v = !o ? W(0, "", "") : typeof T === "function" ? T(c, o) : (T && T[o.k]) || 0; const w = v || [0, "", ""];
    return { role: r, q: d.t, pick: o ? o.n : ok("—", "—"), pts: w[0], why: ok(w[1], w[2]) }; }));
}
function lStarsFor(total) { return total >= 900 ? 3 : total >= 700 ? 2 : total >= 400 ? 1 : 0; }

const CML = [
  { n: 1, m: "storm", t: ok("CML 1 · The idea", "CML 1 · الفكرة"), d: ok("Khamsin Storm Watch. One choice each, two options. Just words, no numbers.", "رادار الخماسين. كل واحد اختيار واحد من اتنين. كلام بس، مفيش أرقام.") },
  { n: 2, m: "moon", t: ok("CML 2 · Can it work?", "CML 2 · هل تنفع؟"), d: ok("Moon Landing Map. Two choices each. Compare each number with what is needed, no adding.", "خريطة الهبوط على القمر. كل واحد اختيارين. قارن كل رقم باللي مطلوب، من غير جمع.") },
  { n: 3, m: "delta", t: ok("CML 3 · Add it up", "CML 3 · اجمع"), d: ok("Nile Delta Crop Watch. Add up watts and kilograms. Many designs work; the smartest wastes nothing.", "مراقب محاصيل الدلتا. اجمع الوات والكيلوهات. تصميمات كتير بتنجح، والأذكى اللي مبيضيّعش حاجة.") },
  { n: 4, m: "mars", t: ok("CML 4 · Everything connects", "CML 4 · كل حاجة مربوطة ببعض"), d: ok("Mars Life Hunter. Add up kilograms and energy, and every choice depends on another role.", "صياد الحياة على المريخ. اجمع الكيلوهات والطاقة، وكل اختيار مربوط بدور تاني.") }];

/* ---- lab state ---- */
const LB = { mode: "solo", level: 1, room: null, me: null, myRole: null, picks: {}, reviews: 0, rewatch: 0, watched: {}, players: [], chat: [], online: false, sb: null, chan: null, flight: null, revealed: null, notes: "" };
const myId = (() => { try { let v = sessionStorage.getItem("ma.cid"); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("ma.cid", v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const lvl = () => CML[LB.level - 1];
const LM = () => LAB_M[lvl().m] || M_STORM;
const rolesInPlay = () => TEAM_ROLES;
const isHost = () => LB.mode === "online" && LB.room && LB.room.state.host === myId;
/* who owns each role: its player; else the player it was shared to; else nobody (the team votes) */
function lPlanExtra() { const ps = LB.players.slice().sort((a, b) => a.id - b.id), ex = {}; if (!ps.length) return ex; let i = 0; TEAM_ROLES.forEach(r => { if (!ps.some(p => p.role === r)) { ex[r] = ps[i % ps.length].id; i++; } }); return ex; }
function lOwner(r) { const p = LB.players.find(x => x.role === r); if (p) return p; const ex = (LB.room && LB.room.state.phase !== "lobby" && LB.room.state.extra) || lPlanExtra(); const id = ex[r]; return LB.players.find(x => x.id === id) || null; }
const lOrphan = r => LB.mode === "online" && !lOwner(r);
const myRoles = () => LB.mode !== "online" ? TEAM_ROLES : TEAM_ROLES.filter(r => { const o = lOwner(r); return !o || (LB.me && o.id === LB.me.id); });
function allPicks() {
  if (LB.mode !== "online") return LB.picks; const p = {};
  TEAM_ROLES.forEach(r => { const o = lOwner(r); (LM().decisions[r] || []).forEach(d => { const key = r + "." + d.k;
    if (o) { const v = o.data && o.data.picks && o.data.picks[key]; if (v) p[key] = v; }
    else { const cnt = {}; LB.players.forEach(pl => { const v = pl.data && pl.data.rv && pl.data.rv[key]; if (v) cnt[v] = (cnt[v] || 0) + 1; }); const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b))[0]; if (best) p[key] = best; } }); });
  return p;
}
function lVotesFor(key, o) { return LB.players.filter(pl => pl.data && pl.data.rv && pl.data.rv[key] === o).length; }
/* one-computer team: players take turns, roles shared out in order */
function lLocalOwner(r) { const ps = LB.localPlayers || []; return ps.length > 1 ? ps[TEAM_ROLES.indexOf(r) % ps.length] : null; }
function pickOpt(m, picks, role, k) { const d = (m.decisions[role] || []).find(x => x.k === k); const v = picks[role + "." + k]; return d && v ? d.o.find(o => o.k === v) : null; }
const lCompute = picks => LM().compute(picks);
const decisionsFor = roles => roles.flatMap(r => (LM().decisions[r] || []).map(d => ({ role: r, d })));
const allChosen = (picks, roles) => decisionsFor(roles).every(({ role, d }) => picks[role + "." + d.k]);
/* ---- Supabase (online rooms) ---- */
function sbClient() { if (LB.sb) return LB.sb; if (!window.supabase || !window.supabase.createClient) return null; LB.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); return LB.sb; }
/* ---- accounts: sign in with Google so your levels follow you to any device ---- */
async function lAuthInit() {
  const sb = sbClient(); if (!sb || LB.authInit) return; LB.authInit = true;
  const apply = async session => {
    A.user = session && session.user ? { id: session.user.id, name: (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || session.user.email || "Player", email: session.user.email } : null;
    if (A.user) { if (!A.lastName) A.lastName = A.user.name.split(" ")[0];
      const { data } = await sb.from("profiles").select("progress").eq("user_id", A.user.id).maybeSingle();
      const pr = (data && data.progress) || {}; CML.forEach(c => { const k = "cml" + c.n; A.progress.stars[k] = Math.max(A.progress.stars[k] || 0, pr[k] || 0); }); store.set("ma.progress3", A.progress); lSaveProgress(); }
    if (["lhome", "llevel", "lonline"].includes(A.screen)) render();
  };
  try { const { data } = await sb.auth.getSession(); await apply(data.session); } catch (e) { }
  sb.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") apply(session); });
}
async function lSaveProgress() { const sb = sbClient(); if (!sb || !A.user) return; const pr = {}; CML.forEach(c => { pr["cml" + c.n] = A.progress.stars["cml" + c.n] || 0; });
  try { await sb.from("profiles").upsert({ user_id: A.user.id, name: A.user.name, progress: pr, updated_at: new Date().toISOString() }); } catch (e) { } }
function lAuthBox() {
  if (!window.supabase) return "";
  return A.user ? `<div class="authbox">👤 <b>${esc(A.user.name)}</b> · ${L(ok("your levels are saved to your account", "المستويات بتاعتك محفوظة على حسابك"))} <button class="linkbtn" type="button" data-act="signout">${L(ok("Sign out", "اخرج"))}</button></div>`
    : `<div class="authbox"><button class="hbtn ghost" type="button" data-act="signin">🔐 ${L(ok("Sign in with Google", "سجّل دخول بجوجل"))}</button> <span class="psub">${L(ok("so your finished levels follow you to any device (optional)", "علشان المستويات اللي خلّصتها تفضل معاك على أي جهاز (اختياري)"))}</span></div>`;
}
async function onlineAvailable() { const sb = sbClient(); if (!sb) return false; try { const { error } = await sb.from("rooms").select("code").limit(1); return !error; } catch (e) { return false; } }
const newCode = () => "SO-" + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
async function roomCreate(name, roleMode) {
  const sb = sbClient(); const code = newCode();
  const { error } = await sb.from("rooms").insert({ code, mission: LM().id, level: LB.level, state: { phase: "lobby", host: myId, reviews: 0, roleMode: roleMode || "random" } }); if (error) throw error;
  return roomJoin(code, name);
}
async function roomJoin(code, name) {
  const sb = sbClient(); code = code.trim().toUpperCase();
  const { data: room, error: e1 } = await sb.from("rooms").select("*").eq("code", code).maybeSingle(); if (e1 || !room) throw new Error(L({ en: "No room with that code.", ar: "مفيش غرفة بالكود ده." }));
  const { data: seats } = await sb.from("players").select("*").eq("room", code);
  const all = seats || [];
  let me = null, mine = all.find(x => x.data && x.data.cid === myId);
  if (mine && mine.data && mine.data.kicked) throw new Error(L({ en: "The room creator removed you from this room.", ar: "اللي عامل الغرفة طلّعك منها." }));
  if (mine) { const { data: up } = await sb.from("players").update({ name, data: Object.assign({}, mine.data, { left: false }), last_seen: new Date().toISOString() }).eq("id", mine.id).select().single(); me = up; }
  // draw a role by luck: a free role, or a seat someone left
  const free = TEAM_ROLES.filter(r => { const x = all.find(y => y.role === r); return !x || (x.data && x.data.left); }).sort(() => Math.random() - .5);
  for (const role of mine ? [] : free) {
    const old = all.find(y => y.role === role);
    const res = old ? await sb.from("players").update({ name, data: { cid: myId, picks: {} }, last_seen: new Date().toISOString() }).eq("id", old.id).select().single()
                    : await sb.from("players").insert({ room: code, name, role, data: { cid: myId, picks: {} } }).select().single();
    if (!res.error && res.data) { me = res.data; break; }
  }
  if (!me) throw new Error(L({ en: "This room is full: all 4 roles are taken.", ar: "الغرفة دي اتملت: الأربع أدوار اتاخدوا." }));
  LB.room = room; LB.me = me; LB.myRole = me.role; LB.level = room.level; LB.mode = "online"; LB.online = true; LB.drawn = Date.now(); lSave(); myData({ done: myDone() });
  await roomRefresh(); roomSubscribe(); return code;
}
async function roomRefresh() {
  const sb = sbClient(); if (!sb || !LB.room) return;
  const [r, p, m] = await Promise.all([sb.from("rooms").select("*").eq("code", LB.room.code).single(), sb.from("players").select("*").eq("room", LB.room.code), sb.from("messages").select("*").eq("room", LB.room.code).order("id").limit(200)]);
  if (!LB.room) return; if (p.data && LB.me) { const meRow = p.data.find(x => x.id === LB.me.id); if (meRow && meRow.data && meRow.data.kicked) { lLeave(); A.kickedMsg = true; go("lonline"); return; } } if (r.data) { LB.room = r.data; if (r.data.level && r.data.level !== LB.level) { LB.level = r.data.level; LB.picks = {}; } } if (p.data) { LB.players = p.data.filter(x => !(x.data && x.data.left)); const mr = LB.me && p.data.find(x => x.id === LB.me.id); if (mr) { LB.me = mr; LB.myRole = mr.role; } } if (m.data) LB.chat = m.data; onRoomChange(); lRoomBarPaint();
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
async function myData(patch) { const sb = sbClient(); if (!sb || !LB.me) return; const d = Object.assign({}, LB.me.data, patch, { done: myDone() }); LB.me.data = d; await sb.from("players").update({ data: d, last_seen: new Date().toISOString() }).eq("id", LB.me.id); }
async function sendChat(body) { const sb = sbClient(); body = body.trim().slice(0, 300); if (!body) return; await sb.from("messages").insert({ room: LB.room.code, name: LB.me.name, role: LB.myRole, body }); }
function onRoomChange() {
  if (!LB.room) return; const ph = LB.room.state.phase;
  if (ph === "video" && LB.room.state.videoAt && LB.gameAt && LB.room.state.videoAt !== LB.gameAt && A.screen !== "lvideo") { LB.gameAt = LB.room.state.videoAt; lResetGame(); LB.backInRoom = false; go("lvideo"); return; }
  if (ph === "video" && LB.room.state.videoAt) LB.gameAt = LB.room.state.videoAt;
  if (ph === "flight" && !LB.flight && !LB.backInRoom) { let done = null; try { done = sessionStorage.getItem("ma.doneGame"); } catch (e) { } if (done && String(LB.room.state.videoAt || LB.room.state.at) === done) { LB.backInRoom = true; if (A.screen !== "lroom") { go("lroom"); return; } } }
  if (LB.backInRoom && ph === "flight") { if (["lroom", "ldesign", "lvideo"].includes(A.screen)) lPartial(); lChatPaint(); return; }
  if (ph === "lobby" && !['lroom', 'lonline'].includes(A.screen)) { lResetGame(); go("lroom"); return; }
  const RANK = { lonline: 0, lroom: 1, lvideo: 2, ldesign: 3, lfly: 4, lusers: 5, lreport: 6 }, target = { lobby: "lroom", video: "lvideo", flight: "lfly" }[ph];
  let doneG = null; try { doneG = sessionStorage.getItem("ma.doneGame"); } catch (e) { }
  const finishedThis = doneG && String(LB.room.state.videoAt || LB.room.state.at) === doneG;
  if (target === "lfly" && !["lfly", "lusers", "lreport"].includes(A.screen) && (finishedThis || LB.backInRoom || !["lroom", "lvideo", "ldesign"].includes(A.screen))) { if (["lroom", "ldesign", "lvideo"].includes(A.screen)) lPartial(); lChatPaint(); return; }
  if (target && ["lonline", "lroom", "lvideo", "ldesign"].includes(A.screen) && (RANK[A.screen] ?? 0) < RANK[target]) { if (target === "lvideo") LB.vi = 0; go(target); if (target === "lfly") lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return; }
  if (isHost() && ph !== "flight" && LB.players.length && LB.players.every(p => p.data && p.data.ready) && allChosen(allPicks(), rolesInPlay())) { roomState({ phase: "flight", at: Date.now() }); }
  if (["lroom", "ldesign", "lvideo"].includes(A.screen)) lPartial();
  if (A.screen === "lfly") lVoteCheck();
  lChatPaint();
}


/* ---- screens ---- */
const roleTag = r => `<span class="rolechip" style="--sc:${CREW[r].col}">${L(CREW[r].title)}</span>`;
function crewImg(r) { return `<img src="img/${CREW[r].img}" alt="">`; }
function lhome() {
  return `<section class="cine notr">
    <canvas id="holoHome" class="holo" aria-label="Hologram of a NASA satellite"></canvas>
    <div class="cine-txt"><div class="kick">NASA SPACE APPS 2026 · TEAM STELLAROPS</div>
      <h1 class="cine-h">MISSION <span>LAB</span></h1>
      <p class="cine-p">${L(ok("You are a space mission team. Each of you gets a role and a guide. Watch your guide's video, write what you learn on the team board, talk together, and design a real satellite.", "إنتوا تيم مهمة فضاء. كل واحد فيكم ليه دور ومرشد. اتفرج على فيديو المرشد بتاعك، واكتب اللي اتعلمته على سبورة التيم، واتكلموا مع بعض، وصمموا قمر صناعي حقيقي."))}</p>
      ${lAuthBox()}
      ${LB.mode === "online" && LB.room ? `<div class="needline">🛰 ${L(ok("You are still in room", "إنت لسه في الغرفة"))} <b class="code">${LB.room.code}</b> <button class="hbtn" type="button" data-act="oagain">${L(ok("Back to the room", "ارجع للغرفة"))}</button> <button class="linkbtn" type="button" data-act="oleave">${L(ok("Leave it", "اخرج منها"))}</button></div>` : ""}
      <div class="row"><button class="hbtn" type="button" data-lmode="solo">${L(ok("Play solo", "العب لوحدك"))}</button>
        <button class="hbtn ghost" type="button" data-lmode="local">${L(ok("Team on one computer", "تيم على جهاز واحد"))}</button>
        <button class="hbtn ghost" type="button" data-lmode="online">${L(ok("Online team (each on own laptop)", "تيم أونلاين (كل واحد على اللابتوب بتاعه)"))}</button></div></div>
    <div class="how">${[[1, ok("Watch your guide", "اتفرج على المرشد")], [2, ok("Write on the team board", "اكتب على السبورة")], [3, ok("Decide together", "قرروا مع بعض")], [4, ok("Launch and see who you helped", "اطلق وشوف ساعدت مين")]].map(([n, t]) => `<div><span>0${n}</span><b>${L(t)}</b></div>`).join("")}</div>
  </section>`;
}
const cmlDone = n => (A.progress.stars["cml" + n] || 0) >= 1;
function llocal() {
  const ps = LB.localPlayers || [];
  return `<section class="hpanel notr"><div class="kick">${L(ok("Team on one computer", "تيم على جهاز واحد"))}</div><h2 class="hh">${L(ok("Who is playing?", "مين بيلعب؟"))}</h2>
    <p class="needline">${L(ok("Write 1 to 4 names. The four roles are shared out in turns: with 2 players, each one plays 2 roles. In surprises, everyone votes.", "اكتبوا من اسم لـ 4 أسامي. الأربع أدوار بيتوزعوا بالدور: لو اتنين، كل واحد بياخد دورين. وفي المفاجآت الكل بيصوّت."))}</p>
    <div class="cols2">${[0, 1, 2, 3].map(i => `<input type="text" class="lpname" maxlength="20" placeholder="${L(ok("Player", "لاعب"))} ${i + 1}" value="${esc(ps[i] || "")}">`).join("")}</div>
    <div class="row"><button class="hbtn" type="button" data-act="llocalgo">${L(ok("Continue", "كمّل"))} →</button></div></section>`;
}
function llevel() {
  return `<section class="hpanel notr"><div class="kick">${L(ok("Choose a level", "اختار المستوى"))}</div>
    <h2 class="hh">${L(ok("How mature is your mission idea?", "فكرة مهمتك ناضجة لحد فين؟"))}</h2>
    <p class="needline">${L(ok("NASA's JPL rates mission ideas with Concept Maturity Levels (CML). Each level here is a different mission, and each one is harder.", "معمل JPL بتاع ناسا بيقيّم أفكار المهمات بمستويات اسمها CML. هنا كل مستوى مهمة مختلفة، وكل واحدة أصعب من اللي قبلها."))}</p>
    <div class="planets">${CML.map(c => { const m = LAB_M[c.m]; const soon = m && m.soon; const locked = !soon && c.n > 1 && !A.unlockAll && !cmlDone(c.n - 1);
      const st = A.progress.stars["cml" + c.n] || 0;
      return `<button class="pcard" type="button" data-llevel="${c.n}" ${locked || soon ? "disabled" : ""}><span class="cmlnum">CML ${c.n}</span><b>${L(c.t)}</b>${m ? `<span class="psub"><b>${L(m.name)}</b></span>` : ""}<span class="psub">${L(c.d)}</span>${st ? `<span class="pstars">${"★".repeat(st)}</span>` : ""}${soon ? `<span class="psub">⏳ ${L(ok("Coming next", "جاي قريب"))}</span>` : locked ? `<span class="psub">🔒 ${L(ok("Finish the level before", "خلّص المستوى اللي قبله"))}</span>` : ""}</button>`; }).join("")}</div>
    <label class="opt inline"><input type="checkbox" id="ula2" ${A.unlockAll ? "checked" : ""}> ${L(ok("Unlock all levels (judges and teachers)", "افتح كل المستويات (للحكام والمدرسين)"))}</label></section>`;
}
function lonline() {
  return `<section class="hpanel notr"><div class="kick">${L(ok("Online team", "تيم أونلاين"))}</div><h2 class="hh">${L(ok("Create or join a mission room", "اعمل أو ادخل غرفة مهمة"))}</h2>
    ${A.resumeMsg ? `<p class="needline">🔄 ${L(ok("Reconnecting to room", "بنرجّعك للغرفة"))} <b class="code">${esc(A.resumeMsg)}</b>…</p>` : ""}${A.kickedMsg ? `<p class="bad">${L(ok("The room creator removed you from the room.", "اللي عامل الغرفة طلّعك من الغرفة."))}</p>` : ""}<div id="olstat" class="needline">${L(ok("Checking the connection…", "بنشيك على الاتصال…"))}</div>
    <div class="cols2"><div class="hcard"><h3>${L(ok("Your name", "اسمك"))}</h3><input type="text" id="oname" maxlength="24" value="${esc(A.lastName || "")}">
      <div class="needline">🎲 ${L(ok("The room creator decides: roles are drawn by luck, or each player picks a free role in the room.", "اللي بيعمل الغرفة هو اللي بيقرر: الأدوار تتوزع بالحظ، أو كل لاعب يختار دور فاضي جوه الغرفة."))}</div><div class="rolepick">${TEAM_ROLES.map(r => `<div class="rolecard" style="--sc:${CREW[r].col}">${crewImg(r)}<b>${L(CREW[r].title)}</b><span>?</span></div>`).join("")}</div></div>
    <div class="hcard"><h3>${L(ok("Start a new room", "ابدأ غرفة جديدة"))}</h3><p class="psub">${L(ok("You choose the level. Share the code with your team.", "إنت اللي هتختار المستوى. ابعت الكود للتيم."))}</p>
      <h3>${L(ok("How are roles given?", "الأدوار هتتوزع إزاي؟"))}</h3>
      <label class="opt inline"><input type="radio" name="rmode" value="random" checked> 🎲 ${L(ok("By luck (random)", "بالحظ (عشوائي)"))}</label>
      <label class="opt inline"><input type="radio" name="rmode" value="pick"> ✋ ${L(ok("Each player picks a free role", "كل لاعب يختار دور فاضي"))}</label>
      <select id="olevel">${CML.filter(c => c.m && !LAB_M[c.m].soon).map(c => `<option value="${c.n}" ${c.n === LB.level ? "selected" : ""}>${L(c.t)} · ${L(LAB_M[c.m].name)}</option>`).join("")}</select>
      <button class="hbtn" type="button" data-act="ocreate">${L(ok("Create room", "اعمل غرفة"))}</button>
      <h3>${L(ok("Or join with a code", "أو ادخل بكود"))}</h3><input type="text" id="ocode" maxlength="16" placeholder="SO-XXXX">
      <button class="hbtn ghost" type="button" data-act="ojoin">${L(ok("Join room", "ادخل الغرفة"))}</button><p class="bad" id="oerr"></p></div></div></section>`;
}
function lroom() {
  const host = LB.room.state.host === myId;
  return lRoomBar() + `<section class="hpanel notr"><div class="kick">${L(ok("Mission room", "غرفة المهمة"))} · ${L(lvl().t)} · ${L(LM().name)}</div>
    ${LB.myRole ? `<div class="drawn" style="--sc:${CREW[LB.myRole].col}">${crewImg(LB.myRole)}<div><span class="psub">${LB.room.state.roleMode === "pick" ? "✋ " + L(ok("Your role (pick a free one below to change it)", "دورك (اختار دور فاضي تحت لو عايز تغيّره)")) : "🎲 " + L(ok("Your role, drawn by luck", "دورك اللي طلعلك بالحظ"))}</span><b>${L(CREW[LB.myRole].title)}</b><span class="psub">${L(ok("Your guide", "المرشد بتاعك"))}: ${CREW[LB.myRole].name}${isHost() ? " · " + L(ok("You created the room, so you also cover empty roles.", "إنت اللي عامل الغرفة، فإنت كمان ماسك الأدوار الفاضية.")) : ""}</span></div></div>` : ""}
    <h2 class="hh">${L(ok("Room code", "كود الغرفة"))}: <span class="code">${LB.room.code}</span></h2>
    <p class="needline">${LB.room.state.roleMode === "pick" ? L(ok("Send this code to your team. Each player joins from their own laptop and picks a free role below. The room creator also covers empty roles.", "ابعت الكود ده للتيم. كل لاعب يدخل من اللابتوب بتاعه ويختار دور فاضي من تحت. واللي عمل الغرفة بيمسك الأدوار الفاضية.")) : L(ok("Send this code to your team. Each player joins from their own laptop and gets a role by luck. The room creator also covers empty roles.", "ابعت الكود ده للتيم. كل لاعب يدخل من اللابتوب بتاعه وبيطلعله دور بالحظ. واللي عمل الغرفة بيمسك الأدوار الفاضية."))}</p>
    ${host ? `<div class="row"><span class="psub">${L(ok("Roles", "الأدوار"))}:</span> <button class="hbtn ${LB.room.state.roleMode !== "pick" ? "" : "ghost"}" type="button" data-act="omode" data-m="random">🎲 ${L(ok("By luck", "بالحظ"))}</button><button class="hbtn ${LB.room.state.roleMode === "pick" ? "" : "ghost"}" type="button" data-act="omode" data-m="pick">✋ ${L(ok("Players pick", "اللاعبين يختاروا"))}</button></div>` : ""}
    <div id="lroomlist" class="rolepick">${lRoomList()}</div>
    ${LB.players.length && LB.players.length < 4 ? `<p class="needline">🔁 ${L(ok("Fewer than 4 players, so the empty roles are shared out:", "التيم أقل من 4، فالأدوار الفاضية اتوزعت كده:"))} ${Object.entries(lPlanExtra()).map(([r, id]) => `<b>${esc((LB.players.find(p => p.id === id) || {}).name || "")}</b> → ${L(CREW[r].title)}`).join(" · ")}</p>` : ""}
    ${lLobbyCtl()}
    ${host ? `<div class="row">${lBlocked(LB.level).length ? `<p class="bad">⚠️ ${lBlocked(LB.level).map(p => esc(p.name)).join(", ")} ${L(ok(`can't play CML ${LB.level} yet. Finish CML ${LB.level - 1} first, or pick another level.`, `لسه مينفعش يلعب CML ${LB.level}. لازم يخلّص CML ${LB.level - 1} الأول، أو اختاروا مستوى تاني.`))}</p>` : ""}<button class="hbtn" type="button" data-act="ostart" ${LB.players.every(p => p.data && p.data.lobbyReady) && !lBlocked(LB.level).length ? "" : "disabled"}>${L(ok("Start the game for everyone", "ابدأ اللعبة للكل"))} (${LB.players.filter(p => p.data && p.data.lobbyReady).length}/${LB.players.length} ${L(ok("ready", "جاهزين"))})</button><button class="linkbtn" type="button" data-act="ostartnow" ${lBlocked(LB.level).length ? "disabled" : ""}>${L(ok("Start anyway", "ابدأ برضه"))}</button></div>` : `<p class="psub">${L(ok("Waiting for the room creator to start…", "مستنيين اللي عمل الغرفة يبدأ…"))}</p>`}
  </section>${lChatBox()}`;
}
function myDone() { const d = {}; CML.forEach(c => { d[c.n] = A.progress.stars["cml" + c.n] || 0; }); return d; }
function lBlocked(n) { if (n <= 1 || A.unlockAll) return []; return LB.players.filter(p => !(((p.data && p.data.done) || {})[n - 1] >= 1)); }
function lLobbyCtl() {
  const host = isHost(), meReady = LB.me && LB.me.data && LB.me.data.lobbyReady;
  return `${host ? `<div class="row lvlpick"><span class="psub">${L(ok("Level for this game", "مستوى الجولة دي"))}:</span>${CML.map(c => { const bl = lBlocked(c.n); return `<button type="button" class="hbtn ${LB.level === c.n ? "" : "ghost"}" data-act="olevel" data-n="${c.n}" ${bl.length ? "disabled" : ""}>${bl.length ? "🔒 " : ""}CML ${c.n} · ${L(LAB_M[c.m].name)}</button>`; }).join("")}</div>
    ${CML.filter(c => lBlocked(c.n).length).map(c => `<p class="psub">🔒 CML ${c.n}: ${lBlocked(c.n).map(p => `<b class="hl">${esc(p.name)}</b>`).join(", ")} ${L(ok(`didn't finish CML ${c.n - 1} yet (needs at least 1 star).`, `لسه مخلّصش CML ${c.n - 1} (محتاج نجمة واحدة على الأقل).`))}</p>`).join("")}` : `<p class="needline">${L(ok("Level", "المستوى"))}: <b class="hl">${L(lvl().t)} · ${L(LM().name)}</b></p>`}
    <div class="row"><button class="hbtn ${meReady ? "ghost" : ""}" type="button" data-act="oready0">${meReady ? "✅ " + L(ok("I'm ready (click to cancel)", "أنا جاهز (دوس علشان تلغي)")) : "✋ " + L(ok("I'm ready", "أنا جاهز"))}</button>
    <span class="psub">${L(ok("The game starts when everyone is ready.", "اللعبة بتبدأ لما الكل يبقى جاهز."))}</span></div>`;
}
function lRoomBar() {
  if (LB.mode !== "online" || !LB.room) return "";
  return `<section class="roombar notr" id="roombar">${lRoomBarInner()}</section>`;
}
function lRoomBarInner() {
  const host = isHost(), ph = LB.room.state.phase;
  return `<div class="rb-code"><span class="psub">${L(ok("Room code", "كود الغرفة"))}</span> <b class="code">${LB.room.code}</b> <button class="linkbtn" type="button" data-act="ocopy">${L(ok("Copy", "انسخ"))}</button></div>
    <div class="rb-who">${LB.players.map(p => `<span class="rb-p" style="--sc:${(CREW[p.role] || CREW.director).col}"><i></i>${esc(p.name)}${p.data && p.data.cid === myId ? " (" + L(ok("you", "إنت")) + ")" : ""} · ${TEAM_ROLES.filter(r => (lOwner(r) || {}).id === p.id).map(r => L(CREW[r].title)).join(" + ")}${p.data && p.data.ready ? " ✓" : ""} · ${(() => { const d = (p.data && p.data.done) || {}; const top = [4, 3, 2, 1].find(n => d[n] >= 1); return top ? "🎓 CML " + top : L(ok("new", "جديد")); })()}${host && !(p.data && p.data.cid === myId) ? ` <button class="rb-kick" type="button" data-kick="${p.id}" title="${L(ok("Remove from the room", "طلّعه من الغرفة"))}">✕</button>` : ""}</span>`).join("")}</div>
    <div class="rb-act">${host && ph !== "lobby" ? `<button class="hbtn ghost" type="button" data-act="olobby">${L(ok("Back to lobby (everyone)", "ارجع للوبي (للكل)"))}</button>` : ""}<button class="hbtn ghost" type="button" data-act="oleave">${L(ok("Leave room", "اخرج من الغرفة"))}</button></div>`;
}
async function lSwitchRole(r) {
  const sb = sbClient(); if (!sb || !LB.room || !LB.me) return;
  const { data: all } = await sb.from("players").select("*").eq("room", LB.room.code); const seat = (all || []).find(x => x.role === r);
  let res;
  if (seat && !(seat.data && seat.data.left)) { alert(L(ok("Someone just took that role. Pick another free one.", "حد لسه واخد الدور ده. اختار دور فاضي تاني."))); return roomRefresh(); }
  if (seat) { res = await sb.from("players").update({ name: LB.me.name, data: { cid: myId, picks: {} } }).eq("id", seat.id).select().single(); if (!res.error) await sb.from("players").update({ data: Object.assign({}, LB.me.data, { left: true, ready: false, cid: "moved-" + myId }) }).eq("id", LB.me.id); }
  else res = await sb.from("players").update({ role: r, data: Object.assign({}, LB.me.data, { picks: {}, ready: false }) }).eq("id", LB.me.id).select().single();
  if (res.error || !res.data) { alert(L(ok("Someone just took that role. Pick another free one.", "حد لسه واخد الدور ده. اختار دور فاضي تاني."))); return roomRefresh(); }
  LB.me = res.data; LB.myRole = r; await roomRefresh(); render();
}
function lSave() { try { if (LB.room && LB.me) sessionStorage.setItem("ma.room", JSON.stringify({ code: LB.room.code, name: LB.me.name })); else sessionStorage.removeItem("ma.room"); } catch (e) { } }
function lResetGame() { LB.flight = null; LB.watched = {}; LB.reviews = 0; LB.rewatch = 0; LB.vi = 0; LB.revealed = null; const m = $("#modal"); if (m) m.innerHTML = ""; if (LB.me) myData({ picks: {}, rv: {}, ready: false, watched: false, votes: {}, lobbyReady: false }); }
function lLeave() { try { sessionStorage.removeItem("ma.room"); } catch (e) { } const sb = sbClient(); if (sb && LB.chan) sb.removeChannel(LB.chan); clearInterval(pollT); LB.chan = null; LB.room = null; LB.me = null; LB.myRole = null; LB.players = []; LB.chat = []; LB.flight = null; LB.mode = "solo"; const m = $("#modal"); if (m) m.innerHTML = ""; }
function lRoomBarPaint() { const el = $("#roombar"); if (el && LB.room) el.innerHTML = lRoomBarInner(); }
function lRoomList() {
  const pick = LB.room && LB.room.state.roleMode === "pick";
  return TEAM_ROLES.map(r => { const p = LB.players.find(x => x.role === r); const me = p && p.data && p.data.cid === myId;
    const can = pick && !p;
    return `<${can ? 'button type="button" data-orole="' + r + '"' : "div"} class="rolecard ${p ? "taken" : ""} ${can ? "free" : ""}" style="--sc:${CREW[r].col}">${crewImg(r)}<b>${L(CREW[r].title)}</b><span>${p ? esc(p.name) + (me ? " (" + L(ok("you", "إنت")) + ")" : "") + (pick && !me ? " · " + L(ok("not available", "مش متاح")) : "") : pick ? "✋ " + L(ok("Free: click to take it", "فاضي: دوس علشان تاخده")) : L(ok("empty", "فاضي"))}</span></${can ? "button" : "div"}>`; }).join("");
}
function lChatBox() { if (LB.mode !== "online") return ""; return `<section class="hpanel notr chat"><div class="kick">${L(ok("Team chat", "شات التيم"))}</div><div id="chatlog" class="chatlog"></div><form id="chatform" class="row"><input type="text" id="chatin" maxlength="300" placeholder="${L(ok("Tell your team what you found…", "قول للتيم إنت لقيت إيه…"))}"><button class="hbtn" type="submit">${L(ok("Send", "ابعت"))}</button></form></section>`; }
function lChatPaint() { const el = $("#chatlog"); if (!el) return; el.innerHTML = LB.chat.map(m => `<div><b style="color:${(CREW[m.role] || CREW.director).col}">${esc(m.name)}</b> <span class="psub">${esc(L((CREW[m.role] || CREW.director).title))}</span><br>${esc(m.body)}</div>`).join(""); el.scrollTop = 1e9; }

/* ---- team board: players write what they learned; the game never fills it in ---- */
function lBoard() {
  const mine = LB.mode === "online" ? ((LB.me && LB.me.data && LB.me.data.notes) || "") : LB.notes;
  return `<section class="hpanel notr board"><div class="kick">${L(ok("Team board", "سبورة التيم"))}</div>
    <p class="psub">${L(ok("Write what you learned from your video: names, numbers, good and bad points. Your team can read it.", "اكتب اللي اتعلمته من الفيديو بتاعك: الأسامي، والأرقام، والميزة والعيب. والتيم كله يقدر يقراه."))}</p>
    <textarea id="lnotes" rows="5" maxlength="1500" placeholder="${L(ok("e.g. Camera A: sees … / needs …", "مثلاً: الكاميرا A: بتشوف … / محتاجة …"))}">${esc(mine)}</textarea>
    <div id="boardOthers" class="boardothers">${lBoardOthers()}</div></section>`;
}
function lBoardOthers() {
  if (LB.mode !== "online") return "";
  return LB.players.filter(p => p.id !== (LB.me && LB.me.id) && p.data && p.data.notes).map(p => `<div class="note" style="--sc:${(CREW[p.role] || CREW.director).col}"><b>${esc(p.name)} · ${L(CREW[p.role].title)}</b><pre>${esc(p.data.notes)}</pre></div>`).join("");
}
let notesT = null;
document.addEventListener("input", e => { if (e.target.id !== "lnotes") return; const v = e.target.value; if (LB.mode === "online") { clearTimeout(notesT); notesT = setTimeout(() => myData({ notes: v }), 700); } else LB.notes = v; });

function lVideoList() { return ["director", ...myRoles()]; }
function lvideo() {
  const list = lVideoList(); const i = Math.min(LB.vi || 0, list.length - 1), r = list[i];
  const who = r === "director" ? L(ok("Your Mission Director", "مدير المهمة")) : `${L(ok("Guide for", "مرشد"))} ${L(CREW[r].title)}`;
  return lRoomBar() + `<section class="hpanel notr"><div class="kick">${L(LM().name)} · ${L(ok("Briefing", "الشرح"))} ${i + 1}/${list.length}</div>
    <h2 class="hh">${CREW[r].name} · ${who}</h2>
    <p class="needline">${L(ok("Watch carefully and write on the team board. The cards later show names only.", "اتفرج كويس واكتب على السبورة، علشان الكروت بعد كده عليها أسامي بس."))}</p>
    ${LB.mode === "online" && LB.room && LB.room.state.videoAt && LB.level > 1 ? `<p class="timer">⏱️ ${L(ok("Time to watch", "وقت الفرجة"))}: <b id="vtimer">--:--</b> · ${L(ok("Watch your videos and write your notes. When time is up, everyone moves on to the design.", "اتفرج على الفيديوهات واكتب النوتس بتاعتك. ولما الوقت يخلص، الكل بيروح على التصميم."))}</p>` : ""}
    <video id="brief" class="briefvid" src="video/${LM().id}_${r}.mp4" controls playsinline preload="auto"></video>
    <div class="row">${i < list.length - 1 ? `<button class="hbtn" type="button" data-act="vnext" id="vnext" ${LB.watched[LM().id + r] ? "" : "disabled"}>${L(ok("Next briefing", "الشرح اللي بعده"))}</button>`
      : `<button class="hbtn" type="button" data-act="vdone" id="vnext" ${LB.watched[LM().id + r] ? "" : "disabled"}>${L(ok("I'm ready to decide", "أنا جاهز أقرر"))}</button>`}
      <span class="psub">${L(ok("The button unlocks when the video ends.", "الزرار بيتفتح لما الفيديو يخلص."))}</span></div></section>${lBoard()}`;
}
function lCard(role, d, o, picks, mine) {
  const sel = picks[role + "." + d.k] === o.k, orph = lOrphan(role), key = role + "." + d.k;
  const myv = orph && LB.me && LB.me.data && LB.me.data.rv && LB.me.data.rv[key] === o.k, nv = orph ? lVotesFor(key, o.k) : 0;
  return `<button type="button" class="ccard ${sel ? "sel" : ""} ${myv ? "myvote" : ""}" ${mine ? `data-lpick="${role}.${d.k}.${o.k}"` : "disabled"}><span class="cnum">${o.k}</span><span class="cicon">${sIcon(o.icon)}</span><b>${L(o.n)}</b>${orph ? `<span class="vcount">🗳 ${nv}${myv ? " · " + L(ok("your vote", "صوتك")) : ""}</span>` : ""}</button>`;
}
function ldesign() {
  const picks = allPicks(), mine = myRoles(), m = LM();
  const tabs = TEAM_ROLES.map(r => `<button type="button" class="stp ${LB.tab === r ? "cur" : ""} ${decisionsFor([r]).every(({ role, d }) => picks[role + "." + d.k]) ? "done" : ""}" data-ltab="${r}" style="--sc:${CREW[r].col}"><span>${crewImg(r)}</span>${L(CREW[r].title)}</button>`).join("");
  const r = TEAM_ROLES.includes(LB.tab) ? LB.tab : (mine[0] || "science"); LB.tab = r; const canEdit = mine.includes(r);
  const reviews = LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews;
  return lRoomBar() + `<section class="build notr">
    <div class="buildhead"><div><div class="kick">${L(m.name)} · ${L(lvl().t)}</div>
      <div class="rulesrow">${m.rules.map(x => `<span class="rulechip">${L(x)}</span>`).join("")}</div>
      ${lPtsHtml()}
      <div class="stepper">${tabs}</div></div></div>
    <div class="buildgrid"><div class="holowrap"><canvas id="holoBuild" class="holo"></canvas><div class="holotag">${L(ok("Your satellite", "القمر بتاعك"))}</div></div>
      <div class="choose"><div class="steptitle" style="--sc:${CREW[r].col}">${roleTag(r)}<span class="psub">${L(SEGMENT[r])} · ${L(ok("Guide", "المرشد"))}: ${CREW[r].name}</span></div>
        ${lOrphan(r) ? `<p class="needline">🗳 <b>${L(ok("Nobody has this role now, so the whole team votes. The choice with the most votes wins.", "مفيش حد ماسك الدور ده دلوقتي، فالتيم كله بيصوّت، والاختيار اللي ياخد أصوات أكتر بيكسب."))}</b></p>` : LB.mode === "online" ? (canEdit ? (lOwner(r) && lOwner(r).role !== r ? `<p class="needline">🔁 <b>${L(ok("This is an extra role for you, because the team has fewer than 4 players.", "ده دور زيادة عليك، علشان التيم أقل من 4 لاعبين."))}</b></p>` : "") : `<p class="needline">${L(ok("This is the job of", "ده شغل"))} <b>${esc((lOwner(r) || {}).name || "")}</b>. ${L(ok("Talk to them in the chat.", "كلّمه في الشات."))}</p>`) : lLocalOwner(r) ? `<p class="needline">👤 ${L(ok("Turn", "الدور على"))}: <b>${esc(lLocalOwner(r))}</b></p>` : ""}
        ${m.decisions[r].map(d => `<div class="dec"><h3>${L(d.t)}</h3><div class="cards3 ${d.o.length === 2 ? "two" : ""}">${d.o.map(o => lCard(r, d, o, picks, canEdit)).join("")}</div></div>`).join("")}
        <div class="nav2"><button class="hbtn ghost" type="button" data-act="rewatch">${L(ok("Rewatch my guide (−20 points)", "اتفرج على المرشد تاني (−20 نقطة)"))}</button></div></div></div>
    <div class="reviewbar"><button class="hbtn ghost" type="button" data-act="review">${L(ok("Design review", "مراجعة التصميم"))} ${reviews ? L(ok("(−30 points)", "(−30 نقطة)")) : L(ok("(first one free)", "(أول مرة ببلاش)"))}</button>
      <div class="row lnav">${lStepBtns()}${lLaunchBtn(picks)}</div></div>
    <div id="reviewbox">${lReviewHtml()}</div>
  </section>${lBoard()}${lChatBox()}`;
}
function lPenNow() { const reviews = LB.mode === "online" && LB.room ? LB.room.state.reviews || 0 : LB.reviews; return Math.max(0, reviews - 1) * 30 + LB.rewatch * 20; }
function lPtsHtml() {
  return `<div class="pts" id="ptsbox"><div><span class="psub">${L(ok("Your team starts with", "التيم بيبدأ بـ"))}</span> <b>1,000</b> · ${L(ok("now", "دلوقتي"))} <b class="ptsnow" id="ptsNow">${nf(1000 - lPenNow())}</b> ${L(ok("points", "نقطة"))}</div>
    <div class="psub">${L(ok("You lose points for: each need not met · each wasted part (−70) · damage in flight · space junk (−100) · extra design reviews (−30) · rewatching a video (−20). Keep as many as you can!", "بتخسر نقط لو: طلب متحققش · كل قطعة زيادة عن اللزوم (−70) · أي ضرر وإنتوا طايرين · زبالة فضائية (−100) · مراجعة تصميم زيادة (−30) · تتفرج على فيديو تاني (−20). حافظوا على أكبر عدد نقط!"))}</div></div>`;
}
function lPtsPaint() { const el = $("#ptsNow"); if (el) el.textContent = nf(1000 - lPenNow()); }
function lStepBtns() {
  if (LB.mode === "online") return "";
  const i = TEAM_ROLES.indexOf(LB.tab), prev = TEAM_ROLES[i - 1], next = TEAM_ROLES[i + 1];
  return (prev ? `<button class="hbtn ghost" type="button" data-act="ltabprev">← ${L(CREW[prev].title)}</button>` : "") + (next ? `<button class="hbtn" type="button" data-act="ltabnext">${L(ok("Next", "التالي"))}: ${lLocalOwner(next) ? esc(lLocalOwner(next)) + " · " : ""}${L(CREW[next].title)} →</button>` : "");
}
function lLaunchBtn(picks) {
  const done = allChosen(picks, TEAM_ROLES);
  if (LB.mode === "online") { const ready = LB.players.filter(p => p.data && p.data.ready).length, meReady = LB.me.data && LB.me.data.ready;
    return `<button class="hbtn launch" type="button" data-act="oready" ${done ? "" : "disabled"}>${meReady ? L(ok("Waiting for team", "مستنيين التيم")) : L(ok("I'm ready to launch", "أنا جاهز للإطلاق"))} (${ready}/${LB.players.length})</button>`; }
  return `<button class="hbtn launch" type="button" data-act="llaunch" ${done ? "" : "disabled"}>${L(ok("Launch!", "اطلق!"))}</button>`;
}
function lReviewHtml() {
  const rv = LB.mode === "online" ? LB.room.state.lastReview : LB.revealed;
  if (!rv) return `<p class="ringhelp">${L(ok("The review stays hidden until you ask for it, like a real NASA design review.", "المراجعة متخفية لحد ما تطلبوها، زي مراجعات التصميم الحقيقية في ناسا."))}</p>`;
  const c = lCompute(allPicks()), list = c.issues.concat(c.waste.map(w => ({ en: "Waste · " + w.en, ar: "تضييع · " + w.ar })));
  return `${c.ring ? ringsRow({ ring: c.ring }) : ""}<div class="hcard"><h3>${L(ok("Review findings", "نتايج المراجعة"))}</h3><ul>${(list.length ? list : [ok("No problems found. The design closes, with nothing wasted.", "مفيش مشاكل. التصميم مظبوط ومفيهوش تضييع.")]).map(x => `<li>${L(x)}</li>`).join("")}</ul><p class="psub">${L(ok("The review tells you what is wrong, not how to fix it.", "المراجعة بتقولك إيه الغلط، مش بتقولك تصلّحه إزاي."))}</p></div>`;
}
function lPartial() {
  if (A.screen === "lroom") { const sig = [LB.room.state.roleMode, LB.myRole, LB.level, LB.players.length, LB.players.filter(p => p.data && p.data.lobbyReady).length, LB.players.map(p => JSON.stringify((p.data && p.data.done) || {})).join(",")].join("|"); if (LB._sig !== sig) { LB._sig = sig; const ci = $("#chatin"), cv = ci ? ci.value : ""; render(); const c2 = $("#chatin"); if (c2 && cv) c2.value = cv; return; } const el = $("#lroomlist"); if (el) el.innerHTML = lRoomList(); return; }
  const bo = $("#boardOthers"); if (bo) bo.innerHTML = lBoardOthers();
  if (A.screen === "ldesign") { const picks = allPicks();
    const sig = TEAM_ROLES.map(r => (lOwner(r) || {}).id || "v").join(",") + "|" + LB.players.map(p => JSON.stringify((p.data && p.data.rv) || {})).join("");
    if (LB.mode === "online" && LB._dsig !== undefined && LB._dsig !== sig) { LB._dsig = sig; const ci = $("#chatin"), cv = ci ? ci.value : "", nt = $("#lnotes"), nv2 = nt ? nt.value : null; render(); const c2 = $("#chatin"); if (c2 && cv) c2.value = cv; const n2 = $("#lnotes"); if (n2 && nv2 !== null) n2.value = nv2; return; }
    LB._dsig = sig;
    document.querySelectorAll("[data-lpick]").forEach(b => { const [r, k, o] = b.dataset.lpick.split("."); b.classList.toggle("sel", picks[r + "." + k] === o); });
    document.querySelectorAll(".ccard[disabled]").forEach(b => { /* teammates' cards are shown via tabs */ });
    document.querySelectorAll(".stp[data-ltab]").forEach(b => b.classList.toggle("done", decisionsFor([b.dataset.ltab]).every(({ role, d }) => picks[role + "." + d.k])));
    const rb = document.querySelector(".reviewbar .lnav"); if (rb) rb.lastElementChild.outerHTML = lLaunchBtn(picks);
    const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); lHolo(); lPtsPaint(); }
}
let holoL = null;
function lEngineDesign(c) { const m = LM(), base = MISSIONS.find(x => x.id === m.base); return { base, d: Object.assign(structuredClone(base.def), m.engine(c, base)) }; }
function lHolo() { const tg = document.querySelector(".holowrap .holotag"); if (tg) tg.textContent = LB.lastPart ? L(ok("Added: ", "اتضاف: ")) + LB.lastPart : L(ok("Your satellite", "القمر بتاعك")); if (!holoL) return; const c = lCompute(allPicks()); try { const { base, d } = lEngineDesign(c); holoL.setDesign(base, d, { dry: 400 }); } catch (e) { } }

/* ---- flight (3D engine with real NASA models) ---- */
function lfly() { return sfly().replace('<b id="hp">100%</b></div>', `<b id="hp">100%</b></div><div class="fb-h"><span>${L(ok("Points (decisions are scored at the end)", "النقط (القرارات بتتحسب في الآخر)"))}</span><b id="ptsFly">${nf(1000 - lPenNow())}</b></div>${LB.mode === "online" ? `<div class="fb-h"><button class="linkbtn" type="button" data-act="oskipfly">⏭ ${L(ok("Back to the room", "ارجع للغرفة"))}</button></div>` : ""}`); }
function lSay(role, text) { const el = $("#subt"); if (el) { el.innerHTML = `<b style="color:${CREW[role].col}">${CREW[role].name}:</b> ${text}`; el.classList.add("on"); } }
async function lRunFlight() {
  SEQ++; const m = LM(), picks = allPicks(), c = lCompute(picks); const { base, d } = lEngineDesign(c);
  const F = LB.flight = { health: 100, sci: 1, cost: 0, events: [], lost: null, c, m, picks: Object.assign({}, picks) };
  curP = 0; totalDays = m.days;
  if (Space3D.ok && $("#view3d")) { flightView = Space3D.createView($("#view3d"), {}); flightView.setReal && flightView.setReal(false); flightView.setMission(base, d, { dry: (c.mass || 1500), prop: 200 }); skyLoop(); }
  const marks = flightView ? flightView.marks() : { ascent: .12 }; ascentEnd = marks.ascent || .12;
  lSay("planner", L(ok("Three, two, one... liftoff!", "تلاتة، اتنين، واحد... انطلقنا!"))); await wait(2600); setPhase(L(ok("LIFTOFF", "الإطلاق")));
  if (c.fatal === "mass") { await animTo(.045, 3500); flightView && flightView.flag("fall"); F.lost = { en: `The ${c.rkt.n.en} could not lift a ${nf(Math.round(c.mass))} kg satellite. It ran out of fuel before space and fell into the ocean.`, ar: `صاروخ ${c.rkt.n.ar} مقدرش يشيل قمر وزنه ${nf(Math.round(c.mass))} كيلو. الوقود خلص قبل ما يوصل الفضاء ووقع في المحيط.` }; lSay("planner", L(F.lost)); await wait(4500); return lFinish(F); }
  await animTo(ascentEnd, 6500); flightView && flightView.flag("separated"); setPhase(L(ok("IN ORBIT", "في الأوربت")));
  lSay("engineer", L(m.orbitLine || ok("We are in orbit! Opening the solar panels.", "إحنا في الأوربت! بنفتح السولار بانلز."))); await wait(2400);
  if (c.fatal && m.fatalMsg && m.fatalMsg[c.fatal]) { const at = (m.fatalAt || {})[c.fatal] || "orbit"; await animTo(at === "landing" && marks.landing ? marks.landing - .005 : ascentEnd + .06, at === "landing" ? 9000 : 3500); flightView && flightView.flag(at === "landing" ? "crash" : "tumble"); F.lost = m.fatalMsg[c.fatal]; lSay(at === "landing" ? "planner" : "engineer", L(F.lost)); await wait(5000); return lFinish(F); }
  if (marks.landing) { setPhase(L(ok("LANDING", "الهبوط"))); lSay("planner", L(ok("Seven minutes of terror... we are landing!", "سبع دقايق رعب... إحنا بننزل!"))); await animTo(marks.landing + .01, 9000); flightView && flightView.flag("landed"); setPhase(L(ok("ON MARS", "على المريخ"))); lSay("planner", L(ok("Touchdown! We are on Mars!", "نزلنا! إحنا على المريخ!"))); await wait(2500); }
  if (c.fatal === "power") { await animTo(ascentEnd + .03, 2500); flightView && flightView.flag("tumble"); F.lost = { en: `The satellite needed ${nf(c.need)} W, but the panel made only ${nf(c.supply)} W. It went silent.`, ar: `القمر كان محتاج ${nf(c.need)} وات، والبانل كان بيطلّع ${nf(c.supply)} بس، فالقمر سكت.` }; lSay("engineer", L(F.lost)); await wait(4500); return lFinish(F); }
  if (c.bat && c.bat.min < 35) { lSay("engineer", L(ok("First shadow... the battery is empty before sunrise. We shut down every orbit.", "أول ضل... البطارية فضيت قبل الشمس ما تطلع، فهنطفي في كل لفة."))); await wait(3500); }
  const ev0 = Math.max(.5, (marks.landing || 0) + .02); if (curP < ev0) await animTo(ev0, 5000); for (let i = 0; i < m.events.length; i++) { await lEvent(i, F); await animTo(ev0 + (i + 1) * ((.97 - ev0) / m.events.length), 3500); }
  lSay("comms", L(ok("Years later... the mission is complete.", "بعد سنين... المهمة خلصت."))); setPhase(L(ok("MISSION COMPLETE", "المهمة خلصت"))); await animTo(1, 2500); await wait(1500);
  return lFinish(F);
}
function lEvent(i, F) {
  const e = F.m.events[i];
  return new Promise(res => {
    const el = $("#modal"); lSay(e.role, L(e.x)); LB.evRes = res; LB.evI = i;
    const online = LB.mode === "online";
    el.innerHTML = `<div class="overlay notr" role="dialog" aria-modal="true"><div class="hmodal">
      <div class="evhead">${crewImg(e.role)}<div><div class="kick">${L(ok("Surprise!", "مفاجأة!"))} · ${CREW[e.role].name}</div><h2 class="hh">${L(e.t)}</h2></div></div>
      <p class="evx">${L(e.x)}</p><p class="evq">${online || (LB.localPlayers || []).length > 1 ? L(ok("Everyone votes. The most votes wins.", "الكل يصوّت، والأكتر أصوات يكسب.")) : L(ok("Talk with the team, then choose.", "اتكلموا مع بعض، وبعدين اختاروا."))}</p>
      <div class="cards3 ${e.o.length === 2 ? "two" : ""}">${e.o.map((o, j) => `<button type="button" class="ccard" data-lev="${j}"><span class="cnum">${"ABC"[j]}</span><b>${L(o.t)}</b></button>`).join("")}</div><p class="psub" id="votes"></p></div></div>`;
    el.querySelectorAll("[data-lev]").forEach(b => b.onclick = async () => { const j = +b.dataset.lev;
      if (online) { el.querySelectorAll("[data-lev]").forEach(x => x.classList.toggle("sel", x === b)); const v = Object.assign({}, LB.me.data.votes || {}); v[i] = j; await myData({ votes: v }); lVoteCheck(); }
      else if ((LB.localPlayers || []).length > 1) lLocalVote(j, F); else lEventResolve(j, F); });
    LB.lv = {}; if (online) lVoteCheck(); else if ((LB.localPlayers || []).length > 1) lLocalVote(null, F);
  });
}
function lLocalVote(j, F) {
  const ps = LB.localPlayers, i = LB.evI, cur = ps.find(n => LB.lv[n] === undefined);
  if (j !== null && cur !== undefined) LB.lv[cur] = j;
  const next = ps.find(n => LB.lv[n] === undefined), vt = $("#votes");
  if (vt) vt.innerHTML = `<b class="hl">${next ? "🗳 " + L(ok("Now voting", "دور التصويت على")) + ": " + esc(next) : ""}</b><div class="votelist">${ps.map(n => `<span class="rb-p">${LB.lv[n] !== undefined ? "✅" : "⏳"} ${esc(n)}${LB.lv[n] !== undefined ? " · " + "ABC"[LB.lv[n]] : ""}</span>`).join("")}</div>`;
  if (!next) { const cnt = {}; ps.forEach(n => cnt[LB.lv[n]] = (cnt[LB.lv[n]] || 0) + 1); const lead = lLocalOwner(F.m.events[i].role), max = Math.max(...Object.values(cnt)); const pick = cnt[LB.lv[lead]] === max ? LB.lv[lead] : +Object.keys(cnt).find(k => cnt[k] === max); setTimeout(() => lEventResolve(pick, F), 600); }
}
function lVoteCheck() {
  const i = LB.evI; if (i == null || !LB.evRes || LB.mode !== "online" || !LB.flight) return; const votes = LB.players.map(p => p.data && p.data.votes ? p.data.votes[i] : undefined).filter(v => v !== undefined);
  const vt = $("#votes"); if (vt) vt.innerHTML = `<b class="hl">${L(ok("Votes", "الأصوات"))}: ${votes.length} / ${LB.players.length}</b><div class="votelist">${LB.players.map(p => { const v = p.data && p.data.votes ? p.data.votes[i] : undefined; return `<span class="rb-p" style="--sc:${(CREW[p.role] || CREW.director).col}">${v !== undefined ? "✅" : "⏳"} ${esc(p.name)}${v !== undefined ? " · " + "ABC"[v] : " · " + L(ok("not voted yet", "لسه مصوّتش"))}</span>`; }).join("")}</div>`;
  if (votes.length >= LB.players.length) { const n = LB.flight.m.events[i].o.length, cnt = Array(n).fill(0); votes.forEach(v => cnt[v]++); const lead = LB.players.find(p => p.role === LB.flight.m.events[i].role); const lv = lead && lead.data.votes ? lead.data.votes[i] : 0; const max = Math.max(...cnt); lEventResolve(cnt[lv] === max ? lv : cnt.indexOf(max), LB.flight); }
}
function lEventResolve(j, F) {
  const i = LB.evI, e = F.m.events[i], r = e.o[j].f(F.c), res = LB.evRes; if (!res) return; LB.evRes = null;
  F.health = Math.max(5, F.health + r.h); F.sci *= 1 + r.sci; F.cost += r.cost || 0; setHealth(F.health); { const el = $("#ptsFly"); if (el) el.textContent = nf(1000 - lPenNow() - Math.round(100 - F.health) - Math.round(F.cost * 10)); } F.events.push({ e, j, r });
  const el = $("#modal"), good = !r.h && !r.sci;
  el.querySelector(".hmodal").innerHTML = `<div class="evhead">${crewImg(e.role)}<div><div class="kick">${L(e.t)} · ${L(ok("the team chose", "التيم اختار"))} ${"ABC"[j]}</div><h2 class="hh">${good ? L(ok("Good call!", "قرار صح!")) : L(ok("Here's what happened", "ده اللي حصل"))}</h2></div></div>
    <p class="evx">${L(r.w)}</p><div class="row"><button class="hbtn" type="button" id="levok">${L(ok("Continue", "كمّل"))}</button></div>`;
  lSay(e.role, L(r.w)); $("#levok").onclick = () => { el.innerHTML = ""; res(); };
}
function lFinish(F) {
  const c = F.c, m = F.m, alive = !F.lost, rules = c.rules, nR = m.rules.length, met = Object.values(rules).filter(Boolean).length;
  const reviews = LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews;
  const rows = lDecisionRows(m, c, F.picks || allPicks()), decLoss = rows.reduce((a, r) => a + r.pts, 0);
  const dmg = alive ? Math.round(100 - F.health) : 0, extraRev = Math.max(0, reviews - 1) * 30, rew = LB.rewatch * 20, rent = Math.round(F.cost * 10);
  let total = Math.max(0, 1000 - decLoss - dmg - extraRev - rew - rent); if (!alive) total = Math.min(total, 350);
  const stars = lStarsFor(total);
  F.result = { alive, rules, met, nR, stars, total, rows, dmg, extraRev, rew, rent, reviews, missed: m.rules.filter(r => !rules[r.k]), waste: c.waste, sciPct: alive ? Math.round(Math.min(1, c.sci * F.sci * (F.health / 100)) * 100) : 0 };
  const k = "cml" + LB.level; A.progress.stars[k] = Math.max(A.progress.stars[k] || 0, stars); store.set("ma.progress3", A.progress); lSaveProgress();
  if (LB.mode === "online" && LB.me) { myData({ done: myDone() }); try { sessionStorage.setItem("ma.doneGame", String(LB.room.state.videoAt || LB.room.state.at)); } catch (e) { } }
  setTimeout(() => { if (A.screen === "lfly" && LB.flight === F) go("lusers"); }, 800);
}
function lLossHtml(R) {
  const extra = [
    [ok("Damage from the surprises in flight", "ضرر من المفاجآت وإنتوا طايرين"), R.dmg],
    [ok("Rented a partner's ground station in a surprise (it costs money)", "أجّرتوا محطة أرضية من شريك في مفاجأة (وده بفلوس)"), R.rent],
    [{ en: `Extra design reviews (${Math.max(0, R.reviews - 1)} × 30; the first one is free)`, ar: `مراجعات تصميم زيادة (${Math.max(0, R.reviews - 1)} × 30، وأول واحدة ببلاش)` }, R.extraRev],
    [{ en: `Rewatched videos (${LB.rewatch} × 20)`, ar: `فيديوهات اتشافت تاني (${LB.rewatch} × 20)` }, R.rew]].filter(r => r[1] > 0);
  return `<div class="dash"><div class="lrow start"><span>${L(ok("Your team started with", "التيم بدأ بـ"))}</span><b>1,000</b></div>
    <table class="dtab"><tr><th>${L(ok("Decision", "القرار"))}</th><th>${L(ok("Your choice", "اختياركم"))}</th><th>${L(ok("Points", "النقط"))}</th><th>${L(ok("Why", "ليه"))}</th></tr>
    ${R.rows.map(r => `<tr class="${r.pts ? "lost" : "okr"}"><td><span class="rdot" style="--sc:${CREW[r.role].col}"></span>${L(r.q)}</td><td>${L(r.pick)}</td><td><b class="${r.pts ? "bad" : "good"}">${r.pts ? "−" + nf(r.pts) : "✅ 0"}</b></td><td class="psub">${r.pts ? L(r.why) : L(ok("Best choice", "أحسن اختيار"))}</td></tr>`).join("")}</table>
    ${extra.map(([t, v]) => `<div class="lrow"><span>${L(t)}</span><b class="bad">−${nf(v)}</b></div>`).join("")}
    ${!R.alive ? `<div class="lrow"><span>${L(ok("The mission was lost, so the score is capped at 350", "المهمة فشلت، فأقصى نقط 350"))}</span><b class="bad">≤ 350</b></div>` : ""}
    <div class="lrow end"><span>${L(ok("You kept", "فضل معاكم"))}</span><b>${nf(R.total)} / 1,000</b></div>
    <p class="psub">${L(ok("Stars come only from points: ★ 400+ · ★★ 700+ · ★★★ 900+. You need at least ★ to unlock the next level.", "النجوم بتيجي من النقط بس: ★ من 400 · ★★ من 700 · ★★★ من 900. ومحتاجين ★ على الأقل علشان المستوى الجاي يتفتح."))}</p></div>`;
}
function lCert() {
  const F = LB.flight; if (!F || !F.result) return; const R = F.result, m = F.m;
  const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1130; const g = cv.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 1600, 1130); grd.addColorStop(0, "#050b18"); grd.addColorStop(1, "#0c1a33"); g.fillStyle = grd; g.fillRect(0, 0, 1600, 1130);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .7})`; g.fillRect(Math.random() * 1600, Math.random() * 1130, 2, 2); }
  g.strokeStyle = "#ffd84d"; g.lineWidth = 6; g.strokeRect(40, 40, 1520, 1050); g.strokeStyle = "#5fd8ff55"; g.lineWidth = 2; g.strokeRect(62, 62, 1476, 1006);
  g.textAlign = "center"; g.fillStyle = "#5fd8ff"; g.font = "600 30px 'IBM Plex Mono', monospace"; g.fillText("NASA SPACE APPS 2026 · TEAM STELLAROPS · MISSION LAB", 800, 140);
  g.fillStyle = "#ffd84d"; g.font = "700 76px 'Chakra Petch', sans-serif"; g.fillText("CERTIFICATE OF MISSION SUCCESS", 800, 250);
  g.fillStyle = "#eaf6ff"; g.font = "400 34px 'IBM Plex Sans', sans-serif"; g.fillText("This certifies that the mission team", 800, 330);
  g.fillStyle = "#ffffff"; g.font = "700 54px 'IBM Plex Sans', sans-serif"; const names = (A.certNames || "").trim() || "Mission Team"; g.fillText(names.length > 60 ? names.slice(0, 57) + "…" : names, 800, 420);
  g.fillStyle = "#eaf6ff"; g.font = "400 34px 'IBM Plex Sans', sans-serif"; g.fillText("designed and flew the mission", 800, 490);
  g.fillStyle = "#5fd8ff"; g.font = "700 60px 'Chakra Petch', sans-serif"; g.fillText(m.name.en.toUpperCase(), 800, 580);
  g.fillStyle = "#eaf6ff"; g.font = "400 34px 'IBM Plex Sans', sans-serif"; g.fillText(lvl().t.en + "  ·  " + R.met + "/" + R.nR + " needs met  ·  " + R.total + " / 1000 points", 800, 650);
  g.fillStyle = "#ffd84d"; g.font = "700 110px sans-serif"; g.fillText("★".repeat(R.stars) + "☆".repeat(3 - R.stars), 800, 790);
  g.fillStyle = "#9fb8cd"; g.font = "400 28px 'IBM Plex Sans', sans-serif"; g.fillText("Real mission it is based on: " + m.real.name, 800, 860);
  g.fillText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), 800, 905);
  g.fillStyle = "#ffc26b"; g.font = "italic 600 34px 'IBM Plex Sans', sans-serif"; g.fillText("Mohamed", 400, 1000); g.fillText("StellarOps Mission Control", 1200, 1000);
  g.fillStyle = "#9fb8cd"; g.font = "400 22px 'IBM Plex Sans', sans-serif"; g.fillText("Mission Director", 400, 1035); g.fillText("Mission Lab", 1200, 1035);
  g.strokeStyle = "#9fb8cd"; g.lineWidth = 1; g.beginPath(); g.moveTo(260, 965); g.lineTo(540, 965); g.moveTo(1060, 965); g.lineTo(1340, 965); g.stroke();
  const url = cv.toDataURL("image/png");
  try { const a = document.createElement("a"); a.download = "StellarOps-certificate-CML" + LB.level + ".png"; a.href = url; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
  const md = $("#modal") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "modal" }));
  md.innerHTML = `<div class="overlay notr" role="dialog" aria-modal="true"><div class="hmodal certmodal"><h2 class="hh">🎓 ${L(ok("Your certificate", "الشهادة بتاعتكم"))}</h2><img src="${url}" alt="Certificate"><p class="psub">${L(ok("If it did not download, right-click the picture (or long-press on a phone) and choose Save image.", "لو مااتنزلتش، دوس كليك يمين على الصورة (أو دوسة طويلة على الموبايل) واختار Save image."))}</p><div class="row"><button class="hbtn" type="button" id="certclose">${L(ok("Close", "اقفل"))}</button></div></div></div>`;
  $("#certclose").onclick = () => { md.innerHTML = ""; };
}
function lusers() {
  const F = LB.flight; if (!F || !F.result) return lhome(); const R = F.result;
  const msg = !R.alive ? ok("The satellite never sent any data. Nobody on Earth was helped.", "القمر الصناعي مبعتش أي داتا، ومحدش على الأرض استفاد.") : F.m.userMsg(R);
  return lRoomBar() + `<section class="hpanel notr result"><div class="kick">${L(ok("User segment", "جزء المستخدمين"))} · ${L(ok("who used your data?", "مين استخدم الداتا بتاعتك؟"))}</div>
    <h2 class="hh">${L(F.m.user)}</h2><p class="evx">${L(msg)}</p>
    <p class="needline">${L(ok("NASA splits every mission into four segments: launch, space, ground, and users. A mission only matters when its data helps people.", "ناسا بتقسم أي مهمة لأربع أجزاء: الإطلاق، والفضاء، والأرض، والمستخدمين. والمهمة بتبقى ليها قيمة لما الداتا بتاعتها تساعد الناس."))}</p>
    <div class="row"><button class="hbtn" type="button" data-go="lreport">${L(ok("See the mission report", "شوف تقرير المهمة"))}</button></div></section>`;
}
function lreport() {
  const F = LB.flight; if (!F || !F.result) return lhome(); const R = F.result, c = F.c, m = F.m;
  const fix = []; if (F.lost) fix.push(F.lost);
  m.rules.forEach(r => { if (!R.rules[r.k]) fix.push({ en: `Not met: ${r.en}.`, ar: `متحققش: ${r.ar}.` }); });
  c.waste.forEach(w => fix.push(w)); if (!c.clean) fix.push(ok("Your satellite becomes space junk at the end. NASA plans how every mission ends.", "القمر بتاعك هيبقى زبالة فضائية في الآخر، وناسا بتخطط لنهاية كل مهمة."));
  const good = []; m.rules.forEach(r => { if (R.rules[r.k]) good.push(r); }); if (c.efficient && R.alive) good.push(ok("Nothing wasted: just what the mission needs.", "مفيش تضييع: على قد اللي المهمة محتاجاه بالظبط.")); F.events.forEach(ev => { if (!ev.r.h && !ev.r.sci) good.push({ en: `Smart decision: ${ev.e.t.en.replace(/[.!]+$/, "")}.`, ar: `قرار ذكي: ${ev.e.t.ar.replace(/[.!]+$/, "")}.` }); });
  const mine = TEAM_ROLES.flatMap(r => m.decisions[r].map(d => { const o = pickOpt(m, allPicks(), r, d.k); return o ? L(o.n) : "—"; })).join(" · ");
  return lRoomBar() + `<section class="hpanel notr result"><div class="kick">${L(ok("Mission report", "تقرير المهمة"))} · ${L(lvl().t)} · ${L(m.name)}</div>
    <div class="resgrid"><div><div class="bigstars">${"★".repeat(R.stars)}<span>${"★".repeat(3 - R.stars)}</span></div>
      <h2 class="hh">${!R.alive ? L(ok("Mission lost", "المهمة فشلت")) : R.stars ? L(ok("Mission complete", "المهمة نجحت")) : L(ok("It worked, but met no need", "اشتغلت، بس محققتش ولا طلب"))} · ${R.total} ${L(ok("points", "نقطة"))}</h2>
      <p class="sciline">${L(ok("Needs met", "الطلبات المتحققة"))}: <b>${R.met}/${R.nR}</b> · ${L(ok("Health", "الصحة"))}: <b>${Math.round(F.health)}%</b>${c.mass ? ` · ${L(ok("Mass", "الوزن"))}: <b>${nf(Math.round(c.mass))} kg</b>` : ""}${c.need ? ` · ${L(ok("Power", "الكهربا"))}: <b>${nf(c.need)} / ${nf(c.supply)} ${m.unit || "W"}</b>` : ""}</p>
      <ul class="starkey"><li class="${R.stars >= 1 ? "on" : ""}">★ ${L(ok("400+ points", "400 نقطة أو أكتر"))}</li><li class="${R.stars >= 2 ? "on" : ""}">★★ ${L(ok("700+ points", "700 نقطة أو أكتر"))}</li><li class="${R.stars >= 3 ? "on" : ""}">★★★ ${L(ok("900+ points", "900 نقطة أو أكتر"))}</li></ul>
      ${lLossHtml(R)}</div>
    <div class="resholo"><canvas id="holoRes" class="holo"></canvas><div class="holotag">NASA 3D model · ${({ goes: "GOES", lro: "LRO", landsat8: "Landsat 8", perseverance: "Perseverance" })[m.model]}</div></div></div>
    <div class="cols2"><div class="hcard"><h3>${L(ok("What you did well", "اللي عملته صح"))}</h3><ul>${(good.length ? good : [ok("You tried. Every NASA team learns from its first design.", "إنت جرّبت، وكل تيم في ناسا بيتعلم من أول تصميم.")]).slice(0, 6).map(x => `<li>${L(x)}</li>`).join("")}</ul></div>
      <div class="hcard"><h3>${L(ok("Fix next time", "صلّحه المرة الجاية"))}</h3><ul>${(fix.length ? fix : [ok("Nothing! Try the next level.", "ولا حاجة! جرّب المستوى اللي بعده.")]).slice(0, 6).map(x => `<li>${L(x)}</li>`).join("")}</ul></div></div>
    ${R.stars >= 1 ? `<div class="hcard cert"><h3>🎓 ${L(ok("Your team certificate", "شهادة التيم"))}</h3><p class="psub">${L(ok("Write your names and download a certificate for this level.", "اكتبوا أساميكم ونزّلوا شهادة المستوى ده."))}</p>
      <div class="row"><input type="text" id="certnames" maxlength="160" value="${esc(LB.mode === "online" ? LB.players.map(p => p.name).join(", ") : (A.certNames || ""))}" placeholder="${L(ok("Team member names", "أسامي أعضاء التيم"))}"><button class="hbtn" type="button" data-act="cert">⬇ ${L(ok("Download certificate", "نزّل الشهادة"))}</button></div></div>` : ""}
    <div class="hcard fact"><h3>${L(ok("The real mission", "المهمة الحقيقية"))}: ${esc(m.real.name)}</h3><p>${L(m.real.facts)}</p>
      <p class="psub"><b>${L(ok("The real mission chose", "المهمة الحقيقية اختارت"))}:</b> ${L(m.real.picks)}<br><b>${L(ok("Your team chose", "التيم بتاعك اختار"))}:</b> ${esc(mine)}</p>
      ${m.real.photos ? `<div class="realgal">${m.real.photos.map(([id, cap]) => `<figure><img src="img/real/${id}.jpg" alt="" loading="lazy"><figcaption>${L(cap)} <span class="psub">· NASA</span></figcaption></figure>`).join("")}</div>` : ""}
      <p class="psub">${L(ok("Sources", "المصادر"))}: ${m.real.links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(" · ")} · <a href="https://nasa.github.io/mission-viz/" target="_blank" rel="noopener">NASA Mission Viz</a></p></div>
    ${LB.level < 4 ? `<p class="needline">${R.stars >= 1 ? `🔓 ${L(ok("Next level unlocked! You need at least 1 star to move on. Come back any time for 3 stars.", "المستوى اللي بعده اتفتح! محتاج نجمة واحدة على الأقل علشان تكمّل، وتقدر ترجع في أي وقت علشان الـ 3 نجوم."))}` : `🔒 ${L(ok("Get at least 1 star to unlock the next level: the spacecraft must work and meet at least one need.", "محتاج نجمة واحدة على الأقل علشان المستوى اللي بعده يتفتح: المركبة لازم تشتغل وتحقق طلب واحد على الأقل."))}`}</p>` : ""}
    <div class="row">${LB.mode === "online" ? `<button class="hbtn" type="button" data-act="oagain">🔁 ${L(ok("Back to the room (next game)", "ارجع للغرفة (الجولة الجاية)"))}</button><button class="hbtn ghost" type="button" data-act="oleave">🚪 ${L(ok("Leave this room", "اخرج من الغرفة دي"))}</button>` : ""}${LB.mode !== "online" && LB.level < 4 && R.stars >= 1 ? `<button class="hbtn" type="button" data-act="nextlvl">${L(ok("Next level", "المستوى اللي بعده"))} → CML ${LB.level + 1}</button>` : ""}<button class="hbtn ${R.stars >= 1 && LB.level < 4 ? "ghost" : ""}" type="button" data-act="redesign">${L(ok("Change the design and fly again", "غيّر التصميم وطير تاني"))}</button>${LB.mode === "online" ? "" : `<button class="hbtn ghost" type="button" data-go="llevel">${L(ok("Levels", "المستويات"))}</button>`}</div></section>`;
}
Object.assign(SIMPLE, { lhome, llocal, llevel, lonline, lroom, lvideo, ldesign, lfly, lusers, lreport });
Object.assign(SIMPLE_AFTER, {
  lhome() { const cv = $("#holoHome"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel("landsat8"); },
  lonline() { onlineAvailable().then(okk => { const el = $("#olstat"); if (!el) return; el.innerHTML = okk ? L(ok("Connected. Write your name, then create or join a room.", "متوصل. اكتب اسمك، وبعدين اعمل غرفة أو ادخل واحدة.")) : L(ok("Online play can't connect here. Open the public game link (GitHub Pages), or play on one computer.", "اللعب الأونلاين مش قادر يتوصل هنا. افتح لينك اللعبة العام (GitHub Pages)، أو العبوا على جهاز واحد.")); if (!okk) document.querySelectorAll("[data-act=ocreate],[data-act=ojoin]").forEach(b => b.disabled = true); }); },
  lroom() { lChatPaint(); },
  lvideo() { clearInterval(LB.vt); if (LB.mode === "online" && LB.room && LB.room.state.videoAt && LB.level > 1) { const lim = 7 * 60000, end = LB.room.state.videoAt + lim;
      const tick = () => { const el = $("#vtimer"); if (A.screen !== "lvideo") return clearInterval(LB.vt); const ms = end - Date.now(); if (ms <= 0) { clearInterval(LB.vt); myData({ watched: true }); lStartDesign(); return; } if (el) el.textContent = Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0"); };
      tick(); LB.vt = setInterval(tick, 1000); }
    const v = $("#brief"); const list = lVideoList(), r = list[Math.min(LB.vi || 0, list.length - 1)]; if (v) v.onended = () => { LB.watched[LM().id + r] = true; const b = $("#vnext"); if (b) b.disabled = false; }; },
  ldesign() { const cv = $("#holoBuild"); holoL = Space3D.ok && cv ? Space3D.createHolo(cv) : null; lHolo(); lChatPaint(); },
  lreport() { const cv = $("#holoRes"); if (!Space3D.ok || !cv || !LB.flight) return; const h = Space3D.createHolo(cv); h && h.setModel(LB.flight.m.model); }
});
function lStartDesign() { LB.tab = myRoles()[0] || "science"; LB.revealed = null; go("ldesign"); }
function lClick(t) {
  const a = t.dataset.act;
  if (t.dataset.lmode) { if (LB.room && LB.me) { myData({ left: true, ready: false }); lLeave(); } LB.mode = t.dataset.lmode; LB.picks = {}; LB.reviews = 0; LB.rewatch = 0; LB.watched = {}; LB.localPlayers = LB.mode === "local" ? (LB.localPlayers || []) : []; go(LB.mode === "online" ? "lonline" : LB.mode === "local" ? "llocal" : "llevel"); return true; }
  if (a === "llocalgo") { LB.localPlayers = [...document.querySelectorAll(".lpname")].map(i => i.value.trim()).filter(Boolean).slice(0, 4); A.certNames = LB.localPlayers.join(", "); go("llevel"); return true; }
  if (t.dataset.llevel) { LB.level = +t.dataset.llevel; LB.vi = 0; LB.picks = {}; LB.reviews = 0; LB.rewatch = 0; LB.notes = ""; go("lvideo"); return true; }
  if (t.dataset.ltab) { LB.tab = t.dataset.ltab; render(); return true; }
  if (a === "ltabnext" || a === "ltabprev") { const i = TEAM_ROLES.indexOf(LB.tab) + (a === "ltabnext" ? 1 : -1); if (TEAM_ROLES[i]) { LB.tab = TEAM_ROLES[i]; LB.lastPart = null; render(); window.scrollTo({ top: 0 }); } return true; }
  if (t.dataset.lpick) { const [r, k, o] = t.dataset.lpick.split("."); if (LB.mode === "online" && lOrphan(r)) { const v = Object.assign({}, (LB.me.data && LB.me.data.rv) || {}); v[r + "." + k] = o; LB.me.data.rv = v; myData({ rv: v }); } else if (LB.mode === "online") { const p = Object.assign({}, (LB.me.data && LB.me.data.picks) || {}); p[r + "." + k] = o; LB.me.data.picks = p; myData({ picks: p, ready: false }); } else LB.picks[r + "." + k] = o; const dd = LM().decisions[r].find(x => x.k === k), oo = dd && dd.o.find(x => x.k === o); LB.lastPart = oo ? L(oo.n) : null; lPartial(); return true; }
  if (a === "vnext") { LB.vi = (LB.vi || 0) + 1; render(); return true; }
  if (a === "vdone") { if (LB.mode === "online") myData({ watched: true }); lStartDesign(); return true; }
  if (a === "rewatch") { LB.rewatch++; LB.vi = lVideoList().length - 1; go("lvideo"); return true; }
  if (a === "review") { const n = LB.mode === "online" ? (LB.room.state.reviews || 0) : LB.reviews; if (LB.mode === "online") roomState({ reviews: n + 1, lastReview: Date.now() }); else { LB.reviews = n + 1; LB.revealed = Date.now(); } const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); lPtsPaint(); return true; }
  if (a === "llaunch") { go("lfly"); lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return true; }
  if (a === "redesign") { lStartDesign(); return true; }
  if (a === "signin") { const sb = sbClient(); if (sb) sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } }).then(r => { if (r && r.error) alert(r.error.message); }); return true; }
  if (a === "signout") { const sb = sbClient(); if (sb) sb.auth.signOut().then(() => { A.user = null; render(); }); return true; }
  if (a === "cert") { A.certNames = $("#certnames").value; lCert(); return true; }
  if (a === "nextlvl") { if (LB.mode === "online") { go("llevel"); return true; } LB.level = Math.min(4, LB.level + 1); LB.vi = 0; LB.picks = {}; LB.reviews = 0; LB.rewatch = 0; LB.notes = ""; go("lvideo"); return true; }
  if (a === "oready") { myData({ ready: true }).then(() => { if (LB.players.every(p => p.data && (p.data.ready || p.id === LB.me.id))) roomState({ phase: "flight", at: Date.now() }); }); return true; }
  if (a === "ocreate" || a === "ojoin") { A.kickedMsg = false; const name = ($("#oname").value || "").trim(); const err = $("#oerr");
    if (!name) { err.textContent = L(ok("Write your name first.", "اكتب اسمك الأول.")); return true; } A.lastName = name;
    if (a === "ocreate") LB.level = +$("#olevel").value;
    (a === "ocreate" ? roomCreate(name, (document.querySelector("input[name=rmode]:checked") || {}).value) : roomJoin($("#ocode").value, name)).then(() => go("lroom")).catch(e => { err.textContent = e.message || String(e); }); return true; }
  if ((a === "ostart" || a === "ostartnow") && lBlocked(LB.level).length) return true;
  if (a === "ostart" || a === "ostartnow") { const at = Date.now(); LB.gameAt = at; LB.backInRoom = false; lResetGame(); roomState({ phase: "video", videoAt: at, reviews: 0, lastReview: null, extra: lPlanExtra() }).then(() => go("lvideo")); return true; }
  if (a === "oready0") { myData({ lobbyReady: !(LB.me.data && LB.me.data.lobbyReady) }).then(() => roomRefresh()); return true; }
  if (a === "olevel") { if (isHost() && !lBlocked(+t.dataset.n).length) { const n = +t.dataset.n; LB.level = n; sbClient().from("rooms").update({ level: n, mission: CML[n - 1].m }).eq("code", LB.room.code).then(() => roomRefresh()); } return true; }
  if (a === "oskipfly") { SEQ++; try { sessionStorage.setItem("ma.doneGame", String(LB.room.state.videoAt || LB.room.state.at)); } catch (e) { } const md = $("#modal"); if (md) md.innerHTML = ""; lResetGame(); LB.backInRoom = true; go("lroom"); return true; }
  if (a === "oagain") { lResetGame(); LB.backInRoom = true; go("lroom"); return true; }
  if (a === "omode") { if (isHost()) roomState({ roleMode: t.dataset.m }).then(() => render()); return true; }
  if (t.dataset.orole) { lSwitchRole(t.dataset.orole); return true; }
  if (a === "ocopy") { const c = LB.room ? LB.room.code : ""; try { navigator.clipboard.writeText(c).then(() => { t.textContent = L(ok("Copied!", "اتنسخ!")); }, () => { t.textContent = c; }); } catch (e) { t.textContent = c; } return true; }
  if (a === "olobby") { if (isHost()) { roomState({ phase: "lobby", lastReview: null, reviews: 0 }); lResetGame(); go("lroom"); } return true; }
  if (a === "oleave") { if (LB.me) myData({ left: true, ready: false }); lLeave(); go("lhome"); return true; }
  if (t.dataset.kick) { const x = LB.players.find(p => String(p.id) === t.dataset.kick); if (x && isHost() && confirm(L({ en: `Remove ${x.name} from the room?`, ar: `تطلّع ${x.name} من الغرفة؟` }))) { sbClient().from("players").update({ data: Object.assign({}, x.data, { left: true, kicked: true, ready: false }) }).eq("id", x.id).then(() => roomRefresh()); } return true; }
  return false;
}
document.addEventListener("submit", e => { if (e.target.id === "chatform") { e.preventDefault(); const i = $("#chatin"); sendChat(i.value); i.value = ""; } });
document.addEventListener("change", e => { if (e.target.id === "ula2") { A.unlockAll = e.target.checked; render(); } });
window.LB = LB; render(); applyLang(); lAuthInit();
(function lResume() { let s = null; try { s = JSON.parse(sessionStorage.getItem("ma.room") || "null"); } catch (e) { } if (!s || !s.code) return;
  if (!sbClient()) return; A.resumeMsg = s.code; LB.mode = "online"; go("lonline"); LB.vi = 0;
  roomJoin(s.code, s.name).then(() => { A.resumeMsg = null; const ph = LB.room.state.phase; if (ph === "lobby") go("lroom"); else if (ph === "video" && LB.me.data && LB.me.data.watched) lStartDesign(); })
    .catch(() => { A.resumeMsg = null; try { sessionStorage.removeItem("ma.room"); } catch (e) { } render(); }); })();
