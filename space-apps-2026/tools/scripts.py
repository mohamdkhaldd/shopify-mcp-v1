# Briefing videos for the Nile Delta mission. Simple English, slow. Each segment may show a card on screen.
# Facts: Landsat 8 OLI 30 m, NIR, 185 km swath (USGS/ESA); crossing ~10 a.m. (USGS 10:12 +/-5 min);
# MODIS 250 m pixels, 2,330 km swath, whole Earth every 1-2 days (NASA MODIS); X-band 384 Mbps, 3.14 Tb recorder (USGS handbook);
# 705 km sun-synchronous orbit (Landsat 8); Atlas V 401 launched Landsat 8 on 11 Feb 2013; Pegasus XL ~450 kg to low orbit (NASA LSP fact sheet).
ROLES = {
 "director": {"name": "Mohamed", "title": "Mission Director", "voice": "en-US-ChristopherNeural", "img": "ctrl_2.jpg", "color": "#ffc26b", "seg": [
   ("Hello, team. I am Mohamed. I am your Mission Director.", None),
   ("Egypt's farmers need our help. They want to know which fields in the Nile Delta are thirsty or sick.", None),
   ("So, we will build a satellite. Here are the mission rules.", None),
   ("Rule one. We must see each small field.", {"t": "RULE 1", "h": "See each small field"}),
   ("Rule two. We must see if the plants are healthy.", {"t": "RULE 2", "h": "See plant health"}),
   ("Rule three. We must take pictures of the same fields again and again, with the same light.", {"t": "RULE 3", "h": "Same fields, same light"}),
   ("Rule four. The satellite must work for five years.", {"t": "RULE 4", "h": "Work for 5 years"}),
   ("And rule five. We have one hundred budget points. Not more.", {"t": "RULE 5", "h": "Budget: 100 points"}),
   ("Now, each of you will listen to your specialist. Remember the numbers. Talk to each other. Good luck!", None)]},
 "science": {"name": "Ayat", "title": "Science Lead", "voice": "en-US-EmmaNeural", "img": "crew_1.jpg", "color": "#5fd8ff", "seg": [
   ("Hi! I am Ayat. I am the Science Lead.", None),
   ("My job is to choose what the satellite sees. I have two choices.", None),
   ("Choice one: the camera.", None),
   ("Camera A is called O L I. It flies on the real Landsat 8.", {"t": "CAMERA A · OLI", "h": "Flies on Landsat 8"}),
   ("Each pixel is thirty meters. It sees near-infrared light. Healthy plants shine in near-infrared. One picture is one hundred eighty-five kilometers wide.", {"t": "CAMERA A · OLI", "h": "30 m pixels · sees near-infrared · 185 km wide"}),
   ("Camera B is called MODIS. It sees the whole Earth every one or two days.", {"t": "CAMERA B · MODIS", "h": "Whole Earth every 1–2 days"}),
   ("But each pixel is two hundred fifty meters. That is bigger than many small fields.", {"t": "CAMERA B · MODIS", "h": "250 m pixels · sees near-infrared"}),
   ("Camera C is a normal camera. Beautiful pictures. But it sees only normal light. No near-infrared.", {"t": "CAMERA C · NORMAL", "h": "Normal light only · no near-infrared"}),
   ("Choice two: when do we take pictures?", None),
   ("In the morning, around ten o'clock. At any time of day. Or at night.", {"t": "PICTURE TIME", "h": "Morning 10 a.m. · Any time · Night"}),
   ("Hint! To compare pictures, the light must be the same every time. And remember: plants need sunlight to be seen.", {"t": "HINT", "h": "Same light every time"}),
   ("One more thing. A better camera makes more data and uses more power. Tell Adham and Abdelrahman which camera you choose.", {"t": "TALK TO", "h": "Adham (data) · Abdelrahman (power)"})]},
 "comms": {"name": "Adham", "title": "Communications Lead", "voice": "en-US-BrianNeural", "img": "crew_4.jpg", "color": "#c79bff", "seg": [
   ("Hi! I am Adham. I am the Communications Lead.", None),
   ("My job is to send the pictures to Earth. I have two choices.", None),
   ("Choice one: the antenna. The antenna is the satellite's mouth and ears. It sends pictures down, and hears commands from Earth.", None),
   ("Antenna A is S-band. It is slow. It is good for small messages, like: I am OK.", {"t": "ANTENNA A · S-BAND", "h": "Slow · small messages"}),
   ("Antenna B is X-band. It is fast. The real Landsat 8 sends three hundred eighty-four megabits every second with X-band.", {"t": "ANTENNA B · X-BAND", "h": "Fast · Landsat 8: 384 Mbit/s"}),
   ("Antenna C is Ka-band. It is even faster. But it costs more, uses more power, and must point very exactly.", {"t": "ANTENNA C · KA-BAND", "h": "Fastest · costs more · more power"}),
   ("Choice two: ground stations. A ground station is a big dish on Earth.", None),
   ("The satellite can talk to a station only when it flies over it. Only a few minutes each time. So the satellite saves pictures in its memory.", {"t": "GROUND STATIONS", "h": "Talk only when flying over"}),
   ("One station is cheap. But if it breaks, we lose pictures. Two stations are safer. Three stations are very safe, but they cost more.", {"t": "STATIONS", "h": "1 cheap · 2 safer · 3 costs more"}),
   ("Hint! Ask Ayat which camera she chooses. A big camera makes a lot of data.", {"t": "HINT", "h": "Ask Ayat about her camera"})]},
 "engineer": {"name": "Abdelrahman", "title": "Spacecraft Engineer", "voice": "en-US-AndrewNeural", "img": "crew_2.jpg", "color": "#ffb35f", "seg": [
   ("Hi! I am Abdelrahman. I am the Spacecraft Engineer.", None),
   ("My job is to keep the satellite alive. I have two choices.", None),
   ("Choice one: solar panels. They turn sunlight into electricity.", None),
   ("Small, medium, or large. Bigger panels make more power. But they are heavier, and they cost more.", {"t": "SOLAR PANELS", "h": "Small · Medium · Large"}),
   ("The camera and the antenna both need power. A big camera or a Ka-band antenna needs more.", {"t": "WHO USES POWER?", "h": "Camera + antenna + computer"}),
   ("Choice two: the battery. Listen carefully.", None),
   ("One orbit around Earth takes about one hundred minutes. For about thirty-five minutes, the satellite is in Earth's shadow. No sunlight. No power from the panels.", {"t": "EARTH'S SHADOW", "h": "About 35 minutes every orbit"}),
   ("The small battery lasts about twenty minutes. The medium battery lasts about forty-five minutes. The large battery lasts about ninety minutes, but it is very heavy.", {"t": "BATTERY", "h": "Small 20 min · Medium 45 min · Large 90 min"}),
   ("Hint! In space, more is not always better. Every kilogram goes on the rocket, and costs money.", {"t": "HINT", "h": "More is not always better"})]},
 "planner": {"name": "Ahmed", "title": "Mission Planner", "voice": "en-US-EricNeural", "img": "ctrl_4.jpg", "color": "#7dffb0", "seg": [
   ("Hi! I am Ahmed. I am the Mission Planner.", None),
   ("My job is the path, the rocket, and the end of the mission. I have three choices.", None),
   ("Choice one: how high is the orbit?", None),
   ("Four hundred kilometers. Pictures are sharper. But there is a little air up there. It slowly pulls the satellite down. So the satellite needs a lot of fuel to stay up.", {"t": "ORBIT A · 400 km", "h": "Sharper · air pulls it down · lots of fuel"}),
   ("Seven hundred five kilometers, sun-synchronous. This is the real Landsat 8 orbit. It passes over the same place at the same time of day.", {"t": "ORBIT B · 705 km", "h": "Landsat 8 orbit · same time every day"}),
   ("One thousand five hundred kilometers. Almost no air. But pictures are less sharp, and the radiation is stronger.", {"t": "ORBIT C · 1,500 km", "h": "Less sharp · more radiation"}),
   ("Choice two: the rocket. A satellite like Landsat 8 weighs about three tonnes.", None),
   ("Pegasus XL is small. It lifts about four hundred fifty kilograms.", {"t": "ROCKET A · PEGASUS XL", "h": "Lifts about 450 kg"}),
   ("Atlas V 401 is medium. It launched the real Landsat 8 in twenty thirteen.", {"t": "ROCKET B · ATLAS V 401", "h": "Launched Landsat 8 in 2013"}),
   ("Falcon Heavy is huge. It lifts much more than we need, and it is very expensive.", {"t": "ROCKET C · FALCON HEAVY", "h": "Huge · very expensive"}),
   ("Choice three: the end of the mission. We can save fuel to bring the satellite down safely. We can use all the fuel for more pictures. Or we can just leave it up there.", {"t": "END OF MISSION", "h": "Bring it down · use all fuel · leave it"}),
   ("Hint! Old satellites that stay up become space junk. And the budget is only one hundred points. Talk with the team.", {"t": "HINT", "h": "Space junk · budget 100"})]}
}
