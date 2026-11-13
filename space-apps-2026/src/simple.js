/* ===== CADET MODE: the easy game for people who know nothing about space yet =====
   4 rings (Mass, Power, Money, Data) · 4 choices (one per role) · 3 cards each · 2 surprises · stars. */
const L = o => (o && typeof o === "object") ? (LANG === "ar" ? o.ar : o.en) : o;
const RINGS = [
  { k: "mass", n: { en: "Mass", ar: "الوزن" }, q: { en: "Can the rocket lift it?", ar: "الصاروخ يقدر يشيله؟" }, c: "#5fd8ff" },
  { k: "power", n: { en: "Power", ar: "الكهربا" }, q: { en: "Is there enough electricity?", ar: "الكهربا مكفية؟" }, c: "#7dffb0" },
  { k: "money", n: { en: "Money", ar: "الفلوس" }, q: { en: "Is it within the budget?", ar: "في حدود الميزانية؟" }, c: "#ffc26b" },
  { k: "data", n: { en: "Data", ar: "الداتا" }, q: { en: "Can the pictures reach Earth?", ar: "الصور هتوصل الأرض؟" }, c: "#c79bff" }];
const STEP_ORDER = [
  { k: "science", role: "science", t: { en: "1. What do we want to discover?", ar: "1. عايزين نكتشف إيه؟" } },
  { k: "comms", role: "comms", t: { en: "2. How do we send the results home?", ar: "2. هنبعت النتايج للأرض إزاي؟" } },
  { k: "power", role: "engineer", t: { en: "3. Where does the electricity come from?", ar: "3. الكهربا هتيجي منين؟" } },
  { k: "rocket", role: "planner", t: { en: "4. Which rocket can carry it all?", ar: "4. أنهي صاروخ هيشيل كل ده؟" } }];
const ROLE_AR = { planner: "مخطط المهمة", engineer: "مهندس المركبة", science: "رئيس العلماء", comms: "مسؤول الاتصالات" };
const roleName = r => LANG === "ar" ? ROLE_AR[r] : ROLES[r].name;
const ROLE_COL = { planner: "#7dffb0", engineer: "#ffb35f", science: "#5fd8ff", comms: "#c79bff" };

const PANELS = (sm, md, lg, cost = [5, 10, 18]) => [
  { k: "p1", icon: "panel1", n: { en: "Small solar panels", ar: "ألواح شمسية صغيرة" }, d: { en: "Light and cheap, but little power.", ar: "خفيفة ورخيصة، بس كهربا قليلة." }, supply: sm, mass: 1, cost: cost[0], panel: 2 },
  { k: "p2", icon: "panel2", n: { en: "Medium solar panels", ar: "ألواح شمسية متوسطة" }, d: { en: "A good balance.", ar: "توازن كويس." }, supply: md, mass: 2, cost: cost[1], panel: 6 },
  { k: "p3", icon: "panel3", n: { en: "Big solar panels", ar: "ألواح شمسية كبيرة" }, d: { en: "Lots of power, but heavy.", ar: "كهربا كتير، بس تقيلة." }, supply: lg, mass: 4, cost: cost[2], panel: 14 }];
const ROCKETS = (l, c) => [
  { k: "r1", icon: "rocket1", lv: "small", n: { en: "Small rocket", ar: "صاروخ صغير" }, d: { en: "Cheap, lifts very little.", ar: "رخيص، بيشيل قليل جداً." }, lift: l[0], cost: c[0] },
  { k: "r2", icon: "rocket2", lv: "medium", n: { en: "Medium rocket", ar: "صاروخ متوسط" }, d: { en: "The everyday workhorse.", ar: "الصاروخ الأساسي." }, lift: l[1], cost: c[1] },
  { k: "r3", icon: "rocket3", lv: "heavy", n: { en: "Big rocket", ar: "صاروخ كبير" }, d: { en: "Lifts a lot, costs a lot.", ar: "بيشيل كتير، وغالي كتير." }, lift: l[2], cost: c[2] }];
const ANTENNAS = (caps) => [
  { k: "a1", icon: "dish1", ant: "small", n: { en: "Small antenna", ar: "هوائي صغير" }, d: { en: "Light, sends slowly.", ar: "خفيف، وبيبعت ببطء." }, cap: caps[0], mass: 1, power: 1, cost: 5 },
  { k: "a2", icon: "dish2", ant: "medium", n: { en: "Medium dish", ar: "طبق متوسط" }, d: { en: "Sends a good amount.", ar: "بيبعت كمية كويسة." }, cap: caps[1], mass: 1, power: 2, cost: 10 },
  { k: "a3", icon: "dish3", ant: "large", n: { en: "Big dish", ar: "طبق كبير" }, d: { en: "Sends a lot, heavy, needs power.", ar: "بيبعت كتير، تقيل، وعايز كهربا." }, cap: caps[2], mass: 2, power: 3, cost: 20 }];

