/* ================= DATA ================= */
const VE = 3.138; // km/s, chemical engine exhaust velocity (Isp 320 s)
const ROLES = {
  planner:{name:"Mission Planner", does:"Orbit, rocket and mission length"},
  engineer:{name:"Spacecraft Engineer", does:"Power, battery, computer, structure, pointing, shielding"},
  science:{name:"Science Lead", does:"Instruments that answer the mission goal"},
  comms:{name:"Communications Lead", does:"Antenna, ground stations and data"}
};
const ROLE_IDS = ["planner","engineer","science","comms"];
const CAPNAME = {LEO:"low Earth orbit", GTO:"geostationary transfer orbit", ESC:"Earth escape (Moon, L2, Mars, asteroids)"};
const LV = {
  rideshare:{name:"Rideshare", s:"Share a ride with other satellites", cap:{LEO:200,GTO:0,ESC:0}, c:6},
  small:{name:"Small rocket", s:"Cheap, for small satellites", cap:{LEO:300,GTO:0,ESC:40}, c:8},
  medium:{name:"Medium rocket", s:"The workhorse", cap:{LEO:15000,GTO:5500,ESC:4000}, c:70},
  heavy:{name:"Heavy rocket", s:"For the biggest spacecraft", cap:{LEO:60000,GTO:25000,ESC:15000}, c:150},
  superheavy:{name:"Super-heavy rocket", s:"Moon and Mars class, carries crews", cap:{LEO:95000,GTO:40000,ESC:27000}, c:2000}
};
const BATT = {none:{name:"No battery",wh:0,m:0,p:0,c:0}, small:{name:"Small battery",wh:200,m:2,p:0,c:.5}, medium:{name:"Medium battery",wh:800,m:6,p:0,c:1.5}, large:{name:"Large battery",wh:2500,m:18,p:0,c:4}};
const COMPUTER = {basic:{name:"Basic computer",s:"Simple, low power",m:2,p:10,c:1}, advanced:{name:"Advanced computer",s:"Can compress data",m:4,p:20,c:4}, dual:{name:"Advanced + backup",s:"A second computer takes over if one fails",m:8,p:35,c:8}};
const ADCS = {basic:{name:"Basic pointing",s:"Magnetic torquers: roughly points the right way",m:2,p:5,c:1}, precise:{name:"Precise pointing",s:"Reaction wheels + star tracker",m:10,p:25,c:5}};
const SHIELD = {none:{name:"No shielding",m:0,p:0,c:0}, light:{name:"Light shielding",s:"Aluminium covers",m:10,p:0,c:1}, heavy:{name:"Heavy shielding",s:"Thick metal vault",m:40,p:0,c:3}};
const STRUCT = {light:{name:"Lightweight frame",s:"Carbon fibre: light but delicate, costly",f:.15,c:8}, standard:{name:"Standard frame",s:"Aluminium honeycomb",f:.25,c:3}, strong:{name:"Reinforced frame",s:"Heavy, survives impacts",f:.4,c:5}};
const ANT = {small:{name:"Small antenna",s:"Light and cheap, slow",m:2,p:10,c:1}, medium:{name:"Medium dish",s:"Good balance",m:8,p:30,c:3}, large:{name:"Large dish",s:"Fast, heavy, needs power",m:25,p:70,c:8}};
const INSTR = {
  cam_med:{name:"Wide camera (30 m)", m:6,p:10,c:3,gb:4,res:30, what:"Big-picture photos"},
  cam_high:{name:"Sharp camera (3 m)", m:30,p:45,c:18,gb:70,res:3,precise:1, what:"Very detailed photos; needs precise pointing"},
  multispec:{name:"Plant-health camera (10 m)", m:15,p:25,c:10,gb:25,res:10, what:"Sees 13 colours, including infrared that shows healthy plants"},
  thermal:{name:"Heat camera (infrared)", m:12,p:30,c:8,gb:12, what:"Sees heat: clouds at night, fires, cold craters"},
  sounder:{name:"Weather sounder", m:60,p:80,c:30,gb:8, what:"Measures temperature and humidity at many heights"},
  lightning:{name:"Lightning mapper", m:25,p:40,c:15,gb:10, what:"Spots lightning flashes that warn of severe storms"},
  neutron:{name:"Water-ice detector", m:15,p:15,c:12,gb:.5, what:"Counts neutrons; fewer neutrons mean hydrogen, which means water"},
  laser:{name:"Laser altimeter", m:20,p:35,c:14,gb:1, what:"Measures height with laser pulses, even in total darkness"},
  radar_s:{name:"Mini radar", m:25,p:60,c:20,gb:3, what:"Sees under the surface"},
  ir_tel:{name:"Infrared camera (cold)", m:200,p:150,c:120,gb:40,precise:1, what:"Sees the faint heat of the first galaxies. Must be very cold"},
  spectro:{name:"Spectrograph", m:150,p:120,c:90,gb:20,precise:1, what:"Splits light into colours to learn what stars are made of"},
  sunshield:{name:"Sunshield (5 layers)", m:400,p:0,c:150,gb:0, what:"Tennis-court-sized shade that keeps the telescope cold"},
  vis_cam:{name:"Visible-light camera", m:100,p:80,c:60,gb:30,precise:1, what:"Takes regular-light pictures, like Hubble"},
  drill:{name:"Drill & robotic arm", m:45,p:80,c:60,gb:.2, what:"Drills into rock to reach material protected from radiation"},
  rover_spec:{name:"Rock chemistry spectrometer", m:10,p:25,c:30,gb:.3, what:"Finds chemicals that life could leave behind"},
  mastcam:{name:"Stereo cameras", m:10,p:20,c:20,gb:1, what:"3D views for driving and for geology"},
  weather_st:{name:"Weather station", m:3,p:10,c:8,gb:.05, what:"Wind, temperature and dust measurements"},
  sample_cache:{name:"Sample tubes", m:40,p:10,c:80,gb:0, what:"Seals rock cores for a future mission to bring home"},
  navcam:{name:"Smart navigation camera", m:10,p:15,c:12,gb:1,precise:1, what:"Finds the target and steers the spacecraft by itself"},
  ballast:{name:"Extra impact mass (+100 kg)", m:100,p:0,c:1,gb:0, what:"Dead weight that makes the hit harder"},
  cubesat:{name:"Companion cubesat camera", m:14,p:0,c:20,gb:.5, what:"Flies behind and films the impact"},
  crew_cam:{name:"Crew 4K cameras", m:15,p:40,c:5,gb:20, what:"Astronauts film and photograph through the windows"},
  farside_cam:{name:"Far-side mapping camera", m:30,p:50,c:25,gb:30,precise:1, what:"Maps the side of the Moon we never see from Earth"},
  rad_sensors:{name:"Crew radiation sensors", m:8,p:10,c:10,gb:.2, what:"Measure the dose astronauts get beyond Earth's magnetic shield"},
  bio_exp:{name:"Biology experiments", m:60,p:120,c:40,gb:1, what:"Study how cells and plants react to deep space"},
  rover_tele:{name:"Robots driven from orbit", m:3000,p:200,c:1800,gb:8, what:"The crew drives rovers on the surface with almost no signal delay"},
  med_lab:{name:"Medical lab", m:400,p:300,c:150,gb:.5, what:"Treats illness and injury far from Earth"},
  greenhouse:{name:"Plant growth lab", m:600,p:800,c:200,gb:.3, what:"Grows fresh food and studies plants in space"}
};
const LSS = {open:{name:"Stored supplies only",s:"Carry all air, water and food",perDay:6,m:300,p:300,c:50},
  partial:{name:"Recycle air & water",s:"Like the Space Station",perDay:3.5,m:1200,p:900,c:300},
  closed:{name:"Advanced closed loop",s:"Recycles almost everything",perDay:1.6,m:2500,p:1600,c:900}};
