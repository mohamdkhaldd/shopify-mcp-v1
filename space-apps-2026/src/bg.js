/* Living star background: drawn live, so it never "restarts" and has no seam. */
(function () {
  const cv = document.createElement("canvas"); cv.id = "starbg"; cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const g = cv.getContext("2d"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, stars = [], neb = null, shoot = null, last = 0, t0 = performance.now();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TINT = ["#ffffff", "#ffffff", "#ffffff", "#cfe3ff", "#a9c8ff", "#fff1d6", "#ffd9b0"];
  function nebula() {
    // painted once into an off-screen canvas, then slowly drifted and breathed
    const c = document.createElement("canvas"); c.width = W; c.height = H; const n = c.getContext("2d");
    const blob = (x, y, r, col) => { const gr = n.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); n.fillStyle = gr; n.fillRect(0, 0, W, H); };
    blob(W * .82, H * .12, Math.max(W, H) * .55, "rgba(40,70,160,.20)");
    blob(W * .12, H * .85, Math.max(W, H) * .5, "rgba(20,90,120,.16)");
    blob(W * .55, H * .45, Math.max(W, H) * .35, "rgba(110,50,140,.08)");
    // milky way band
    n.save(); n.translate(W / 2, H / 2); n.rotate(-.42);
    const band = n.createLinearGradient(0, -H * .22, 0, H * .22);
    band.addColorStop(0, "rgba(0,0,0,0)"); band.addColorStop(.5, "rgba(150,170,230,.07)"); band.addColorStop(1, "rgba(0,0,0,0)");
    n.fillStyle = band; n.fillRect(-W, -H * .22, W * 2, H * .44);
    for (let i = 0; i < (W * H) / 900; i++) { n.fillStyle = `rgba(220,230,255,${rnd(.05, .28)})`; n.fillRect(rnd(-W, W), rnd(-H * .16, H * .16) * Math.random() * 1.4, 1, 1); }
    n.restore(); return c;
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(900, (W * H) / 1300));
    stars = Array.from({ length: count }, () => {
      const z = Math.pow(Math.random(), 2.2); // most stars far and faint
      return { x: rnd(0, W), y: rnd(0, H), z, r: .5 + z * 1.9, a: .45 + z * .55, c: TINT[(Math.random() * TINT.length) | 0], tw: rnd(.4, 2.2), ph: rnd(0, 6.3) };
    });
    neb = nebula(); draw(performance.now(), true);
  }
  function draw(now, force) {
    const dt = Math.min(50, now - (last || now)); last = now; const t = (now - t0) / 1000;
    g.fillStyle = "#02040a"; g.fillRect(0, 0, W, H);
    g.globalAlpha = .85 + Math.sin(t * .07) * .15; g.drawImage(neb, Math.sin(t * .013) * 18, Math.cos(t * .011) * 12, W, H); g.globalAlpha = 1;
    for (const s of stars) {
      if (!still) { s.x -= dt * .0025 * (.15 + s.z * 1.1); s.y += dt * .0008 * (.15 + s.z); if (s.x < -2) s.x += W + 4; if (s.y > H + 2) s.y -= H + 4; }
      const a = s.a * (.72 + .28 * Math.sin(t * s.tw + s.ph));
      g.globalAlpha = a; g.fillStyle = s.c;
      if (s.r > 1.35) { // bright stars get a soft glow and tiny spikes
        const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4); gr.addColorStop(0, s.c); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
        g.globalAlpha = a * .5; g.fillStyle = s.c; g.fillRect(s.x - s.r * 3, s.y - .3, s.r * 6, .6); g.fillRect(s.x - .3, s.y - s.r * 3, .6, s.r * 6);
        g.globalAlpha = a;
      }
      g.beginPath(); g.arc(s.x, s.y, s.r * .6, 0, 6.283); g.fill();
    }
    // a rare shooting star
    if (!still) {
      if (!shoot && Math.random() < dt / 9000) shoot = { x: rnd(W * .2, W), y: rnd(0, H * .4), vx: -rnd(.6, 1), vy: rnd(.25, .45), life: 0 };
      if (shoot) {
        shoot.life += dt; const k = shoot.life / 900, x = shoot.x + shoot.vx * shoot.life, y = shoot.y + shoot.vy * shoot.life;
        const gr = g.createLinearGradient(x, y, x - shoot.vx * 140, y - shoot.vy * 140);
        gr.addColorStop(0, `rgba(255,255,255,${.9 * (1 - k)})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - shoot.vx * 140, y - shoot.vy * 140); g.stroke();
        if (k >= 1) shoot = null;
      }
    }
    g.globalAlpha = 1;
    if (!still && !force) requestAnimationFrame(draw);
  }
  addEventListener("resize", () => { clearTimeout(size.t); size.t = setTimeout(size, 150); });
  size(); if (!still) requestAnimationFrame(draw);
})();
