"""Voice-over as one file per line (01..10): clean, trim, level together, write src/voice.json.
usage: python3 scripts/sync_files.py f1 f2 ... f10
"""
import json, os, re, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "voice"); os.makedirs(out, exist_ok=True)
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True)
dur = lambda f: float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f).stdout)
chain = ("highpass=f=80,afftdn=nf=-28,"
         "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.06,"
         "areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.12,areverse,"
         "acompressor=threshold=-20dB:ratio=3:attack=5:release=90")
tmp = []
for i, src in enumerate(sys.argv[1:], 1):
    t = os.path.join(out, f"raw{i:02d}.wav")
    run("ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "48000", "-af", chain, t)
    tmp.append(t)
# one shared gain so all lines sit at the same loudness (≈ -14 LUFS for social)
lst = os.path.join(out, "list.txt"); open(lst, "w").write("".join(f"file '{t}'\n" for t in tmp))
log = subprocess.run(["ffmpeg", "-f", "concat", "-safe", "0", "-i", lst, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", log)[-1]); gain = -14 - I
print(f"measured {I} LUFS → gain {gain:+.1f} dB")
clips = []
for i, t in enumerate(tmp, 1):
    f = f"voice/{i:02d}.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", t, "-af", f"volume={gain}dB,alimiter=limit=0.89,afade=t=in:d=0.02,areverse,afade=t=in:d=0.05,areverse", os.path.join(root, "public", f))
    clips.append({"file": f, "dur": round(dur(os.path.join(root, "public", f)), 3)})
    os.remove(t)
os.remove(lst)
json.dump({"clips": clips}, open(os.path.join(root, "src", "voice.json"), "w"), indent=2)
print("durations:", [c["dur"] for c in clips])