const S_MISSIONS = [
 { id: "earth", base: "delta", orbit: "sso600", planet: "earth_atmos_2048.jpg", lvl: 1, model: "landsat8",
   name: { en: "Watch Egypt's farms", ar: "راقب مزارع مصر" },
   sub: { en: "A satellite in orbit around Earth", ar: "قمر صناعي بيلف حوالين الأرض" },
   goal: { en: "Build a satellite that can tell healthy crops from thirsty ones in the Nile Delta.", ar: "ابني قمر صناعي يقدر يعرف الزرع السليم من الزرع العطشان في دلتا النيل." },
   budget: 100, baseMass: 2, basePower: 1,
   tips: { rocket: { en: "The rocket must lift everything you build. A bigger rocket lifts more, but costs more.", ar: "الصاروخ لازم يشيل كل اللي هتبنيه. الصاروخ الأكبر بيشيل أكتر، بس أغلى." },
           power: { en: "Solar panels turn sunlight into electricity. Every part of the satellite needs some.", ar: "الألواح الشمسية بتحوّل نور الشمس لكهربا. وكل جزء في القمر الصناعي محتاج كهربا." },
           science: { en: "This is why we're going! Pick the tool that can answer the mission question.", ar: "ده سبب الرحلة كلها! اختار الجهاز اللي يقدر يجاوب على سؤال المهمة." },
           comms: { en: "Pictures are useless if they stay in space. The antenna sends them home.", ar: "الصور ملهاش لازمة لو فضلت في الفضاء. الهوائي هو اللي بيبعتها للأرض." } },
   steps: {
     rocket: ROCKETS([5, 9, 15], [10, 25, 45]),
     power: PANELS(3, 6, 10),
     science: [
       { k: "s1", icon: "cam1", instr: "cam_med", n: { en: "Normal camera", ar: "كاميرا عادية" }, d: { en: "Takes nice pictures, but can't see plant health.", ar: "بتصوّر صور حلوة، بس مش بتشوف صحة النبات." }, mass: 1, power: 1, cost: 10, data: 2, sci: 1 },
       { k: "s2", icon: "leaf", instr: "multispec", star: true, n: { en: "Plant-health camera", ar: "كاميرا صحة النبات" }, d: { en: "Sees infrared light: healthy plants glow in it.", ar: "بتشوف الأشعة تحت الحمرا: النبات السليم بينوّر فيها." }, mass: 2, power: 2, cost: 20, data: 5, sci: 3 },
       { k: "s3", icon: "cam3", instr: "cam_high", n: { en: "Super-sharp camera", ar: "كاميرا حادة جداً" }, d: { en: "You can see cars! But still not plant health.", ar: "تقدر تشوف العربيات! بس برضه مش بتشوف صحة النبات." }, mass: 4, power: 4, cost: 40, data: 10, sci: 2 }],
     comms: ANTENNAS([3, 6, 12]) },
   events: ["shadow", "storm"],
   fact: { en: "The real Landsat 8 photographs every place on Earth every 16 days. Its infrared cameras show farmers which fields are healthy.", ar: "القمر الحقيقي Landsat 8 بيصوّر كل مكان على الأرض كل 16 يوم، وكاميراته بالأشعة تحت الحمرا بتوري الفلاحين أنهي أرض سليمة." } },
 { id: "moon", base: "moon", orbit: "polar100", planet: "moon_1024.jpg", lvl: 2, model: "lro",
   name: { en: "Find ice on the Moon", ar: "دوّر على تلج في القمر" },
   sub: { en: "A spacecraft in orbit around the Moon", ar: "مركبة بتلف حوالين القمر" },
   goal: { en: "Some craters at the Moon's poles are always dark and freezing. Find out if water ice is hiding there.", ar: "فيه حفر عند قطبي القمر ضلمة وساقعة على طول. اعرف إذا كان فيها تلج مية مستخبي." },
   budget: 150, baseMass: 4, basePower: 1,
   tips: { rocket: { en: "The Moon is far, so rockets lift less there. Your spacecraft also carries fuel to brake and stop at the Moon.", ar: "القمر بعيد، فالصواريخ بتشيل أقل. ومركبتك كمان شايلة وقود علشان تفرمل وتقف عند القمر." },
           power: { en: "Sunlight at the Moon is as strong as at Earth, but you pass through darkness every orbit.", ar: "الشمس عند القمر قوية زي الأرض، بس بتعدي في ضلمة كل لفة." },
           science: { en: "A camera can't see inside craters that never get sunlight. What can find ice in the dark?", ar: "الكاميرا مش هتشوف جوه حفر عمرها ما شافت الشمس. إيه اللي يقدر يلاقي تلج في الضلمة؟" },
           comms: { en: "The Moon is 1,000 times farther than a normal satellite, so signals arrive much weaker.", ar: "القمر أبعد ألف مرة من القمر الصناعي العادي، فالإشارة بتوصل أضعف بكتير." } },
   steps: {
     rocket: ROCKETS([3, 7, 13], [15, 35, 60]),
     power: PANELS(3, 6, 10),
     science: [
       { k: "s1", icon: "cam1", instr: "cam_high", n: { en: "Camera", ar: "كاميرا" }, d: { en: "Great pictures of the surface, but sees nothing in the dark.", ar: "صور حلوة للسطح، بس مش بتشوف حاجة في الضلمة." }, mass: 1, power: 1, cost: 15, data: 3, sci: 1 },
       { k: "s2", icon: "ice", instr: "neutron", star: true, n: { en: "Ice detector", ar: "كاشف التلج" }, d: { en: "Senses hydrogen (part of water) in the soil, even in total darkness.", ar: "بيحس بالهيدروجين (جزء من المية) في التربة، حتى في الضلمة الكاملة." }, mass: 2, power: 2, cost: 25, data: 1, sci: 3 },
       { k: "s3", icon: "radar", instr: "radar_s", n: { en: "Radar", ar: "رادار" }, d: { en: "Sees under the surface, but heavy and power-hungry.", ar: "بيشوف تحت السطح، بس تقيل وبياكل كهربا كتير." }, mass: 3, power: 4, cost: 35, data: 4, sci: 2 }],
     comms: ANTENNAS([1, 3, 6]) },
   events: ["farside", "pebbles"],
   fact: { en: "NASA's LRO has circled the Moon since 2009. Its instruments found signs of ice in the dark polar craters, where future astronauts may get water.", ar: "مركبة ناسا LRO بتلف حوالين القمر من 2009، وأجهزتها لقت علامات تلج في حفر القطبين الضلمة، اللي ممكن الرواد ياخدوا منها مية بعدين." } },
 { id: "mars", base: "mars", orbit: "jezero", planet: "mars_2048.jpg", lvl: 3, model: "perseverance",
   name: { en: "Look for life on Mars", ar: "دوّر على حياة في المريخ" },
   sub: { en: "A rover on the surface of Mars", ar: "روڤر على سطح المريخ" },
   goal: { en: "Mars had lakes billions of years ago. Land a rover in an old lake and look for signs that tiny life once lived there.", ar: "المريخ كان فيه بحيرات من مليارات السنين. نزّل روڤر في بحيرة قديمة ودوّر على علامات إن كان فيه كائنات صغيرة عايشة هناك." },
   budget: 250, baseMass: 5, basePower: 1,
   tips: { rocket: { en: "A rover also needs a heat shield and parachute to land, so it's heavy. Mars is far: rockets lift little.", ar: "الروڤر محتاج كمان درع حراري وباراشوت علشان ينزل، فهو تقيل. والمريخ بعيد: الصواريخ بتشيل قليل." },
           power: { en: "Mars gets less than half of Earth's sunlight, and dust storms can cover the panels.", ar: "المريخ بيوصله أقل من نص شمس الأرض، وعواصف التراب ممكن تغطي الألواح." },
           science: { en: "Signs of old life hide inside rocks. Which tool can look inside?", ar: "علامات الحياة القديمة بتستخبى جوه الصخور. أنهي جهاز يقدر يبص جوه؟" },
           comms: { en: "Mars can be 400 million km away. Mars orbiters can relay your data home much faster.", ar: "المريخ ممكن يبقى بعيد 400 مليون كم. والأقمار اللي بتلف حوالين المريخ تقدر توصّل الداتا للأرض أسرع بكتير." } },
   steps: {
     rocket: ROCKETS([4, 9, 15], [20, 50, 80]),
     power: [
       { k: "p1", icon: "panel2", n: { en: "Solar panels", ar: "ألواح شمسية" }, d: { en: "Cheap, but weak on Mars and dust can cover them.", ar: "رخيصة، بس ضعيفة على المريخ والتراب ممكن يغطيها." }, supply: 3, mass: 2, cost: 15, panel: 4 },
       { k: "p2", icon: "panel3", n: { en: "Big solar panels", ar: "ألواح شمسية كبيرة" }, d: { en: "More power, but heavy, and dust is still a problem.", ar: "كهربا أكتر، بس تقيلة، والتراب لسه مشكلة." }, supply: 6, mass: 4, cost: 25, panel: 10 },
       { k: "p3", icon: "rtg", rtg: true, n: { en: "Nuclear power source (RTG)", ar: "مصدر كهربا نووي (RTG)" }, d: { en: "Works day and night, even in dust storms. Expensive.", ar: "بيشتغل ليل ونهار حتى في عواصف التراب. غالي." }, supply: 6, mass: 2, cost: 70 }],
     science: [
       { k: "s1", icon: "cam1", instr: "mastcam", n: { en: "3D cameras", ar: "كاميرات 3D" }, d: { en: "Beautiful views, but only see the outside of rocks.", ar: "مناظر حلوة، بس بتشوف الصخور من برا بس." }, mass: 1, power: 1, cost: 20, data: 3, sci: 1 },
       { k: "s2", icon: "drill", instr: "drill", star: true, n: { en: "Drill + rock lab", ar: "دريل + معمل صخور" }, d: { en: "Drills into rocks and tests what's inside.", ar: "بيحفر في الصخور ويحلل اللي جواها." }, mass: 3, power: 3, cost: 60, data: 2, sci: 3 },
       { k: "s3", icon: "weather", instr: "weather_st", n: { en: "Weather station", ar: "محطة أرصاد" }, d: { en: "Measures wind and dust, but can't find signs of life.", ar: "بتقيس الريح والتراب، بس مش هتلاقي علامات حياة." }, mass: 1, power: 1, cost: 15, data: 1, sci: 1 }],
     comms: [
       { k: "a1", icon: "dish1", ant: "small", n: { en: "Small antenna to Earth", ar: "هوائي صغير للأرض" }, d: { en: "Light, but very slow from so far.", ar: "خفيف، بس بطيء جداً من المسافة دي." }, cap: 1, mass: 1, power: 1, cost: 5 },
       { k: "a2", icon: "dish3", ant: "large", n: { en: "Big dish to Earth", ar: "طبق كبير للأرض" }, d: { en: "Faster, but heavy.", ar: "أسرع، بس تقيل." }, cap: 2, mass: 2, power: 2, cost: 20 },
       { k: "a3", icon: "relay", ant: "medium", relay: true, n: { en: "Relay through Mars orbiters", ar: "توصيل عن طريق أقمار المريخ" }, d: { en: "Send data to satellites above you; they pass it home.", ar: "ابعت الداتا للأقمار اللي فوقك، وهما يوصّلوها للأرض." }, cap: 6, mass: 1, power: 1, cost: 30 }] },
   events: ["dust", "delay"],
   fact: { en: "NASA's Perseverance landed in an old lake called Jezero Crater in 2021. It runs on a nuclear power source, drives itself around rocks, and drills rock samples.", ar: "الروڤر Perseverance بتاع ناسا نزل في بحيرة قديمة اسمها فوهة جيزيرو سنة 2021. بيشتغل بمصدر كهربا نووي، وبيسوق نفسه بعيد عن الصخور، وبيحفر ياخد عينات." } }
];

