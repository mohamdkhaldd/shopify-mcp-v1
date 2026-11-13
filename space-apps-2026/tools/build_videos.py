import os, subprocess, textwrap, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from scripts import ROLES
HERE = os.path.dirname(os.path.abspath(__file__)); GAME = os.path.join(HERE, "..", "game")
OUT = os.path.join(GAME, "video"); os.makedirs(OUT, exist_ok=True)
W, H = 1280, 720
F = "/usr/share/fonts/truetype/dejavu/"
font = lambda n, s: ImageFont.truetype(F + n, s)
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def bg():
    im = Image.new("RGB", (W, H), (3, 6, 13)); d = ImageDraw.Draw(im)
    for x in range(0, W, 44): d.line([(x, 0), (x, H)], fill=(8, 18, 30))
    for y in range(0, H, 44): d.line([(0, y), (W, y)], fill=(8, 18, 30))
    glow = Image.new("RGB", (W, H), (0, 0, 0)); gd = ImageDraw.Draw(glow); gd.ellipse((200, -300, 1100, 300), fill=(20, 45, 90)); glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(im, glow, .5)
def bracket(d, box, col):
    x0, y0, x1, y1 = box; L = 22
    d.rectangle(box, outline=(30, 70, 100), width=1)
    for (x, y, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        d.line([(x, y), (x + dx * L, y)], fill=col, width=3); d.line([(x, y), (x, y + dy * L)], fill=col, width=3)
def slide(role, seg, card):
    R = ROLES[role]; col = hexc(R["color"]); im = bg(); d = ImageDraw.Draw(im)
    d.text((60, 44), "MISSION BRIEFING  ·  NILE DELTA CROP WATCH", font=font("DejaVuSansMono.ttf", 20), fill=(95, 216, 255))
    p = Image.open(os.path.join(GAME, "img", R["img"])).convert("RGB").resize((580, 342)); im.paste(p, (60, 110)); bracket(d, (60, 110, 640, 452), col)
    d.rectangle((60, 462, 640, 540), fill=(6, 14, 28)); d.text((80, 470), R["name"].upper(), font=font("DejaVuSans-Bold.ttf", 34), fill=(234, 246, 255))
    d.text((80, 510), R["title"].upper(), font=font("DejaVuSansMono.ttf", 20), fill=col)
    if card:
        bx = (690, 150, 1220, 452); d.rectangle(bx, fill=(5, 12, 26)); bracket(d, bx, col)
        d.text((716, 176), card["t"], font=font("DejaVuSansMono-Bold.ttf", 24), fill=col)
        y = 226
        for part in card["h"].split(" · "):
            for line in textwrap.wrap(part, 21):
                d.text((716, y), line, font=font("DejaVuSans-Bold.ttf", 34), fill=(234, 246, 255)); y += 46
            y += 10
    else:
        d.text((716, 280), "LISTEN CAREFULLY", font=font("DejaVuSansMono-Bold.ttf", 26), fill=(60, 110, 140))
        d.text((716, 320), "Remember the numbers.", font=font("DejaVuSans.ttf", 26), fill=(90, 130, 160))
    d.rectangle((0, 586, W, H), fill=(2, 5, 11)); d.line([(0, 586), (W, 586)], fill=(30, 70, 100))
    y = 604
    for line in textwrap.wrap(seg, 70)[:3]:
        w = d.textlength(line, font=font("DejaVuSans.ttf", 28)); d.text(((W - w) / 2, y), line, font=font("DejaVuSans.ttf", 28), fill=(234, 246, 255)); y += 36
    return im
def run(c): subprocess.run(c, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode())
TTS = os.path.join(HERE, "venv", "bin", "edge-tts")
for role in (sys.argv[1:] or ROLES.keys()):
    R = ROLES[role]; tmp = os.path.join(HERE, "work", role); os.makedirs(tmp, exist_ok=True); parts = []
    for i, (text, card) in enumerate(R["seg"]):
        a = os.path.join(tmp, f"{i:02d}.mp3"); png = os.path.join(tmp, f"{i:02d}.png"); mp4 = os.path.join(tmp, f"{i:02d}.mp4")
        for attempt in range(4):
            if os.path.exists(a) and os.path.getsize(a) > 1000: break
            try: run([TTS, "--voice", R["voice"], "--rate=-10%", "--text", text, "--write-media", a])
            except subprocess.CalledProcessError: import time; time.sleep(3)
        slide(role, text, card).save(png)
        t = dur(a) + .45
        run(["ffmpeg", "-y", "-i", png, "-i", a, "-filter_complex", f"[0:v]scale=1300:-2,zoompan=z='1+0.012*on/{int(t*30)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(t*30)}:s={W}x{H}:fps=30,fade=in:0:6[v];[1:a]apad=pad_dur=0.45[a]", "-map", "[v]", "-map", "[a]", "-t", str(t), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", mp4])
        parts.append(mp4)
    lst = os.path.join(tmp, "list.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(OUT, f"delta_{role}.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "26", "-preset", "veryfast", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out])
    print(role, round(dur(out), 1), "s", round(os.path.getsize(out) / 1e6, 2), "MB")
