// Hand-drawn rendering toolkit for <canvas>. Classic script: exposes window.Sketch.
(function () {
  'use strict';

  // ---------- seeded randomness ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRandom(seed) {
    const r = mulberry32(seed);
    const R = () => r();
    R.range = (a, b) => a + (b - a) * r();
    R.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    R.pick = (arr) => arr[Math.floor(r() * arr.length)];
    R.chance = (p) => r() < p;
    R.gauss = (m = 0, s = 1) => {
      const u = 1 - r(), v = r();
      return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return R;
  }

  // ---------- smooth value noise ----------
  function makeNoise(seed) {
    const r = mulberry32(seed ^ 0x9e3779b9);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r() * 2 - 1; }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const fade = (t) => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const v00 = vals[perm[X + perm[Y]]], v10 = vals[perm[X + 1 + perm[Y]]];
      const v01 = vals[perm[X + perm[Y + 1]]], v11 = vals[perm[X + 1 + perm[Y + 1]]];
      const u = fade(xf), v = fade(yf);
      return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
    }
    n2.fbm = (x, y, oct = 4) => {
      let s = 0, a = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); norm += a; a *= 0.5; f *= 2; }
      return s / norm;
    };
    return n2;
  }

  // ---------- geometry samplers (return dense point lists) ----------
  const STEP = 3;

  function line(x0, y0, x1, y1, step = STEP) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.ceil(d / step));
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
    return pts;
  }

  function polyline(points, step = STEP) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const seg = line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], step);
      if (i > 0) seg.shift();
      out.push(...seg);
    }
    return out;
  }

  // Ellipse arc; rot in radians, angles t0..t1 in the ellipse's own frame.
  function ellipse(cx, cy, rx, ry, rot = 0, t0 = 0, t1 = Math.PI * 2, step = STEP) {
    const approxLen = Math.abs(t1 - t0) * Math.sqrt((rx * rx + ry * ry) / 2);
    const n = Math.max(8, Math.ceil(approxLen / step));
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * (i / n);
      const x = rx * Math.cos(t), y = ry * Math.sin(t);
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return pts;
  }

  const circle = (cx, cy, r, t0, t1, step) => ellipse(cx, cy, r, r, 0, t0, t1, step);

  function bezier(p0, p1, p2, p3, step = STEP) {
    const est = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    const n = Math.max(4, Math.ceil(est / step));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      pts.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return pts;
  }

  // Catmull-Rom through control points -> dense points.
  function spline(ctrl, step = STEP) {
    const out = [];
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      const b1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const b2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      const seg = bezier(p1, b1, b2, p2, step);
      if (i > 1) seg.shift();
      out.push(...seg);
    }
    return out;
  }

  // ---------- the drawing context ----------
  // Ink is drawn to an offscreen layer; finish() applies paper grain and composites.
  function create(canvas, seed = 1) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const inkCanvas = document.createElement('canvas');
    inkCanvas.width = W; inkCanvas.height = H;
    const ink = inkCanvas.getContext('2d');
    ink.lineCap = 'round'; ink.lineJoin = 'round';

    const rand = makeRandom(seed);
    const noise = makeNoise(seed);
    let strokeId = 0;

    // Displace a point list along its normals with smooth noise -> wobble.
    function wobble(pts, amp, freq, offset) {
      const out = new Array(pts.length);
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const d = amp * noise(s * freq + offset, offset * 0.37);
        out[i] = [pts[i][0] + nx * d, pts[i][1] + ny * d];
      }
      return out;
    }

    // Pencil/pen stroke: several slightly different passes over the same path.
    function stroke(pts, o = {}) {
      if (!pts || pts.length < 2) return;
      const color = o.color || '#2b2d33';
      const width = o.width ?? 1.1;
      const alpha = o.alpha ?? 0.8;
      const passes = o.passes ?? 2;
      const amp = o.wobble ?? 1.2;
      const freq = o.freq ?? 0.02;
      // Optional ragged ends: trim a little off each end per pass.
      const trim = o.trim ?? 0.03;
      ink.strokeStyle = color;
      for (let p = 0; p < passes; p++) {
        strokeId++;
        let q = wobble(pts, amp * (p === 0 ? 1 : 0.7), freq, strokeId * 13.7 + rand() * 100);
        if (trim > 0 && q.length > 10) {
          const a = Math.floor(rand() * trim * q.length), b = Math.floor(rand() * trim * q.length);
          q = q.slice(a, q.length - b);
        }
        ink.globalAlpha = alpha * (p === 0 ? 1 : 0.55);
        ink.lineWidth = width * (p === 0 ? 1 : rand.range(0.5, 0.9));
        ink.beginPath();
        ink.moveTo(q[0][0], q[0][1]);
        for (let i = 1; i < q.length; i++) ink.lineTo(q[i][0], q[i][1]);
        ink.stroke();
      }
      ink.globalAlpha = 1;
    }

    // Tonal hatching: lines at `angle` spaced `spacing` apart over a bbox. A segment is
    // inked only where tone(x,y) (0 = white, 1 = black) exceeds the layer's threshold.
    // Multiple layers at rotated angles build cross-hatching for darker tones.
    function hatch(bbox, tone, o = {}) {
      const [bx, by, bw, bh] = bbox;
      const layers = o.layers ?? 3;
      const baseAngle = o.angle ?? -Math.PI / 4;
      const spacing = o.spacing ?? 5;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const R = Math.hypot(bw, bh) / 2 + 4;
      for (let L = 0; L < layers; L++) {
        const ang = baseAngle + (o.layerAngles ? o.layerAngles[L] : L * 0.7);
        const thr = (L + 0.5) / (layers + 0.5);
        const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
        const sp = spacing * (o.layerSpacing ? o.layerSpacing[L] : 1);
        for (let k = -R; k <= R; k += sp * rand.range(0.75, 1.25)) {
          let run = null;
          const flush = () => {
            if (run && run.length > 2) stroke(run, { width: o.width ?? 0.7, alpha: o.alpha ?? 0.55, passes: 1, wobble: o.wobble ?? 0.6, color: o.color, trim: 0.08 });
            run = null;
          };
          for (let t = -R; t <= R; t += 2) {
            const x = cx + dx * t + px * k, y = cy + dy * t + py * k;
            const inside = x >= bx && x <= bx + bw && y >= by && y <= by + bh;
            const tv = inside ? tone(x, y) : -1;
            const j = (noise(x * 0.05, y * 0.05 + L * 10) * 0.15);
            if (tv >= 0 && tv + j > thr) { (run || (run = [])).push([x, y]); }
            else flush();
          }
          flush();
        }
      }
    }

    // Clip ink drawing to a path built by `build(ctx)` while running `fn`.
    function clip(build, fn) {
      ink.save(); ink.beginPath(); build(ink); ink.clip(); fn(); ink.restore();
    }

    // Erase (cover) a region of the ink layer, for occlusion.
    function erase(build) {
      ink.save(); ink.globalCompositeOperation = 'destination-out';
      ink.beginPath(); build(ink); ink.fill(); ink.restore();
    }

    function paper(color = '#f1ede0', opts = {}) {
      ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      // Low-frequency blotches + fine fibre.
      const img = ctx.getImageData(0, 0, W, H), d = img.data;
      const amt = opts.mottle ?? 6;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const v = noise.fbm(x * 0.004, y * 0.004, 3) * amt + (rand() - 0.5) * (opts.fibre ?? 5);
        d[i] += v; d[i + 1] += v; d[i + 2] += v;
      }
      ctx.putImageData(img, 0, 0);
      // Vignette.
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(90,70,40,${opts.vignette ?? 0.08})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // Printed grid (drawn straight onto paper, not wobbled much).
    function grid(spacing, color, alpha, major = 0, majorAlpha = 0) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
      for (let x = 0.5; x < W; x += spacing) {
        const isMajor = major && Math.round(x / spacing) % major === 0;
        ctx.globalAlpha = isMajor ? majorAlpha : alpha;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0.5; y < H; y += spacing) {
        const isMajor = major && Math.round(y / spacing) % major === 0;
        ctx.globalAlpha = isMajor ? majorAlpha : alpha;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Apply graphite grain to the ink layer, then composite it onto the paper.
    function finish(opts = {}) {
      const img = ink.getImageData(0, 0, W, H), d = img.data;
      const grain = opts.grain ?? 0.55;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4 + 3;
        if (!d[i]) continue;
        const g = 1 - grain * (rand() * 0.75 + 0.25 * (noise(x * 0.35, y * 0.35) * 0.5 + 0.5));
        d[i] = d[i] * g;
      }
      ink.putImageData(img, 0, 0);
      ctx.save(); ctx.globalCompositeOperation = opts.blend || 'multiply';
      ctx.drawImage(inkCanvas, 0, 0); ctx.restore();
    }

    return { W, H, ctx, ink, rand, noise, stroke, hatch, clip, erase, paper, grid, finish, wobble };
  }

  window.Sketch = { create, makeRandom, makeNoise, line, polyline, ellipse, circle, bezier, spline };
})();