/* surprise events: 3 choices; result depends on what the team built */
const S_EVENTS = {
  shadow: { role: "engineer", t: { en: "Night side", ar: "الناحية الضلمة" }, x: { en: "Every 90 minutes the satellite flies into Earth's shadow. No sunlight means no power from the panels.", ar: "كل 90 دقيقة القمر الصناعي بيدخل في ضل الأرض. مفيش شمس يعني الألواح مش بتعمل كهربا." },
    o: [
      { t: { en: "Run on the battery and keep working", ar: "اشتغل على البطارية وكمّل" }, f: s => s.ring.power <= .7 ? { h: 0, sci: 0, w: { en: "Your panels made extra power in daylight, so the battery was full. Perfect!", ar: "الألواح عملت كهربا زيادة في النهار، فالبطارية كانت مليانة. ممتاز!" } } : { h: -20, sci: 0, w: { en: "Your panels were only just enough in daylight, so the battery ran low at night. Extra power gives you safety.", ar: "الألواح كانت على القد في النهار، فالبطارية خلصت بالليل. الكهربا الزيادة بتديك أمان." } } },
      { t: { en: "Turn the camera off at night", ar: "اقفل الكاميرا بالليل" }, f: s => ({ h: 0, sci: 0, w: { en: "Smart! You can't photograph farms in the dark anyway, so you lost nothing.", ar: "شاطر! أصلاً مش هتعرف تصوّر المزارع في الضلمة، فمخسرتش حاجة." } }) },
      { t: { en: "Turn off the heaters", ar: "اقفل التدفئة" }, f: s => ({ h: -15, sci: 0, w: { en: "Space is freezing in the shadow. Some parts got too cold and were damaged.", ar: "الفضاء ساقع جداً في الضل. شوية قطع بردت أوي واتضررت." } }) }] },
  storm: { role: "engineer", t: { en: "Solar storm!", ar: "عاصفة شمسية!" }, x: { en: "The Sun just threw out a cloud of charged particles. They can confuse the computer.", ar: "الشمس لسه رامية سحابة جزيئات مشحونة، ممكن تلخبط الكمبيوتر." },
    o: [
      { t: { en: "Safe mode: sleep for a day", ar: "الوضع الآمن: نام يوم" }, f: s => ({ h: 0, sci: -.05, w: { en: "The computer was protected. You lost one day of pictures. Real satellites do this!", ar: "الكمبيوتر اتحمى. خسرت صور يوم واحد. والأقمار الحقيقية بتعمل كده!" } }) },
      { t: { en: "Turn so the body shields the computer", ar: "لف علشان جسم القمر يحمي الكمبيوتر" }, f: s => ({ h: -5, sci: 0, w: { en: "Good idea: the metal body blocked most particles. A little damage.", ar: "فكرة حلوة: الجسم المعدني صد أغلب الجزيئات. ضرر بسيط." } }) },
      { t: { en: "Ignore it and keep going", ar: "طنّش وكمّل" }, f: s => ({ h: -25, sci: 0, w: { en: "The particles hit the computer and broke some parts. In space, the Sun can be dangerous.", ar: "الجزيئات خبطت الكمبيوتر وبوّظت شوية قطع. في الفضاء، الشمس ممكن تبقى خطيرة." } }) }] },
  farside: { role: "comms", t: { en: "Behind the Moon", ar: "ورا القمر" }, x: { en: "Every orbit, the Moon blocks your signal to Earth for 45 minutes.", ar: "في كل لفة، القمر بيحجب الإشارة بينك وبين الأرض 45 دقيقة." },
    o: [
      { t: { en: "Save the data and send it later", ar: "خزّن الداتا وابعتها بعدين" }, f: s => s.ring.data <= 1 ? { h: 0, sci: 0, w: { en: "Your antenna had room to send everything once you came back around. Nothing lost!", ar: "الهوائي كان فيه مساحة يبعت كل حاجة لما رجعت. مفيش حاجة ضاعت!" } } : { h: 0, sci: -.2, w: { en: "Your antenna was already too slow, so the saved data piled up and some was lost.", ar: "الهوائي كان بطيء أصلاً، فالداتا المتخزنة اتكوّمت وجزء منها ضاع." } } },
      { t: { en: "Stop measuring behind the Moon", ar: "بطّل قياس ورا القمر" }, f: s => ({ h: 0, sci: -.15, w: { en: "Safe, but you missed half of the Moon on every orbit.", ar: "آمن، بس فاتك نص القمر في كل لفة." } }) },
      { t: { en: "Keep sending anyway", ar: "كمّل ابعت عادي" }, f: s => ({ h: 0, sci: -.25, w: { en: "Nobody can hear you behind the Moon. All that data was lost.", ar: "محدش يقدر يسمعك ورا القمر. كل الداتا دي ضاعت." } }) }] },
  pebbles: { role: "planner", t: { en: "Tiny space rocks", ar: "حجارة فضاء صغيرة" }, x: { en: "A stream of sand-sized rocks is coming, faster than a bullet.", ar: "سيل حجارة قد الرملة جاي عليك، أسرع من الرصاصة." },
    o: [
      { t: { en: "Turn your strongest side toward them", ar: "لف أقوى جنب ناحيتهم" }, f: s => ({ h: -5, sci: 0, w: { en: "The strong side took the hits. Only small scratches.", ar: "الجنب القوي استحمل الخبطات. خدوش بسيطة بس." } }) },
      { t: { en: "Close the instrument covers", ar: "اقفل أغطية الأجهزة" }, f: s => ({ h: 0, sci: -.05, w: { en: "Instruments safe. You paused science for a few hours.", ar: "الأجهزة في أمان. وقفت العلم كام ساعة." } }) },
      { t: { en: "Ignore them", ar: "طنّشهم" }, f: s => ({ h: -20, sci: 0, w: { en: "Some rocks hit a solar panel. Even tiny rocks are dangerous at that speed.", ar: "شوية حجارة خبطت لوح شمسي. حتى الحجارة الصغيرة خطيرة بالسرعة دي." } }) }] },
  dust: { role: "engineer", t: { en: "Dust storm!", ar: "عاصفة تراب!" }, x: { en: "A huge dust storm is covering the sky. Very little sunlight reaches the ground.", ar: "عاصفة تراب ضخمة مغطية السما، والشمس اللي بتوصل الأرض قليلة جداً." },
    o: [
      { t: { en: "Sleep until it's over", ar: "نام لحد ما تخلص" }, f: s => ({ h: 0, sci: -.15, w: { en: "The rover was safe, but you lost weeks of exploring.", ar: "الروڤر كان في أمان، بس خسرت أسابيع استكشاف." } }) },
      { t: { en: "Keep driving", ar: "كمّل سواقة" }, f: s => s.pick.power.rtg ? { h: 0, sci: 0, w: { en: "Your nuclear power source doesn't need sunlight. The rover kept working!", ar: "مصدر الكهربا النووي مش محتاج شمس. الروڤر كمّل شغل!" } } : { h: -35, sci: 0, w: { en: "Dust covered the panels and the rover nearly froze. This is how NASA's Opportunity rover was lost in 2018.", ar: "التراب غطى الألواح والروڤر قرّب يتجمد. كده بالظبط ناسا خسرت الروڤر Opportunity سنة 2018." } } },
      { t: { en: "Shake the dust off the panels", ar: "هز الألواح علشان التراب يقع" }, f: s => s.pick.power.rtg ? { h: 0, sci: 0, w: { en: "You have no panels to shake: your nuclear power source is fine!", ar: "معندكش ألواح تهزها: مصدر الكهربا النووي تمام!" } } : { h: -10, sci: -.05, w: { en: "Some dust fell off, but the motors were strained.", ar: "شوية تراب وقع، بس الموتورات اتضغطت." } } }] },
  delay: { role: "comms", t: { en: "A cliff ahead!", ar: "منحدر قدامك!" }, x: { en: "There's a cliff in front of the rover. A message to Earth takes 12 minutes, and the answer takes 12 more.", ar: "فيه منحدر قدام الروڤر. الرسالة للأرض بتاخد 12 دقيقة، والرد بياخد 12 كمان." },
    o: [
      { t: { en: "Stop and wait for Earth", ar: "اقف واستنى الأرض" }, f: s => ({ h: 0, sci: -.08, w: { en: "Safe, but slow. You lost driving time.", ar: "آمن، بس بطيء. خسرت وقت سواقة." } }) },
      { t: { en: "Let the rover's computer decide", ar: "خلّي كمبيوتر الروڤر يقرر" }, f: s => ({ h: 0, sci: 0, w: { en: "The rover saw the cliff and drove around it by itself. That's how Perseverance drives!", ar: "الروڤر شاف المنحدر ولف حواليه لوحده. وده بالظبط اللي بيعمله Perseverance!" } }) },
      { t: { en: "Drive fast before the answer comes", ar: "سوق بسرعة قبل ما الرد ييجي" }, f: s => ({ h: -30, sci: 0, w: { en: "The rover slid near the cliff edge and got damaged. Far from Earth, you can't rush.", ar: "الروڤر اتزحلق جنب حافة المنحدر واتضرر. وانت بعيد عن الأرض، مينفعش تستعجل." } }) }] }
};

