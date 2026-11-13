# CML 1 - Khamsin Storm Watch. Simple English. The guides explain the player's job; they never choose.
# Facts: Khamsin = hot dusty spring wind from the desert into Egypt; geostationary orbit ~35,786 km, one trip = one day;
# a 700 km orbit takes ~99 min and sees a place for minutes; infrared cameras see heat day and night (Meteosat dust products);
# RTGs power NASA's Curiosity and Perseverance; their plutonium-238 fuel is rare.
TITLE = "MISSION BRIEFING  ·  KHAMSIN STORM WATCH"
PREFIX = "storm"
V = {"director": ("Mohamed", "Mission Director", "en-US-ChristopherNeural", "ctrl_2.jpg", "#ffc26b"),
     "science": ("Ayat", "Science Lead guide", "en-US-EmmaNeural", "crew_1.jpg", "#5fd8ff"),
     "comms": ("Adham", "Communications Lead guide", "en-US-BrianNeural", "crew_4.jpg", "#c79bff"),
     "engineer": ("Abdelrahman", "Spacecraft Engineer guide", "en-US-AndrewNeural", "crew_2.jpg", "#ffb35f"),
     "planner": ("Ahmed", "Mission Planner guide", "en-US-EricNeural", "ctrl_4.jpg", "#7dffb0")}
SEG = {
 "director": [
   ("Hello, team! I am Mohamed, your Mission Director.", None),
   ("Every spring, hot winds called Khamsin blow from the desert into Egypt. They carry huge clouds of dust.", {"t": "THE PROBLEM", "h": "Khamsin dust storms"}),
   ("Dust storms close roads and airports, and make breathing hard for many people.", None),
   ("Our mission: build a satellite that watches these storms coming, so people can get ready.", None),
   ("Here is what our satellite must do.", None),
   ("One: watch Egypt all the time, without stopping.", {"t": "NEED 1", "h": "Watch Egypt all the time"}),
   ("Two: see the storms in the day, and at night.", {"t": "NEED 2", "h": "See storms day and night"}),
   ("Three: send a new picture to Earth very often, every fifteen minutes.", {"t": "NEED 3", "h": "New picture every 15 minutes"}),
   ("On your screen there is a team board. Write on it what you learn in your video. Your team will see it, even from far away.", {"t": "TEAM BOARD", "h": "Write what you learn"}),
   ("Nobody knows everything alone. Listen, write, then talk together. Good luck!", None)],
 "science": [
   ("Hi! I am Ayat. In this mission, you are the Science Lead. Let me show you your job.", None),
   ("The Science Lead chooses what the satellite sees. Your choice: the camera.", None),
   ("Camera A is a color camera. It takes pictures like your phone, with real colors. But it needs sunlight. At night, it sees almost nothing.", {"t": "CAMERA A · COLOR", "h": "Real colors · needs sunlight"}),
   ("Camera B is an infrared camera. It sees heat, not colors. Hot ground, cold clouds and dust all look different. It works in the day, and at night. But its pictures are not in real colors.", {"t": "CAMERA B · INFRARED", "h": "Sees heat · day and night"}),
   ("Write the difference on the team board. Then think: what did Mohamed ask for?", {"t": "THINK", "h": "What did Mohamed ask for?"})],
 "comms": [
   ("Hi! I am Adham. In this mission, you are the Communications Lead. Let me show you your job.", None),
   ("The Communications Lead makes sure the pictures reach Earth. Your choice: the antenna.", None),
   ("The antenna is how the satellite talks to Earth. It sends pictures down, and hears our commands.", None),
   ("Antenna A is slow. It is great for small messages, like: I am OK. It is light, and uses little power. But one big picture takes a very long time to send.", {"t": "ANTENNA A · SLOW", "h": "Small messages · light"}),
   ("Antenna B is fast. It sends big pictures in a short time. But it is heavier, and uses more power.", {"t": "ANTENNA B · FAST", "h": "Big pictures fast · more power"}),
   ("Pictures are big. Messages are small. Write it down, and ask: how often must we send a picture?", {"t": "THINK", "h": "How often do we send?"})],
 "engineer": [
   ("Hi! I am Abdelrahman. In this mission, you are the Spacecraft Engineer. Let me show you your job.", None),
   ("The Spacecraft Engineer keeps the satellite alive. Your choice: where the power comes from.", None),
   ("Choice A: solar panels. They turn sunlight into electricity. Near Earth, sunlight is strong. They are light and simple. But in Earth's shadow they make no power, so we also carry a battery.", {"t": "A · SOLAR PANELS", "h": "Strong sun near Earth · plus a battery"}),
   ("Choice B: a nuclear battery, called an R T G. It makes electricity from heat, day and night, anywhere. NASA's Curiosity and Perseverance rovers on Mars use one. But its fuel is very rare and very expensive. NASA saves it for places where sunlight is weak.", {"t": "B · RTG", "h": "Works anywhere · rare, very expensive"}),
   ("Write both on the board. Then ask: where is our satellite? Near the Sun, or far away?", {"t": "THINK", "h": "Near the Sun or far away?"})],
 "planner": [
   ("Hi! I am Ahmed. In this mission, you are the Mission Planner. Let me show you your job.", None),
   ("The Mission Planner chooses the path. Your choice: the orbit. An orbit is the path the satellite flies around Earth.", None),
   ("Orbit A is low, at 700 kilometers. The satellite goes around Earth in about an hour and a half. It is close, so pictures are sharp. But it flies over Egypt for only a few minutes each time. Then it is gone.", {"t": "ORBIT A · 700 km", "h": "Sharp · over Egypt a few minutes"}),
   ("Orbit B is geostationary, at about 36,000 kilometers. Up there, one trip around Earth takes one full day, the same as Earth's spin. So the satellite seems to stay above the same place, all the time. But it is very far, so pictures are less sharp.", {"t": "ORBIT B · 36,000 km", "h": "Stays over one place · less sharp"}),
   ("Write it down. Then ask: does Mohamed need sharp pictures, or does he need to watch all the time?", {"t": "THINK", "h": "Sharp, or all the time?"})]}
ROLES = {k: {"name": v[0], "title": v[1], "voice": v[2], "img": v[3], "color": v[4], "seg": SEG[k]} for k, v in V.items()}