const HEAT = {standard:{name:"Low-orbit heat shield",s:"Rated for 8 km/s",max:8,m:600,c:40},
  lunar:{name:"Lunar heat shield",s:"Rated for 11.5 km/s",max:11.5,m:1400,c:150},
  mars:{name:"Mars-return heat shield",s:"Rated for 14 km/s",max:14,m:2400,c:400}};
const SHELTER = {m:600,c:40}, ABORT = {c:250};
const ENGINE = {chem:{name:"Chemical (hydrogen–oxygen)",s:"Isp 450 s, proven",isp:450,m:0,c:0}, ntp:{name:"Nuclear thermal",s:"Isp 900 s, twice as efficient",isp:900,m:12000,c:5000}};

const MISSIONS = [
 {id:"delta", level:"Easy", name:"Nile Delta Crop Watch", place:"Earth orbit", scene:"earth",
  story:"Egypt's farmers need to know which fields are thirsty or sick. Build a satellite that photographs the Nile Delta often enough to catch problems early.",
  concept:"Mass and money. Every part you add costs kilograms and dollars, and the rocket you can afford limits how heavy you can be.",
  budget:150, life:3, lifeRange:[1,7], baseCost:25, opsYear:3, stationCost:1, extraMass:20, basePower:20, sun:1, capClass:"LEO",
  orbits:[
   {id:"leo400",name:"Low orbit, 400 km",s:"Sharpest pictures. Thin air drags you down, so you burn fuel to stay up.",keep:.03,ecl:.38,eclH:.6,revisit:5,resF:.67},
   {id:"sso600",name:"Sun-synchronous, 600 km",s:"Passes over Egypt at the same time each day, so every photo has the same light.",keep:.005,ecl:.35,eclH:.6,revisit:3,resF:1},
   {id:"sso800",name:"Sun-synchronous, 800 km",s:"Wider view each pass, so it revisits sooner, but pictures are less sharp.",keep:.001,ecl:.33,eclH:.6,revisit:2,resF:1.33}],
  ride:{id:"sso550",name:"Rideshare drop-off, 550 km",keep:.008,ecl:.35,eclH:.6,revisit:3,resF:.92},
  dl:{small:8,medium:30,large:80},
  instr:{cam_med:4,cam_high:6,multispec:10,thermal:6},
  def:{orbit:"sso600",lv:"small",life:3,power:"solar",panel:1.5,battery:"small",structure:"standard",computer:"basic",adcs:"basic",shield:"none",instr:["cam_med"],antenna:"small",stations:1},
  goals:[
   {t:"Can see plant health", f:c=>c.has("multispec"), why:"Only the plant-health camera sees the infrared colours that tell healthy plants from stressed ones."},
   {t:"Pictures sharper than 10 m", f:c=>c.bestRes<=10.01, why:"A camera's sharpness depends on the camera and on how high you fly. Higher orbit = blurrier."},
   {t:"Revisits every 3 days or less", f:c=>c.orb.revisit<=3, why:"How often you pass over Egypt depends on your orbit."},
   {t:"Works for 3 years", f:c=>c.effLife>=3, why:"Mission length is set by the Mission Planner, and the money must last that long."}],
  rules:["A sharper camera makes much more data. Your antenna must be able to send it all down.","Low orbits give sharp pictures, but air drag eats fuel.","Rideshares and small rockets are cheap but only carry light satellites."],
  events:["solar_storm","debris","battery_cell","glitch","station_outage","eclipse_season"],
  real:{name:"Sentinel-2 and Landsat",text:"ESA's Sentinel-2 satellites take 10 m plant-health pictures in 13 colours from a 786 km sun-synchronous orbit; each weighs about 1,100 kg. NASA's Landsat satellites have watched Earth's farms since 1972."}},

 {id:"storm", level:"Easy", name:"Storm Watch", place:"Earth orbit", scene:"earth",
  story:"Storms grow fast over Africa and the Mediterranean. Forecasters want to watch them every few minutes, day and night, for years.",
  concept:"Orbits. The height and shape of an orbit decide what you can see, how often, and how hard it is to get there.",
  budget:500, life:8, lifeRange:[3,15], baseCost:200, opsYear:6, stationCost:1, extraMass:400, basePower:200, sun:1, capClass:"LEO",
  orbits:[
   {id:"polar",name:"Low polar orbit, 800 km",s:"Sees the whole planet in a day, but passes over each place only twice.",keep:.001,ecl:.33,eclH:.6,continuous:false,sciF:.5},
   {id:"geo",name:"Geostationary, 35,786 km",s:"Circles once a day, exactly as fast as Earth turns, so it hovers over one spot.",capClass:"GTO",dv:1.8,keep:.05,ecl:.01,eclH:1.2,continuous:true}],
  dl:{small:20,medium:80,large:200},
  instr:{cam_med:5,thermal:8,sounder:8,lightning:7},
  def:{orbit:"polar",lv:"medium",life:8,power:"solar",panel:3,battery:"medium",structure:"standard",computer:"advanced",adcs:"basic",shield:"light",instr:["cam_med","sounder"],antenna:"medium",stations:1},
  goals:[
   {t:"Watches the same area nonstop", f:c=>!!c.orb.continuous, why:"Only geostationary orbit keeps the satellite over the same spot all the time."},
   {t:"Sees clouds at night", f:c=>c.has("thermal"), why:"Ordinary cameras see nothing at night. A heat camera sees warm and cold clouds anytime."},
   {t:"Works for 8 years", f:c=>c.effLife>=8, why:"Weather agencies plan years ahead. Longer missions need more fuel and money."},
   {t:"Sends all its data", f:c=>c.dataFrac>=.95, why:"Forecasters need every picture, so the antenna must keep up."}],
  rules:["Reaching geostationary orbit needs a rocket that can reach GTO plus 1.8 km/s of your own fuel.","From geostationary orbit you can talk to the ground nonstop.","Weather instruments are power-hungry. Size your solar panels."],
  events:["solar_storm","battery_cell","glitch","station_outage","eclipse_season"],
  real:{name:"GOES-16",text:"NASA and NOAA's GOES-16 (2016) weighed about 5,200 kg at launch. From geostationary orbit it photographs the whole Americas every 10 minutes and carried the first lightning mapper in geostationary orbit."}},

 {id:"moon", level:"Medium", name:"Lunar Ice Hunter", place:"Moon orbit", scene:"moon",
  story:"Some craters near the Moon's poles never see sunlight. Water ice may hide there, and future astronauts could drink it or turn it into rocket fuel. Find it.",
  concept:"Fuel. To stop at the Moon you must brake with your engine. Fuel adds mass, and that mass needs even more fuel: the rocket equation.",
  budget:500, life:2, lifeRange:[1,6], baseCost:200, opsYear:15, stationCost:4, extraMass:150, basePower:60, sun:1, capClass:"ESC",
  orbits:[
   {id:"eq100",name:"Equatorial orbit, 100 km",s:"Easy and stable, but it never passes over the poles.",dv:.8,keep:.03,ecl:.4,eclH:.8,sciF:.3},
   {id:"polar100",name:"Polar orbit, 100 km",s:"Passes over both poles every two hours.",dv:.9,keep:.05,ecl:.4,eclH:.8,poles:true},
   {id:"polar50",name:"Low polar orbit, 50 km",s:"Closer means sharper data, but lumpy lunar gravity needs frequent fuel burns.",dv:.9,keep:.15,ecl:.4,eclH:.8,poles:true,sciF:1.15}],
  dl:{small:.5,medium:3,large:12},
  instr:{neutron:10,laser:7,thermal:7,cam_high:5,radar_s:6},
  def:{orbit:"eq100",lv:"medium",life:2,power:"solar",panel:3,battery:"medium",structure:"standard",computer:"advanced",adcs:"basic",shield:"light",instr:["cam_high"],antenna:"medium",stations:1},
  goals:[
   {t:"Flies over the poles", f:c=>!!c.orb.poles, why:"The icy craters are at the poles. Only a polar orbit passes over them."},
   {t:"Can detect water ice", f:c=>c.has("neutron"), why:"Cameras can't see into craters that are always dark. A neutron detector senses hydrogen in the soil."},
   {t:"Works for 2 years", f:c=>c.effLife>=2, why:"Mapping both poles in detail takes time."},
   {t:"Sends 80% of its data", f:c=>c.dataFrac>=.8, why:"The Moon is 1,000 times farther than low orbit, so data rates drop sharply."}],
  rules:["Every kilogram you bring needs about 0.3 kg of fuel just to brake into lunar orbit.","Data rates from the Moon are low: bring a bigger antenna or more ground-station time.","Cameras are nearly useless inside craters that never see sunlight."],
  events:["solar_storm","micrometeoroid","battery_cell","glitch","station_outage"],
  real:{name:"Lunar Reconnaissance Orbiter (LRO)",text:"NASA's LRO launched in 2009 weighing 1,916 kg and flew a 50 km polar orbit. It carries a neutron detector, a laser altimeter and a heat camera, and has mapped the coldest, darkest polar craters for more than 15 years."}},

 {id:"telescope", level:"Medium", name:"Deep Space Telescope", place:"Sun–Earth L2", scene:"l2",
  story:"Astronomers want to see the first galaxies. Their light reaches us as faint heat (infrared), so the telescope must be extremely cold and far from Earth's warmth.",
  concept:"Heat. Infrared telescopes must stay colder than −220 °C, so where you put them and how you shade them matters.",
  budget:1500, life:5, lifeRange:[2,10], baseCost:600, opsYear:40, stationCost:5, extraMass:2600, basePower:300, sun:1, capClass:"ESC",
  orbits:[
   {id:"leo600",name:"Low Earth orbit, 600 km",s:"Like Hubble: easy to reach, but Earth's heat and shadow come and go every 95 minutes.",capClass:"LEO",keep:.01,ecl:.36,eclH:.6},
   {id:"l2",name:"Sun–Earth L2, 1.5 million km",s:"A balance point beyond the Moon. Sun, Earth and Moon all sit on one side, so one shade blocks them all.",dv:.15,keep:.003,ecl:0,eclH:0,cold:true}],
  dl:{small:5,medium:25,large:80},
  instr:{ir_tel:10,spectro:8,vis_cam:5,sunshield:0},
  def:{orbit:"leo600",lv:"medium",life:5,power:"solar",panel:6,battery:"medium",structure:"standard",computer:"advanced",adcs:"precise",shield:"light",instr:["ir_tel","vis_cam"],antenna:"medium",stations:1},
  goals:[
   {t:"Infrared camera stays cold", f:c=>c.has("ir_tel")&&c.has("sunshield")&&!!c.orb.cold, why:"It needs both the sunshield and a cold place far from Earth (L2)."},
   {t:"Can tell what stars are made of", f:c=>c.has("spectro"), why:"Only a spectrograph splits light into colours that reveal chemicals."},
   {t:"Works for 5 years", f:c=>c.effLife>=5, why:"Big telescopes are built to last."},
   {t:"Sends 90% of its data", f:c=>c.dataFrac>=.9, why:"Telescope images are huge."}],
  rules:["Without a sunshield, an infrared camera sees only its own heat.","A big telescope plus its shade is heavy: check that your rocket can lift it to escape.","L2 is far away, so you need a strong data link."],
  events:["solar_storm","micrometeoroid","heat_leak","glitch","station_outage"], mustEvent:"heat_leak",
  real:{name:"James Webb Space Telescope",text:"JWST launched in 2021 weighing about 6,200 kg, with a 6.5 m gold mirror and a tennis-court-sized five-layer sunshield. It orbits Sun–Earth L2, 1.5 million km away, and its camera runs below −230 °C."}},

 {id:"mars", level:"Hard", name:"Mars Life Seeker", place:"Mars surface", scene:"mars",
  story:"Billions of years ago Mars had lakes. Land a rover in an old lakebed, drill into rocks, and look for signs that tiny life once lived there.",
  concept:"Distance and delay. Signals take up to 22 minutes each way, so the rover must land and drive by itself, and sending data home is slow.",
  budget:2500, life:2, lifeRange:[1,8], baseCost:1300, opsYear:60, stationCost:6, extraMass:450, basePower:60, sun:.43, capClass:"ESC", entry:1.5, nightLoad:.3, relay:true, surface:true,
  orbits:[
   {id:"plain",name:"Flat lava plain",s:"Smooth and safe for landing, but no lake was ever here.",dv:.05,ecl:.5,eclH:12,dust:.8,sciF:.45},
   {id:"jezero",name:"Jezero Crater (old lake)",s:"Ancient river delta, top science. Rocks and cliffs make landing dangerous.",dv:.05,ecl:.5,eclH:12,dust:.8,hazard:true},
   {id:"north",name:"Northern ice plains",s:"Buried ice! Very cold, and long dark nights drain batteries.",dv:.05,ecl:.6,eclH:16,dust:.7,sciF:.7}],
  dl:{small:.02,medium:.1,large:.4},
  instr:{drill:9,rover_spec:9,mastcam:6,weather_st:3,sample_cache:7},
  def:{orbit:"plain",lv:"medium",life:2,power:"solar",panel:4,battery:"medium",structure:"standard",computer:"advanced",adcs:"basic",shield:"light",instr:["mastcam","weather_st"],antenna:"medium",stations:1,relay:false},
  goals:[
   {t:"Lands in the ancient lake", f:c=>c.orb.id==="jezero", why:"Signs of past life are most likely where water once pooled."},
   {t:"Can drill and analyse rocks", f:c=>c.has("drill")&&c.has("rover_spec"), why:"The surface is baked by radiation; you must drill and test the chemistry."},
   {t:"Works for 2 years", f:c=>c.effLife>=2, why:"Driving to good rocks and drilling takes a long time."},
   {t:"Sends 70% of its data home", f:c=>c.dataFrac>=.7, why:"Mars is up to 400 million km away. Direct links are very slow."}],
  rules:["Landing among rocks needs precise pointing (terrain-relative navigation) or the rover crashes.","Mars gets 43% of Earth's sunlight, and dust storms block even that. A nuclear RTG works day and night.","Relaying data through Mars orbiters is 10 times faster than talking to Earth directly, but costs money."],
  events:["dust_storm","solar_storm","glitch","station_outage","battery_cell"], mustEvent:"dust_storm",
  real:{name:"Perseverance rover",text:"Perseverance landed in Jezero Crater in February 2021. The 1,025 kg rover runs on a nuclear RTG of about 110 W, used terrain-relative navigation to dodge rocks while landing, and seals rock cores in tubes for a future return mission. The solar-powered Opportunity rover went silent in a 2018 dust storm."}},

 {id:"dart", level:"Hard", name:"Asteroid Defender", place:"Deep space", scene:"dart",
  story:"A small moonlet circles a bigger asteroid. Crash into it hard enough to change its orbit and prove we could push a dangerous asteroid away from Earth one day.",
  concept:"Momentum. A heavier or faster spacecraft pushes harder, but more speed makes aiming much harder.",
  budget:350, life:1, lifeRange:[1,3], baseCost:120, opsYear:20, stationCost:4, extraMass:250, basePower:150, sun:.9, capClass:"ESC", impact:true,
  orbits:[
   {id:"slow",name:"Gentle catch-up, 2 km/s",s:"Easier to aim, but a much smaller push. Needs more fuel to match the asteroid.",dv:1.2,ecl:0,eclH:0,speed:2},
   {id:"fast",name:"Head-on intercept, 6 km/s",s:"A big push, but only seconds to aim before impact.",dv:.3,ecl:0,eclH:0,speed:6,aimHard:true}],
  dl:{small:.05,medium:.5,large:2},
  instr:{navcam:6,cubesat:6,cam_med:2,ballast:3},
  def:{orbit:"slow",lv:"medium",life:1,power:"solar",panel:3,battery:"small",structure:"standard",computer:"advanced",adcs:"basic",shield:"none",instr:["cam_med"],antenna:"medium",stations:1},
  goals:[
   {t:"Hits the asteroid", f:c=>c.hits, why:"You need the smart navigation camera, and at 6 km/s also precise pointing."},
   {t:"Changes its orbit by 10+ minutes", f:c=>c.hits&&c.deflect>=10, why:"Push = mass × speed. Go faster or heavier."},
   {t:"Someone films the impact", f:c=>c.has("cubesat"), why:"Without pictures of the crash, scientists can't measure what happened."},
   {t:"Stays within budget", f:c=>c.cost<=c.budget, why:"Planetary defence must be affordable to be useful."}],
  rules:["At 6 km/s you get no second chance: the spacecraft must steer itself with a smart camera and precise pointing.","More mass hits harder but needs a bigger rocket.","If nobody films the impact, you learn much less."],
  events:["target_drift","solar_storm","micrometeoroid","glitch","station_outage"], mustEvent:"target_drift",
  real:{name:"DART",text:"NASA's DART hit the moonlet Dimorphos on 26 September 2022 at about 6.1 km/s, weighing roughly 570 kg. Its smart navigation camera steered it in the final hours. The hit shortened Dimorphos's orbit by about 32 minutes, and Italy's LICIACube cubesat photographed the impact."}}
];


