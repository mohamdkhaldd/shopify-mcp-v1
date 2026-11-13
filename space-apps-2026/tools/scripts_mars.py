# CML 4 - Mars Life Hunter. Hardest: add up kilograms AND energy, and choices depend on other roles.
# Real: Jezero Crater was an ancient lake with a river delta; Utopia Planitia is a flat plain (Viking 2 landed there);
# Olympus Mons is the tallest volcano; Mars gets less than half of Earth's sunlight; dust ended Opportunity (2018) and InSight (2022);
# an MMRTG makes about 110 W day and night, weighs about 45 kg, and its waste heat warms a rover; airbags landed rovers of about 180 kg;
# a sky crane lowered a rover of about 1,000 kg; Terrain Relative Navigation compares the ground with a map and steers away from danger;
# signals take 4 to 24 minutes one way; most rover data goes through orbiters; Earth-Mars launch windows come every 26 months;
# Mars nights can drop below -80 C; engineers test moves on a twin rover on Earth before sending them (used for stuck rovers).
# Our own design: rover body 800 kg; instrument weights; solar panel 70 kg and 2,000 Wh per clear sol; energy use per sol.
TITLE = "MISSION BRIEFING  ·  MARS LIFE HUNTER"
PREFIX = "mars"
V = {"director": ("Mohamed", "Mission Director", "en-US-AndrewMultilingualNeural", "mohamed_wide.jpg", "#ffc26b"),
     "science": ("Ayat", "Science Lead guide", "en-US-AvaMultilingualNeural", "ayat_wide.jpg", "#5fd8ff"),
     "comms": ("Adham", "Communications Lead guide", "en-US-BrianMultilingualNeural", "adham_wide.jpg", "#c79bff"),
     "engineer": ("Abdelrahman", "Spacecraft Engineer guide", "en-AU-WilliamMultilingualNeural", "abdelrahman_wide.jpg", "#ffb35f"),
     "planner": ("Ahmed", "Mission Planner guide", "de-DE-FlorianMultilingualNeural", "ahmed_wide.jpg", "#7dffb0")}
