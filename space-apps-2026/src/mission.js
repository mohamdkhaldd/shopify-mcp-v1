/* ===== MISSION LAB: a different mission per NASA Concept Maturity Level, teams on one device or online (Supabase) =====
   CML 1 Khamsin Storm Watch (words only) · CML 2 Moon landing map (coming next) · CML 3 Nile Delta Crop Watch (add up numbers) · CML 4 expert mode.
   Real facts are listed at the top of tts/scripts_storm.py and tts/scripts_delta.py; parts of our own satellite design are marked there. */
const SB_URL = "https://sruvvklwlixpzjyhhnit.supabase.co", SB_KEY = "sb_publishable_FPsD1Xy-KmR_CrrkSwIdnQ_TP92c6Zh";
const CREW = {
  director: { name: "Mohamed", title: { en: "Mission Director", ar: "مدير المهمة" }, img: "ctrl_2.jpg", col: "#ffc26b" },
  science: { name: "Ayat", title: { en: "Science Lead", ar: "رئيس العلماء" }, img: "crew_1.jpg", col: "#5fd8ff" },
  comms: { name: "Adham", title: { en: "Communications Lead", ar: "مسؤول الاتصالات" }, img: "crew_4.jpg", col: "#c79bff" },
  engineer: { name: "Abdelrahman", title: { en: "Spacecraft Engineer", ar: "مهندس المركبة" }, img: "crew_2.jpg", col: "#ffb35f" },
  planner: { name: "Ahmed", title: { en: "Mission Planner", ar: "مخطط المهمة" }, img: "ctrl_4.jpg", col: "#7dffb0" } };
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
  engine(c, base) { return { orbit: c.orb.geo ? "geo" : "polar", lv: "medium", antenna: c.ant.fast ? "large" : "small", instr: [c.cam.ir ? "thermal" : "cam_med"], power: c.pow.rtg ? "rtg1" : "solar", panel: 3 }; },
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
  real: { name: "Meteosat (EUMETSAT)", picks: ok("Infrared camera · fast antenna · solar panels · geostationary orbit", "كاميرا إنفرا ريد · أنتينا سريعة · سولار بانلز · أوربت جيوستيشنري"),
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
  engine(c) { return { orbit: "sso600", lv: c.rkt.lv || "medium", antenna: c.ant.eng || "medium", instr: [c.cam.instr || "multispec"], panel: (c.pan.supply || 2000) / 1000, shield: "light" }; },
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
  real: { name: "Landsat 8 (NASA + USGS)", picks: ok("OLI camera · about 10 a.m. · X-band · 705 km sun-synchronous orbit", "كاميرا OLI · حوالي الساعة 10 · X-band · أوربت 705 كم صن سينكرونس"),
    facts: ok("Your mission is the real Landsat 8. It has flown since 2013 at 705 km, crossing the equator at about 10 a.m. Its OLI camera sees near-infrared with 30 m pixels, and it sends data on X-band at 384 Mbit/s. (It launched on an Atlas V rocket.)", "مهمتك هي Landsat 8 الحقيقي. بيطير من 2013 على ارتفاع 705 كم، وبيعدّي خط الاستوا حوالي الساعة 10 الصبح. كاميرته OLI بتشوف النير إنفرا ريد ببيكسل 30 متر، وبيبعت الداتا على X-band بسرعة 384 ميجابت في الثانية. (واتطلق على صاروخ Atlas V.)"),
    links: [["USGS Landsat 8", "https://www.usgs.gov/landsat-missions/landsat-8"], ["NASA MODIS", "https://modis.gsfc.nasa.gov/about/specifications.php"], ["ESA Vega C", "https://www.esa.int/Enabling_Support/Space_Transportation/Vega/Vega_capabilities"]] }
};
const M_MOON = { id: "moon", soon: true, name: ok("Moon Landing Map", "خريطة الهبوط على القمر") };
const LAB_M = { storm: M_STORM, moon: M_MOON, delta: M_DELTA };
const CML = [
  { n: 1, m: "storm", t: ok("CML 1 · The idea", "CML 1 · الفكرة"), d: ok("Khamsin Storm Watch. One choice each, two options. Just words, no numbers.", "رادار الخماسين. كل واحد اختيار واحد من اتنين. كلام بس، مفيش أرقام.") },
  { n: 2, m: "moon", t: ok("CML 2 · Can it work?", "CML 2 · هل تنفع؟"), d: ok("Moon landing map. Compare each number with what is needed. Coming next.", "خريطة الهبوط على القمر. تقارن كل رقم باللي مطلوب. جاية قريب.") },
  { n: 3, m: "delta", t: ok("CML 3 · Add it up", "CML 3 · اجمع"), d: ok("Nile Delta Crop Watch. Add up watts and kilograms. Many designs work; the smartest wastes nothing.", "مراقب محاصيل الدلتا. اجمع الوات والكيلوهات. تصميمات كتير بتنجح، والأذكى اللي مبيضيّعش حاجة.") },
  { n: 4, m: null, t: ok("CML 4 · Every detail", "CML 4 · كل التفاصيل"), d: ok("Expert mode: every part and real number, for advanced players.", "وضع الخبراء: كل القطع والأرقام الحقيقية، للاعبين المتقدمين.") }];

