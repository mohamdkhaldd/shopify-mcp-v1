# CML 2 - Moon Landing Map. Compare one number with what is needed. No adding.
# Real: NASA Artemis targets the Moon's south pole; polar craters never see sunlight; LRO's narrow cameras 0.5 m pixels (strip ~5 km),
# wide camera 100 m; LOLA laser altimeter measures height in the dark; Diviner measures temperature;
# LRO high-rate link 100 Mbit/s; LLCD laser link 622 Mbit/s from lunar orbit (2013); NASA Deep Space Network: 3 sites ~120 deg apart;
# a 50 km lunar orbit takes ~2 h, shadow up to ~48 min (geometry); LRO turned instruments off in the 2014 lunar eclipse;
# CAPSTONE (~25 kg) launched on Electron (~$10M contract); IM-1 lander (~1,900 kg) launched on Falcon 9 (2024; DART launch ~$69M);
# SLS Block 1: more than 27 t to the Moon, more than $2 billion per launch.
# Our own design: medium camera, satellite mass 1,900 kg, battery sizes, laser-link and S-band options as described.
TITLE = "MISSION BRIEFING  ·  MOON LANDING MAP"
PREFIX = "moon"
V = {"director": ("Mohamed", "Mission Director", "en-US-AndrewMultilingualNeural", "mohamed_wide.jpg", "#ffc26b"),
     "science": ("Ayat", "Science Lead guide", "en-US-AvaMultilingualNeural", "ayat_wide.jpg", "#5fd8ff"),
     "comms": ("Adham", "Communications Lead guide", "en-US-BrianMultilingualNeural", "adham_wide.jpg", "#c79bff"),
     "engineer": ("Abdelrahman", "Spacecraft Engineer guide", "en-AU-WilliamMultilingualNeural", "abdelrahman_wide.jpg", "#ffb35f"),
     "planner": ("Ahmed", "Mission Planner guide", "de-DE-FlorianMultilingualNeural", "ahmed_wide.jpg", "#7dffb0")}
