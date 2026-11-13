# CML 3 - Nile Delta Crop Watch. No real-satellite names that give the answer away.
# Real: MODIS 250 m, 2,330 km, 229 kg, ~160 W, 10.6 Mbit/s | TIRS 100 m heat, 236 kg, ~380 W | OLI 30 m NIR, ~470 kg (Ball), ~400 W (approx)
# OLI ~200 Mbit/s and TIRS ~3 Mbit/s are calculated from swath/pixel/bands | X-band 384 Mbit/s | Ka-band ~3,500 Mbit/s (NISAR)
# Orbit ~99 min, shadow up to ~35 min at 705 km | Pegasus XL ~450 kg, NASA paid ~$56M (ICON) | Falcon 9 >10 t, ~$69M (DART)
# Vega C ~2,300 kg to 700 km SSO (ESA) | US debris rule: deorbit within 25 years.
# Our own design (not NASA): satellite body + fuel 1,500 kg and 1,400 W; antenna power/weight; panels; batteries.
TITLE = "MISSION BRIEFING  ·  NILE DELTA CROP WATCH"
PREFIX = "delta"
V = {"director": ("Mohamed", "Mission Director", "en-US-ChristopherNeural", "ctrl_2.jpg", "#ffc26b"),
     "science": ("Ayat", "Science Lead guide", "en-US-EmmaNeural", "crew_1.jpg", "#5fd8ff"),
     "comms": ("Adham", "Communications Lead guide", "en-US-BrianNeural", "crew_4.jpg", "#c79bff"),
     "engineer": ("Abdelrahman", "Spacecraft Engineer guide", "en-US-AndrewNeural", "crew_2.jpg", "#ffb35f"),
     "planner": ("Ahmed", "Mission Planner guide", "en-US-EricNeural", "ctrl_4.jpg", "#7dffb0")}