SEG = {
 "director": [
   ("Hello, team. This is our hardest mission. I am Mohamed, your Mission Director.", None),
   ("Billions of years ago, Mars had rivers and lakes. Did tiny life ever live there? We will send a rover to find out.", {"t": "THE QUESTION", "h": "Was there life on Mars?"}),
   ("A rover is a robot car that drives on another world.", None),
   ("Here is what our mission must do.", None),
   ("One: look for signs of ancient life, in rocks from an old lake or river.", {"t": "MUST 1", "h": "Find signs of ancient life"}),
   ("Two: land safely, and be able to drive.", {"t": "MUST 2", "h": "Land safely, then drive"}),
   ("Three: keep working for years, even in dust storms and cold winters.", {"t": "MUST 3", "h": "Work for years"}),
   ("Four: send our data home every Martian day. Five: drive safely, even though messages are slow. Six: launch at the right time.", {"t": "MUST 4 · 5 · 6", "h": "Data home · drive safely · launch on time"}),
   ("This time, choices depend on each other. One person's choice can break another person's plan. Write everything on the team board, and add up the kilograms and the energy together.", {"t": "TEAM BOARD", "h": "Kilograms · energy · who depends on whom"}),
   ("Good luck, team.", None),
   ("One more thing. Your team starts with one thousand points. Every need you miss, every part that is bigger than you need, every bit of damage, and every extra review costs points. Keep as many as you can!", {"t": "1,000 POINTS", "h": "Start with 1,000 · don't lose them"})],
 "science": [
   ("Hi! I am Ayat. You are the Science Lead. Your choices: where to land, and which science tool to carry.", None),
   ("Signs of ancient life are most likely where water once was.", {"t": "LIFE NEEDS WATER", "h": "Look where water was"}),
   ("Site A, Jezero Crater. It was a lake, with a river delta, long ago. Great for science. But it has rocks and cliffs, so landing is dangerous.", {"t": "SITE A · JEZERO", "h": "Old lake + river · rocks and cliffs"}),
   ("Site B, Utopia Planitia. A big flat plain. Landing is easy. But there are few clues of old water.", {"t": "SITE B · UTOPIA", "h": "Flat · safe · few water clues"}),
   ("Site C, the top of Olympus Mons, the tallest volcano in the solar system. Amazing views. But the air is so thin that parachutes barely work, and there was no lake there.", {"t": "SITE C · OLYMPUS MONS", "h": "Thin air · no lake"}),
   ("Tool A, a drill with sample tubes. It saves rock samples for a future mission to bring back to Earth. It weighs 80 kilograms, and uses 500 watt-hours each Martian day.", {"t": "TOOL A · DRILL + TUBES", "h": "Saves samples · 80 kg · 500 Wh/day"}),
   ("Tool B, a weather station. It measures wind and temperature. It weighs 5 kilograms, and uses 50 watt-hours each day. It does not study rocks.", {"t": "TOOL B · WEATHER", "h": "Wind, temperature · 5 kg · 50 Wh/day"}),
   ("Tool C, a rock scanner on the robot arm. It finds the chemicals that ancient life can leave in rocks. It weighs 40 kilograms, and uses 300 watt-hours each day.", {"t": "TOOL C · ROCK SCANNER", "h": "Finds life's chemicals · 40 kg · 300 Wh/day"}),
   ("Tell Ahmed where you land. He must plan the landing. And write your tool's weight and energy on the board.", {"t": "TALK", "h": "Site → Ahmed · weight, energy → board"})],
 "comms": [
   ("Hi! I am Adham. You are the Communications Lead. Your choices: how data gets home, and how we drive.", None),
   ("Mars is far. A message takes between 4 and 24 minutes to get there, at the speed of light. And the same time to come back.", {"t": "THE DELAY", "h": "4 to 24 minutes one way"}),
   ("Path A: the rover talks straight to Earth. It always works, but it is slow. Good for commands, too slow for many big pictures.", {"t": "PATH A · DIRECT TO EARTH", "h": "Always works · slow"}),
   ("Path B: the rover talks to an orbiter, a satellite flying around Mars, and the orbiter sends it to Earth. Much faster. But only when an orbiter flies overhead, a few times each day.", {"t": "PATH B · ORBITER RELAY", "h": "Much faster · a few times a day"}),
   ("Path C: both. A little more weight and power, but if one way stops, the other still works.", {"t": "PATH C · BOTH", "h": "Backup · a bit more weight"}),
   ("Now, driving. Choice A: drive it live with a joystick from Earth, like a video game.", {"t": "DRIVE A · JOYSTICK", "h": "Live from Earth"}),
   ("Choice B: every morning, send a plan for the day. The rover drives itself, and its cameras check for danger.", {"t": "DRIVE B · DAILY PLAN", "h": "Rover drives itself"}),
   ("Choice C: don't drive at all. Stay where we land. Safe, but we only see one spot.", {"t": "DRIVE C · STAY", "h": "Safe · one spot only"}),
   ("Think about the delay. If you see a cliff on the screen, how long until the rover hears you stop?", {"t": "THINK", "h": "The delay"})],
 "engineer": [
   ("Hi! I am Abdelrahman. You are the Spacecraft Engineer. Your choices: power, and staying warm.", None),
   ("Mars gets less than half of Earth's sunlight. Dust storms can cover the sky for weeks. Dust also settles on solar panels. Two NASA missions ended because of dust.", {"t": "MARS SUN", "h": "Less than half · dust storms"}),
   ("Power A: solar panels. 70 kilograms. About 2,000 watt-hours each clear Martian day. Almost nothing in a dust storm.", {"t": "POWER A · SOLAR", "h": "70 kg · 2,000 Wh/day clear · ~0 in dust"}),
   ("Power B: an RTG nuclear battery. 45 kilograms. About 110 watts, day and night, in any weather. That is about 2,700 watt-hours each day. It also makes heat.", {"t": "POWER B · RTG", "h": "45 kg · 2,700 Wh/day · any weather · makes heat"}),
   ("Power C: both. 115 kilograms. Lots of energy, but heavy.", {"t": "POWER C · BOTH", "h": "115 kg"}),
   ("Our rover body, with its computer and cameras, uses 1,200 watt-hours each day. Driving uses 600 more. Add Ayat's tool.", {"t": "ENERGY EACH DAY", "h": "Body 1,200 + driving 600 + tool"}),
   ("Mars nights can drop below minus 80 degrees. Cold breaks electronics.", {"t": "COLD NIGHTS", "h": "Below -80 °C"}),
   ("Heat A: pipe the RTG's extra heat around the rover. It is free, but only if we carry an RTG. 10 kilograms.", {"t": "HEAT A · RTG HEAT PIPES", "h": "Free heat · needs an RTG · 10 kg"}),
   ("Heat B: electric heaters. They work with any power, but they use 1,000 watt-hours every day. 15 kilograms.", {"t": "HEAT B · ELECTRIC", "h": "1,000 Wh/day · 15 kg"}),
   ("Heat C: nothing. Zero kilograms.", {"t": "HEAT C · NOTHING", "h": "0 kg"}),
   ("Add up the energy on the board. Make sure we make more than we use, every day.", None)],
 "planner": [
   ("Hi! I am Ahmed. You are the Mission Planner. Your choices: how we land, how we avoid danger, and when we launch.", None),
   ("Our rover body weighs 800 kilograms. Add the science tool, the power and the heat on the board.", {"t": "ROVER WEIGHT", "h": "Body 800 kg + parts"}),
   ("Landing A: airbags. The rover bounces on giant balloons. It worked for rovers of about 180 kilograms.", {"t": "LANDING A · AIRBAGS", "h": "Rovers of about 180 kg"}),
   ("Landing B: a sky crane. A rocket platform hovers, and lowers the rover on ropes, right onto its wheels. It worked for a rover of about 1,000 kilograms.", {"t": "LANDING B · SKY CRANE", "h": "Rovers up to about 1,000 kg"}),
   ("Landing C: legs and rockets, like a lander. Safe and simple, but a lander stays where it lands. The rover cannot drive off.", {"t": "LANDING C · LEGS", "h": "Cannot drive off"}),
   ("Danger A: a smart camera compares the ground with a map while we fall, and steers away from rocks. It adds a little weight.", {"t": "DANGER A · SMART CAMERA", "h": "Steers away from rocks"}),
   ("Danger B: no steering. We land wherever we land. It is fine on flat ground, but dangerous near rocks and cliffs.", {"t": "DANGER B · NO STEERING", "h": "OK on flat ground only"}),
   ("Launch time. We can only reach Mars with the fuel we have during a short time called a launch window. It comes once every 26 months.", {"t": "LAUNCH WINDOW", "h": "Once every 26 months"}),
   ("Launch A: right now, any day. Launch B: in the next launch window. Launch C: when Mars is farthest from Earth.", {"t": "WHEN?", "h": "Any day · next window · Mars farthest"}),
   ("Ask Ayat where she wants to land. Your landing must match her site.", {"t": "TALK", "h": "Ask Ayat about the site"})]}
ROLES = {k: {"name": v[0], "title": v[1], "voice": v[2], "img": v[3], "color": v[4], "seg": SEG[k]} for k, v in V.items()}