/* ---- lab state ---- */
const LB = { mode: "solo", level: 1, room: null, me: null, myRole: null, picks: {}, reviews: 0, rewatch: 0, watched: {}, players: [], chat: [], online: false, sb: null, chan: null, flight: null, revealed: null, notes: "" };
const myId = (() => { try { let v = sessionStorage.getItem("ma.cid"); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("ma.cid", v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const lvl = () => CML[LB.level - 1];
const LM = () => LAB_M[lvl().m] || M_STORM;
const rolesInPlay = () => TEAM_ROLES;
const isHost = () => LB.mode === "online" && LB.room && LB.room.state.host === myId;
const myRoles = () => LB.mode !== "online" ? TEAM_ROLES : TEAM_ROLES.filter(r => r === LB.myRole || (isHost() && !LB.players.some(p => p.role === r)));
function allPicks() { if (LB.mode !== "online") return LB.picks; const p = {}; LB.players.forEach(pl => Object.assign(p, (pl.data && pl.data.picks) || {})); return p; }
function pickOpt(m, picks, role, k) { const d = (m.decisions[role] || []).find(x => x.k === k); const v = picks[role + "." + k]; return d && v ? d.o.find(o => o.k === v) : null; }
const lCompute = picks => LM().compute(picks);
const decisionsFor = roles => roles.flatMap(r => (LM().decisions[r] || []).map(d => ({ role: r, d })));
const allChosen = (picks, roles) => decisionsFor(roles).every(({ role, d }) => picks[role + "." + d.k]);
/* ---- Supabase (online rooms) ---- */
function sbClient() { if (LB.sb) return LB.sb; if (!window.supabase || !window.supabase.createClient) return null; LB.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }); return LB.sb; }
async function onlineAvailable() { const sb = sbClient(); if (!sb) return false; try { const { error } = await sb.from("rooms").select("code").limit(1); return !error; } catch (e) { return false; } }
const newCode = () => "SO-" + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
async function roomCreate(name, role) {
  const sb = sbClient(); const code = newCode();
  const { error } = await sb.from("rooms").insert({ code, mission: LM().id, level: LB.level, state: { phase: "lobby", host: myId, reviews: 0 } }); if (error) throw error;
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
      <div class="row"><button class="hbtn" type="button" data-lmode="solo">${L(ok("Play solo", "العب لوحدك"))}</button>
        <button class="hbtn ghost" type="button" data-lmode="local">${L(ok("Team on one computer", "تيم على جهاز واحد"))}</button>
        <button class="hbtn ghost" type="button" data-lmode="online">${L(ok("Online team (each on own laptop)", "تيم أونلاين (كل واحد على اللابتوب بتاعه)"))}</button></div></div>
    <div class="how">${[[1, ok("Watch your guide", "اتفرج على المرشد")], [2, ok("Write on the team board", "اكتب على السبورة")], [3, ok("Decide together", "قرروا مع بعض")], [4, ok("Launch and see who you helped", "اطلق وشوف ساعدت مين")]].map(([n, t]) => `<div><span>0${n}</span><b>${L(t)}</b></div>`).join("")}</div>
  </section>`;
}
const cmlDone = n => (A.progress.stars["cml" + n] || 0) >= 1;
function llevel() {
  return `<section class="hpanel notr"><div class="kick">${L(ok("Choose a level", "اختار المستوى"))}</div>
    <h2 class="hh">${L(ok("How mature is your mission idea?", "فكرة مهمتك ناضجة لحد فين؟"))}</h2>
    <p class="needline">${L(ok("NASA's JPL rates mission ideas with Concept Maturity Levels (CML). Each level here is a different mission, and each one is harder.", "معمل JPL بتاع ناسا بيقيّم أفكار المهمات بمستويات اسمها CML. هنا كل مستوى مهمة مختلفة، وكل واحدة أصعب من اللي قبلها."))}</p>
    <div class="planets">${CML.map(c => { const m = LAB_M[c.m]; const soon = m && m.soon; const locked = !soon && c.n > 1 && c.n < 4 && !A.unlockAll && !cmlDone(c.n === 3 ? 1 : c.n - 1);
      const st = A.progress.stars["cml" + c.n] || 0;
      return `<button class="pcard" type="button" data-llevel="${c.n}" ${locked || soon ? "disabled" : ""}><span class="cmlnum">CML ${c.n}</span><b>${L(c.t)}</b>${m ? `<span class="psub"><b>${L(m.name)}</b></span>` : ""}<span class="psub">${L(c.d)}</span>${st ? `<span class="pstars">${"★".repeat(st)}</span>` : ""}${soon ? `<span class="psub">⏳ ${L(ok("Coming next", "جاي قريب"))}</span>` : locked ? `<span class="psub">🔒 ${L(ok("Finish the level before", "خلّص المستوى اللي قبله"))}</span>` : ""}</button>`; }).join("")}</div>
    <label class="opt inline"><input type="checkbox" id="ula2" ${A.unlockAll ? "checked" : ""}> ${L(ok("Unlock all levels (judges and teachers)", "افتح كل المستويات (للحكام والمدرسين)"))}</label></section>`;
}
function lonline() {
  return `<section class="hpanel notr"><div class="kick">${L(ok("Online team", "تيم أونلاين"))}</div><h2 class="hh">${L(ok("Create or join a mission room", "اعمل أو ادخل غرفة مهمة"))}</h2>
    <div id="olstat" class="needline">${L(ok("Checking the connection…", "بنشيك على الاتصال…"))}</div>
    <div class="cols2"><div class="hcard"><h3>${L(ok("Your name", "اسمك"))}</h3><input type="text" id="oname" maxlength="24" value="${esc(A.lastName || "")}">
      <h3>${L(ok("Your role", "دورك"))}</h3><div class="rolepick">${TEAM_ROLES.map(r => `<label class="rolecard" style="--sc:${CREW[r].col}"><input type="radio" name="orole" value="${r}" ${r === "science" ? "checked" : ""}>${crewImg(r)}<b>${L(CREW[r].title)}</b><span>${L(ok("Guide", "المرشد"))}: ${CREW[r].name}</span></label>`).join("")}</div></div>
    <div class="hcard"><h3>${L(ok("Start a new room", "ابدأ غرفة جديدة"))}</h3><p class="psub">${L(ok("You choose the level. Share the code with your team.", "إنت اللي هتختار المستوى. ابعت الكود للتيم."))}</p>
      <select id="olevel">${CML.filter(c => c.m && !LAB_M[c.m].soon).map(c => `<option value="${c.n}" ${c.n === LB.level ? "selected" : ""}>${L(c.t)} · ${L(LAB_M[c.m].name)}</option>`).join("")}</select>
      <button class="hbtn" type="button" data-act="ocreate">${L(ok("Create room", "اعمل غرفة"))}</button>
      <h3>${L(ok("Or join with a code", "أو ادخل بكود"))}</h3><input type="text" id="ocode" maxlength="16" placeholder="SO-XXXX">
      <button class="hbtn ghost" type="button" data-act="ojoin">${L(ok("Join room", "ادخل الغرفة"))}</button><p class="bad" id="oerr"></p></div></div></section>`;
}
function lroom() {
  const host = LB.room.state.host === myId;
  return `<section class="hpanel notr"><div class="kick">${L(ok("Mission room", "غرفة المهمة"))} · ${L(lvl().t)} · ${L(LM().name)}</div>
    <h2 class="hh">${L(ok("Room code", "كود الغرفة"))}: <span class="code">${LB.room.code}</span></h2>
    <p class="needline">${L(ok("Send this code to your team. Each player joins from their own laptop and takes one role. The room creator also covers empty roles.", "ابعت الكود ده للتيم. كل لاعب يدخل من اللابتوب بتاعه وياخد دور. واللي عمل الغرفة بيمسك الأدوار الفاضية."))}</p>
    <div id="lroomlist" class="rolepick">${lRoomList()}</div>
    ${host ? `<button class="hbtn" type="button" data-act="ostart">${L(ok("Start the briefing for everyone", "ابدأ الشرح للكل"))}</button>` : `<p class="psub">${L(ok("Waiting for the room creator to start…", "مستنيين اللي عمل الغرفة يبدأ…"))}</p>`}
  </section>${lChatBox()}`;
}
function lRoomList() { return TEAM_ROLES.map(r => { const p = LB.players.find(x => x.role === r); return `<div class="rolecard ${p ? "taken" : ""}" style="--sc:${CREW[r].col}">${crewImg(r)}<b>${L(CREW[r].title)}</b><span>${p ? esc(p.name) + (p.data && p.data.cid === myId ? " (" + L(ok("you", "إنت")) + ")" : "") : L(ok("empty", "فاضي"))}</span></div>`; }).join(""); }
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
  return `<section class="hpanel notr"><div class="kick">${L(LM().name)} · ${L(ok("Briefing", "الشرح"))} ${i + 1}/${list.length}</div>
    <h2 class="hh">${CREW[r].name} · ${who}</h2>
    <p class="needline">${L(ok("Watch carefully and write on the team board. The cards later show names only.", "اتفرج كويس واكتب على السبورة، علشان الكروت بعد كده عليها أسامي بس."))}</p>
    <video id="brief" class="briefvid" src="video/${LM().id}_${r}.mp4" controls playsinline preload="auto"></video>
    <div class="row">${i < list.length - 1 ? `<button class="hbtn" type="button" data-act="vnext" id="vnext" ${LB.watched[LM().id + r] ? "" : "disabled"}>${L(ok("Next briefing", "الشرح اللي بعده"))}</button>`
      : `<button class="hbtn" type="button" data-act="vdone" id="vnext" ${LB.watched[LM().id + r] ? "" : "disabled"}>${L(ok("I'm ready to decide", "أنا جاهز أقرر"))}</button>`}
      <span class="psub">${L(ok("The button unlocks when the video ends.", "الزرار بيتفتح لما الفيديو يخلص."))}</span></div></section>${lBoard()}`;
}
function lCard(role, d, o, picks, mine) {
  const sel = picks[role + "." + d.k] === o.k;
  return `<button type="button" class="ccard ${sel ? "sel" : ""}" ${mine ? `data-lpick="${role}.${d.k}.${o.k}"` : "disabled"}><span class="cnum">${o.k}</span><span class="cicon">${sIcon(o.icon)}</span><b>${L(o.n)}</b></button>`;
}
function ldesign() {
  const picks = allPicks(), mine = myRoles(), m = LM();
  const tabs = TEAM_ROLES.map(r => `<button type="button" class="stp ${LB.tab === r ? "cur" : ""} ${decisionsFor([r]).every(({ role, d }) => picks[role + "." + d.k]) ? "done" : ""}" data-ltab="${r}" style="--sc:${CREW[r].col}"><span>${crewImg(r)}</span>${L(CREW[r].title)}</button>`).join("");
  const r = TEAM_ROLES.includes(LB.tab) ? LB.tab : (mine[0] || "science"); LB.tab = r; const canEdit = mine.includes(r);
  const reviews = LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews;
  return `<section class="build notr">
    <div class="buildhead"><div><div class="kick">${L(m.name)} · ${L(lvl().t)}</div>
      <div class="rulesrow">${m.rules.map(x => `<span class="rulechip">${L(x)}</span>`).join("")}</div>
      <div class="stepper">${tabs}</div></div></div>
    <div class="buildgrid"><div class="holowrap"><canvas id="holoBuild" class="holo"></canvas><div class="holotag">${L(ok("Your satellite", "القمر بتاعك"))}</div></div>
      <div class="choose"><div class="steptitle" style="--sc:${CREW[r].col}">${roleTag(r)}<span class="psub">${L(SEGMENT[r])} · ${L(ok("Guide", "المرشد"))}: ${CREW[r].name}</span></div>
        ${canEdit ? "" : `<p class="needline">${L(ok("This is a teammate's job. Talk to them in the chat.", "ده شغل حد تاني في التيم. كلّمه في الشات."))}</p>`}
        ${m.decisions[r].map(d => `<div class="dec"><h3>${L(d.t)}</h3><div class="cards3 ${d.o.length === 2 ? "two" : ""}">${d.o.map(o => lCard(r, d, o, picks, canEdit)).join("")}</div></div>`).join("")}
        <div class="nav2"><button class="hbtn ghost" type="button" data-act="rewatch">${L(ok("Rewatch my guide (−20 points)", "اتفرج على المرشد تاني (−20 نقطة)"))}</button></div></div></div>
    <div class="reviewbar"><button class="hbtn ghost" type="button" data-act="review">${L(ok("Design review", "مراجعة التصميم"))} ${reviews ? L(ok("(−30 points)", "(−30 نقطة)")) : L(ok("(first one free)", "(أول مرة ببلاش)"))}</button>
      ${lLaunchBtn(picks)}</div>
    <div id="reviewbox">${lReviewHtml()}</div>
  </section>${lBoard()}${lChatBox()}`;
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
  if (A.screen === "lroom") { const el = $("#lroomlist"); if (el) el.innerHTML = lRoomList(); return; }
  const bo = $("#boardOthers"); if (bo) bo.innerHTML = lBoardOthers();
  if (A.screen === "ldesign") { const picks = allPicks();
    document.querySelectorAll("[data-lpick]").forEach(b => { const [r, k, o] = b.dataset.lpick.split("."); b.classList.toggle("sel", picks[r + "." + k] === o); });
    document.querySelectorAll(".ccard[disabled]").forEach(b => { /* teammates' cards are shown via tabs */ });
    document.querySelectorAll(".stp[data-ltab]").forEach(b => b.classList.toggle("done", decisionsFor([b.dataset.ltab]).every(({ role, d }) => picks[role + "." + d.k])));
    const rb = document.querySelector(".reviewbar"); if (rb) rb.lastElementChild.outerHTML = lLaunchBtn(picks);
    const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); lHolo(); }
}
let holoL = null;
function lEngineDesign(c) { const m = LM(), base = MISSIONS.find(x => x.id === m.base); return { base, d: Object.assign(structuredClone(base.def), m.engine(c, base)) }; }
function lHolo() { if (!holoL) return; const c = lCompute(allPicks()); try { const { base, d } = lEngineDesign(c); holoL.setDesign(base, d, { dry: 400 }); } catch (e) { } }

/* ---- flight (3D engine with real NASA models) ---- */
function lfly() { return sfly(); }
function lSay(role, text) { const el = $("#subt"); if (el) { el.innerHTML = `<b style="color:${CREW[role].col}">${CREW[role].name}:</b> ${text}`; el.classList.add("on"); } }
async function lRunFlight() {
  SEQ++; const m = LM(), picks = allPicks(), c = lCompute(picks); const { base, d } = lEngineDesign(c);
  const F = LB.flight = { health: 100, sci: 1, cost: 0, events: [], lost: null, c, m };
  curP = 0; totalDays = m.days;
  if (Space3D.ok && $("#view3d")) { flightView = Space3D.createView($("#view3d"), {}); flightView.setMission(base, d, { dry: (c.mass || 1500), prop: 200 }); skyLoop(); }
  const marks = flightView ? flightView.marks() : { ascent: .12 }; ascentEnd = marks.ascent || .12;
  lSay("planner", L(ok("Three, two, one... liftoff!", "تلاتة، اتنين، واحد... انطلقنا!"))); await wait(2600); setPhase(L(ok("LIFTOFF", "الإطلاق")));
  if (c.fatal === "mass") { await animTo(.045, 3500); flightView && flightView.flag("fall"); F.lost = { en: `The ${c.rkt.n.en} could not lift a ${nf(Math.round(c.mass))} kg satellite. It ran out of fuel before space and fell into the ocean.`, ar: `صاروخ ${c.rkt.n.ar} مقدرش يشيل قمر وزنه ${nf(Math.round(c.mass))} كيلو. الوقود خلص قبل ما يوصل الفضاء ووقع في المحيط.` }; lSay("planner", L(F.lost)); await wait(4500); return lFinish(F); }
  await animTo(ascentEnd, 6500); flightView && flightView.flag("separated"); setPhase(L(ok("IN ORBIT", "في الأوربت")));
  lSay("engineer", L(ok("We are in orbit! Opening the solar panels.", "إحنا في الأوربت! بنفتح السولار بانلز."))); await wait(2400);
  if (c.fatal === "power") { await animTo(ascentEnd + .03, 2500); flightView && flightView.flag("tumble"); F.lost = { en: `The satellite needed ${nf(c.need)} W, but the panel made only ${nf(c.supply)} W. It went silent.`, ar: `القمر كان محتاج ${nf(c.need)} وات، والبانل كان بيطلّع ${nf(c.supply)} بس، فالقمر سكت.` }; lSay("engineer", L(F.lost)); await wait(4500); return lFinish(F); }
  if (c.bat && c.bat.min < 35) { lSay("engineer", L(ok("First shadow... the battery is empty before sunrise. We shut down every orbit.", "أول ضل... البطارية فضيت قبل الشمس ما تطلع، فهنطفي في كل لفة."))); await wait(3500); }
  await animTo(.5, 5000); for (let i = 0; i < m.events.length; i++) { await lEvent(i, F); await animTo(.5 + (i + 1) * (.45 / m.events.length), 3500); }
  lSay("comms", L(ok("Five years later... the mission is complete.", "بعد 5 سنين... المهمة خلصت."))); setPhase(L(ok("MISSION COMPLETE", "المهمة خلصت"))); await animTo(1, 2500); await wait(1500);
  return lFinish(F);
}
function lEvent(i, F) {
  const e = F.m.events[i];
  return new Promise(res => {
    const el = $("#modal"); lSay(e.role, L(e.x)); LB.evRes = res; LB.evI = i;
    const online = LB.mode === "online";
    el.innerHTML = `<div class="overlay notr" role="dialog" aria-modal="true"><div class="hmodal">
      <div class="evhead">${crewImg(e.role)}<div><div class="kick">${L(ok("Surprise!", "مفاجأة!"))} · ${CREW[e.role].name}</div><h2 class="hh">${L(e.t)}</h2></div></div>
      <p class="evx">${L(e.x)}</p><p class="evq">${online ? L(ok("Everyone votes. The most votes wins.", "الكل يصوّت، والأكتر أصوات يكسب.")) : L(ok("Talk with the team, then choose.", "اتكلموا مع بعض، وبعدين اختاروا."))}</p>
      <div class="cards3 ${e.o.length === 2 ? "two" : ""}">${e.o.map((o, j) => `<button type="button" class="ccard" data-lev="${j}"><span class="cnum">${"ABC"[j]}</span><b>${L(o.t)}</b></button>`).join("")}</div><p class="psub" id="votes"></p></div></div>`;
    el.querySelectorAll("[data-lev]").forEach(b => b.onclick = async () => { const j = +b.dataset.lev;
      if (online) { el.querySelectorAll("[data-lev]").forEach(x => x.classList.toggle("sel", x === b)); const v = Object.assign({}, LB.me.data.votes || {}); v[i] = j; await myData({ votes: v }); lVoteCheck(); }
      else lEventResolve(j, F); });
    if (online) lVoteCheck();
  });
}
function lVoteCheck() {
  const i = LB.evI; if (i == null || !LB.evRes || LB.mode !== "online" || !LB.flight) return; const votes = LB.players.map(p => p.data && p.data.votes ? p.data.votes[i] : undefined).filter(v => v !== undefined);
  const vt = $("#votes"); if (vt) vt.textContent = `${L(ok("Votes", "الأصوات"))}: ${votes.length} / ${LB.players.length}`;
  if (votes.length >= LB.players.length) { const n = LB.flight.m.events[i].o.length, cnt = Array(n).fill(0); votes.forEach(v => cnt[v]++); const lead = LB.players.find(p => p.role === LB.flight.m.events[i].role); const lv = lead && lead.data.votes ? lead.data.votes[i] : 0; const max = Math.max(...cnt); lEventResolve(cnt[lv] === max ? lv : cnt.indexOf(max), LB.flight); }
}
function lEventResolve(j, F) {
  const i = LB.evI, e = F.m.events[i], r = e.o[j].f(F.c), res = LB.evRes; if (!res) return; LB.evRes = null;
  F.health = Math.max(5, F.health + r.h); F.sci *= 1 + r.sci; F.cost += r.cost || 0; setHealth(F.health); F.events.push({ e, j, r });
  const el = $("#modal"), good = !r.h && !r.sci;
  el.querySelector(".hmodal").innerHTML = `<div class="evhead">${crewImg(e.role)}<div><div class="kick">${L(e.t)} · ${L(ok("the team chose", "التيم اختار"))} ${"ABC"[j]}</div><h2 class="hh">${good ? L(ok("Good call!", "قرار صح!")) : L(ok("Here's what happened", "ده اللي حصل"))}</h2></div></div>
    <p class="evx">${L(r.w)}</p><div class="row"><button class="hbtn" type="button" id="levok">${L(ok("Continue", "كمّل"))}</button></div>`;
  lSay(e.role, L(r.w)); $("#levok").onclick = () => { el.innerHTML = ""; res(); };
}
function lFinish(F) {
  const c = F.c, m = F.m, alive = !F.lost, rules = c.rules, nR = m.rules.length, met = Object.values(rules).filter(Boolean).length;
  let stars = alive ? 1 : 0; if (alive && met === nR) stars = 2; if (stars === 2 && F.health >= 70 && c.clean && c.efficient) stars = 3;
  const reviews = LB.mode === "online" ? LB.room.state.reviews || 0 : LB.reviews;
  const parts = { success: alive ? 300 : 0, rules: alive ? Math.round(met * 300 / nR) : 0, efficiency: alive ? Math.max(0, 200 - c.waste.length * 70) : 0, health: alive ? Math.round(F.health) : 0, cleanup: alive && c.clean ? 100 : 0, penalties: -(Math.max(0, reviews - 1) * 30 + LB.rewatch * 20 + Math.round(F.cost * 10)) };
  const total = Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0));
  F.result = { alive, rules, met, nR, stars, parts, total, sciPct: alive ? Math.round(Math.min(1, c.sci * F.sci * (F.health / 100)) * 100) : 0 };
  if (alive) { const k = "cml" + LB.level; A.progress.stars[k] = Math.max(A.progress.stars[k] || 0, stars); store.set("ma.progress3", A.progress); }
  setTimeout(() => { if (A.screen === "lfly" && LB.flight === F) go("lusers"); }, 800);
}
function lusers() {
  const F = LB.flight; if (!F || !F.result) return lhome(); const R = F.result;
  const msg = !R.alive ? ok("The satellite never sent any data. Nobody on Earth was helped.", "القمر الصناعي مبعتش أي داتا، ومحدش على الأرض استفاد.") : F.m.userMsg(R);
  return `<section class="hpanel notr result"><div class="kick">${L(ok("User segment", "جزء المستخدمين"))} · ${L(ok("who used your data?", "مين استخدم الداتا بتاعتك؟"))}</div>
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
  return `<section class="hpanel notr result"><div class="kick">${L(ok("Mission report", "تقرير المهمة"))} · ${L(lvl().t)} · ${L(m.name)}</div>
    <div class="resgrid"><div><div class="bigstars">${"★".repeat(R.stars)}<span>${"★".repeat(3 - R.stars)}</span></div>
      <h2 class="hh">${R.alive ? L(ok("Mission complete", "المهمة نجحت")) : L(ok("Mission lost", "المهمة فشلت"))} · ${R.total} ${L(ok("points", "نقطة"))}</h2>
      <p class="sciline">${L(ok("Needs met", "الطلبات المتحققة"))}: <b>${R.met}/${R.nR}</b> · ${L(ok("Health", "الصحة"))}: <b>${Math.round(F.health)}%</b>${c.mass ? ` · ${L(ok("Mass", "الوزن"))}: <b>${nf(Math.round(c.mass))} kg</b> · ${L(ok("Power", "الكهربا"))}: <b>${nf(c.need)} / ${nf(c.supply)} W</b>` : ""}</p>
      <ul class="starkey"><li class="${R.stars >= 1 ? "on" : ""}">★ ${L(ok("The satellite reached orbit and worked", "القمر وصل الأوربت واشتغل"))}</li><li class="${R.stars >= 2 ? "on" : ""}">★ ${L(ok("Every need was met", "كل الطلبات اتحققت"))}</li><li class="${R.stars >= 3 ? "on" : ""}">★ ${L(ok("Nothing wasted, healthy, clean end", "مفيش تضييع، وصحة كويسة، ونهاية نضيفة"))}</li></ul>
      <p class="psub">${L(ok("Points", "النقط"))}: ${Object.entries(R.parts).map(([k, v]) => `${k} ${v}`).join(" · ")}</p></div>
    <div class="resholo"><canvas id="holoRes" class="holo"></canvas><div class="holotag">NASA 3D model · ${m.model === "goes" ? "GOES" : "Landsat 8"}</div></div></div>
    <div class="cols2"><div class="hcard"><h3>${L(ok("What you did well", "اللي عملته صح"))}</h3><ul>${(good.length ? good : [ok("You tried. Every NASA team learns from its first design.", "إنت جرّبت، وكل تيم في ناسا بيتعلم من أول تصميم.")]).slice(0, 6).map(x => `<li>${L(x)}</li>`).join("")}</ul></div>
      <div class="hcard"><h3>${L(ok("Fix next time", "صلّحه المرة الجاية"))}</h3><ul>${(fix.length ? fix : [ok("Nothing! Try the next level.", "ولا حاجة! جرّب المستوى اللي بعده.")]).slice(0, 6).map(x => `<li>${L(x)}</li>`).join("")}</ul></div></div>
    <div class="hcard fact"><h3>${L(ok("The real mission", "المهمة الحقيقية"))}: ${esc(m.real.name)}</h3><p>${L(m.real.facts)}</p>
      <p class="psub"><b>${L(ok("The real mission chose", "المهمة الحقيقية اختارت"))}:</b> ${L(m.real.picks)}<br><b>${L(ok("Your team chose", "التيم بتاعك اختار"))}:</b> ${esc(mine)}</p>
      <p class="psub">${L(ok("Sources", "المصادر"))}: ${m.real.links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(" · ")} · <a href="https://nasa.github.io/mission-viz/" target="_blank" rel="noopener">NASA Mission Viz</a></p></div>
    <div class="row"><button class="hbtn" type="button" data-act="redesign">${L(ok("Change the design and fly again", "غيّر التصميم وطير تاني"))}</button><button class="hbtn ghost" type="button" data-go="llevel">${L(ok("Levels", "المستويات"))}</button></div></section>`;
}
Object.assign(SIMPLE, { lhome, llevel, lonline, lroom, lvideo, ldesign, lfly, lusers, lreport });
Object.assign(SIMPLE_AFTER, {
  lhome() { const cv = $("#holoHome"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel("landsat8"); },
  lonline() { onlineAvailable().then(okk => { const el = $("#olstat"); if (!el) return; el.innerHTML = okk ? L(ok("Connected. Choose your name and role.", "متوصل. اختار اسمك ودورك.")) : L(ok("Online play can't connect here. Open the public game link (GitHub Pages), or play on one computer.", "اللعب الأونلاين مش قادر يتوصل هنا. افتح لينك اللعبة العام (GitHub Pages)، أو العبوا على جهاز واحد.")); if (!okk) document.querySelectorAll("[data-act=ocreate],[data-act=ojoin]").forEach(b => b.disabled = true); }); },
  lroom() { lChatPaint(); },
  lvideo() { const v = $("#brief"); const list = lVideoList(), r = list[Math.min(LB.vi || 0, list.length - 1)]; if (v) v.onended = () => { LB.watched[LM().id + r] = true; const b = $("#vnext"); if (b) b.disabled = false; }; },
  ldesign() { const cv = $("#holoBuild"); holoL = Space3D.ok && cv ? Space3D.createHolo(cv) : null; lHolo(); lChatPaint(); },
  lreport() { const cv = $("#holoRes"); if (!Space3D.ok || !cv || !LB.flight) return; const h = Space3D.createHolo(cv); h && h.setModel(LB.flight.m.model); }
});
function lStartDesign() { LB.tab = myRoles()[0] || "science"; LB.revealed = null; go("ldesign"); }
function lClick(t) {
  const a = t.dataset.act;
  if (t.dataset.lmode) { LB.mode = t.dataset.lmode; LB.picks = {}; LB.reviews = 0; LB.rewatch = 0; LB.watched = {}; go(LB.mode === "online" ? "lonline" : "llevel"); return true; }
  if (t.dataset.llevel) { LB.level = +t.dataset.llevel; if (LB.level === 4) { A.simple = false; go("home"); return true; } LB.vi = 0; LB.picks = {}; LB.reviews = 0; LB.rewatch = 0; LB.notes = ""; go("lvideo"); return true; }
  if (t.dataset.ltab) { LB.tab = t.dataset.ltab; render(); return true; }
  if (t.dataset.lpick) { const [r, k, o] = t.dataset.lpick.split("."); if (LB.mode === "online") { const p = Object.assign({}, (LB.me.data && LB.me.data.picks) || {}); p[r + "." + k] = o; LB.me.data.picks = p; myData({ picks: p, ready: false }); } else LB.picks[r + "." + k] = o; lPartial(); return true; }
  if (a === "vnext") { LB.vi = (LB.vi || 0) + 1; render(); return true; }
  if (a === "vdone") { if (LB.mode === "online") myData({ watched: true }); lStartDesign(); return true; }
  if (a === "rewatch") { LB.rewatch++; LB.vi = lVideoList().length - 1; go("lvideo"); return true; }
  if (a === "review") { const n = LB.mode === "online" ? (LB.room.state.reviews || 0) : LB.reviews; if (LB.mode === "online") roomState({ reviews: n + 1, lastReview: Date.now() }); else { LB.reviews = n + 1; LB.revealed = Date.now(); } const box = $("#reviewbox"); if (box) box.innerHTML = lReviewHtml(); return true; }
  if (a === "llaunch") { go("lfly"); lRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return true; }
  if (a === "redesign") { lStartDesign(); return true; }
  if (a === "oready") { myData({ ready: true }).then(() => { if (LB.players.every(p => p.data && (p.data.ready || p.id === LB.me.id))) roomState({ phase: "flight", at: Date.now() }); }); return true; }
  if (a === "ocreate" || a === "ojoin") { const name = ($("#oname").value || "").trim(); const role = (document.querySelector("input[name=orole]:checked") || {}).value; const err = $("#oerr");
    if (!name) { err.textContent = L(ok("Write your name first.", "اكتب اسمك الأول.")); return true; } A.lastName = name;
    if (a === "ocreate") LB.level = +$("#olevel").value;
    (a === "ocreate" ? roomCreate(name, role) : roomJoin($("#ocode").value, name, role)).then(() => go("lroom")).catch(e => { err.textContent = e.message || String(e); }); return true; }
  if (a === "ostart") { roomState({ phase: "video" }); return true; }
  return false;
}
document.addEventListener("submit", e => { if (e.target.id === "chatform") { e.preventDefault(); const i = $("#chatin"); sendChat(i.value); i.value = ""; } });
document.addEventListener("change", e => { if (e.target.id === "ula2") { A.unlockAll = e.target.checked; render(); } });
window.LB = LB; render(); applyLang();
