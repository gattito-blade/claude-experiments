// Saturn orbital plate: graphite on graph paper with a red trajectory.
(function () {
  'use strict';
  const { create, ellipse, circle, line, spline, polyline } = window.Sketch;
  const TAU = Math.PI * 2;

  function draw(canvas, seed = 7) {
    const S = create(canvas, seed);
    const { W, H, rand, stroke, hatch, clip, erase } = S;
    const GRAPHITE = '#2a2c31', RED = '#c7372d', FAINT = '#3a3d44';

    S.paper('#edf1ec', { mottle: 5, vignette: 0.05 });
    S.grid(11, '#5f9d95', 0.16, 5, 0.3);

    const C = [800, 560];            // construction centre
    const P = [712, 552], PR = 138;  // planet
    const TILT = -0.2;

    // ---- construction geometry ----
    for (let i = 0; i < 16; i++) {
      const r = rand.range(330, 650);
      const cx = C[0] + rand.gauss(0, 18), cy = C[1] + rand.gauss(0, 14);
      const full = rand.chance(0.6);
      const t0 = full ? 0 : rand.range(0, TAU);
      const t1 = full ? TAU : t0 + rand.range(1.5, 4);
      stroke(ellipse(cx, cy, r, r * rand.range(0.9, 1.02), rand.range(-0.3, 0.3), t0, t1), {
        color: FAINT, width: rand.range(0.6, 1.3), alpha: rand.range(0.25, 0.65), passes: 2, wobble: 1.6,
      });
    }
    // Long construction rays through the centre.
    for (let i = 0; i < 7; i++) {
      const a = rand.range(-0.5, 0.5) + (i % 2 ? Math.PI / 2 : 0) * rand.range(0.2, 1);
      const L = rand.range(500, 800), ox = rand.gauss(0, 30), oy = rand.gauss(0, 30);
      stroke(line(C[0] + ox - Math.cos(a) * L, C[1] + oy - Math.sin(a) * L, C[0] + ox + Math.cos(a) * L, C[1] + oy + Math.sin(a) * L),
        { color: FAINT, width: 0.6, alpha: 0.3, passes: 1, wobble: 0.8 });
    }
    // Graduated scale rings.
    function tickRing(cx, cy, r, t0, t1, every, alpha) {
      stroke(circle(cx, cy, r, t0, t1), { color: FAINT, width: 0.8, alpha, passes: 1 });
      for (let t = t0; t <= t1; t += every) {
        const k = Math.round((t - t0) / every);
        const len = k % 10 === 0 ? 12 : k % 5 === 0 ? 8 : 4;
        const c = Math.cos(t), s = Math.sin(t);
        stroke(line(cx + c * r, cy + s * r, cx + c * (r - len), cy + s * (r - len), 1),
          { color: FAINT, width: 0.6, alpha, passes: 1, wobble: 0, trim: 0 });
      }
    }
    tickRing(C[0] - 20, C[1] + 10, 425, 0, TAU, TAU / 180, 0.45);
    tickRing(C[0] - 30, C[1], 385, 3.4, 6.1, TAU / 240, 0.3);

    // ---- rings: back half ----
    const RIN = 178, ROUT = 330, RY = 0.26;
    function ringAlpha(u) {
      if (u < 0.16) return 0.12;               // C ring
      if (u < 0.55) return 0.55 + 0.25 * Math.sin(u * 60) * 0.5;  // B ring
      if (u < 0.61) return 0;                  // Cassini division
      if (Math.abs(u - 0.84) < 0.012) return 0; // Encke gap
      if (u < 0.93) return 0.42;               // A ring
      if (Math.abs(u - 0.98) < 0.006) return 0.5; // F ring
      return 0;
    }
    function rings(t0, t1) {
      for (let rx = RIN; rx <= ROUT; rx += 1.6) {
        const u = (rx - RIN) / (ROUT - RIN);
        const a = ringAlpha(u);
        if (a <= 0) continue;
        stroke(ellipse(P[0], P[1], rx, rx * RY, TILT, t0, t1), {
          color: GRAPHITE, width: rand.range(0.5, 0.9), alpha: a * rand.range(0.6, 1), passes: 1, wobble: 0.5, freq: 0.01,
        });
      }
      // Firm outline edges.
      for (const rx of [RIN, RIN + 0.55 * (ROUT - RIN), RIN + 0.61 * (ROUT - RIN), RIN + 0.93 * (ROUT - RIN)])
        stroke(ellipse(P[0], P[1], rx, rx * RY, TILT, t0, t1), { color: GRAPHITE, width: 1, alpha: 0.7, passes: 2, wobble: 0.6 });
    }
    // Clear the ring region of construction lines first.
    erase((c) => c.ellipse(P[0], P[1], ROUT + 4, (ROUT + 4) * RY, TILT, 0, TAU));
    rings(Math.PI, TAU);

    // ---- planet ----
    erase((c) => c.arc(P[0], P[1], PR + 2, 0, TAU));
    const Lx = -0.55, Ly = -0.55, Lz = 0.63;
    const cT = Math.cos(-TILT), sT = Math.sin(-TILT);
    function planetTone(x, y) {
      const nx = (x - P[0]) / PR, ny = (y - P[1]) / PR;
      const rr = nx * nx + ny * ny;
      if (rr > 1) return -1;
      const nz = Math.sqrt(1 - rr);
      const lam = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const v = nx * sT + ny * cT; // latitude in ring frame
      const band = Math.pow(0.5 + 0.5 * Math.sin(v * 11 + S.noise(v * 3, 2) * 2.5), 3) * 0.5;
      const polar = Math.max(0, Math.abs(v) - 0.7) * 1.2;
      return Math.min(1, 0.12 + 0.6 * (1 - lam) + band + polar);
    }
    clip((c) => c.arc(P[0], P[1], PR, 0, TAU), () => {
      hatch([P[0] - PR, P[1] - PR, PR * 2, PR * 2], planetTone, {
        angle: TILT, layers: 4, spacing: 2.2, layerAngles: [0, 0.05, 0.9, -0.8], width: 0.8, alpha: 0.85, color: GRAPHITE,
      });
      // Shadow of the rings cast onto the globe.
      hatch([P[0] - PR, P[1] - PR, PR * 2, PR * 2], (x, y) => {
        const dx = x - P[0], dy = y - P[1];
        const lx = dx * Math.cos(-TILT) - dy * Math.sin(-TILT), ly = dx * Math.sin(-TILT) + dy * Math.cos(-TILT);
        const ringY = -(lx * 0.08) - 22;
        return Math.abs(ly - ringY) < 9 ? 0.9 : -1;
      }, { angle: TILT + 0.4, layers: 2, spacing: 2, width: 0.7, alpha: 0.6, color: GRAPHITE });
    });
    stroke(circle(P[0], P[1], PR), { color: GRAPHITE, width: 1.3, alpha: 0.85, passes: 3, wobble: 0.8 });

    // ---- rings: front half (occludes planet) ----
    erase((c) => {
      c.ellipse(P[0], P[1], ROUT + 2, (ROUT + 2) * RY, TILT, 0, Math.PI);
      c.ellipse(P[0], P[1], RIN - 2, (RIN - 2) * RY, TILT, Math.PI, 0, true);
      c.closePath();
    });
    rings(0, Math.PI);

    // ---- moons ----
    function moon(x, y, r) {
      erase((c) => c.arc(x, y, r + 3, 0, TAU));
      const toP = Math.atan2(P[1] - y, P[0] - x);
      const ox = Math.cos(toP) * r * 0.45, oy = Math.sin(toP) * r * 0.45;
      clip((c) => c.arc(x, y, r, 0, TAU), () => hatch([x - r, y - r, 2 * r, 2 * r], (px, py) => {
        const inLit = (px - x - ox) ** 2 + (py - y - oy) ** 2 < (r * 0.98) ** 2;
        return inLit ? 0.1 : 0.95;
      }, { angle: 0.6, layers: 3, spacing: 1.4, width: 0.8, alpha: 0.9, color: GRAPHITE }));
      stroke(circle(x, y, r), { color: GRAPHITE, width: 1.1, alpha: 0.7, passes: 2, wobble: 0.5 });
    }
    // Moons sit away from the planet on the left side, lit from the right.
    moon(168, 356, 22);
    moon(1046, 306, 26);
    moon(1253, 410, 33);
    moon(915, 906, 19);
    stroke(circle(1300, 385, 56), { color: FAINT, width: 0.7, alpha: 0.45, passes: 1 });
    stroke(circle(1300, 385, 44), { color: FAINT, width: 0.6, alpha: 0.35, passes: 1 });

    // ---- red trajectory ----
    const path = spline([[1255, 40], [1300, 200], [1318, 380], [1290, 560], [1180, 790], [960, 985], [700, 1025], [470, 930], [330, 760], [300, 610], [340, 440], [378, 310]], 3);
    stroke(path, { color: RED, width: 1.6, alpha: 0.9, passes: 2, wobble: 0.6, trim: 0 });
    // Direction chevrons along the path.
    for (const f of [0.2, 0.45, 0.72]) {
      const i = Math.floor(path.length * f);
      const [x, y] = path[i], [x2, y2] = path[i + 3];
      const a = Math.atan2(y2 - y, x2 - x);
      for (const s of [-1, 1]) stroke(line(x, y, x - Math.cos(a + s * 0.45) * 10, y - Math.sin(a + s * 0.45) * 10, 1), { color: RED, width: 1.3, alpha: 0.9, passes: 1, wobble: 0 });
    }
    // Target reticles.
    function reticle(x, y, rs) {
      for (const r of rs) stroke(circle(x, y, r), { color: RED, width: 1.2, alpha: 0.85, passes: 2, wobble: 0.5 });
      stroke(line(x - 12, y - 4, x + 12, y - 4), { color: RED, width: 1, alpha: 0.9, passes: 1 });
      stroke(line(x - 12, y + 2, x + 12, y + 2), { color: RED, width: 1, alpha: 0.9, passes: 1 });
    }
    reticle(305, 668, [62, 40, 14]);
    reticle(1319, 424, [24]);
    // Arrow heads.
    function arrow(x, y, a) {
      const pts = [[x, y], [x - Math.cos(a - 0.35) * 16, y - Math.sin(a - 0.35) * 16], [x - Math.cos(a + 0.35) * 16, y - Math.sin(a + 0.35) * 16], [x, y]];
      S.ink.fillStyle = RED; S.ink.globalAlpha = 0.85; S.ink.beginPath();
      S.ink.moveTo(...pts[0]); S.ink.lineTo(...pts[1]); S.ink.lineTo(...pts[2]); S.ink.fill(); S.ink.globalAlpha = 1;
    }
    arrow(1322, 395, -Math.PI / 2);
    arrow(312, 706, Math.PI / 2 + 0.15);

    // ---- sheet furniture ----
    const rect = (x, y, w, h, o) => stroke(polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]), o);
    rect(28, 28, W - 56, H - 56, { color: GRAPHITE, width: 1.2, alpha: 0.8, passes: 2, wobble: 1 });
    rect(38, 38, W - 76, H - 76, { color: GRAPHITE, width: 0.8, alpha: 0.6, passes: 1, wobble: 1 });
    // Scale bar.
    rect(78, 98, 145, 6, { color: GRAPHITE, width: 0.8, alpha: 0.7, passes: 1 });
    hatch([78, 98, 60, 6], () => 0.9, { angle: 0.9, layers: 1, spacing: 2, width: 0.7, alpha: 0.8 });
    stroke(circle(280, 100, 13), { color: FAINT, width: 0.7, alpha: 0.5, passes: 1 });
    // Compass star.
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8, L = k % 2 ? 12 : 30;
      stroke(line(1500, 102, 1500 + Math.cos(a) * L, 102 + Math.sin(a) * L, 1), { color: GRAPHITE, width: 1, alpha: 0.85, passes: 1, wobble: 0 });
    }
    // Hatched patches.
    function patch(quad, ang) {
      stroke(polyline([...quad, quad[0]]), { color: FAINT, width: 0.7, alpha: 0.5, passes: 1 });
      clip((c) => { c.moveTo(...quad[0]); quad.slice(1).forEach((p) => c.lineTo(...p)); c.closePath(); },
        () => hatch([Math.min(...quad.map((p) => p[0])), Math.min(...quad.map((p) => p[1])), 200, 200], () => 0.5, { angle: ang, layers: 2, spacing: 3.5, width: 0.6, alpha: 0.5 }));
    }
    patch([[1378, 612], [1522, 618], [1512, 768], [1370, 745]], -0.9);
    patch([[92, 918], [150, 896], [180, 995], [126, 1015]], 0.7);
    patch([[705, 130], [940, 140], [1040, 215], [975, 200]], 0.3);
    // Title block.
    rect(1128, 938, 428, 165, { color: GRAPHITE, width: 1, alpha: 0.7, passes: 2 });
    rect(1136, 946, 412, 149, { color: GRAPHITE, width: 0.7, alpha: 0.5, passes: 1 });
    stroke(line(1296, 946, 1296, 1095), { color: GRAPHITE, width: 0.8, alpha: 0.6, passes: 1 });
    rect(1318, 958, 212, 44, { color: GRAPHITE, width: 0.8, alpha: 0.6, passes: 1 });
    rect(1318, 1036, 100, 32, { color: GRAPHITE, width: 0.8, alpha: 0.6, passes: 1 });
    rect(1432, 1036, 98, 32, { color: GRAPHITE, width: 0.8, alpha: 0.6, passes: 1 });
    stroke(circle(1214, 1020, 44), { color: FAINT, width: 0.7, alpha: 0.5, passes: 1 });
    stroke(circle(1214, 1020, 30), { color: RED, width: 1, alpha: 0.8, passes: 1 });
    clip((c) => c.arc(1214, 1020, 8, 0, TAU), () => hatch([1204, 1010, 20, 20], () => 0.9, { spacing: 1.5, layers: 2, width: 0.7, alpha: 0.9 }));

    S.finish({ grain: 0.5 });
  }

  (window.Scenes = window.Scenes || {}).saturn = draw;
})();