SEG = {
 "director": [
   ("Hello again, team. I am Mohamed, your Mission Director.", None),
   ("NASA's Artemis program will land astronauts near the south pole of the Moon. There may be ice hiding in dark craters there.", {"t": "THE PROBLEM", "h": "Land safely near the south pole"}),
   ("But big rocks and steep slopes can tip a lander over. Our satellite will make a map, so we can find a safe place to land.", None),
   ("Here is what it must do.", None),
   ("One: see rocks two meters wide.", {"t": "NEED 1", "h": "See rocks 2 meters wide"}),
   ("Two: map the ground inside dark craters, where sunlight never reaches.", {"t": "NEED 2", "h": "Map inside dark craters"}),
   ("Three: fly over the south pole.", {"t": "NEED 3", "h": "Fly over the south pole"}),
   ("Four: send at least one hundred megabits of maps every second.", {"t": "NEED 4", "h": "Send 100 Mbit/s"}),
   ("Five: survive the cold shadow. And six: our launch budget is one hundred fifty million dollars.", {"t": "NEED 5 AND 6", "h": "Survive the shadow · $150 million"}),
   ("Each guide will give you numbers. Compare each number with what we need. Write them on the team board. Good luck!", {"t": "TEAM BOARD", "h": "Compare with what we need"}),
   ("One more thing. Your team starts with one thousand points. Every need you miss, every part that is bigger than you need, every bit of damage, and every extra review costs points. Keep as many as you can!", {"t": "1,000 POINTS", "h": "Start with 1,000 · don't lose them"})],
 "science": [
   ("Hi! I am Ayat. You are the Science Lead again. Your choices: the camera, and how to see inside dark craters.", None),
   ("Remember: a pixel is one tiny square in the picture. To see a rock two meters wide, each pixel must be one meter or smaller.", {"t": "PIXEL", "h": "1 meter or smaller"}),
   ("Camera A, a wide camera. Pixel: 100 meters. It sees a very big area in each picture. It makes little data.", {"t": "CAMERA A · WIDE", "h": "100 m · big area · little data"}),
   ("Camera B, a narrow camera. Pixel: half a meter. Each picture is a thin strip, about five kilometers wide. It makes a lot of data.", {"t": "CAMERA B · NARROW", "h": "0.5 m · thin strip · lots of data"}),
   ("Camera C, a medium camera. Pixel: 10 meters. Medium area. Medium data.", {"t": "CAMERA C · MEDIUM", "h": "10 m · medium area"}),
   ("Now the dark craters. Some craters near the pole never get sunlight. Not ever.", None),
   ("Choice A, an infrared camera. It measures temperature, and finds the coldest places, where ice can hide. But it does not measure the shape of the ground.", {"t": "A · INFRARED", "h": "Temperature · finds ice · no shape"}),
   ("Choice B, a normal camera. It needs light to see. Inside the dark craters, there is no light.", {"t": "B · NORMAL CAMERA", "h": "Needs light"}),
   ("Choice C, a laser altimeter. It shines its own laser at the ground, and measures how high or low each spot is. It works in total darkness.", {"t": "C · LASER ALTIMETER", "h": "Own laser · measures height · works in the dark"}),
   ("Write it on the board, then compare with what Mohamed asked for.", None)],
 "comms": [
   ("Hi! I am Adham. You are the Communications Lead. Your choices: the antenna, and the ground stations.", None),
   ("The Moon is about 384,000 kilometers away. That is far, so signals get weak.", {"t": "DISTANCE", "h": "384,000 km"}),
   ("Antenna A, a laser link. NASA tested one at the Moon in 2013. It sent 622 megabits every second. But laser light cannot pass through clouds over the ground station.", {"t": "A · LASER LINK", "h": "622 Mbit/s · blocked by clouds"}),
   ("Antenna B, Ka-band radio. It sends 100 megabits every second. Radio waves pass through clouds.", {"t": "B · KA-BAND", "h": "100 Mbit/s · passes clouds"}),
   ("Antenna C, S-band radio. It sends a few megabits every second. It is simple, and passes through clouds.", {"t": "C · S-BAND", "h": "A few Mbit/s · simple"}),
   ("Now the ground stations. Each ground station can see the Moon for only about half of each day.", {"t": "ONE STATION", "h": "Sees the Moon half the day"}),
   ("Choice A: three stations, spread around the world. NASA's Deep Space Network does this, in California, Spain and Australia. One of them can always see the Moon.", {"t": "A · 3 STATIONS", "h": "Always one can see the Moon"}),
   ("Choice B: one station. It costs the least. Choice C: six stations. It also sees the Moon all the time, but it costs twice as much as three.", {"t": "B · 1 STATION   C · 6 STATIONS", "h": "1: half the day · 6: always, costs 2 times"}),
   ("Write the speeds on the board. Compare them with what Mohamed asked for.", None)],
 "engineer": [
   ("Hi! I am Abdelrahman. You are the Spacecraft Engineer. Your choices: the battery, and how to stay warm.", None),
   ("Many times every day, the satellite flies behind the Moon, into shadow. No sunlight. Each shadow lasts up to 48 minutes.", {"t": "SHADOW", "h": "Up to 48 minutes"}),
   ("Battery A lasts 30 minutes. Battery B lasts 60 minutes. Battery C lasts 120 minutes, but it is very heavy.", {"t": "BATTERY", "h": "A 30 min · B 60 min · C 120 min, heavy"}),
   ("In the shadow it gets very cold, far below zero. Cold can break electronics.", {"t": "COLD", "h": "Far below zero"}),
   ("Choice A: a thermal blanket and small heaters. The gold blanket keeps heat in, like a jacket. Most satellites use this.", {"t": "A · BLANKET + HEATERS", "h": "Like a jacket"}),
   ("Choice B: no protection. It is lighter, and costs nothing.", {"t": "B · NOTHING", "h": "Lighter · free"}),
   ("Choice C: an extra RTG, a nuclear battery, just for heat. It is warm all the time. But its fuel is very rare and very expensive.", {"t": "C · EXTRA RTG", "h": "Always warm · rare fuel"}),
   ("Write the battery times on the board, and compare them with the shadow.", None)],
 "planner": [
   ("Hi! I am Ahmed. You are the Mission Planner. Your choices: the orbit, and the rocket.", None),
   ("Orbit A, polar orbit, 50 kilometers high. It flies over the north pole and the south pole on every trip.", {"t": "ORBIT A · POLAR 50 km", "h": "Over both poles every trip"}),
   ("Orbit B, equator orbit, 50 kilometers high. It flies around the Moon's middle. It never flies over the poles.", {"t": "ORBIT B · EQUATOR 50 km", "h": "Never over the poles"}),
   ("Orbit C, high polar orbit, 3,000 kilometers. It flies over the poles too, and needs less fuel to stay up. But it is sixty times higher, so every pixel is sixty times bigger.", {"t": "ORBIT C · POLAR 3,000 km", "h": "Over the poles · pixels 60 times bigger"}),
   ("Our satellite weighs about 1,900 kilograms. Our launch budget is 150 million dollars.", {"t": "OUR SATELLITE", "h": "1,900 kg · $150 million"}),
   ("Rocket A, SLS, NASA's Moon rocket. It can send more than 27,000 kilograms to the Moon. Each launch costs more than 2 billion dollars.", {"t": "ROCKET A · SLS", "h": "27,000+ kg · $2 billion+"}),
   ("Rocket B, Electron. It sent a 25-kilogram satellite to the Moon in 2022. NASA paid about 10 million dollars.", {"t": "ROCKET B · ELECTRON", "h": "25 kg to the Moon · about $10 million"}),
   ("Rocket C, Falcon 9. In 2024 it sent a 1,900-kilogram lander toward the Moon. NASA paid about 69 million dollars for a Falcon 9 launch.", {"t": "ROCKET C · FALCON 9", "h": "1,900 kg to the Moon · about $69 million"}),
   ("Write the numbers on the board. Which rocket can carry us, and stay in the budget?", None)]}
ROLES = {k: {"name": v[0], "title": v[1], "voice": v[2], "img": v[3], "color": v[4], "seg": SEG[k]} for k, v in V.items()}