/* ---- crewed missions ---- */
MISSIONS.splice(4,0,
 {id:"artemis", level:"Medium", name:"Crew Around the Moon", place:"Lunar flyby · crewed", scene:"artemis", crew:true,
  story:"Fly four astronauts around the far side of the Moon and bring them home safely: the first step toward people living on the Moon.",
  concept:"Keeping people alive. Astronauts need air, water and food every day, a heat shield strong enough to come home, and a way to escape if the rocket fails.",
  budget:7000, life:1, lifeRange:[1,1], baseCost:2500, opsYear:400, stationCost:30, extraMass:14000, basePower:2500, sun:1, capClass:"ESC", reentry:11, panelMax:80,
  orbits:[
   {id:"free",name:"Free-return flyby (~10 days)",s:"Loops behind the Moon and falls back to Earth with almost no engine burns. If the engine fails, the crew still comes home.",dv:.3,days:10,ecl:.03,eclH:.6},
   {id:"lunar_orbit",name:"Lunar orbit (~14 days)",s:"Stops in orbit around the Moon for more science, but needs two big burns. If the engine fails, the crew is stuck.",dv:1.8,days:14,ecl:.2,eclH:.8,sciF:1.3}],
  dl:{small:2,medium:10,large:40},
  instr:{crew_cam:6,farside_cam:8,rad_sensors:8,bio_exp:6},
  def:{orbit:"free",lv:"superheavy",life:1,days:8,power:"solar",panel:30,battery:"large",structure:"standard",computer:"dual",adcs:"precise",shield:"light",lss:"open",heatshield:"standard",shelter:false,abort:true,instr:["crew_cam"],antenna:"medium",stations:1},
  goals:[
   {t:"Crew comes home safely", f:c=>c.heatOk&&c.suppliesOk&&c.margin>=1, why:"Returning from the Moon hits the air at 11 km/s, so you need a lunar heat shield, and supplies must last the whole trip."},
   {t:"Has a launch escape system", f:c=>!!c.d.abort, why:"If the rocket fails, an escape motor pulls the capsule away. No crew launches without one."},
   {t:"Maps the far side of the Moon", f:c=>c.has("farside_cam"), why:"We can never see the far side from Earth. A mapping camera makes the trip count for science."},
   {t:"Measures the crew's radiation dose", f:c=>c.has("rad_sensors"), why:"Learning how much radiation people get beyond Earth's magnetic shield is key for going to Mars."}],
  rules:["Without recycling, each astronaut uses about 6 kg of air, water and food per day.","Coming home from the Moon is fast (11 km/s): a low-orbit heat shield would burn through.","Only a super-heavy rocket can send a crew capsule toward the Moon."],
  events:["solar_flare_crew","co2_scrubber","far_side","micrometeoroid","engine_anomaly"], mustEvent:"far_side",
  real:{name:"Artemis II and Apollo 8",text:"NASA's Artemis II flies four astronauts around the Moon in the Orion capsule on a free-return path of about 10 days, launched by the SLS super-heavy rocket. Apollo 8 first carried people around the Moon in December 1968. In 1970, Apollo 13's crew got home thanks to a free-return path and a CO₂ filter adapter built from spare parts."}});