/* ---- state & model ---- */
const SA = { mi: 0, pick: {}, step: 0, hover: null, flight: null };
const SM = () => S_MISSIONS[SA.mi];
function sCompute(pick) {
  const m = SM(), p = Object.assign({}, pick);
  const sum = k => ["power", "science", "comms"].reduce((a, s) => a + ((p[s] && p[s][k]) || 0), 0);
  const mass = m.baseMass + sum("mass"), lift = p.rocket ? p.rocket.lift : 0;
  const need = m.basePower + (p.science ? p.science.power : 0) + (p.comms ? p.comms.power : 0), supply = p.power ? p.power.supply : 0;
  const cost = (p.rocket ? p.rocket.cost : 0) + sum("cost");
  const made = p.science ? p.science.data : 0, cap = p.comms ? p.comms.cap : 0;
  const ring = { mass: lift ? mass / lift : mass / 10, power: supply ? need / supply : need / 6, money: cost / m.budget, data: cap ? made / cap : (made ? made / 4 : 0) };
  const done = STEP_ORDER.every(s => p[s.k]);
  return { mass, lift, need, supply, cost, made, cap, ring, done, goal: !!(p.science && p.science.star), sci: p.science ? p.science.sci : 0 };
}
function sEngineDesign(m, p) {
  const base = MISSIONS.find(x => x.id === m.base);
  return { base, d: Object.assign(structuredClone(base.def), { orbit: m.orbit, lv: p.rocket ? p.rocket.lv : "medium", power: p.power && p.power.rtg ? "rtg1" : "solar", panel: p.power ? (p.power.panel || 3) : 3,
    antenna: p.comms ? p.comms.ant : "medium", relay: !!(p.comms && p.comms.relay), instr: p.science ? [p.science.instr] : [], adcs: "precise", shield: "light" }) };
}