SEG = {
 "director": [
   ("Hello, team. I am Mohamed, your Mission Director.", None),
   ("Farmers in the Nile Delta have a problem. They can't see which fields are thirsty or sick, until it is too late.", {"t": "THE PROBLEM", "h": "Thirsty and sick fields"}),
   ("We will build a satellite to watch the Delta from space. It must do four things.", None),
   ("One: see each small field. Many farms in the Delta are small.", {"t": "MUST 1", "h": "See each small field"}),
   ("Two: tell if the plants are healthy.", {"t": "MUST 2", "h": "See plant health"}),
   ("Three: photograph the same place, with the same light, again and again, so we can compare.", {"t": "MUST 3", "h": "Same place, same light"}),
   ("Four: keep working for five years.", {"t": "MUST 4", "h": "Work for 5 years"}),
   ("And one goal: don't waste. Every extra kilogram and every extra watt costs money. The best team uses just what it needs.", {"t": "GOAL", "h": "Don't waste"}),
   ("This time there are many numbers. Write every number on the team board. You will need to add them up together.", {"t": "TEAM BOARD", "h": "Write every number"}),
   ("Nobody can solve this alone. Good luck!", None)],
 "science": [
   ("Hi! I am Ayat. In this mission, you are the Science Lead. Your choices: the camera, and when it takes pictures.", None),
   ("A picture is made of tiny squares called pixels. For small fields, each pixel must be fifty meters or smaller.", {"t": "PIXEL", "h": "50 meters or smaller"}),
   ("Healthy plants reflect a lot of near-infrared light. Our eyes can't see it. Some cameras can. This light comes from the Sun, bouncing off the leaves.", {"t": "PLANT HEALTH", "h": "Near-infrared · needs sunlight"}),
   ("Camera A, MODIS. Pixel: 250 meters. Sees normal light and near-infrared. One picture is 2,330 kilometers wide. Weight: about 230 kilograms. Power: about 160 watts. Data: about 10 megabits every second.", {"t": "CAMERA A · MODIS", "h": "250 m · near-infrared · 230 kg · 160 W · 10 Mbit/s"}),
   ("Camera B, TIRS. Pixel: 100 meters. Sees heat, so it works at night too. Thirsty plants are often warmer. Weight: about 240 kilograms. Power: about 380 watts. Data: about 3 megabits every second.", {"t": "CAMERA B · TIRS", "h": "100 m · heat · 240 kg · 380 W · 3 Mbit/s"}),
   ("Camera C, OLI. Pixel: 30 meters. Sees normal light and near-infrared. Weight: about 470 kilograms. Power: about 400 watts. Data: about 200 megabits every second.", {"t": "CAMERA C · OLI", "h": "30 m · near-infrared · 470 kg · 400 W · 200 Mbit/s"}),
   ("When do we take pictures? At night, there is no sunlight. At ten in the morning, every day, the Sun is at the same height each time. At any time of day, we get more pictures, but the Sun is at a different height each time.", {"t": "PICTURE TIME", "h": "Night · 10 a.m. every day · Any time"}),
   ("Write the weight, power and data of your camera on the board. Your team needs them.", {"t": "TEAM BOARD", "h": "Weight · power · data"})],
 "comms": [
   ("Hi! I am Adham. In this mission, you are the Communications Lead. Your choices: the antenna, and the ground stations.", None),
   ("Data is the size of the pictures. The camera makes data every second. The antenna must send at least as fast. If not, the memory fills up and pictures are lost.", {"t": "THE RULE", "h": "Antenna speed ≥ camera data"}),
   ("Antenna A, Ka-band. Sends about 3,500 megabits every second. Power: 350 watts. Weight: 30 kilograms. Only a few ground stations in the world can hear it.", {"t": "ANTENNA A · KA-BAND", "h": "3,500 Mbit/s · 350 W · 30 kg · few stations"}),
   ("Antenna B, S-band. Sends about a quarter of one megabit every second. Power: 50 watts. Weight: 10 kilograms. Almost every station can hear it.", {"t": "ANTENNA B · S-BAND", "h": "0.25 Mbit/s · 50 W · 10 kg"}),
   ("Antenna C, X-band. Sends 384 megabits every second. Power: 150 watts. Weight: 20 kilograms. Many stations can hear it.", {"t": "ANTENNA C · X-BAND", "h": "384 Mbit/s · 150 W · 20 kg"}),
   ("A ground station is a big dish on Earth. The satellite talks to it for a few minutes, while it flies over.", None),
   ("One station costs the least. But if it stops, pictures must wait. Two stations give a backup. Three stations give the most chances to send, but each one costs money every year.", {"t": "GROUND STATIONS", "h": "1 cheapest · 2 backup · 3 costs most"}),
   ("Write your antenna's power and weight on the board.", {"t": "TEAM BOARD", "h": "Power · weight"})],
 "engineer": [
   ("Hi! I am Abdelrahman. In this mission, you are the Spacecraft Engineer. Your choices: the solar panels, and the battery.", None),
   ("Our satellite body, with its computer, uses 1,400 watts. The camera and the antenna use more. Add them all up on the board.", {"t": "POWER", "h": "Body 1,400 W + camera + antenna"}),
   ("Panel A makes 2,600 watts, and weighs 200 kilograms. Panel B makes 3,200 watts, and weighs 300 kilograms. Panel C makes 2,000 watts, and weighs 120 kilograms.", {"t": "SOLAR PANELS", "h": "A 2,600 W · B 3,200 W · C 2,000 W"}),
   ("The panel must make more than the total. Engineers keep a small extra, called margin. Too little is dangerous. Too much is heavy, and wasted.", {"t": "MARGIN", "h": "A little extra, not a lot"}),
   ("One trip around Earth takes about 99 minutes. For up to 35 minutes, the satellite is in Earth's shadow. Then only the battery works.", {"t": "SHADOW", "h": "Up to 35 minutes"}),
   ("Battery A lasts 60 minutes, and weighs 150 kilograms. Battery B lasts 40 minutes, and weighs 70 kilograms. Battery C lasts 25 minutes, and weighs 40 kilograms.", {"t": "BATTERY", "h": "A 60 min · B 40 min · C 25 min"}),
   ("Write the weight of your panel and battery on the board. Every kilogram goes on the rocket.", {"t": "TEAM BOARD", "h": "Panel and battery weight"})],
 "planner": [
   ("Hi! I am Ahmed. In this mission, you are the Mission Planner. Your choices: the orbit, the rocket, and how the mission ends.", None),
   ("The higher we fly, the bigger each pixel gets. Ayat's pixel numbers are for 705 kilometers. At 400 kilometers, pixels are smaller. At 1,500 kilometers, they are about two times bigger.", {"t": "HEIGHT AND PIXELS", "h": "Higher = bigger pixels"}),
   ("Orbit A, 400 kilometers. A little air is still there. It pulls the satellite down, and it falls in a few years. It passes over Egypt at a different time each day.", {"t": "ORBIT A · 400 km", "h": "Falls in a few years · time changes"}),
   ("Orbit B, 705 kilometers, sun-synchronous. It passes over the same place at the same time, every day.", {"t": "ORBIT B · 705 km", "h": "Same time every day"}),
   ("Orbit C, 1,500 kilometers. Almost no air. It passes at a different time each day, and the radiation is stronger.", {"t": "ORBIT C · 1,500 km", "h": "Time changes · more radiation"}),
   ("Our satellite body, with its fuel, weighs 1,500 kilograms. Add the camera, antenna, panel and battery on the board.", {"t": "WEIGHT", "h": "Body 1,500 kg + parts"}),
   ("Rocket A, Falcon 9. Lifts more than 10,000 kilograms. NASA paid about 69 million dollars for one launch.", {"t": "ROCKET A · FALCON 9", "h": "10,000+ kg · about $69 million"}),
   ("Rocket B, Pegasus XL. Lifts about 450 kilograms. NASA paid about 56 million dollars for one launch.", {"t": "ROCKET B · PEGASUS XL", "h": "About 450 kg · about $56 million"}),
   ("Rocket C, Vega C, from Europe. Lifts about 2,300 kilograms to this kind of orbit. It costs less than Falcon 9.", {"t": "ROCKET C · VEGA C", "h": "About 2,300 kg · cheaper than Falcon 9"}),
   ("The end of the mission. Old satellites can stay up as space junk. US rules ask them to come down within 25 years. We can leave it up there, use all the fuel for more pictures, or save some fuel and bring it down.", {"t": "THE END", "h": "Leave it · use all fuel · bring it down"})]}
ROLES = {k: {"name": v[0], "title": v[1], "voice": v[2], "img": v[3], "color": v[4], "seg": SEG[k]} for k, v in V.items()}
