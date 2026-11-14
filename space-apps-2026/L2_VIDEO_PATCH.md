# Level 2 (Moon) briefing videos: patch list

**Task:** edit the 5 existing Level 2 videos in `space-apps-2026/video/`. Only add or replace the sentences below. Do **not** rebuild the videos from scratch.

**Files:** `moon_director.mp4`, `moon_science.mp4`, `moon_comms.mp4`, `moon_engineer.mp4`, `moon_planner.mp4`

**Why:** Level 2 choices are now linked in pairs:
- camera data → antenna speed
- battery weight → rocket
- laser antenna → 3 ground stations
- orbit height → pixel size

The game already uses the new numbers, and the scripts shown under each video are already updated in `src/transcripts.js`. The videos are the only thing left.

**How to find each spot:** every change below quotes the OLD sentence exactly as it is spoken in the current video. Find that sentence, then:
- **REPLACE** it with the new sentence, or
- **ADD** the new sentence right after it.

**Rules:**
- Use the same voice for the new audio as the rest of that video.
- Keep the same on-screen style.
- Update the on-screen caption wherever it shows the old number.
- Export at the same format as now: 1280×720, H.264 + AAC.
- Re-encode only the parts you change if possible. Keep the rest at its current quality.

---

## 1. `moon_director.mp4` (Mohamed, Mission Director)

**REPLACE**
- OLD: "Four: send at least one hundred megabits of maps every second."
- NEW: "Four: send home every map the camera makes, as fast as the camera makes it."
- On-screen caption for NEED 4: change "Send 100 Mbit/s" to **"Send ALL the camera data"**.

**ADD** after "Each guide will give you numbers. Compare each number with what we need. Write them on the team board. Good luck!"
- NEW: "Our choices are linked. The camera decides how fast the antenna must be. The battery changes the weight the rocket must carry. So talk to each other!"
- Optional caption: **"LINKED: camera → antenna · battery → rocket"**

## 2. `moon_science.mp4` (Ayat, Science Lead)

**REPLACE** each camera sentence. It is the same sentence with the data number added at the end.

| OLD | NEW |
|---|---|
| "Camera A, a wide camera. Pixel: 100 meters. It sees a very big area in each picture. It makes little data." | "Camera A, a wide camera. Pixel: 100 meters. It sees a very big area in each picture. It makes about 2 megabits of data every second." |
| "Camera B, a narrow camera. Pixel: half a meter. Each picture is a thin strip, about five kilometers wide. It makes a lot of data." | "Camera B, a narrow camera. Pixel: half a meter. Each picture is a thin strip, about five kilometers wide. It makes about 100 megabits of data every second." |
| "Camera C, a medium camera. Pixel: 10 meters. Medium area. Medium data." | "Camera C, a medium camera. Pixel: 10 meters. Medium area. It makes about 20 megabits of data every second." |

On-screen captions: add **"2 Mbit/s"**, **"100 Mbit/s"** and **"20 Mbit/s"** to cameras A, B and C.

**REPLACE** (last sentence)
- OLD: "Write it on the board, then compare with what Mohamed asked for."
- NEW: "Write your camera's data number on the board, so Adham can choose an antenna fast enough. Then compare with what Mohamed asked for."

## 3. `moon_comms.mp4` (Adham, Communications Lead)

**REPLACE**
- OLD: "Antenna A, a laser link. NASA tested one at the Moon in 2013. It sent 622 megabits every second. But laser light cannot pass through clouds over the ground station."
- NEW: "Antenna A, a laser link. NASA tested one at the Moon in 2013. It sent 622 megabits every second. But laser light cannot pass through clouds, so it only works safely with three ground stations."
- Caption: **"622 Mbit/s · needs 3 stations"**

**REPLACE**
- OLD: "Antenna C, S-band radio. It sends a few megabits every second. It is simple, and passes through clouds."
- NEW: "Antenna C, S-band radio. It sends about 2 megabits every second. It is simple, and passes through clouds."
- Caption: "A few Mbit/s" becomes **"2 Mbit/s"**.

**REPLACE** (last sentence)
- OLD: "Write the speeds on the board. Compare them with what Mohamed asked for."
- NEW: "Your antenna must send at least as much as Ayat's camera makes. Compare your speed with her number on the board."

## 4. `moon_engineer.mp4` (Abdelrahman, Spacecraft Engineer)

**REPLACE**
- OLD: "Battery A lasts 30 minutes. Battery B lasts 60 minutes. Battery C lasts 120 minutes, but it is very heavy."
- NEW: "Battery A lasts 30 minutes. Battery B lasts 60 minutes. Battery C lasts 120 minutes, but it adds 150 kilograms to the satellite."
- Caption: **"C 120 min · +150 kg"**

**REPLACE** (last sentence)
- OLD: "Write the battery times on the board, and compare them with the shadow."
- NEW: "Write the battery times on the board, and compare them with the shadow. If you take battery C, tell Ahmed: the satellite gets heavier."

## 5. `moon_planner.mp4` (Ahmed, Mission Planner)

**REPLACE**
- OLD: "Orbit C, high polar orbit, 3,000 kilometers. It flies over the poles too, and needs less fuel to stay up. But it is sixty times higher, so every pixel is sixty times bigger."
- NEW: the same sentence, then add: "The narrow camera's half-meter pixel becomes thirty meters, too big to see the rocks."
- Caption: **"0.5 m → 30 m"**

**REPLACE**
- OLD: "Our satellite weighs about 1,900 kilograms. Our launch budget is 150 million dollars."
- NEW: "Our satellite weighs about 1,900 kilograms, plus 150 more if we take battery C. Our launch budget is 150 million dollars."
- Caption: **"1,900 kg (+150 kg with battery C)"**

---

**When done:** push the 5 files with the same names to a new branch on top of `claude/magical-darwin-2gtbz6`, and change nothing else.

| Video | Changes | Total |
|---|---|---|
| `moon_director` | 1 replace + 1 add | 2 |
| `moon_science` | 4 replace | 4 |
| `moon_comms` | 3 replace | 3 |
| `moon_engineer` | 2 replace | 2 |
| `moon_planner` | 2 replace | 2 |