/* what this step must satisfy, from the choices before it */
function sNeed(k) {
  const m = SM(), p = SA.pick;
  if (k === "comms") return p.science ? p.science.data : null;
  if (k === "power") return p.science && p.comms ? m.basePower + p.science.power + p.comms.power : null;
  if (k === "rocket") return p.science && p.comms && p.power ? m.baseMass + p.science.mass + p.comms.mass + p.power.mass : null;
  return null;
}
const CAPK = { comms: "cap", power: "supply", rocket: "lift" };
function sSpentWithout(k) { return STEP_ORDER.reduce((a, s) => a + (s.k !== k && SA.pick[s.k] ? SA.pick[s.k].cost : 0), 0); }
function sFit(c, k) {
  const need = sNeed(k), m = SM(), total = sSpentWithout(k) + c.cost;
  const enough = need == null ? null : c[CAPK[k]] >= need;
  return { need, enough, over: total > m.budget, total };
}
function sChips(c, k) {
  const W = (n, en, ar, cls) => `<span class="chip2 ${cls || ""}">${L({ en, ar })} <b>${n}</b></span>`;
  const out = [];
  if (k === "science") out.push(W(c.data, "pictures/day", "صور في اليوم", "cdata"));
  if (k === "comms") out.push(W(c.cap, "sends/day", "يبعت في اليوم", "cdata"));
  if (k === "power") out.push(W(c.supply, "makes power", "بيعمل كهربا", "cpow"));
  if (k === "rocket") out.push(W(c.lift, "can lift", "يشيل وزن", "cmass"));
  if (c.power) out.push(W(c.power, "uses power", "بياكل كهربا", "cpow"));
  if (c.mass) out.push(W(c.mass, "weight", "وزن", "cmass"));
  out.push(W(c.cost, "cost", "فلوس", "cmoney"));
  return `<span class="chips3">${out.join("")}</span>`;
}
function sNeedLine(k) {
  const m = SM(), n = sNeed(k);
  if (k === "science") return L({ en: `The question: ${m.goal.en} Only one tool can answer it: look for ★.`, ar: `السؤال: ${m.goal.ar} جهاز واحد بس يقدر يجاوب: دوّر على ★.` });
  if (n == null) return L({ en: "Finish the steps before this one first.", ar: "خلّص الخطوات اللي قبل دي الأول." });
  if (k === "comms") return L({ en: `Your science tool makes ${n} pictures a day. Pick an antenna that sends at least ${n}.`, ar: `جهاز العلم بتاعك بيطلّع ${n} صور في اليوم. اختار هوائي يبعت ${n} على الأقل.` });
  if (k === "power") return L({ en: `Your science tool, antenna and computer need ${n} power. Pick a source that makes at least ${n}.`, ar: `جهاز العلم والهوائي والكمبيوتر محتاجين ${n} كهربا. اختار مصدر يعمل ${n} على الأقل.` });
  if (k === "rocket") return L({ en: `Your spacecraft now weighs ${n}. Pick a rocket that can lift at least ${n}.`, ar: `مركبتك وزنها دلوقتي ${n}. اختار صاروخ يشيل ${n} على الأقل.` });
}
function sCardHtml(c, k) {
  const sel = SA.pick[k] && SA.pick[k].k === c.k, f = sFit(c, k), cards = SM().steps[k];
  const okCards = cards.filter(x => { const g = sFit(x, k); return g.enough !== false && !g.over; });
  const best = k !== "science" && f.enough && !f.over && okCards.length && c.cost === Math.min(...okCards.map(x => x.cost));
  let badge = "";
  if (k === "science") badge = c.star ? `<span class="fit ok">★ ${L({ en: "Answers the question", ar: "بيجاوب على السؤال" })}</span>` : `<span class="fit no">✗ ${L({ en: "Can't answer the question", ar: "مش بيجاوب على السؤال" })}</span>`;
  else if (f.enough === false) badge = `<span class="fit no">✗ ${L({ en: `Not enough (need ${f.need})`, ar: `مش كفاية (محتاج ${f.need})` })}</span>`;
  else if (f.over) badge = `<span class="fit no">✗ ${L({ en: "Not enough money", ar: "الفلوس مش هتكفي" })}</span>`;
  else if (f.enough) badge = `<span class="fit ok">✓ ${L({ en: "Enough", ar: "كفاية" })}</span>${best ? `<span class="fit best">👍 ${L({ en: "Best value", ar: "الأوفر" })}</span>` : ""}`;
  return `<button type="button" class="ccard ${sel ? "sel" : ""} ${(k === "science" ? !c.star : f.enough === false || f.over) ? "dim" : ""}" data-scard="${c.k}">
    <span class="cicon">${sIcon(c.icon)}</span><b>${L(c.n)}</b><span class="cd">${L(c.d)}</span>${sChips(c, k)}<span class="fits">${badge}</span></button>`;
}
/* ---- icons (hologram line art) ---- */
function sIcon(k) {
  const st = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    rocket1: `<path d="M50 28c6 8 8 18 8 30H42c0-12 2-22 8-30z" ${st}/><path d="M44 58l-5 8h22l-5-8" ${st}/>`,
    rocket2: `<path d="M50 14c8 10 10 26 10 46H40c0-20 2-36 10-46z" ${st}/><path d="M42 60l-7 12h30l-7-12M50 34v12" ${st}/>`,
    rocket3: `<path d="M50 8c8 10 10 28 10 52H40c0-24 2-42 10-52z" ${st}/><path d="M30 30c4 4 5 14 5 30h-9c0-16 1-26 4-30zM70 30c-4 4-5 14-5 30h9c0-16-1-26-4-30z" ${st}/><path d="M38 60l-6 14h36l-6-14" ${st}/>`,
    panel1: `<rect x="40" y="38" width="20" height="20" ${st}/><rect x="22" y="43" width="16" height="10" ${st}/><rect x="62" y="43" width="16" height="10" ${st}/>`,
    panel2: `<rect x="42" y="38" width="16" height="20" ${st}/><path d="M14 40h26v16H14zM60 40h26v16H60zM27 40v16M73 40v16" ${st}/>`,
    panel3: `<rect x="44" y="38" width="12" height="20" ${st}/><path d="M4 36h38v24H4zM58 36h38v24H58zM17 36v24M30 36v24M70 36v24M83 36v24" ${st}/>`,
    cam1: `<rect x="28" y="34" width="44" height="30" rx="4" ${st}/><circle cx="50" cy="49" r="9" ${st}/><path d="M38 34l4-6h16l4 6" ${st}/>`,
    cam3: `<rect x="22" y="36" width="38" height="26" rx="3" ${st}/><path d="M60 42l20-8v30l-20-8z" ${st}/><circle cx="41" cy="49" r="7" ${st}/>`,
    leaf: `<path d="M30 66c0-24 16-36 40-38-2 24-14 40-38 40z" ${st}/><path d="M32 66c8-12 18-22 30-30" ${st}/><path d="M18 30l8 4M18 46l8-2M82 62l-8-2" ${st}/>`,
    ice: `<path d="M50 20v56M26 34l48 28M74 34L26 62" ${st}/><path d="M44 24l6 6 6-6M44 72l6-6 6 6" ${st}/>`,
    radar: `<path d="M24 64a30 30 0 0 1 52 0" ${st}/><path d="M34 64a18 18 0 0 1 32 0" ${st}/><path d="M50 64V36M50 36l12-8" ${st}/>`,
    dish1: `<path d="M38 46a14 14 0 0 0 24 0z" ${st}/><path d="M50 46v18M42 64h16" ${st}/>`,
    dish2: `<path d="M30 40a22 22 0 0 0 40 0z" ${st}/><path d="M50 40l10-12M50 50v16M40 66h20" ${st}/>`,
    dish3: `<path d="M20 34a32 32 0 0 0 60 0z" ${st}/><path d="M50 34l14-16M50 52v16M38 68h24" ${st}/>`,
    rtg: `<rect x="40" y="28" width="20" height="40" rx="4" ${st}/><path d="M32 34v28M68 34v28M26 40v16M74 40v16" ${st}/><circle cx="50" cy="48" r="5" ${st}/>`,
    drill: `<path d="M50 18v34l-6 10h12l-6-10" ${st}/><path d="M30 70h40M38 70l4-8h16l4 8" ${st}/><path d="M44 30l12 4M44 40l12 4" ${st}/>`,
    weather: `<circle cx="40" cy="44" r="10" ${st}/><path d="M52 52c8 0 14 4 14 10H30c0-4 2-8 6-9" ${st}/><path d="M66 30v12M60 36h12" ${st}/>`,
    relay: `<circle cx="50" cy="64" r="6" ${st}/><path d="M50 58V40M30 28h12M58 28h12M42 22h16v12H42z" ${st}/><path d="M24 50a30 30 0 0 1 52 0" ${st} stroke-dasharray="3 5"/>`
  };
  return `<svg viewBox="0 0 100 90" aria-hidden="true">${I[k] || ""}</svg>`;
}
function ringSvg(r, val, ghost) {
  const pct = Math.max(0, val), over = pct > 1.0001, frac = Math.min(1, pct), C = 2 * Math.PI * 42;
  const g = ghost != null && Math.abs(ghost - val) > .001 ? `<circle cx="50" cy="50" r="42" class="rg-ghost" stroke-dasharray="${Math.min(1, ghost) * C} ${C}"/>` : "";
  return `<div class="ring ${over ? "over" : ""}" style="--rc:${over ? "#ff4d5e" : r.c}">
    <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="rg-bg"/>${g}<circle cx="50" cy="50" r="42" class="rg-fg" stroke-dasharray="${frac * C} ${C}"/></svg>
    <div class="rg-in">${over ? '<span class="rg-warn">⚠</span>' : ""}<b>${Math.round(pct * 100)}%</b></div>
    <div class="rg-lab"><b>${L(r.n)}</b><span>${L(r.q)}</span></div></div>`;
}
function ringsRow(cmp, ghostCmp) { return `<div class="rings">${RINGS.map(r => ringSvg(r, cmp.ring[r.k], ghostCmp ? ghostCmp.ring[r.k] : null)).join("")}</div>`; }
function guide(role, text, m) { return `<div class="guide"><img src="${portrait(role, m && m.crew ? { crew: true } : { crew: true })}" alt=""><div><b>${L({ en: "Your guide", ar: "المرشد" })} · ${roleName(role)}</b><p>${text}</p></div></div>`; }