MISSIONS.push(
 {id:"marscrew", level:"Hard", name:"First Crew to Mars", place:"Mars orbit · crewed", scene:"marscrew", crew:true, multiLaunch:true,
  story:"Send four astronauts to Mars orbit, explore the surface with robots they drive in real time, and bring everyone home. Nobody has done this yet.",
  concept:"Radiation and supplies over years. A Mars trip lasts about two years, and the crew is exposed to deep-space radiation the whole way.",
  budget:45000, life:1, lifeRange:[1,1], baseCost:22000, opsYear:1500, stationCost:50, extraMass:45000, basePower:6000, sun:.6, capClass:"LEO", reentry:13, panelMax:300,
  orbits:[
   {id:"opp",name:"Short stay (opposition class)",s:"About 650 days in total, but only 30 days at Mars. Needs much more fuel.",dv:8.6,transit:620,stay:30,sciF:.35},
   {id:"conj",name:"Long stay (conjunction class)",s:"About 910 days in total with 550 days at Mars. Less fuel, much more time away.",dv:6.8,transit:360,stay:550}],
  dl:{small:1,medium:5,large:20},
  instr:{cam_high:5,rover_tele:10,med_lab:6,greenhouse:5},
  def:{orbit:"opp",lv:"superheavy",launches:3,life:1,days:600,engine:"chem",power:"solar",panel:120,battery:"large",structure:"standard",computer:"dual",adcs:"precise",shield:"light",lss:"partial",heatshield:"lunar",shelter:false,abort:false,instr:["cam_high"],antenna:"large",stations:2},
  goals:[
   {t:"Crew comes home safely", f:c=>c.heatOk&&c.suppliesOk&&c.margin>=1, why:"Coming home from Mars hits the air at about 13 km/s, and supplies must last every day of the trip."},
   {t:"Radiation dose under 1,000 mSv", f:c=>c.dose<1000, why:"Deep space adds about 1.8 mSv per day. Faster trips and heavy shielding lower the dose. Even NASA hasn't solved this fully."},
   {t:"Explores the surface", f:c=>c.has("rover_tele"), why:"From orbit, the crew can drive robots on the surface with almost no signal delay."},
   {t:"Stays within budget", f:c=>c.cost<=c.budget, why:"A Mars program has to be affordable to happen at all."}],
  rules:["Recycling air and water saves many tonnes of supplies over two years.","With chemical engines the ship needs several super-heavy launches. Nuclear thermal engines are twice as efficient.","Every day in deep space adds radiation. A faster trip and heavy shielding help."],
  events:["solar_flare_crew","co2_scrubber","crew_ill","micrometeoroid","engine_anomaly","glitch"], mustEvent:"crew_ill",
  real:{name:"Curiosity's radiation data and NASA's Mars plans",text:"No crew has gone to Mars yet. NASA studies both short-stay and long-stay missions, and tested nuclear thermal rocket engines in the NERVA program of the 1960s. Curiosity's radiation detector measured about 1.8 mSv per day on its way to Mars in 2011–2012: about 660 mSv for a year of travel."}});
