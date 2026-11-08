"""Cut the voice-over into one clip per scene and write src/voice.json.

usage: python3 scripts/sync.py path/to/voice.(m4a|mp3|wav|ogg) [silence_db] [min_silence_s]
The recording is the 10 lines read in order with ~2s pauses between them.
"""
import json, re, subprocess, sys, os

src = sys.argv[1]
db = sys.argv[2] if len(sys.argv) > 2 else "-35dB"
gap = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "voice")
os.makedirs(out, exist_ok=True)

# clean, level the voice once: denoise, gentle compression, loudness for social
clean = os.path.join(out, "clean.wav")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "48000",
                "-af", "highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-14:TP=-1.5:LRA=9",
                clean], check=True)
length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clean], capture_output=True, text=True).stdout)
log = subprocess.run(["ffmpeg", "-i", clean, "-af", f"silencedetect=noise={db}:d={gap}", "-f", "null", "-"], capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]

# speech = the gaps between silences
speech, cur = [], 0.0
for s, e in zip(starts, ends + [length] * (len(starts) - len(ends))):
    if s - cur > 0.25:
        speech.append((cur, s))
    cur = e
if length - cur > 0.25:
    speech.append((cur, length))
print(f"{len(speech)} spoken parts found:", [(round(a, 2), round(b, 2)) for a, b in speech])
if len(speech) != 10:
    print("!! expected 10 lines; adjust silence_db / min_silence_s (or a line was repeated: keep the LAST take by editing below)")

clips = []
for i, (a, b) in enumerate(speech[-10:] if len(speech) >= 10 else speech):
    a, b = max(0, a - 0.08), min(length, b + 0.12)
    f = f"voice/{i + 1:02d}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", clean, "-ss", f"{a}", "-to", f"{b}", "-af", "afade=t=in:d=0.03,areverse,afade=t=in:d=0.06,areverse", os.path.join(root, "public", f)], check=True)
    clips.append({"file": f, "dur": round(b - a, 3)})
json.dump({"clips": clips}, open(os.path.join(root, "src", "voice.json"), "w"), indent=2)
print("wrote src/voice.json:", [c["dur"] for c in clips], "total ≈", round(sum(c["dur"] + 0.35 for c in clips), 1), "s")
