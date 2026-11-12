/* ===== Space3D: real-scale 3D views (Three.js r128) =====
   World units: 1 unit = 637.1 km, so Earth's radius = 10 units.
   The spacecraft is drawn in its own pass in metres, so it stays sharp next to whole planets. */
const Space3D = (() => {
  const T = window.THREE;
  const webgl = (() => { if (!T) return false; try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  const KM = 1 / 637.1, MPU_SPACE = 637100;
  let quality = (matchMedia("(pointer:coarse)").matches || innerWidth < 760) ? "low" : "high";
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const RE = 10, RM = 1737.4 * KM, RMARS = 3389.5 * KM;
  let SUN_DIR, SUN_POS, MOON_POS, L2_POS, LAUNCH_DIR;
  if (webgl) {
    SUN_DIR = V(1, .12, .38).normalize();
    SUN_POS = SUN_DIR.clone().multiplyScalar(149.6e6 * KM);
    MOON_POS = V(-.55, .06, -.83).normalize().multiplyScalar(384400 * KM);
    L2_POS = SUN_DIR.clone().multiplyScalar(-1.5e6 * KM);
    LAUNCH_DIR = V(.72, .42, .55).normalize();
  }
  /* ---------- textures ---------- */
  const cache = {}; let loader, sky;
  const tex = n => { if (!cache[n]) { loader = loader || new T.TextureLoader(); const t = loader.load("tex/" + n); t.anisotropy = 4; cache[n] = t; } return cache[n]; };
  const skybox = () => sky || (sky = new T.CubeTextureLoader().setPath("tex/").load(["dark-s_px.jpg", "dark-s_nx.jpg", "dark-s_py.jpg", "dark-s_ny.jpg", "dark-s_pz.jpg", "dark-s_nz.jpg"]));
  function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; }
  let cellTex;
  const solarCells = () => cellTex || (cellTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#0d1b3d"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const gr = g.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32); gr.addColorStop(0, "#1c3a78"); gr.addColorStop(1, "#0e2350"); g.fillStyle = gr; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); }
    g.strokeStyle = "#9aa6bb"; g.lineWidth = 1; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
  }));
  let foilTex;
  const foil = () => foilTex || (foilTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 90 + Math.random() * 120 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + Math.random() * 30 - 15, y + Math.random() * 30 - 15); g.lineTo(x + Math.random() * 30 - 15, y + Math.random() * 30 - 15); g.fill(); }
  }));
  function labelSprite(txt) {
    const t = canvasTex(512, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#5fd0e0"; g.beginPath(); g.arc(28, h / 2, 14, 0, 7); g.fill(); g.font = "600 64px 'IBM Plex Sans', sans-serif"; g.fillStyle = "#e6ebf7"; g.textBaseline = "middle"; g.fillText(txt, 60, h / 2 + 4); });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); sp.center.set(.055, .5); sp.renderOrder = 10; sp.visible = false; return sp;
  }
  /* ---------- noise ---------- */
  function hash(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf); let r = 0;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++)
      r += hash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    return r;
  }
  const fbm = (x, y, z, o = 5) => { let a = .5, f = 1, r = 0; for (let i = 0; i < o; i++) { r += a * vnoise(x * f, y * f, z * f); a *= .5; f *= 2.03; } return r; };
  /* ---------- shaders ---------- */
  const LOGV = "#include <common>\n#include <logdepthbuf_pars_vertex>\n", LOGF = "#include <common>\n#include <logdepthbuf_pars_fragment>\n";
  function earthMaterial() {
    return new T.ShaderMaterial({
      extensions: { fragDepth: true },
      uniforms: { day: { value: tex("earth_atmos_2048.jpg") }, night: { value: tex("earth_lights_2048.jpg") }, spec: { value: tex("earth_specular_2048.jpg") }, sunDir: { value: SUN_DIR } },
      vertexShader: LOGV + `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + `uniform sampler2D day; uniform sampler2D night; uniform sampler2D spec; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 N=normalize(vN); vec3 L=normalize(sunDir); vec3 Vw=normalize(cameraPosition-vP);
          float d=dot(N,L); float dayK=smoothstep(-.12,.2,d);
          vec3 dc=texture2D(day,vUv).rgb; vec3 nc=texture2D(night,vUv).rgb;
          vec3 col=mix(nc*vec3(1.0,.82,.55)*1.6, dc*(.04+1.1*max(d,0.0)), dayK);
          vec3 H=normalize(L+Vw); float s=pow(max(dot(N,H),0.0),55.0)*texture2D(spec,vUv).r*.65*dayK; col+=vec3(1.0,.95,.85)*s;
          float f=pow(1.0-max(dot(N,Vw),0.0),2.4); col+=vec3(.32,.58,1.0)*f*.6*smoothstep(-.3,.45,d);
          gl_FragColor=vec4(col,1.0);
        }`
    });
  }
  function atmoMaterial(color, power, strength) {
    return new T.ShaderMaterial({
      extensions: { fragDepth: true }, side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false,
      uniforms: { sunDir: { value: SUN_DIR }, col: { value: new T.Color(color) }, pw: { value: power }, k: { value: strength } },
      vertexShader: LOGV + `varying vec3 vNv; varying vec3 vNw; void main(){ vNv=normalize(normalMatrix*normal); vNw=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + `uniform vec3 sunDir; uniform vec3 col; uniform float pw; uniform float k; varying vec3 vNv; varying vec3 vNw;
        void main(){
          #include <logdepthbuf_fragment>
          float i=pow(max(0.0,.72+dot(vNv,vec3(0,0,1.0))),pw); float lit=.15+.85*smoothstep(-.4,.5,dot(-vNw,sunDir)*-1.0);
          gl_FragColor=vec4(col*i*k*lit,1.0);
        }`
    });
  }
  /* ---------- bodies ---------- */
  const seg = () => quality === "high" ? 128 : 56;
  function makeEarth() {
    const g = new T.Group();
    const surf = new T.Mesh(new T.SphereGeometry(RE, seg(), seg() / 2), earthMaterial()); g.add(surf);
    const clouds = new T.Mesh(new T.SphereGeometry(RE * 1.006, seg(), seg() / 2), new T.MeshLambertMaterial({ map: tex("clouds.png"), transparent: true, opacity: .85, depthWrite: false }));
    g.add(clouds); g.userData.clouds = clouds;
    g.add(new T.Mesh(new T.SphereGeometry(RE * 1.025, 64, 32), atmoMaterial(0x5aa0ff, 3.2, 1.35)));
    return g;
  }
  function makeMoon() { return new T.Mesh(new T.SphereGeometry(RM, seg(), seg() / 2), new T.MeshStandardMaterial({ map: tex("moon_1024.jpg"), roughness: 1, metalness: 0 })); }
  function makeMars() {
    const g = new T.Group();
    g.add(new T.Mesh(new T.SphereGeometry(RMARS, seg(), seg() / 2), new T.MeshStandardMaterial({ map: tex("mars_2048.jpg"), roughness: 1, metalness: 0 })));
    g.add(new T.Mesh(new T.SphereGeometry(RMARS * 1.015, 64, 32), atmoMaterial(0xd9774a, 5.0, .32)));
    return g;
  }
  function makeSun(pos, radius) {
    const g = new T.Group(); g.position.copy(pos);
    g.add(new T.Mesh(new T.SphereGeometry(radius, 48, 24), new T.MeshBasicMaterial({ color: 0xffffff })));
    const glow = new T.Sprite(new T.SpriteMaterial({ map: tex("lensflare0.png"), color: 0xfff3dd, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.scale.setScalar(radius * 28); g.add(glow);
    return g;
  }
  function rockGeometry(r, detail, rough, seed) {
    const geo = new T.IcosahedronGeometry(r, detail); const p = geo.attributes.position; const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const n = fbm(v.x * 2.1 + seed, v.y * 2.1, v.z * 2.1, 5); const k = 1 + (n - .5) * rough; p.setXYZ(i, v.x * r * k, v.y * r * k * .88, v.z * r * k); }
    geo.computeVertexNormals(); return geo;
  }
  /* ---------- lights ---------- */
  function lights(scene, amb = .035) {
    const s = new T.DirectionalLight(0xfff3e6, 2.1); s.position.copy(SUN_DIR).multiplyScalar(100); scene.add(s); scene.add(s.target);
    scene.add(new T.AmbientLight(0x8899bb, amb)); return s;
  }
  /* ---------- worlds ---------- */
  function worldEarth() {
    const s = new T.Scene(); s.background = skybox(); lights(s);
    const earth = makeEarth(); earth.rotation.y = -1.2; s.add(earth);
    const moon = makeMoon(); moon.position.copy(MOON_POS); s.add(moon);
    s.add(makeSun(SUN_POS, 696000 * KM));
    return { scene: s, mpu: MPU_SPACE, earth, moon, focus: { earth: V(0, 0, 0), moon: MOON_POS } };
  }
  function worldMars() {
    const s = new T.Scene(); s.background = skybox(); lights(s, .03);
    const mars = makeMars(); s.add(mars);
    s.add(makeSun(SUN_DIR.clone().multiplyScalar(227.9e6 * KM), 696000 * KM));
    const phobos = new T.Mesh(rockGeometry(11 * KM * 3, 3, .5, 3), new T.MeshStandardMaterial({ color: 0x7a6a5c, roughness: 1, flatShading: true }));
    phobos.position.set(9376 * KM, 0, 0); s.add(phobos);
    return { scene: s, mpu: MPU_SPACE, mars, phobos, focus: { mars: V(0, 0, 0) } };
  }
  function worldDeep() {
    const s = new T.Scene(); s.background = skybox(); lights(s, .03);
    s.add(makeSun(SUN_DIR.clone().multiplyScalar(149.6e6 * KM), 696000 * KM));
    return { scene: s, mpu: MPU_SPACE, focus: { sun: SUN_POS } };
  }
  function worldAsteroid() { // units: metres
    const s = new T.Scene(); s.background = skybox(); lights(s, .02);
    const mat = new T.MeshStandardMaterial({ color: 0x8a7d70, roughness: 1, metalness: 0, flatShading: true });
    const didy = new T.Mesh(rockGeometry(390, quality === "high" ? 5 : 4, .35, 1), mat); s.add(didy);
    const dimo = new T.Mesh(rockGeometry(80, 4, .45, 7), mat); dimo.position.set(1190, 0, 0); s.add(dimo);
    const sun = new T.Sprite(new T.SpriteMaterial({ map: tex("lensflare0.png"), color: 0xffe2b0, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    sun.position.copy(SUN_DIR).multiplyScalar(4e6); sun.scale.setScalar(1.1e5); s.add(sun);
    const ej = makeEjecta(); dimo.add(ej);
    return { scene: s, mpu: 1, didy, dimo, ejecta: ej, focus: { dimo: dimo.position } };
  }
  function makeEjecta() {
    const n = 1500, g = new T.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { const d = V(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); d.x = -Math.abs(d.x) * 1.5 - .2; d.normalize(); vel.push(d.multiplyScalar(20 + Math.random() * 60)); }
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    const p = new T.Points(g, new T.PointsMaterial({ color: 0xd8cbb8, size: 3, sizeAttenuation: true, transparent: true, opacity: .9, depthWrite: false }));
    p.visible = false; p.userData = { vel, t: 0 }; return p;
  }
  function worldSurface(m, d) { // Mars surface, metres
    const s = new T.Scene(); s.background = new T.Color(0xc9a184); s.fog = new T.Fog(0xc9a184, 300, 2600);
    const sun = new T.DirectionalLight(0xffe7cc, 1.9); sun.position.set(400, 260, 200); s.add(sun); s.add(new T.HemisphereLight(0xe9c3a0, 0x5a3420, .55));
    const N = quality === "high" ? 160 : 80, geo = new T.PlaneGeometry(5000, 5000, N, N); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = [], crater = d && d.orbit === "jezero";
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z);
      let h = (fbm(x * .0016, 0, z * .0016, 5) - .5) * 90 + (fbm(x * .01, 3, z * .01, 3) - .5) * 8;
      if (crater) h += Math.max(0, (r - 1400) * .12) - 10; // crater rim
      p.setY(i, h); const k = .75 + fbm(x * .004, 9, z * .004, 3) * .5; col.push(.62 * k, .33 * k, .2 * k);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    s.add(new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true })));
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x5c3b2a, roughness: 1, flatShading: true }), crater ? 700 : 150);
    const mtx = new T.Matrix4(); for (let i = 0; i < rocks.count; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 300, sc = .3 + Math.random() * (crater ? 3 : 1.2); mtx.compose(V(Math.cos(a) * r, -.2, Math.sin(a) * r), new T.Quaternion().setFromEuler(new T.Euler(Math.random(), Math.random(), Math.random())), V(sc, sc * .7, sc)); rocks.setMatrixAt(i, mtx); }
    s.add(rocks);
    return { scene: s, mpu: 1, surface: true, focus: { ground: V(0, 0, 0) } };
  }
  /* ---------- materials ---------- */
  function mats() {
    const env = skybox();
    return {
      gold: new T.MeshStandardMaterial({ color: 0xd9a843, metalness: .65, roughness: .42, roughnessMap: foil(), envMap: env, envMapIntensity: 1.2 }),
      silver: new T.MeshStandardMaterial({ color: 0xc8ccd4, metalness: .6, roughness: .4, roughnessMap: foil(), envMap: env, envMapIntensity: 1.2 }),
      white: new T.MeshStandardMaterial({ color: 0xe9e9e6, metalness: .05, roughness: .55, envMap: env, envMapIntensity: .3 }),
      grey: new T.MeshStandardMaterial({ color: 0x5b6070, metalness: .5, roughness: .5, envMap: env, envMapIntensity: .4 }),
      dark: new T.MeshStandardMaterial({ color: 0x1d1f26, metalness: .3, roughness: .6 }),
      cells: new T.MeshStandardMaterial({ map: solarCells(), metalness: .3, roughness: .35, envMap: env, envMapIntensity: .8, emissive: 0x0a1a3a, emissiveIntensity: .35 }),
      orange: new T.MeshStandardMaterial({ color: 0xc76a2a, metalness: 0, roughness: .8 }),
      lens: new T.MeshStandardMaterial({ color: 0x0a0d18, metalness: 1, roughness: .05, envMap: env }),
      shield: new T.MeshStandardMaterial({ color: 0xb9a9d6, metalness: .9, roughness: .25, envMap: env, side: T.DoubleSide }),
      heat: new T.MeshStandardMaterial({ color: 0x3a2a20, metalness: 0, roughness: .9 }),
      flame: new T.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false }),
      flameCore: new T.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })
    };
  }
  let MAT;
  const box = (x, y, z, m) => new T.Mesh(new T.BoxGeometry(x, y, z), m);
  const cyl = (rt, rb, h, m, s = 32) => new T.Mesh(new T.CylinderGeometry(rt, rb, h, s), m);
  function wing(len, wid, m) { const g = new T.Group(); const p = box(len, .04, wid, MAT.cells); p.position.x = len / 2; g.add(p); const f = box(len, .05, .04, MAT.grey); f.position.set(len / 2, 0, wid / 2); g.add(f); return g; }
  function dish(r) {
    const pts = []; for (let i = 0; i <= 16; i++) { const x = r * i / 16; pts.push(new T.Vector2(x, x * x / (4 * r * .45))); }
    const g = new T.Group(); const d = new T.Mesh(new T.LatheGeometry(pts, 40), new T.MeshStandardMaterial({ color: 0xf0f0ec, metalness: .1, roughness: .5, side: T.DoubleSide })); g.add(d);
    const feed = cyl(.03 * r + .02, .03 * r + .02, r * .7, MAT.grey, 8); feed.position.y = r * .35; g.add(feed); return g;
  }
  function rtg() { const g = new T.Group(); g.add(cyl(.3, .3, 1.1, MAT.dark, 16)); for (let i = 0; i < 8; i++) { const f = box(.04, 1, .5, MAT.grey); f.position.set(Math.cos(i * .785) * .4, 0, Math.sin(i * .785) * .4); f.rotation.y = -i * .785; g.add(f); } return g; }
  function instrumentPod(i) { const g = new T.Group(); const b = cyl(.12 + i * .02, .14 + i * .02, .35, MAT.white, 20); g.add(b); const l = cyl(.1, .1, .02, MAT.lens, 20); l.position.y = -.18; g.add(l); return g; }
  function flame(r, h) { const g = new T.Group(); const o = new T.Mesh(new T.ConeGeometry(r, h, 24, 1, true), MAT.flame); o.rotation.x = Math.PI; o.position.y = -h / 2; g.add(o); const c = new T.Mesh(new T.ConeGeometry(r * .5, h * .55, 16, 1, true), MAT.flameCore); c.rotation.x = Math.PI; c.position.y = -h * .27; g.add(c); g.userData.flame = true; return g; }
  /* ---------- spacecraft from the design ---------- */
  function buildShip(m, d, c) {
    MAT = MAT || mats();
    const g = new T.Group(); const dry = c ? c.dry : 500; const id = m.id;
    const foilM = d.shield === "none" ? MAT.silver : MAT.gold;
    const addWings = (body, area, n = 2, rad = .6) => {
      if (d.power !== "solar" || area <= 0) return; const each = area / n; const len = Math.sqrt(each * 2.6), wid = each / len;
      for (let k = 0; k < n; k++) { const w = wing(len, wid); const a = k * Math.PI * 2 / n; w.rotation.y = a; w.position.set(Math.cos(a) * rad, 0, -Math.sin(a) * rad); w.children.forEach(ch => ch.position.x += .3); body.add(w); const boom = box(.35, .05, .05, MAT.grey); boom.position.set(Math.cos(a) * (rad + .15), 0, -Math.sin(a) * (rad + .15)); boom.rotation.y = a; body.add(boom); }
    };
    const addRTG = (body, off) => { const n = d.power === "rtg2" ? 2 : d.power === "rtg1" ? 1 : 0; for (let k = 0; k < n; k++) { const r = rtg(); r.rotation.z = Math.PI / 2; r.position.set(-off - .8 - k * 1.3, 0, 0); body.add(r); const b = box(.9, .05, .05, MAT.grey); b.position.set(-off - .3 - k * 1.3, 0, 0); body.add(b); } };
    const antR = { small: .18, medium: .5, large: 1.1 }[d.antenna] || .4;
    if (id === "telescope") {
      if (d.instr.includes("sunshield")) {
        for (let k = 0; k < 5; k++) { const sh = new T.Mesh(new T.CircleGeometry(1, 6), MAT.shield); sh.scale.set(10.5, 7, 1); sh.rotation.x = -Math.PI / 2; sh.position.y = k * .25; g.add(sh); }
        const mirror = new T.Group(); const hexR = .66; const hm = new T.MeshStandardMaterial({ color: 0xe6b84a, metalness: 1, roughness: .12, envMap: skybox(), envMapIntensity: 1.2 });
        const pts = [[0, 0]]; for (let ring = 1; ring <= 2; ring++) for (let k = 0; k < 6 * ring; k++) { const a = Math.PI / 6 + k * Math.PI * 2 / (6 * ring); const rr = ring * hexR * 1.74 * (ring === 2 && k % 2 ? .87 : 1); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
        pts.slice(1, 19).forEach(([x, y]) => { const h = cyl(hexR, hexR, .08, hm, 6); h.rotation.x = Math.PI / 2; h.rotation.y = Math.PI / 6; h.position.set(x, y, 0); mirror.add(h); });
        mirror.position.set(0, 4.2, -.4); mirror.rotation.x = -.15; g.add(mirror);
        [[-1, 0], [1, 0], [0, 1]].forEach(([x, z]) => { const s = cyl(.04, .04, 7.2, MAT.dark, 6); s.position.set(x * 1.6, 5.3, 2.6 + z * .6); s.rotation.x = -.62; g.add(s); });
        const sec = cyl(.38, .38, .1, hm, 16); sec.position.set(0, 7.5, 4.9); sec.rotation.x = Math.PI / 2 - .3; g.add(sec);
        const bus = box(2, 1.2, 2, MAT.gold); bus.position.y = -1; g.add(bus); addWings(bus, d.panel, 1, 1);
      } else {
        const tube = cyl(2.1, 2.1, 13, MAT.silver, 40); tube.rotation.z = Math.PI / 2; g.add(tube);
        const door = cyl(2.15, 2.15, .15, MAT.white, 40); door.rotation.z = Math.PI / 2; door.position.x = 6.6; g.add(door);
        const body = new T.Group(); g.add(body); addWings(body, d.panel, 2, 2.3);
      }
      const dsh = dish(antR); dsh.position.set(-1.5, -1.6, 0); dsh.rotation.x = Math.PI; g.add(dsh);
    } else if (id === "mars") {
      const rover = new T.Group(); rover.add(box(2.9, .6, 2.2, MAT.white)); const deck = box(2.6, .1, 2, MAT.grey); deck.position.y = .35; rover.add(deck);
      for (const x of [-1.15, 0, 1.15]) for (const z of [-1.2, 1.2]) { const wh = cyl(.26, .26, .4, MAT.dark, 20); wh.rotation.x = Math.PI / 2; wh.position.set(x, -.62, z); rover.add(wh); }
      const mast = cyl(.07, .07, 1.6, MAT.white, 10); mast.position.set(1.1, 1.15, .7); rover.add(mast); const head = box(.5, .3, .35, MAT.white); head.position.set(1.15, 2, .7); rover.add(head);
      if (d.instr.includes("drill")) { const arm = box(1.6, .1, .1, MAT.grey); arm.position.set(2.1, .1, -.4); rover.add(arm); const tur = cyl(.2, .2, .4, MAT.silver, 12); tur.position.set(2.9, -.1, -.4); rover.add(tur); }
      if (d.power === "solar") { const area = Math.max(1, d.panel); const s = box(Math.sqrt(area * 1.4), .05, area / Math.sqrt(area * 1.4), MAT.cells); s.position.y = .46; rover.add(s); }
      else { const r = rtg(); r.rotation.z = Math.PI / 2.6; r.position.set(-1.8, .4, 0); rover.add(r); }
      const dd = dish(.3); dd.position.set(-.6, .6, -.6); rover.add(dd);
      g.add(rover); g.userData.rover = rover;
      const aero = new T.Group(); const shell = cyl(.4, 2.25, 1.8, MAT.white, 48); shell.position.y = .9; aero.add(shell); const hs = cyl(2.25, 2.25, .2, MAT.heat, 48); aero.add(hs); aero.visible = false; g.add(aero); g.userData.aero = aero;
    } else if (id === "dart") {
      const bus = box(1.25, 1.3, 1.3, foilM); g.add(bus);
      if (d.power === "solar") { const each = d.panel / 2, len = Math.max(2, each / 2.3); [-1, 1].forEach(s => { const w = box(len, .03, 2.3, MAT.cells); w.position.x = s * (len / 2 + .7); g.add(w); }); } else addRTG(bus, .7);
      if (d.instr.includes("navcam")) { const n = cyl(.18, .2, .8, MAT.white, 20); n.rotation.x = Math.PI / 2; n.position.z = .9; g.add(n); }
      const flat = box(.9, .9, .05, MAT.white); flat.position.set(0, .7, 0); flat.rotation.x = Math.PI / 2; g.add(flat);
      if (d.instr.includes("cubesat")) { const cs = box(.23, .34, .23, MAT.gold); cs.position.set(0, -.9, -1.5); g.add(cs); g.userData.cubesat = cs; }
      if (d.instr.includes("ballast")) { const b = box(.9, .5, .9, MAT.grey); b.position.y = -.9; g.add(b); }
    } else if (id === "artemis" || id === "marscrew") {
      const capsule = new T.Group();
      const cm = cyl(1.0, 2.5, 3.3, new T.MeshStandardMaterial({ color: 0xd8dade, metalness: .4, roughness: .35, envMap: skybox() }), 48); capsule.add(cm);
      for (let k = 0; k < 4; k++) { const w = box(.28, .28, .05, MAT.lens); const a = k * Math.PI / 2 + .4; w.position.set(Math.sin(a) * 1.55, .4, Math.cos(a) * 1.55); w.lookAt(Math.sin(a) * 5, .4 + 2.2, Math.cos(a) * 5); capsule.add(w); }
      const hs = cyl(2.5, 2.5, .25, MAT.heat, 48); hs.position.y = -1.75; capsule.add(hs);
      if (id === "artemis") {
        const sm = cyl(2.05, 2.05, 4.8, MAT.white, 40); sm.position.y = -4.3; capsule.add(sm);
        const eng = cyl(.35, .9, 1.6, MAT.dark, 24); eng.position.y = -7.4; capsule.add(eng); capsule.userData.engine = eng;
        if (d.power === "solar") { const each = d.panel / 4, len = Math.sqrt(each * 3.5), wid = each / len; for (let k = 0; k < 4; k++) { const w = wing(len, wid); const a = Math.PI / 4 + k * Math.PI / 2; w.rotation.y = a; w.rotation.z = -.15; w.position.set(Math.cos(a) * 2.05, -4.6, -Math.sin(a) * 2.05); capsule.add(w); } }
        g.add(capsule);
      } else {
        capsule.rotation.z = -Math.PI / 2; capsule.position.x = 34; g.add(capsule);
        const truss = box(60, 1.2, 1.2, MAT.grey); truss.position.x = 2; g.add(truss);
        for (let k = 0; k < 2; k++) { const hab = cyl(4, 4, 11, MAT.white, 40); hab.rotation.z = Math.PI / 2; hab.position.x = 24 - k * 12; g.add(hab); }
        const tanks = Math.min(8, Math.max(1, Math.round((c ? c.prop : 2e5) / 60000)));
        for (let k = 0; k < tanks; k++) { const t = cyl(3.2, 3.2, 9, MAT.orange, 32); t.rotation.z = Math.PI / 2; t.position.set(0 - (k >> 1) * 10, (k % 2 ? 1 : -1) * 3.6, 0); g.add(t); }
        if (d.engine === "ntp") { for (let k = -1; k <= 1; k++) { const n = cyl(.8, 1.8, 4, MAT.dark, 24); n.rotation.z = Math.PI / 2; n.position.set(-30, 0, k * 3.5); g.add(n); } const shieldDisk = cyl(4, 4, .6, MAT.grey, 40); shieldDisk.rotation.z = Math.PI / 2; shieldDisk.position.x = -26; g.add(shieldDisk); const rad = box(14, .1, 9, MAT.white); rad.position.set(-18, 0, 7); g.add(rad); const rad2 = rad.clone(); rad2.position.z = -7; g.add(rad2); }
        else { for (let k = 0; k < 4; k++) { const n = cyl(.6, 1.5, 3.2, MAT.dark, 24); n.rotation.z = Math.PI / 2; n.position.set(-30, (k % 2 ? 1 : -1) * 1.8, (k >> 1 ? 1 : -1) * 1.8); g.add(n); } }
        if (d.power === "solar") { const each = d.panel / 2; const len = Math.sqrt(each * 3), wid = each / len; [-1, 1].forEach(s => { const w = box(wid, .06, len, MAT.cells); w.position.set(10, 0, s * (len / 2 + 4.5)); g.add(w); }); }
        else addRTG(g, 30);
      }
      const dsh = dish(antR); dsh.position.set(id === "artemis" ? 2.4 : 12, id === "artemis" ? -3.2 : 4.6, 0); dsh.rotation.z = -Math.PI / 2; g.add(dsh);
    } else {
      const s = Math.max(.7, Math.min(3.4, .45 + Math.cbrt(dry) / 5.5));
      const bus = box(s, s * 1.1, s, foilM); g.add(bus);
      if (d.shield === "heavy") { const v = box(s * .55, s * .45, s * .55, MAT.grey); v.position.y = s * .2; bus.add(v); v.position.z = s * .28; }
      addWings(bus, d.panel, 2, s / 2); addRTG(bus, s / 2);
      const dsh = dish(Math.min(antR, s * .9)); dsh.position.y = s * .55; g.add(dsh);
      d.instr.forEach((k, i) => { const p = instrumentPod(i % 3); const a = i * 1.7; p.position.set(Math.cos(a) * s * .28, -s * .55 - .15, Math.sin(a) * s * .28); g.add(p); });
    }
    g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    const b = new T.Box3().setFromObject(g); g.userData.radius = Math.max(1.2, b.getSize(new T.Vector3()).length() / 2);
    return g;
  }
  function buildRocket(lv) {
    MAT = MAT || mats();
    const g = new T.Group(); const spec = { rideshare: [1.85, 70, 0], small: [1.2, 18, 0], medium: [1.85, 70, 0], heavy: [1.85, 70, 2], superheavy: [4.2, 98, 1] }[lv] || [1.85, 70, 0];
    const [r, h, side] = spec; const coreMat = lv === "superheavy" ? MAT.orange : MAT.white;
    const core = cyl(r, r, h, coreMat, 40); core.position.y = h / 2; g.add(core);
    const band = cyl(r * 1.01, r * 1.01, h * .03, MAT.dark, 40); band.position.y = h * .72; g.add(band);
    const fair = new T.Mesh(new T.ConeGeometry(r * 1.05, r * 3.2, 40), MAT.white); fair.position.y = h + r * 1.6; g.add(fair);
    const addFlame = (x, z, rr) => { const f = flame(rr * 1.4, rr * 14); f.position.set(x, -.2, z); g.add(f); };
    const nz = cyl(r * .35, r * .55, r * .8, MAT.dark, 20); nz.position.y = -.2; g.add(nz); addFlame(0, 0, r);
    if (side === 2) [-1, 1].forEach(s => { const b = core.clone(); b.position.x = s * r * 2.05; g.add(b); const n = new T.Mesh(new T.ConeGeometry(r * 1.02, r * 2.2, 40), MAT.white); n.position.set(s * r * 2.05, h + r * 1.1, 0); g.add(n); addFlame(s * r * 2.05, 0, r); });
    if (side === 1) [-1, 1].forEach(s => { const b = cyl(1.85, 1.85, h * .55, MAT.white, 32); b.position.set(s * (r + 1.95), h * .3, 0); g.add(b); const n = new T.Mesh(new T.ConeGeometry(1.9, 4.5, 32), MAT.white); n.position.set(s * (r + 1.95), h * .55 + 2.2, 0); g.add(n); addFlame(s * (r + 1.95), 0, 1.85); });
    g.userData.radius = h * .6; g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  }
  /* ---------- trajectories ---------- */
  function orbitFn(center, radius, axis, startDir, period) {
    const n = axis.clone().normalize(); const u = startDir.clone().sub(n.clone().multiplyScalar(startDir.dot(n))).normalize(); const v = new T.Vector3().crossVectors(n, u);
    return t => { const a = t * Math.PI * 2 / period; return center.clone().add(u.clone().multiplyScalar(Math.cos(a) * radius)).add(v.clone().multiplyScalar(Math.sin(a) * radius)); };
  }
  function curveFn(pts) { const c = new T.CatmullRomCurve3(pts, false, "centripetal"); return u => c.getPointAt(Math.min(1, Math.max(0, u))); }
  function buildTrack(m, d) {
    const id = m.id, S = [];
    const add = (name, p1, world, fn, kind = "path", focus = "earth") => S.push({ name, p1, world, fn, kind, focus });
    const leoR = (km) => RE * (1 + km / 6371);
    const ascent = (rTarget) => {
      const A = LAUNCH_DIR.clone().multiplyScalar(RE * 1.0002), axis = V(0, 1, 0).applyAxisAngle(V(1, 0, 0), .5);
      const B = LAUNCH_DIR.clone().applyAxisAngle(axis, .35).multiplyScalar(rTarget), C = LAUNCH_DIR.clone().applyAxisAngle(axis, .12).multiplyScalar(RE + (rTarget - RE) * 1.25);
      const q = new T.QuadraticBezierCurve3(A, C, B); return { fn: u => q.getPoint(Math.pow(u, 1.6)), end: B, axis };
    };
    const alt = { leo400: 400, sso600: 600, sso800: 800, sso550: 550, polar: 800, leo600: 600 }[d.orbit] || 400;
    const asc = ascent(leoR(Math.min(alt, 600)));
    add("ascent", .12, "earth", asc.fn, "ascent");
    if (id === "delta" || id === "storm" || (id === "telescope" && d.orbit === "leo600")) {
      const r = leoR(alt); const sso = /sso|polar/.test(d.orbit);
      const axis = sso ? V(SUN_DIR.x, .12, SUN_DIR.z).normalize() : asc.axis;
      if (id === "storm" && d.orbit === "geo") {
        const rg = leoR(35786), pts = [asc.end]; for (let k = 1; k <= 6; k++) { const a = k * .9; pts.push(V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r + (rg - r) * Math.pow(k / 6, 1.5)).add(V(0, asc.end.y * (1 - k / 6), 0))); }
        add("transfer", .45, "earth", curveFn(pts)); add("orbit", 1, "earth", orbitFn(V(0, 0, 0), rg, V(0, 1, 0), pts[pts.length - 1], 90), "orbit", "earth");
        S.geoSync = true;
      } else add("orbit", 1, "earth", orbitFn(V(0, 0, 0), r, axis, asc.end, 26 + alt / 60), "orbit", "earth");
    } else if (id === "moon" || id === "artemis") {
      const md = MOON_POS.clone().normalize(), side = new T.Vector3().crossVectors(md, V(0, 1, 0)).normalize();
      const lo = RM * (1 + ({ polar50: 50, polar100: 100, eq100: 100 }[d.orbit] || 100) / 1737);
      if (id === "moon") {
        const pts = [asc.end, asc.end.clone().multiplyScalar(4).add(side.clone().multiplyScalar(-20)), MOON_POS.clone().multiplyScalar(.5).add(side.clone().multiplyScalar(-70)), MOON_POS.clone().add(side.clone().multiplyScalar(-12)), MOON_POS.clone().add(side.clone().multiplyScalar(-lo))];
        add("transfer", .78, "earth", curveFn(pts), "path", "moon");
        const ax = d.orbit === "eq100" ? V(0, 1, 0) : V(SUN_DIR.x, 0, SUN_DIR.z).normalize();
        add("orbit", 1, "earth", orbitFn(MOON_POS, lo, ax, side.clone().multiplyScalar(-1), 22), "orbit", "moon");
      } else {
        const far = MOON_POS.clone().add(md.clone().multiplyScalar(d.orbit === "free" ? 9 : 0));
        const pts = d.orbit === "free"
          ? [asc.end, asc.end.clone().multiplyScalar(4).add(side.clone().multiplyScalar(-20)), MOON_POS.clone().multiplyScalar(.5).add(side.clone().multiplyScalar(-60)), MOON_POS.clone().add(side.clone().multiplyScalar(-6)), far, MOON_POS.clone().add(side.clone().multiplyScalar(6)), MOON_POS.clone().multiplyScalar(.5).add(side.clone().multiplyScalar(55)), LAUNCH_DIR.clone().multiplyScalar(30), LAUNCH_DIR.clone().applyAxisAngle(V(0, 1, 0), .4).multiplyScalar(RE * 1.035)]
          : [asc.end, asc.end.clone().multiplyScalar(4).add(side.clone().multiplyScalar(-20)), MOON_POS.clone().multiplyScalar(.5).add(side.clone().multiplyScalar(-60)), MOON_POS.clone().add(side.clone().multiplyScalar(-3.2)), MOON_POS.clone().add(md.clone().multiplyScalar(3.2)), MOON_POS.clone().add(side.clone().multiplyScalar(3.2)), MOON_POS.clone().multiplyScalar(.5).add(side.clone().multiplyScalar(55)), LAUNCH_DIR.clone().multiplyScalar(30), LAUNCH_DIR.clone().applyAxisAngle(V(0, 1, 0), .4).multiplyScalar(RE * 1.035)];
        const cf = curveFn(pts); add("outbound", .55, "earth", u => cf(u * .5), "path", "moon"); add("return", 1, "earth", u => cf(.5 + u * .5), "path", "earth");
      }
    } else if (id === "telescope") {
      const pts = [asc.end, asc.end.clone().multiplyScalar(5), L2_POS.clone().multiplyScalar(.4).add(V(0, 60, 0)), L2_POS.clone().add(V(0, 120, 0))];
      add("transfer", .8, "earth", curveFn(pts), "path", "earth"); add("orbit", 1, "earth", orbitFn(L2_POS, 120, SUN_DIR, V(0, 1, 0), 60), "orbit", "earth");
    } else if (id === "mars" || id === "marscrew" || id === "dart") {
      const out = LAUNCH_DIR.clone().applyAxisAngle(V(0, 1, 0), .8);
      add("depart", .3, "earth", curveFn([asc.end, asc.end.clone().multiplyScalar(2.5), out.clone().multiplyScalar(200), out.clone().multiplyScalar(900)]), "path", "earth");
      add("cruise", .7, "deep", u => V(0, 0, 0), "cruise", "sun");
      if (id === "dart") {
        const tgt = V(1190, 0, 0), from = V(1190, 0, 0).add(V(-1, .08, .25).normalize().multiplyScalar(12000));
        add("approach", 1, "asteroid", u => from.clone().lerp(tgt.clone().add(V(-1, .08, .25).normalize().multiplyScalar(82)), u), "path", "dimo");
      } else {
        const R = RMARS, start = V(-1, .1, .4).normalize().multiplyScalar(R * 14);
        if (id === "mars") {
          add("approach", .88, "mars", curveFn([start, V(-.4, .05, .9).normalize().multiplyScalar(R * 4), V(.3, .1, 1).normalize().multiplyScalar(R * 1.04)]), "path", "mars");
          add("landing", 1, "surface", u => V(0, 900 * Math.pow(1 - u, 1.3) + 1.25, -80 * (1 - u)), "landing", "ground");
        } else {
          add("approach", .8, "mars", curveFn([start, V(-.4, .05, .9).normalize().multiplyScalar(R * 4), V(.3, .1, 1).normalize().multiplyScalar(R * 1.15)]), "path", "mars");
          add("orbit", .93, "mars", orbitFn(V(0, 0, 0), R * 1.15, V(SUN_DIR.x, 0, SUN_DIR.z).normalize(), V(.3, .1, 1).normalize(), 40), "orbit", "mars");
          add("return", 1, "earth", curveFn([out.clone().multiplyScalar(500), out.clone().multiplyScalar(60), LAUNCH_DIR.clone().multiplyScalar(RE * 1.6), LAUNCH_DIR.clone().applyAxisAngle(V(0, 1, 0), .3).multiplyScalar(RE * 1.035)]), "path", "earth");
        }
      }
    }
    let p0 = 0; S.forEach(s => { s.p0 = p0; p0 = s.p1; });
    S.marks = Object.fromEntries(S.map(s => [s.name, s.p1]));
    return S;
  }
  /* ---------- view ---------- */
  function createView(canvas, opts = {}) {
    if (!webgl) return null;
    const renderer = new T.WebGLRenderer({ canvas, antialias: quality === "high", logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === "high" ? 2 : 1));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const wcam = new T.PerspectiveCamera(50, 1, 1e-4, 4e8), scam = new T.PerspectiveCamera(50, 1, .05, 1e5);
    const shipScene = new T.Scene(); const sl = lights(shipScene, .25); shipScene.add(new T.HemisphereLight(0xbfd2ff, 0x3a3028, .55)); const earthShine = new T.DirectionalLight(0x6f9cff, 0); shipScene.add(earthShine);
    const st = { m: null, d: null, c: null, p: 0, view: "ship", worlds: {}, track: null, ship: null, rocket: null, yaw: .9, pitch: .25, dist: null, flags: {}, t0: performance.now(), alive: true, preview: !!opts.preview, lastPos: null };
    // input: drag to orbit, wheel to zoom
    let drag = null;
    canvas.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (!drag) return; st.yaw -= (e.clientX - drag[0]) * .006; st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch + (e.clientY - drag[1]) * .006)); drag = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", () => drag = null);
    canvas.addEventListener("wheel", e => { e.preventDefault(); st.zoom = Math.max(.35, Math.min(6, (st.zoom || 1) * (e.deltaY > 0 ? 1.12 : .89))); }, { passive: false });
    function world(name) {
      if (!st.worlds[name]) st.worlds[name] = name === "earth" ? worldEarth() : name === "mars" ? worldMars() : name === "deep" ? worldDeep() : name === "asteroid" ? worldAsteroid() : worldSurface(st.m, st.d);
      return st.worlds[name];
    }
    function setMission(m, d, c) {
      st.m = m; st.d = d; st.c = c; st.track = buildTrack(m, d);
      if (st.ship) shipScene.remove(st.ship); st.ship = buildShip(m, d, c); shipScene.add(st.ship);
      if (st.rocket) shipScene.remove(st.rocket); st.rocket = st.preview ? null : buildRocket(d.lv); if (st.rocket) shipScene.add(st.rocket);
      if (st.worlds.surface) delete st.worlds.surface;
      st.flags = {}; st.p = 0;
    }
    function evalTrack(p, t) {
      const S = st.track; let s = S[S.length - 1]; for (const x of S) if (p <= x.p1) { s = x; break; }
      const u = s.p1 > s.p0 ? (p - s.p0) / (s.p1 - s.p0) : 1;
      const pos = s.kind === "orbit" ? s.fn(t) : s.fn(Math.max(0, Math.min(1, u)));
      return { s, u, pos };
    }
    function resize() { const w = canvas.clientWidth || 640, h = canvas.clientHeight || 360; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); wcam.aspect = scam.aspect = w / h; wcam.updateProjectionMatrix(); scam.updateProjectionMatrix(); }
    const tmp = new T.Vector3(), fwd = new T.Vector3(0, 0, 1);
    function frame() {
      if (!st.alive) return; if (!canvas.isConnected) { dispose(); return; }
      requestAnimationFrame(frame); if (!st.m) return; resize();
      const t = (performance.now() - st.t0) / 1000;
      if (st.preview) { // design preview: just the ship turning, with Earth below for scale feel
        st.yaw += .003; const r = st.ship.userData.radius * 2.6 * (st.zoom || 1);
        const off = V(Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch)).multiplyScalar(r);
        const w = world(st.m.id === "mars" ? "surface" : "earth");
        if (w.surface) { wcam.position.set(off.x, off.y + 2, off.z); wcam.lookAt(0, 1, 0); st.ship.position.set(0, 0, 0); renderer.autoClear = true; renderer.render(w.scene, wcam); scam.position.copy(off); scam.position.y += 1; scam.lookAt(0, 0, 0); }
        else { const base = V(0, 0, 0).add(LAUNCH_DIR.clone().multiplyScalar(RE * 1.35)); wcam.position.copy(base).add(off.clone().divideScalar(MPU_SPACE)); wcam.lookAt(base.clone().add(off.clone().multiplyScalar(-1))); renderer.autoClear = true; renderer.render(w.scene, wcam); scam.position.copy(off); scam.lookAt(0, 0, 0); }
        if (st.ship.userData.rover) { st.ship.userData.rover.visible = true; st.ship.userData.aero.visible = false; }
        sl.position.copy(SUN_DIR).multiplyScalar(100); renderer.autoClear = false; renderer.clearDepth(); renderer.render(shipScene, scam); return;
      }
      const ev = evalTrack(st.p, t); const w = world(ev.s.world);
      if (w.earth) { w.earth.rotation.y = st.track.geoSync && ev.s.name === "orbit" ? -1.2 + t * Math.PI * 2 / 90 : -1.2 + t * .004; w.earth.userData.clouds.rotation.y = t * .002; }
      if (w.dimo) { w.didy.rotation.y = t * .05; w.dimo.rotation.y = t * .1; }
      if (w.ejecta && st.flags.impact) { const e = w.ejecta; e.visible = true; e.userData.t += 1 / 60; const pa = e.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const v = e.userData.vel[i]; pa.setXYZ(i, v.x * e.userData.t, v.y * e.userData.t, v.z * e.userData.t); } pa.needsUpdate = true; e.material.opacity = Math.max(0, .9 - e.userData.t * .05); }
      // direction of motion
      const ahead = evalTrack(Math.min(1, st.p + .002), t + .05).pos; let dir = ahead.clone().sub(ev.pos); if (dir.lengthSq() < 1e-14) dir = st.lastDir || V(0, 0, 1); dir.normalize(); st.lastDir = dir;
      const isAscent = ev.s.kind === "ascent" && !st.flags.separated;
      const model = isAscent ? st.rocket : st.ship;
      if (st.rocket) st.rocket.visible = isAscent; st.ship.visible = !isAscent && !st.flags.gone;
      const ro = st.ship.userData.rover, ae = st.ship.userData.aero;
      if (ro) { const onSurf = ev.s.world === "surface"; ro.visible = onSurf || st.m.id !== "mars"; ae.visible = !onSurf && st.m.id === "mars"; if (onSurf && st.flags.crash) { ro.rotation.z = 1.2; } }
      const up = ev.pos.clone().normalize(); if (!isFinite(up.x) || ev.s.world === "surface" || ev.s.world === "deep" || ev.s.world === "asteroid") up.set(0, 1, 0);
      const q = new T.Quaternion();
      if (isAscent) q.setFromUnitVectors(V(0, 1, 0), st.flags.fall ? up.clone().negate().lerp(dir, .3).normalize() : dir);
      else if (ev.s.world === "surface") q.identity();
      else { const mtx = new T.Matrix4().lookAt(V(0, 0, 0), dir, up); q.setFromRotationMatrix(mtx); }
      if (st.flags.tumble) q.multiply(new T.Quaternion().setFromEuler(new T.Euler(t * 1.3, t * .7, 0)));
      model.quaternion.copy(q);
      model.traverse(o => { if (o.userData.flame) { o.visible = !st.flags.fall; o.scale.set(1 + Math.sin(t * 40) * .05, 1 + Math.sin(t * 31) * .12, 1 + Math.sin(t * 37) * .05); } });
      // camera
      const R = (model.userData.radius || 3) * 2.8 * (st.zoom || 1);
      const base = V(Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch));
      let camOff;
      if (isAscent) { const side = new T.Vector3().crossVectors(dir, up).normalize(); if (!isFinite(side.x) || side.lengthSq() < .5) side.set(1, 0, 0);
        camOff = side.multiplyScalar(Math.cos(st.yaw - .9)).add(new T.Vector3().crossVectors(side, dir).normalize().multiplyScalar(Math.sin(st.yaw - .9))).multiplyScalar(.75).add(dir.clone().multiplyScalar(-.55 + st.pitch * .3)).normalize().multiplyScalar(R * 1.25); }
      else camOff = ev.s.world === "surface" ? base.clone().multiplyScalar(R) : base.clone().applyQuaternion(q).multiplyScalar(R);
      let pos = ev.pos.clone(); if (st.flags.fall && isAscent) pos = ev.pos.clone().multiplyScalar(1 - Math.min(.0007, (t - (st.flags.fallT || t)) * .0002));
      const focusPt = w.focus[ev.s.focus] || V(0, 0, 0);
      st.info = { world: ev.s.world, seg: ev.s.name, alt: ev.s.world === "earth" ? (pos.length() - RE) * 637.1 : -1 };
      if (st.view === "map") {
        const span = { earth: ev.s.focus === "moon" || st.m.id === "artemis" ? 900 : st.m.id === "telescope" && st.d.orbit === "l2" ? 3400 : st.track.geoSync ? 220 : 45, mars: 40, deep: 4e5, asteroid: 5000, surface: 900 }[ev.s.world];
        const center = ev.s.world === "earth" && (ev.s.focus === "moon" || st.m.id === "artemis") ? MOON_POS.clone().multiplyScalar(.5) : ev.s.world === "earth" && st.m.id === "telescope" && st.d.orbit === "l2" ? L2_POS.clone().multiplyScalar(.5) : focusPt.clone();
        wcam.position.copy(center).add(V(Math.sin(st.yaw) * .9, .55 + st.pitch * .3, Math.cos(st.yaw) * .9).normalize().multiplyScalar(span * (st.zoom || 1))); wcam.lookAt(center);
        ensureMarker(w); w.marker.position.copy(pos); w.marker.scale.setScalar(span * .012 * (st.zoom || 1)); w.marker.visible = true; w.labels.forEach(l => { l.visible = true; if (l.isSprite) l.scale.set(span * .16 * (st.zoom || 1), span * .04 * (st.zoom || 1), 1); });
        renderer.autoClear = true; renderer.render(w.scene, wcam); return;
      }
      if (w.marker) { w.marker.visible = false; w.labels.forEach(l => l.visible = false); }
      if (st.view === "window") {
        let look = ev.s.world === "deep" ? SUN_POS.clone() : focusPt.clone();
        let bodyR = 0;
        if (ev.s.world === "earth") { const ae = RE / Math.max(1e-6, pos.length()), am = RM / Math.max(1e-6, pos.distanceTo(MOON_POS)); look = ae > am ? V(0, 0, 0) : MOON_POS.clone(); bodyR = ae > am ? RE : RM; }
        if (ev.s.world === "mars") bodyR = RMARS;
        if (bodyR) { const toB = look.clone().sub(pos); const dist = toB.length(); const ang = Math.asin(Math.min(1, bodyR / dist)); if (ang > .5) { toB.normalize(); const side = dir.clone().sub(toB.clone().multiplyScalar(dir.dot(toB))).normalize(); look = pos.clone().add(side.multiplyScalar(Math.cos(ang * .85)).add(toB.multiplyScalar(Math.sin(ang * .85))).multiplyScalar(dist)); } }
        wcam.position.copy(pos); if (ev.s.world === "surface") wcam.position.y += 3; wcam.up.copy(up); wcam.lookAt(ev.s.world === "surface" ? V(200, 30, -400) : look.distanceTo(pos) < 1e-6 ? pos.clone().add(dir) : look);
        wcam.fov = 62; wcam.updateProjectionMatrix(); renderer.autoClear = true; renderer.render(w.scene, wcam); wcam.fov = 50; wcam.updateProjectionMatrix(); wcam.up.set(0, 1, 0); return;
      }
      if (ev.s.world === "asteroid") {
        if (st.flags.gone) { wcam.position.copy(w.dimo.position).add(V(-1, .35, .55).normalize().multiplyScalar(650 * (st.zoom || 1))); wcam.lookAt(w.dimo.position); renderer.autoClear = true; renderer.render(w.scene, wcam); return; }
        const back = dir.clone().multiplyScalar(-R * 1.1).add(V(0, R * .35, 0)).add(camOff.clone().multiplyScalar(.25));
        camOff.copy(back); wcam.position.copy(pos).add(back); wcam.lookAt(pos.clone().add(dir.clone().multiplyScalar(300)));
        renderer.autoClear = true; renderer.render(w.scene, wcam);
        scam.position.copy(back); scam.lookAt(dir.clone().multiplyScalar(300)); model.position.set(0, 0, 0); sl.position.copy(SUN_DIR).multiplyScalar(100);
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(shipScene, scam); return;
      }
      wcam.position.copy(pos).add(camOff.clone().divideScalar(w.mpu)); wcam.up.copy(ev.s.world === "surface" ? V(0, 1, 0) : up); wcam.lookAt(pos);
      renderer.autoClear = true; renderer.render(w.scene, wcam); wcam.up.set(0, 1, 0);
      // ship pass, in metres around the model
      scam.position.copy(camOff); scam.up.copy(ev.s.world === "surface" ? V(0, 1, 0) : up); scam.lookAt(0, 0, 0); scam.up.set(0, 1, 0);
      if (ev.s.world === "surface") { model.position.copy(pos); scam.position.add(pos); scam.lookAt(pos); } else model.position.set(0, 0, 0);
      sl.position.copy(SUN_DIR).multiplyScalar(100);
      const ed = ev.s.world === "earth" ? pos.length() : 1e9; earthShine.intensity = ed < 80 ? .35 * (1 - ed / 80) : 0; earthShine.position.copy(pos).negate().normalize().multiplyScalar(100);
      if (ev.s.world === "surface") { renderer.autoClear = false; renderer.render(shipScene, scam); return; }
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(shipScene, scam);
    }
    function ensureMarker(w) { if (w.marker) return; w.marker = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0x5fd0e0 })); w.scene.add(w.marker);
      w.labels = [];
      const lab = (txt, p) => { const sp = labelSprite(txt); sp.position.copy(p); w.scene.add(sp); w.labels.push(sp); };
      if (w.earth) { lab("Earth", V(0, 0, 0)); lab("Moon", MOON_POS); if (st.m && st.m.id === "telescope") lab("L2", L2_POS); }
      if (w.mars) lab("Mars", V(0, 0, 0));
      if (w.didy) { lab("Didymos", V(0, 0, 0)); lab("Dimorphos", w.dimo.position); }
      if (st.track) { const pts = []; for (let i = 0; i <= 400; i++) { const p = i / 400; const e = evalTrack(p, 0); if (e.s.world === Object.keys(st.worlds).find(k => st.worlds[k] === w)) pts.push(e.pos); } if (pts.length > 1) { const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xf2a93b, transparent: true, opacity: .7 })); w.scene.add(line); w.labels.push(line); } } }
    function dispose() { st.alive = false; renderer.dispose(); }
    requestAnimationFrame(frame);
    return {
      setMission, setProgress(p) { st.p = Math.max(0, Math.min(1, p)); }, get progress() { return st.p; },
      setView(v) { st.view = v; st.zoom = 1; }, get view() { return st.view; },
      flag(k, v = true) { st.flags[k] = v; if (k === "fall") st.flags.fallT = (performance.now() - st.t0) / 1000; },
      marks: () => st.track ? st.track.marks : {}, info: () => st.info || {}, dispose
    };
  }
  return { ok: webgl, createView, setQuality(q) { quality = q; }, get quality() { return quality; } };
})();