MISSIONS.forEach(m=>{ m.panelMax = m.panelMax || 30; });

/* ---- surprise events: g = what you gain/protect, r = what you lose/risk ---- */
const pct = c => Math.round((c.budget===Infinity?c.m.budget:c.budget)*.02);
const EVENTS = {
 solar_storm:{lead:"engineer", title:"Solar storm!", say:"Engineer here. Solar storm incoming! Charged particles hit us in two hours.", text:"The Sun just threw out a burst of charged particles. It reaches your spacecraft in 2 hours and can scramble electronics.",
  opts:[
   {l:"Switch to safe mode", g:"Electronics fully protected", r:"About 2 days of science", f:c=>({h:0,sci:.06,why:"Safe mode protected the electronics. You lost a couple of days of observations, the usual price of playing safe."})},
   {l:"Turn the body to shield the computer", g:"Most particles blocked, work continues", r:"Power drops for a while, small damage", f:c=>({h:-5,sci:.02,why:"Your solar panels pointed away from the Sun for a while, so power dropped, and a few particles still got through."})},
   {l:"Switch to the backup computer", g:"Main computer rests safely", r:"Only works if you built a backup computer", f:c=>c.d.computer==="dual"?{h:-2,sci:0,why:"Your backup computer took over while the main one rested. Redundancy paid off."}:{h:-15,sci:.03,why:"There is no backup computer on board! The main computer crashed and had to reboot under radiation."}},
   {l:"Keep going as planned", g:"No science lost", r:"Radiation damage, unless you built heavy shielding", f:c=>c.d.shield==="heavy"||c.m.surface?{h:0,sci:0,why:c.m.surface?"Mars's atmosphere absorbed most of the particles. Nothing happened.":"Your heavy shielding blocked the particles. Nothing happened, and you kept observing."}:c.d.shield==="light"?{h:-10,sci:0,why:"Light shielding stopped some particles, but a few memory chips were damaged."}:{h:-25,sci:0,why:"With no shielding, the particles hit the electronics directly. Several parts were damaged."}}]},
 debris:{lead:"planner", title:"Space junk ahead!", say:"Planner here. Space junk on a collision course. Closest approach in six hours.", text:"Tracking shows a fragment of a dead satellite may pass within 200 m of you in 6 hours.",
  opts:[
   {l:"Fire thrusters to dodge it", g:"No collision", r:"Fuel, so a slightly shorter mission", f:c=>({h:0,sci:.03,why:"Dodging used fuel meant for staying in orbit, so the mission ends a little earlier. The Space Station dodges debris like this."})},
   {l:"Buy more precise tracking data", g:"You learn the exact risk", r:"Money", f:c=>({h:-2,cost:1,why:"Better tracking showed it would miss by 1 km. You paid for the data and kept working."})},
   {l:"Turn your strongest side toward it", g:"Smaller damage if hit", r:"Some damage, less with a reinforced frame", f:c=>({h:c.d.structure==="strong"?-2:-8,sci:0,why:c.d.structure==="strong"?"A paint-fleck-sized piece hit your reinforced side and bounced off.":"A tiny piece hit. Your frame took a dent."})},
   {l:"Keep going as planned", g:"No fuel or money spent", r:"A hit, unless your frame is reinforced", f:c=>c.d.structure==="strong"?{h:0,sci:0,why:"Your reinforced frame shrugged off the small fragments. Nothing happened."}:{h:-20,sci:.02,why:"A small fragment punched through a solar panel. At 10 km/s even a tiny piece hits like a bullet."}}]},
 battery_cell:{lead:"engineer", title:"Battery cell failure", say:"Engineer here. We just lost a battery cell. Less power in the dark from now on.", text:"One battery cell stopped working. You now store less energy for the dark part of each orbit or night.",
  opts:[
   {l:"Turn off instruments in the dark", g:"Battery stays safe", r:"Science during dark periods", f:c=>({h:0,sci:.08,why:"No energy shortage, but you lost the observations you would have made in shadow."})},
   {l:"Turn off heaters to save energy", g:"Energy saved, science continues", r:"Cold damage to parts", f:c=>({h:-8,sci:0,why:"Parts got very cold. Cold electronics and batteries wear out faster."})},
   {l:"Run instruments at half power", g:"Some science, some safety", r:"A little of both", f:c=>({h:-3,sci:.04,why:"A compromise: a little less science and a little stress on the battery."})},
   {l:"Keep going as planned", g:"Full science", r:"Battery damage, unless it's large or you have an RTG", f:c=>c.d.power!=="solar"||c.d.battery==="large"?{h:0,sci:0,why:c.d.power!=="solar"?"Your RTG keeps supplying power day and night, so the battery hardly matters. Nothing happened.":"Your large battery has spare cells. Nothing happened."}:c.d.battery==="medium"?{h:-10,sci:0,why:"The medium battery ran low every night, stressing the remaining cells."}:{h:-20,sci:.03,why:"The small battery emptied in every shadow and the spacecraft browned out."}}]},
 glitch:{lead:"comms", title:"Software glitch", say:"Comms here. The flight computer keeps rebooting. It's a software bug.", text:"The onboard computer keeps restarting because of a software bug.",
  opts:[
   {l:"Restart it from the ground", g:"Quick and free", r:"1 day of work, small stress", f:c=>({h:-2,sci:.03,why:"A clean restart fixed it for now. You lost a day of work."})},
   {l:"Send a software fix", g:"Fixed for good, no damage", r:"Money for engineers' overtime", f:c=>({h:0,cost:pct(c),why:`Engineers worked overtime to write and test a patch ($${pct(c)}M). Problem solved for good.`})},
   {l:"Switch to the backup computer", g:"Instant fix", r:"Only works if you built a backup computer", f:c=>c.d.computer==="dual"?{h:0,sci:0,why:"The backup computer took over smoothly."}:{h:-15,sci:.03,why:"There is no backup computer! The spacecraft tumbled while the main one rebooted."}},
   {l:"Keep going as planned", g:"Nothing to do", r:"Hardware stress, unless you have a backup computer", f:c=>c.d.computer==="dual"?{h:0,sci:0,why:"Your backup computer took over automatically. Nothing happened."}:{h:-18,sci:.05,why:"The restarts kept happening, and each one stressed the hardware."}}]},
 station_outage:{lead:"comms", title:"Ground station offline", say:"Comms here. Our main ground station just went offline for a week.", text:"A storm on Earth knocked out your main ground station for a week.",
  opts:[
   {l:"Store data on board until it's back", g:"Data kept on board", r:"Some data if memory fills (compression helps)", f:c=>c.d.compress?{h:0,sci:0,why:"Compression left room in memory, so everything fit."}:{h:0,sci:.05,why:"Memory filled up after three days, and the rest of the data was overwritten."}},
   {l:"Rent time on a partner station", g:"No data lost", r:"Money", f:c=>({h:0,cost:pct(c),why:`Space agencies share antennas. You paid $${pct(c)}M and lost nothing.`})},
   {l:"Take fewer observations this week", g:"Nothing is lost", r:"Fewer observations", f:c=>({h:0,sci:.05,why:"Fewer observations, but nothing was lost."})},
   {l:"Keep going as planned", g:"No cost", r:"A week of data, unless you have 2+ stations or a relay", f:c=>c.d.stations>=2||c.d.relay?{h:0,sci:0,why:c.d.relay?"Your data went through the Mars orbiter relay. Nothing happened.":"Your second ground station picked up the data. Nothing happened."}:{h:0,sci:.12,why:"With only one station, a week of data never reached Earth."}}]},
 eclipse_season:{lead:"engineer", title:"Long shadow season", say:"Engineer here. Shadow season is starting. Longer nights on every orbit.", text:"For the next weeks your orbit passes through Earth's shadow for longer than usual.",
  opts:[
   {l:"Turn off instruments in shadow", g:"Battery stays safe", r:"Some observations", f:c=>({h:0,sci:.05,why:"Safe on energy, but you lost some observations."})},
   {l:"Lower heater power", g:"Energy saved", r:"Cold stress on parts", f:c=>({h:-6,sci:0,why:"Parts got colder than they like."})},
   {l:"Use a low-power mode", g:"Balanced", r:"A little science and health", f:c=>({h:-3,sci:.02,why:"A small trade on both sides."})},
   {l:"Keep going as planned", g:"Full science", r:"Battery damage, unless it's sized for long shadows", f:c=>c.battOk&&c.d.battery!=="small"?{h:0,sci:0,why:"Your battery was sized for long shadows. Nothing happened."}:{h:-15,sci:.02,why:"The battery drained deep every orbit. Deep discharges age batteries fast."}}]},
 micrometeoroid:{lead:"planner", title:"Micrometeoroid shower", say:"Planner here. Micrometeoroid stream ahead. Tiny grains at twenty kilometres per second.", text:"A stream of sand-sized grains is crossing your path at 20 km/s.",
  opts:[
   {l:"Turn so sensors hide behind the body", g:"Sensors protected", r:"Short science pause", f:c=>({h:0,sci:.04,why:"Sensors stayed safe but couldn't look at the target for a while."})},
   {l:"Close instrument covers", g:"Full protection", r:"A longer science pause", f:c=>({h:0,sci:.06,why:"Fully protected, with a bigger pause in science."})},
   {l:"Shift your path slightly", g:"Avoid most grains", r:"Fuel and small damage", f:c=>({h:-3,sci:.02,why:"The burn used fuel and you still caught a few grains."})},
   {l:"Keep going as planned", g:"No pause", r:"Damage, unless your frame is reinforced", f:c=>c.d.structure==="strong"?{h:0,sci:0,why:"Your reinforced frame absorbed the grains. Nothing happened."}:{h:-15,sci:.02,why:"Grains pitted the surface and damaged a sensor."}}]},
 heat_leak:{lead:"science", title:"Telescope warming up", say:"Science here. The infrared camera is warming up. Our images are getting foggy.", text:"The infrared camera is warming slightly. Warm infrared pictures look foggy.",
  opts:[
   {l:"Turn so the shade blocks the Sun", g:"Camera cools down", r:"Short pause", f:c=>({h:0,sci:.03,why:"The camera cooled down after a pause."})},
   {l:"Use the visible camera for a while", g:"Keep observing", r:"Less valuable pictures", f:c=>({h:0,sci:.08,why:"You kept working, but with less valuable pictures."})},
   {l:"Run the cooler harder", g:"Camera stays cold, keep working", r:"The cooler wears out faster", f:c=>({h:-6,sci:0,why:"The cooler wore a bit faster."})},
   {l:"Keep going as planned", g:"No change", r:"Foggy pictures, unless you have the sunshield at L2", f:c=>c.has("sunshield")&&c.orb.cold?{h:0,sci:0,why:"Your sunshield at L2 kept it cold. Nothing happened."}:{h:-5,sci:.2,why:"Without a good shade in a cold place, the camera stayed foggy for weeks."}}]},
 dust_storm:{lead:"engineer", title:"Dust storm!", say:"Engineer here. A giant dust storm is covering the sky. Our sunlight is dropping fast.", text:"A planet-wide dust storm is darkening the sky. Sunlight on the ground may drop by 90%.",
  opts:[
   {l:"Hibernate until the sky clears", g:"Rover stays safe", r:"Weeks of driving", f:c=>({h:0,sci:.12,why:"The rover slept safely through the storm and lost weeks of driving."})},
   {l:"Wiggle the panels to shake off dust", g:"Some power back", r:"Strain on the motors", f:c=>({h:-6,sci:.04,why:"Some dust came off. The motors were strained."})},
   {l:"Do only the most important science", g:"Some science continues", r:"Some battery stress", f:c=>({h:-5,sci:.06,why:"You kept a little science going on low power."})},
   {l:"Keep going as planned", g:"Full science", r:"The rover may nearly freeze, unless it has an RTG", f:c=>c.d.power!=="solar"?{h:0,sci:0,why:"Your RTG doesn't need sunlight. The rover kept working. Nothing happened."}:{h:-30,sci:.05,why:"The batteries drained and the rover nearly froze. This is how Opportunity was lost in 2018."}}]},
 target_drift:{lead:"planner", title:"Target not where expected", say:"Planner here. The asteroid isn't where we expected. We're fifteen kilometres off target.", text:"New measurements show the asteroid is 15 km from where you are aiming.",
  opts:[
   {l:"Take navigation pictures and re-aim", g:"Back on target", r:"Slow and rough without a navigation camera", f:c=>c.has("navcam")?{h:0,sci:.02,why:"Your smart camera found the target and corrected course."}:{h:-5,sci:.1,why:"Without a navigation camera, re-aiming was slow and rough."}},
   {l:"Fire thrusters to correct now", g:"Back on target fast", r:"Fuel and a little strain", f:c=>({h:-3,sci:0,why:"The correction worked and used a little fuel."})},
   {l:"Ask big telescopes on Earth for help", g:"A precise position", r:"Money", f:c=>({h:0,cost:pct(c),why:`Observatories refined the asteroid's position ($${pct(c)}M).`})},
   {l:"Keep going as planned", g:"No cost", r:"An off-centre hit, unless your smart camera and precise pointing re-aim by themselves", f:c=>c.has("navcam")&&c.d.adcs==="precise"?{h:0,sci:0,why:"Your smart camera and precise pointing re-aimed automatically, just like DART. Nothing happened."}:{h:-5,sci:.25,why:"Without automatic aiming, you hit off-centre and pushed the asteroid less."}}]},
 solar_flare_crew:{lead:"engineer", title:"Solar flare: crew in danger", say:"Engineer here. Big solar flare! Radiation spikes in thirty minutes. Crew, we have to act now.", text:"A big solar flare! Radiation around the spacecraft will spike for 12 hours. Astronauts have no thick atmosphere to protect them out here.",
  opts:[
   {l:"Everyone into the storm shelter", g:"Crew protected", r:"Work stops for 12 hours (works best with a shelter)", f:c=>c.d.shelter?{h:0,sci:.05,why:"The crew waited it out behind the water walls of the shelter. Their dose stayed tiny."}:{h:-8,sci:.05,why:"You built no shelter, so the crew huddled behind bags of food and water. It helped, but they still got a dose."}},
   {l:"Turn the heaviest side toward the Sun", g:"The ship's mass blocks some particles", r:"Some radiation dose", f:c=>({h:-6,sci:.02,why:"Fuel tanks and equipment soaked up part of the radiation."})},
   {l:"Keep working, wear dosimeters", g:"No work lost", r:"A higher crew dose", f:c=>({h:-12,sci:0,why:"Work went on, but every astronaut picked up extra radiation."})},
   {l:"Keep going as planned", g:"Nothing changes", r:"A big crew dose, unless you built heavy shielding", f:c=>c.d.shield==="heavy"?{h:0,sci:0,why:"Your heavy shielding kept the dose low. Nothing happened."}:c.d.shelter?{h:-4,sci:.03,why:"Flight rules sent the crew to the shelter anyway, so the dose was small."}:{h:-20,sci:0,why:"With light shielding and no shelter, the crew took a big radiation dose."}}]},
 co2_scrubber:{lead:"engineer", title:"Carbon dioxide rising", say:"Engineer here. Carbon dioxide is rising. One of the air scrubbers is failing.", text:"A CO₂ scrubber filter is failing. If CO₂ keeps rising, the crew gets headaches, then worse.",
  opts:[
   {l:"Build a makeshift adapter (like Apollo 13)", g:"Air fixed with spare parts", r:"Crew time and a little risk", f:c=>({h:-3,sci:.03,why:"The crew built an adapter from tape, hoses and plastic, just like Apollo 13 in 1970."})},
   {l:"Switch to the backup scrubber", g:"A quick fix", r:"Needs a recycling life-support system", f:c=>c.d.lss!=="open"?{h:0,sci:0,why:"Your recycling life support carries spare scrubbers. Swapped in minutes."}:{h:-10,sci:.02,why:"The basic system had no spare scrubber, so the fix took hours."}},
   {l:"Crew rests to breathe less", g:"CO₂ rises more slowly", r:"Science time", f:c=>({h:0,sci:.08,why:"Resting crews make less CO₂. You lost a day of work."})},
   {l:"Keep going as planned", g:"Nothing to do", r:"Headaches and danger, unless your life support is advanced", f:c=>c.d.lss==="closed"?{h:0,sci:0,why:"Your advanced closed-loop system handled it automatically. Nothing happened."}:c.d.lss==="partial"?{h:-8,sci:0,why:"The recycling system coped, slowly. The crew had headaches for a day."}:{h:-20,sci:.02,why:"CO₂ climbed for hours. The crew felt sick before it was under control."}}]},
 far_side:{lead:"comms", title:"Behind the Moon", say:"Comms here. We're passing behind the Moon. We'll lose contact with Earth for about forty minutes.", text:"The Moon is about to block every radio signal from Earth for about 40 minutes.",
  opts:[
   {l:"Upload the full plan before losing signal", g:"The crew knows exactly what to do", r:"A few far-side photos missed while preparing", f:c=>({h:0,sci:.02,why:"Mission Control sent every step in advance. The crew worked calmly in the silence."})},
   {l:"Record everything and send it later", g:"No data lost", r:"Needs onboard storage; compression helps", f:c=>c.d.compress?{h:0,sci:0,why:"Compressed recordings fit easily in memory and went home afterwards."}:{h:0,sci:.03,why:"Memory filled up near the end, so a few recordings were dropped."}},
   {l:"Point the antenna at Earth the moment you're back", g:"Fast reconnection", r:"Fewer far-side photos", f:c=>({h:0,sci:.02,why:"Contact came back within seconds of coming around the Moon."})},
   {l:"Keep going as planned", g:"Nothing changes", r:"Stress, unless the ship's computers can fly alone", f:c=>c.d.computer==="dual"?{h:0,sci:0,why:"Your redundant computers flew the ship on their own. Nothing happened."}:{h:-5,sci:.03,why:"Without backup computers, the crew had to watch every system by hand."}}]},
 crew_ill:{lead:"science", title:"Astronaut sick", say:"Science here. One of our crew is sick. We need to decide how to treat them.", text:"One astronaut has a bad infection. Earth's doctors are 20 minutes away by radio, each way.",
  opts:[
   {l:"Treat them in the onboard medical lab", g:"Fast treatment", r:"Needs the medical lab", f:c=>c.has("med_lab")?{h:0,sci:0,why:"The medical lab had the right medicine and tests. Recovered in days."}:{h:-6,sci:.03,why:"With no medical lab you used the basic kit. Recovery was slow."}},
   {l:"Ask doctors on Earth", g:"Expert advice", r:"Slow: 40 minutes per question and answer", f:c=>({h:-4,sci:.04,why:"Good advice, but every exchange took 40 minutes."})},
   {l:"Give the crew rest days", g:"The astronaut recovers", r:"Science time", f:c=>({h:0,sci:.07,why:"Rest worked, but the whole crew lost working days."})},
   {l:"Keep going as planned", g:"No time lost", r:"The illness spreads, unless you have a medical lab", f:c=>c.has("med_lab")?{h:0,sci:0,why:"The medical lab handled it with no fuss. Nothing happened."}:{h:-15,sci:.03,why:"Two more crew members got sick before it was under control."}}]},
 engine_anomaly:{lead:"planner", title:"Engine pressure low", say:"Planner here. Main engine pressure is low, and our big burn is coming up.", text:"Main engine pressure is low, and the big burn is in 3 hours.",
  opts:[
   {l:"Delay the burn and troubleshoot", g:"Safe", r:"Arrive later, less science time", f:c=>({h:0,sci:.05,why:"You found a stuck valve and burned a day late."})},
   {l:"Use the backup thrusters", g:"Burn on time", r:"Extra fuel, small strain", f:c=>({h:-5,sci:0,why:"The small thrusters did the job but worked hard."})},
   {l:"Run tests on a simulator on Earth", g:"Find the cause", r:"Money", f:c=>({h:-2,cost:pct(c),why:`Engineers on Earth reproduced the fault and found a fix ($${pct(c)}M).`})},
   {l:"Keep going as planned", g:"Burn on time", r:"Engine damage, unless backup computers catch the fault", f:c=>c.d.computer==="dual"?{h:0,sci:0,why:"Your backup computers spotted the bad sensor and fixed the reading. Nothing happened."}:{h:-15,sci:.02,why:"The engine ran rough through the burn and was damaged."}}]}
};