/* ---- screens ---- */
function shome() {
  return `<section class="cine notr">
    <canvas id="holoHome" class="holo" aria-label="${L({ en: "Hologram of a real NASA satellite", ar: "هولوجرام لقمر صناعي حقيقي من ناسا" })}"></canvas>
    <div class="cine-txt">
      <div class="kick">NASA SPACE APPS 2026 · TEAM STELLAROP</div>
      <h1 class="cine-h">MISSION <span>ARCHITECT</span></h1>
      <p class="cine-p">${L({ en: "Build a real space mission in 5 minutes. No space knowledge needed: we'll teach you as you play.", ar: "ابني مهمة فضائية حقيقية في 5 دقايق. مش محتاج تعرف أي حاجة عن الفضاء: هنعلّمك وانت بتلعب." })}</p>
      <div class="row"><button class="hbtn" type="button" data-go="spick">${L({ en: "Start", ar: "ابدأ" })}</button>
        <button class="hbtn ghost" type="button" data-act="steam">${L({ en: "Play as a team", ar: "العب مع تيم" })}</button></div>
      <p class="cine-small">${L({ en: "Already know your rockets?", ar: "عارف الصواريخ كويس؟" })} <button class="linkbtn" type="button" data-act="expert">${L({ en: "Expert mode", ar: "وضع الخبراء" })}</button></p>
    </div>
    <div class="how">${[[1, { en: "Pick a mission", ar: "اختار مهمة" }], [2, { en: "Make 4 choices", ar: "خد 4 قرارات" }], [3, { en: "Keep the 4 rings blue", ar: "خلّي الأربع دواير زرقا" }], [4, { en: "Launch and handle surprises", ar: "اطلق واتصرف في المفاجآت" }]].map(([n, t]) => `<div><span>0${n}</span><b>${L(t)}</b></div>`).join("")}</div>
  </section>`;
}
function spick() {
  const st = A.progress.stars;
  return `<section class="hpanel notr"><div class="kick">${L({ en: "Choose your mission", ar: "اختار مهمتك" })}</div>
    <h2 class="hh">${L({ en: "Where do you want to go?", ar: "عايز تروح فين؟" })}</h2>
    <div class="planets">${S_MISSIONS.map((m, i) => `<button class="pcard" type="button" data-smi="${i}">
      <span class="globe" style="background-image:url(tex/${m.planet})"></span>
      <span class="lvdots">${[1, 2, 3].map(k => `<i class="${k <= m.lvl ? "on" : ""}"></i>`).join("")}<em>${L([{ en: "Easy", ar: "سهلة" }, { en: "Medium", ar: "متوسطة" }, { en: "Harder", ar: "أصعب" }][m.lvl - 1])}</em></span>
      <b>${L(m.name)}</b><span class="psub">${L(m.sub)}</span><span class="pstars">${"★".repeat(st["s_" + m.id] || 0)}${"☆".repeat(3 - (st["s_" + m.id] || 0))}</span></button>`).join("")}</div></section>`;
}
function sbrief() {
  const m = SM();
  return `<section class="hpanel notr brief">
    <div class="briefgrid"><span class="globe big" style="background-image:url(tex/${m.planet})"></span>
    <div><div class="kick">${L({ en: "Mission briefing", ar: "شرح المهمة" })}</div><h2 class="hh">${L(m.name)}</h2>
      <p class="goalbox"><b>${L({ en: "Your goal", ar: "هدفك" })}:</b> ${L(m.goal)}</p>
      <div class="chain">${[["science", { en: "Science tool", ar: "جهاز العلم" }, { en: "Answers the question", ar: "بيجاوب على السؤال" }], ["comms", { en: "Antenna", ar: "الهوائي" }, { en: "Sends its pictures", ar: "بيبعت صوره" }], ["engineer", { en: "Power", ar: "الكهربا" }, { en: "Feeds everything", ar: "بتشغّل كل حاجة" }], ["planner", { en: "Rocket", ar: "الصاروخ" }, { en: "Lifts it all", ar: "بيشيل كل ده" }]].map(([r, t, d], i) => `${i ? '<span class="arrow">→</span>' : ""}<div class="link" style="--sc:${ROLE_COL[r]}"><span>${i + 1}</span><b>${L(t)}</b><em>${L(d)}</em></div>`).join("")}</div>
      <p class="rule">${L({ en: "The rule: start from the question, then make each choice just big enough for the one before it. Bigger isn't always better: it adds weight and costs money.", ar: "القاعدة: ابدأ من السؤال، وبعدين خلّي كل اختيار على قد اللي قبله بالظبط. الأكبر مش دايماً أحسن: بيزوّد الوزن والفلوس." })}</p>
      ${ringsRow({ ring: { mass: .5, power: .5, money: .5, data: .5 } })}
      <div class="row"><button class="hbtn" type="button" data-go="sbuild">${L({ en: "Let's build", ar: "يلا نبني" })}</button><button class="linkbtn" type="button" data-go="spick">${L({ en: "Other missions", ar: "مهمات تانية" })}</button></div></div></div></section>`;
}
function sbuild() {
  const m = SM(), s = STEP_ORDER[SA.step], cards = m.steps[s.k], cmp = sCompute(SA.pick);
  const ghost = SA.hover ? sCompute(Object.assign({}, SA.pick, { [s.k]: SA.hover })) : null;
  const who = A.mode === "team" ? ` · ${L({ en: "turn", ar: "دور" })}: <b>${esc(playerFor(s.role))}</b>` : "";
  return `<section class="build notr">
    <div class="buildhead"><div><div class="kick">${L(m.name)}</div>
      <div class="stepper">${STEP_ORDER.map((x, i) => `<button type="button" class="stp ${i === SA.step ? "cur" : ""} ${SA.pick[x.k] ? "done" : ""}" data-sstep="${i}" style="--sc:${ROLE_COL[x.role]}"><span>${i + 1}</span>${L(x.t)}</button>`).join("")}</div></div></div>
    <div class="buildgrid">
      <div class="holowrap"><canvas id="holoBuild" class="holo" aria-label="${L({ en: "Your spacecraft as a hologram. Drag to turn it.", ar: "مركبتك كهولوجرام. اسحب علشان تلفها." })}"></canvas>
        <div class="holotag">${cmp.done ? L({ en: "Spacecraft ready", ar: "المركبة جاهزة" }) : L({ en: "Building your spacecraft…", ar: "بنبني مركبتك…" })}</div></div>
      <div class="choose">
        <div class="steptitle" style="--sc:${ROLE_COL[s.role]}"><span class="rolechip">${roleName(s.role)}${who}</span><h2 class="hh">${L(s.t)}</h2></div>
        ${guide(s.role, L(m.tips[s.k]))}
        <p class="needline">${sNeedLine(s.k)}</p>
        <div class="wallet">${L({ en: "Budget", ar: "الميزانية" })}: <b>${cmp.cost}</b> / ${m.budget} ${L({ en: "spent", ar: "مصروفين" })}</div>
        <div class="cards3">${cards.map(c => sCardHtml(c, s.k)).join("")}</div>
        <div class="nav2">${SA.step > 0 ? `<button class="hbtn ghost" type="button" data-act="sprev">${L({ en: "Back", ar: "رجوع" })}</button>` : ""}
          ${SA.step < 3 ? `<button class="hbtn" type="button" data-act="snext" ${SA.pick[s.k] ? "" : "disabled"}>${L({ en: "Next", ar: "اللي بعده" })}</button>`
            : `<button class="hbtn launch" type="button" data-act="slaunch" ${cmp.done ? "" : "disabled"}>${L({ en: "Launch!", ar: "اطلق!" })}</button>`}</div>
      </div></div>
    ${ringsRow(cmp, ghost)}
    <p class="ringhelp">${sRingHint(cmp)}</p>
  </section>`;
}
function sRingHint(c) {
  const red = RINGS.filter(r => c.ring[r.k] > 1.0001).map(r => r.k);
  const H = { mass: { en: "Mass is red: the rocket can't lift your spacecraft. Pick a bigger rocket or lighter parts.", ar: "الوزن أحمر: الصاروخ مش هيقدر يشيل مركبتك. اختار صاروخ أكبر أو قطع أخف." },
    power: { en: "Power is red: your parts need more electricity than the panels make. Pick bigger panels or parts that use less.", ar: "الكهربا حمرا: القطع محتاجة كهربا أكتر من اللي الألواح بتعمله. اختار ألواح أكبر أو قطع بتاكل أقل." },
    money: { en: "Money is red: you spent more than the budget. Pick cheaper parts.", ar: "الفلوس حمرا: صرفت أكتر من الميزانية. اختار قطع أرخص." },
    data: { en: "Data is red: your science tool makes more pictures than the antenna can send. Pick a bigger antenna.", ar: "الداتا حمرا: جهاز العلم بيطلّع صور أكتر من اللي الهوائي يقدر يبعته. اختار هوائي أكبر." } };
  if (red.length) return `<span class="bad">⚠ ${L(H[red[0]])}</span>`;
  return c.done ? L({ en: "All rings are blue. Your spacecraft is ready to launch!", ar: "كل الدواير زرقا. مركبتك جاهزة للإطلاق!" }) : L({ en: "Hover over a card to see how it moves the rings before you pick it.", ar: "حط الماوس على أي كارت علشان تشوف هيحرّك الدواير إزاي قبل ما تختاره." });
}
let holoB = null;
const SIMPLE_AFTER = {
  shome() { const cv = $("#holoHome"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel("landsat8"); },
  sbuild() { const cv = $("#holoBuild"); holoB = Space3D.ok && cv ? Space3D.createHolo(cv) : null; sRefreshHolo(); }
};
function sRefreshHolo() { if (!holoB) return; const m = SM(); const { base, d } = sEngineDesign(m, SA.pick); const cmp = sCompute(SA.pick); holoB.setDesign(base, d, { dry: cmp.mass * 120, prop: 0 }); holoB.setAlert(RINGS.some(r => cmp.ring[r.k] > 1.0001)); }
function sRenderBuildParts() { // update without rebuilding the hologram canvas
  const m = SM(), s = STEP_ORDER[SA.step], cmp = sCompute(SA.pick), ghost = SA.hover ? sCompute(Object.assign({}, SA.pick, { [s.k]: SA.hover })) : null;
  const rr = document.querySelector(".build .rings"); if (rr) rr.outerHTML = ringsRow(cmp, ghost);
  const h = document.querySelector(".ringhelp"); if (h) h.innerHTML = sRingHint(ghost || cmp);
}

/* ---- flight ---- */
function sfly() {
  const m = SM();
  return `<section class="stage control notr sfly">
    <div class="screen" id="screen">${Space3D.ok ? `<canvas id="view3d" aria-label="Live 3D view"></canvas>` : ""}
      <div class="sky" id="sky" aria-hidden="true"></div>
      <div class="hud tl"><span class="eyebrow" id="phase">${L({ en: "COUNTDOWN", ar: "العد التنازلي" })}</span><span class="clock" id="clock"></span></div>
      <div class="hud tr">● ${L({ en: "LIVE", ar: "مباشر" })}</div>
      <div class="subtitle" id="subt"></div>
      <div class="hud br views">${[["ship", { en: "Outside", ar: "من برا" }], ["window", { en: "Onboard", ar: "من المركبة" }], ["map", { en: "Map", ar: "الخريطة" }]].map(([k, n]) => `<button type="button" class="vbtn" data-view="${k}" aria-pressed="${k === "ship"}">${L(n)}</button>`).join("")}</div>
    </div>
    <div class="flybar"><div class="fb-h"><span>${L({ en: "Spacecraft health", ar: "صحة المركبة" })}</span><b id="hp">100%</b></div><div class="bar"><i id="hpBar" style="width:100%;background:var(--ok)"></i></div></div>
  </section><div id="modal"></div>`;
}
function sSay(role, text) { const el = $("#subt"); if (el) { el.innerHTML = `<b>${roleName(role)}:</b> ${text}`; el.classList.add("on"); } Voice.say(role, text); }
async function sRunFlight() {
  SEQ++; const m = SM(), p = SA.pick, cmp = sCompute(p); const { base, d } = sEngineDesign(m, p);
  const F = SA.flight = { health: 100, sci: 1, events: [], lost: null, cmp };
  curP = 0; totalDays = m.id === "earth" ? 365 * 3 : m.id === "moon" ? 365 * 2 : 900;
  if (Space3D.ok && $("#view3d")) { flightView = Space3D.createView($("#view3d"), {}); flightView.setMission(base, d, { dry: cmp.mass * 150, prop: 200 }); skyLoop(); }
  const marks = flightView ? flightView.marks() : { ascent: .12 }; ascentEnd = marks.ascent || .12;
  const names = Object.keys(marks).slice(1);
  sSay("planner", L({ en: "Three, two, one... liftoff!", ar: "تلاتة، اتنين، واحد... انطلقنا!" })); await wait(2600);
  setPhase(L({ en: "LIFTOFF", ar: "الإطلاق" }));
  if (cmp.ring.mass > 1.0001) { await animTo(.045, 3500); flightView && flightView.flag("fall");
    F.lost = { k: "mass", w: { en: "The rocket couldn't lift that much weight. It ran out of fuel before reaching space and fell into the ocean.", ar: "الصاروخ مقدرش يشيل الوزن ده. الوقود خلص قبل ما يوصل الفضاء ووقع في المحيط." } };
    sSay("planner", L(F.lost.w)); await wait(4500); return sFinish(F); }
  await animTo(ascentEnd, 6500); flightView && flightView.flag("separated");
  setPhase(L({ en: "IN SPACE", ar: "في الفضاء" })); sSay("engineer", L({ en: "We made it to space! Opening the solar panels.", ar: "وصلنا الفضاء! بنفتح الألواح الشمسية." })); await wait(2500);
  if (cmp.ring.power > 1.0001) { await animTo(ascentEnd + .03, 2500); flightView && flightView.flag("tumble");
    F.lost = { k: "power", w: { en: "The parts needed more electricity than the panels could make. The batteries emptied and the spacecraft went silent.", ar: "القطع كانت محتاجة كهربا أكتر من اللي الألواح بتعمله. البطاريات فضيت والمركبة سكتت." } };
    sSay("engineer", L(F.lost.w)); await wait(4500); return sFinish(F); }
  for (let i = 0; i < names.length; i++) {
    const nm = names[i], last = i === names.length - 1;
    setPhase(L({ transfer: { en: "ON THE WAY", ar: "في الطريق" }, depart: { en: "LEAVING EARTH", ar: "بنسيب الأرض" }, cruise: { en: "CRUISING TO MARS", ar: "رايحين المريخ" }, approach: { en: "ARRIVING", ar: "بنوصل" }, orbit: { en: "WORKING", ar: "شغالين" }, landing: { en: "LANDING", ar: "بننزل" } }[nm] || { en: nm, ar: nm }));
    if (nm === "landing") sSay("engineer", L({ en: "Heat shield, parachute, rockets... seven minutes of landing!", ar: "الدرع الحراري، الباراشوت، الصواريخ... سبع دقايق هبوط!" }));
    if (last) { await animTo(marks[nm] - .3 * (marks[nm] - (i ? marks[names[i - 1]] : ascentEnd)), 5000); await sEvent(m.events[0], F); await sEvent(m.events[1], F); await animTo(marks[nm], 3500); }
    else await animTo(marks[nm], nm === "cruise" ? 3000 : 5500);
    if (nm === "landing") sSay("engineer", L({ en: "Touchdown! We're on Mars!", ar: "نزلنا! إحنا على المريخ!" }));
  }
  sSay("comms", L({ en: "Mission complete. The data is home!", ar: "المهمة خلصت. الداتا وصلت الأرض!" })); setPhase(L({ en: "MISSION COMPLETE", ar: "المهمة خلصت" })); await wait(3000);
  return sFinish(F);
}
function sEvent(key, F) {
  const e = S_EVENTS[key], m = SM();
  return new Promise(res => {
    const el = $("#modal"); sSay(e.role, L(e.x));
    el.innerHTML = `<div class="overlay notr" role="dialog" aria-modal="true" aria-labelledby="sev"><div class="hmodal">
      <div class="evhead"><img src="${portrait(e.role, { crew: true })}" alt=""><div><div class="kick">${L({ en: "Surprise!", ar: "مفاجأة!" })} · ${roleName(e.role)}</div><h2 id="sev" class="hh">${L(e.t)}</h2></div></div>
      <p class="evx">${L(e.x)}</p><p class="evq">${L({ en: "What should the team do? Talk about it, then pick one.", ar: "التيم يعمل إيه؟ اتكلموا مع بعض، وبعدين اختاروا." })}</p>
      <div class="cards3">${e.o.map((o, i) => `<button type="button" class="ccard" data-sev="${i}"><span class="cnum">${"ABC"[i]}</span><b>${L(o.t)}</b></button>`).join("")}</div></div></div>`;
    el.querySelectorAll("[data-sev]").forEach(b => b.onclick = () => {
      const o = e.o[+b.dataset.sev], r = o.f({ ring: F.cmp.ring, pick: SA.pick }); F.health = Math.max(5, F.health + r.h); F.sci *= 1 + r.sci; setHealth(F.health);
      F.events.push({ t: e.t, o: o.t, r });
      const good = r.h === 0 && r.sci === 0;
      el.querySelector(".hmodal").innerHTML = `<div class="evhead"><img src="${portrait(e.role, { crew: true })}" alt=""><div><div class="kick">${L(e.t)}</div><h2 class="hh">${good ? L({ en: "Great choice!", ar: "اختيار ممتاز!" }) : L({ en: "Here's what happened", ar: "ده اللي حصل" })}</h2></div></div>
        <p class="evx">${L(r.w)}</p><div class="chips2">${r.h ? `<span class="bad">${L({ en: "Health", ar: "الصحة" })} ${r.h}</span>` : ""}${r.sci ? `<span class="warn">${L({ en: "Science", ar: "العلم" })} ${Math.round(r.sci * 100)}%</span>` : ""}${good ? `<span class="good">${L({ en: "No loss", ar: "مفيش خسارة" })}</span>` : ""}</div>
        <div class="row"><button class="hbtn" type="button" id="sevok">${L({ en: "Continue", ar: "كمّل" })}</button></div>`;
      sSay(e.role, L(r.w)); $("#sevok").focus(); $("#sevok").onclick = () => { Voice.stop(); el.innerHTML = ""; res(); };
    });
  });
}
function sFinish(F) {
  const m = SM(), c = F.cmp; const ok = !F.lost;
  const dataF = c.ring.data <= 1 ? 1 : 1 / c.ring.data, moneyF = c.ring.money <= 1 ? 1 : .6;
  const sciPct = ok ? Math.round(100 * (c.sci / 3) * dataF * moneyF * F.sci * (F.health / 100)) : 0;
  let stars = ok ? 1 : 0; if (ok && c.goal && c.ring.data <= 1) stars = 2; if (stars === 2 && F.health >= 70 && c.ring.money <= 1) stars = 3;
  F.result = { ok, sciPct, stars };
  A.progress.stars["s_" + m.id] = Math.max(A.progress.stars["s_" + m.id] || 0, stars); store.set("ma.progress3", A.progress);
  setTimeout(() => { if (A.screen === "sfly" && SA.flight === F) go("sresult"); }, 600);
}
function sresult() {
  const F = SA.flight; if (!F || !F.result) return spick(); const m = SM(), c = F.cmp, R = F.result;
  const good = [], fix = [];
  if (F.lost) fix.push(F.lost.w);
  if (c.goal) good.push({ en: `You chose the right science tool: the ${SA.pick.science.n.en.toLowerCase()} answers the mission question.`, ar: `اخترت جهاز العلم الصح: ${SA.pick.science.n.ar} بيجاوب على سؤال المهمة.` });
  else fix.push({ en: "Your science tool couldn't answer the mission question. Look for the card with ★.", ar: "جهاز العلم اللي اخترته مقدرش يجاوب على سؤال المهمة. دوّر على الكارت اللي عليه ★." });
  if (!F.lost && c.ring.data > 1) fix.push({ en: "Some pictures never reached Earth: the antenna was too small for your science tool.", ar: "شوية صور ماوصلتش الأرض: الهوائي كان صغير على جهاز العلم." });
  if (c.ring.money > 1) fix.push({ en: "You went over the budget, so the mission had to end early.", ar: "عدّيت الميزانية، فالمهمة اضطرت تخلص بدري." });
  if (!F.lost && c.ring.mass <= 1 && c.ring.power <= 1) good.push({ en: "Your rocket and power were well matched to your spacecraft.", ar: "الصاروخ والكهربا كانوا مناسبين لمركبتك." });
  F.events.forEach(e => { if (e.r.h === 0 && e.r.sci === 0) good.push({ en: `Smart decision during "${e.t.en}".`, ar: `قرار ذكي في "${e.t.ar}".` }); else if (e.r.h <= -20) fix.push(e.r.w); });
  const next = SA.mi < S_MISSIONS.length - 1;
  return `<section class="hpanel notr result">
    <div class="kick">${L({ en: "Mission report", ar: "تقرير المهمة" })} · ${esc(A.team)}</div>
    <div class="resgrid"><div><div class="bigstars" aria-label="${R.stars} stars">${"★".repeat(R.stars)}<span>${"★".repeat(3 - R.stars)}</span></div>
      <h2 class="hh">${R.ok ? L({ en: "Mission complete!", ar: "المهمة نجحت!" }) : L({ en: "Mission lost", ar: "المهمة فشلت" })}</h2>
      <p class="sciline">${L({ en: "Science collected", ar: "العلم اللي اتجمع" })}: <b>${R.sciPct}%</b> · ${L({ en: "Health", ar: "الصحة" })}: <b>${Math.round(F.health)}%</b></p>
      <ul class="starkey"><li class="${R.stars >= 1 ? "on" : ""}">★ ${L({ en: "The spacecraft survived", ar: "المركبة عاشت" })}</li><li class="${R.stars >= 2 ? "on" : ""}">★ ${L({ en: "You answered the mission question", ar: "جاوبت على سؤال المهمة" })}</li><li class="${R.stars >= 3 ? "on" : ""}">★ ${L({ en: "Healthy and within budget", ar: "بصحة كويسة وفي حدود الميزانية" })}</li></ul></div>
    <div class="resholo"><canvas id="holoRes" class="holo"></canvas><div class="holotag">${L({ en: "The real NASA spacecraft", ar: "المركبة الحقيقية بتاعة ناسا" })}</div></div></div>
    <div class="cols2">
      <div class="hcard"><h3>${L({ en: "What you did well", ar: "اللي عملته صح" })}</h3><ul>${(good.length ? good : [{ en: "You tried! Every mission team learns from its first flight.", ar: "انت جرّبت! وكل تيم بيتعلم من أول رحلة." }]).slice(0, 3).map(x => `<li>${L(x)}</li>`).join("")}</ul></div>
      <div class="hcard"><h3>${L({ en: "Fix next time", ar: "صلّحه المرة الجاية" })}</h3><ul>${(fix.length ? fix : [{ en: "Nothing! Try a harder mission.", ar: "ولا حاجة! جرّب مهمة أصعب." }]).slice(0, 3).map(x => `<li>${L(x)}</li>`).join("")}</ul></div>
    </div>
    <div class="hcard fact"><h3>${L({ en: "Real NASA fact", ar: "معلومة حقيقية من ناسا" })}</h3><p>${L(m.fact)}</p></div>
    <div class="row"><button class="hbtn" type="button" data-act="sretry">${L({ en: "Change my choices and fly again", ar: "غيّر اختياراتي وطير تاني" })}</button>
      ${next ? `<button class="hbtn ghost" type="button" data-act="snextm">${L({ en: "Next mission", ar: "المهمة اللي بعدها" })}</button>` : ""}
      <button class="linkbtn" type="button" data-go="spick">${L({ en: "All missions", ar: "كل المهمات" })}</button></div>
  </section>`;
}
SIMPLE_AFTER.sresult = () => { const cv = $("#holoRes"); if (!Space3D.ok || !cv) return; const h = Space3D.createHolo(cv); h && h.setModel(SM().model); };
const SIMPLE = { shome, spick, sbrief, sbuild, sfly, sresult };
function sClick(t) {
  if (typeof lClick === "function" && lClick(t)) return true;
  if (t.dataset.smi !== undefined) { SA.mi = +t.dataset.smi; SA.pick = {}; SA.step = 0; go("sbrief"); return true; }
  if (t.dataset.sstep !== undefined) { const i = +t.dataset.sstep; if (i <= Object.keys(SA.pick).length) { SA.step = i; SA.hover = null; render(); } return true; }
  if (t.dataset.scard) { const s = STEP_ORDER[SA.step]; SA.pick[s.k] = SM().steps[s.k].find(c => c.k === t.dataset.scard); SA.hover = null;
    document.querySelectorAll(".ccard[data-scard]").forEach(b => b.classList.toggle("sel", b === t)); const nb = document.querySelector("[data-act=snext],[data-act=slaunch]"); if (nb) nb.disabled = SA.step < 3 ? false : !sCompute(SA.pick).done;
    document.querySelectorAll(".stp").forEach((b, i) => b.classList.toggle("done", !!SA.pick[STEP_ORDER[i].k])); const tag = document.querySelector(".holotag"); if (tag) tag.textContent = sCompute(SA.pick).done ? L({ en: "Spacecraft ready", ar: "المركبة جاهزة" }) : L({ en: "Building your spacecraft…", ar: "بنبني مركبتك…" });
    document.querySelector(".build .wallet") && (document.querySelector(".build .wallet b").textContent = sCompute(SA.pick).cost);
    sRenderBuildParts(); sRefreshHolo(); return true; }
  const a = t.dataset.act;
  if (a === "snext") { SA.step = Math.min(3, SA.step + 1); SA.hover = null; render(); return true; }
  if (a === "sprev") { SA.step = Math.max(0, SA.step - 1); SA.hover = null; render(); return true; }
  if (a === "slaunch") { go("sfly"); sRunFlight().catch(err => { if (err !== "abort") console.error(err); }); return true; }
  if (a === "sretry") { SA.step = 0; go("sbuild"); return true; }
  if (a === "snextm") { SA.mi++; SA.pick = {}; SA.step = 0; go("sbrief"); return true; }
  if (a === "steam") { A.mode = "team"; A.simple = true; if (A.players.length < 2) A.players = ["Player 1", "Player 2", "Player 3", "Player 4"]; go("setup"); return true; }
  if (a === "expert") { A.simple = false; go("home"); return true; }
  if (a === "easy") { A.simple = true; go("lhome"); return true; }
  return false;
}
document.addEventListener("pointerover", e => { const c = e.target.closest && e.target.closest(".ccard[data-scard]"); if (!c || A.screen !== "sbuild") return; const s = STEP_ORDER[SA.step]; const card = SM().steps[s.k].find(x => x.k === c.dataset.scard); if (SA.hover !== card) { SA.hover = card; sRenderBuildParts(); } });
document.addEventListener("pointerout", e => { const c = e.target.closest && e.target.closest(".ccard[data-scard]"); if (!c || A.screen !== "sbuild") return; if (!e.relatedTarget || !c.contains(e.relatedTarget)) { SA.hover = null; sRenderBuildParts(); } });

window.SA=SA;