/* ---- training cards: 3 per role, each with a hands-on lab ---- */
const CARDS = {
 planner:[
  {title:"Orbit height", text:"Low orbits are close to the ground: sharp pictures, but leftover air slowly drags you down. High orbits see more at once and last longer.", lab:"orbit", take:"There is no best height, only the best height for your goal."},
  {title:"Rockets have limits", text:"Every rocket can lift only so much. Going farther (geostationary, the Moon, Mars) means it can lift much less.", lab:"rocket", take:"Check your spacecraft's mass, including fuel, against the rocket's limit for your destination."},
  {title:"Mission length", text:"A longer mission collects more science, but the team on the ground costs money every year and you need fuel to keep your orbit.", lab:"length", take:"Budget for operations, not just for building."}],
 engineer:[
  {title:"Sunlight and distance", text:"Solar panels make less power the farther you are from the Sun. Twice as far gives a quarter of the power.", lab:"sun", take:"Far from the Sun you need huge panels or a nuclear RTG."},
  {title:"Batteries and shadow", text:"In Earth's shadow (or at night on Mars) panels make nothing. The battery must keep everything alive until sunlight returns.", lab:"battery", take:"Size the battery for the longest dark period."},
  {title:"Backups and shielding", text:"Radiation and failures will happen. Shielding blocks particles; a backup computer takes over if the main one fails.", lab:"radiation", take:"Protection costs mass and money now, and saves the mission later."}],
 science:[
  {title:"Every instrument costs", text:"Each instrument adds science, but also mass, power, money and data.", lab:"instr", take:"Pick the instruments that answer the goal, not all of them."},
  {title:"Sharper means more data", text:"Halving the size of each pixel makes four times as many pixels to send.", lab:"res", take:"A sharper camera only helps if the data can reach Earth."},
  {title:"Right tool for the job", text:"Different instruments see different things. Matching them to the question is the Science Lead's main job.", lab:"quiz", take:"Read the mission goal, then choose the instrument that can answer it."}],
 comms:[
  {title:"Distance slows data", text:"Radio signals spread out as they travel. Twice as far means four times weaker.", lab:"dist", take:"Far missions need big dishes and patience."},
  {title:"Ground stations", text:"A low satellite can talk to a ground station only while flying over it, a few minutes per pass. More stations mean more contact time.", lab:"stations", take:"More stations = more data home, at a yearly cost."},
  {title:"The data budget", text:"If instruments make more data than you can send, the extra is lost. Compression shrinks data but needs a stronger computer.", lab:"databudget", take:"Data made ≠ data delivered. Only delivered data counts."}]
};
