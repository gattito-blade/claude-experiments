# Handoff: hand-made-looking art in plain canvas JavaScript

This report explains how the three projects in this repo were built, so another Claude Code session (or a person) can repeat the method and extend it. Everything here is plain HTML5 `<canvas>` 2D JavaScript. No images, no drawing libraries, no build step.

| # | Project | File(s) | Look | What it proves |
|---|---|---|---|---|
| 1 | Saturn plate | `sketches/lib/sketch.js`, `sketches/scenes/saturn.js` | Graphite pencil on graph paper, red pen trajectory | A reusable "hand-drawn" toolkit: wobbly strokes, tonal hatching, grain |
| 2 | Snowbank Shuffle | `cutout/snowbank.html` | Construction-paper cut-outs (South Park-like, original character "Denny") | Interactive character, paper diorama depth, day/night lighting |
| 3 | Felt Grenadier | `cutout/grenadier.html` | Wool felt pieces on a cutting mat | Rebuilding a reference image as a jointed puppet, IK, stop-motion |

---

## 1. The core idea

Hand-made art looks hand-made because of **imperfection with structure**. The drawing code always has two layers:

1. **Clean geometry**: circles, ellipses, polygons, splines, placed on purpose.
2. **Controlled imperfection** on top: noise-displaced lines, multiple passes, jittered cut edges, paper/felt texture, soft shadows, slightly off timing.

Randomness is always **seeded**, so the same seed gives the same picture every time (important for iterating: you change one thing and compare).

The second key idea is the **look-and-fix loop**: render to PNG with headless Chromium, look at the PNG, fix what's wrong, render again. Most quality comes from that loop, not from the first draft.

---

## 2. Environment and workflow

### Tools used
- **Node 22** and **Playwright 1.56.1** (pinned in `sketches/package.json` to match the installed Chromium; in Claude Code on the web, Chromium lives at `/opt/pw-browsers`, never run `playwright install`).
- **Read tool on PNGs**: Claude Code can look at images. This is how every render was checked.
- **Git**: every finished step was committed and pushed to the working branch.
- **Artifacts** (claude.ai only): the two cut-out pages were also published as private web pages. Outside claude.ai, just open the `.html` files in a browser.

### The render loop
`sketches/render.mjs` loads `index.html?scene=<name>&seed=<n>`, waits for `window.done === true`, reads the canvas with `toDataURL`, and writes `out/<scene>-<seed>.png`:

```bash
cd sketches && npm i && node render.mjs saturn 7   # ~1 s per render
```

For the interactive pages, a scratch script wrapped the page in `<!doctype html>...` (the artifact files have no skeleton of their own), used `page.setContent(html)`, then drove it with the keyboard and took canvas screenshots:

```js
await p.setContent(html); await p.waitForTimeout(1500);
await p.locator('canvas').screenshot({ path: 'day.png' });
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(900); await p.keyboard.up('ArrowRight');
await p.keyboard.press('f');                         // trigger an action mid-test
await p.locator('canvas').screenshot({ path: 'action.png' });
// also: collect page errors with p.on('pageerror', ...) and check scrollWidth at 400px wide
```

**Always screenshot the states that matter**: at rest, mid-action, night mode, phone width. Bugs found this way in this session:
- Lit windows drawn on top of Denny's face at night (draw-order bug).
- The moon's crescent "cover" disc didn't match the tinted sky colour.
- Hat snow covered the hat band instead of sitting on top.
- The grenadier's coat hid his trousers; the reference has split coat tails.

### Gotchas
- **`file://` + ES modules** are blocked by Chromium CORS. Use classic `<script>` tags that attach to `window` (as `sketch.js` does), or serve over HTTP.
- **Network policy**: in this cloud session, `x.com` and tweet mirrors were blocked, so the reference images were uploaded by the user instead. If a host is blocked, ask the user for the file.
- Keep generated PNGs out of git (`out/` is in `.gitignore`); commit one preview image if you want it visible on GitHub.

---

## 3. Toolkit: graphite drawing (`sketches/lib/sketch.js`)

`Sketch.create(canvas, seed)` returns a drawing context with these helpers.

### 3.1 Seeded randomness and noise
- `mulberry32(seed)` (line 6): tiny, fast, deterministic PRNG. Wrapped as `rand()` with `range`, `int`, `pick`, `chance`, `gauss`.
- `makeNoise(seed)` (line 32): 2D value noise with smoothstep interpolation, plus `noise.fbm(x, y, octaves)` for layered noise. Used for line wobble, paper mottling and hatch breakup.

### 3.2 Geometry samplers return dense point lists
`line`, `polyline`, `ellipse(cx, cy, rx, ry, rot, t0, t1)`, `circle`, `bezier`, `spline` (Catmull-Rom). Every shape becomes points ~3 px apart, so it can be wobbled afterwards.

### 3.3 Wobbly multi-pass strokes (`wobble` line 140, `stroke` line 155)
1. Walk the points, compute each point's normal, and push it sideways by `amp * noise(arcLength * freq + offset)`. Smooth noise gives a hand tremor, not jagged zigzags.
2. Draw the path 2 or 3 times ("passes"). Each pass gets a new noise offset, a lower alpha and a thinner width, so it looks like the pencil went over the line twice.
3. Trim a random 0–3 % off each end per pass, so the ends look ragged like real strokes.

Options: `color, width, alpha, passes, wobble, freq, trim`.

### 3.4 Tonal hatching (`hatch` line 186): the most useful technique
`hatch(bbox, tone, opts)` shades anything from a function `tone(x, y) -> 0..1` (0 = white, 1 = black, negative = skip):
- Draw parallel lines at an angle across the bbox, with spacing jittered ±25 %.
- Walk along each line in 2 px steps. Ink only the runs where `tone + small noise > threshold`.
- Several **layers** at rotated angles, each with a higher threshold, give cross-hatching automatically in the darker areas.

Shading a sphere is just a tone function (`saturn.js` line 83, `planetTone`): Lambert lighting `dot(normal, lightDir)` plus sinusoidal bands along the planet's latitude, plus darker poles. Clip to the circle, call `hatch`. The same function drew the moons' crescents, the ring shadow and the hatched patches.

### 3.5 Clip and erase for occlusion
- `clip(build, fn)`: draw only inside a path.
- `erase(build)`: `destination-out` on the ink layer, to hide lines behind something.

Saturn's rings pass correctly behind and in front of the planet: draw the back half of the rings, erase the planet disc, draw the planet, erase the front ring band, then draw the front half (`saturn.js` `rings` line 62).

### 3.6 Paper, grid, grain (`paper` 228, `grid` 246, `finish` 262)
- Ink is drawn on an **offscreen layer**, not on the paper.
- `paper()`: base colour + low-frequency fbm blotches + per-pixel fibre noise + a warm vignette.
- `grid()`: printed graph-paper lines, minor and major.
- `finish()`: multiply each ink pixel's alpha by random grain (graphite breaks up on paper tooth), then composite the ink onto the paper with `multiply`. This one step makes clean vector lines read as pencil.

### 3.7 Composition recipe for a technical plate (Saturn)
Paper → grid → faint construction circles and rays (low alpha, random centres near the middle) → graduated tick rings → subject with hatching → occlusion with erase → accent colour (red trajectory with chevrons and target reticles) → sheet furniture (double border, scale bar, compass star, title block, hatched patches) → grain. The cheap "furniture" is what makes it read as a technical drawing.

---

## 4. Paper cut-out character (`cutout/snowbank.html`)

### 4.1 Character design without copying
The user asked for "a character like one from South Park". The *style* was borrowed (flat shapes, thick ink outline, big touching oval eyes, beanie with a pom-pom, mitten hands, stubby body), but the character is original: new name (Denny), new colours, new lines of dialogue. Don't reproduce existing copyrighted characters or catchphrases.

### 4.2 Structure of an interactive canvas page
- **Fixed logical height** (`VIEW_H = 540`), width derived from the aspect ratio. Canvas pixels = CSS size × `devicePixelRatio` (capped at 2). One `ctx.setTransform(scale, …)` per frame, so all drawing code uses logical units.
- A **world wider than the screen** (3600 units) and a camera that eases toward the character: `camX += (target - camX) * dt * 4.5`.
- `update(dt, t)` then `draw()` inside `requestAnimationFrame`, with `dt` capped at 50 ms.
- **Input**: keyboard `Set` for held keys, `pointerdown` on on-screen buttons with `setPointerCapture` (for touch), and tap-to-walk by converting the pointer to world coordinates.
- `prefers-reduced-motion` stops the snowfall and star twinkle.
- `window.claude?.hot` snapshot/ready keeps position and time of day when the page is republished (artifact-specific; harmless elsewhere).

### 4.3 The diorama effect ("my twist")
Every background layer is **baked once** to an offscreen canvas (`bake()` line 212, `LAYERS` line 195):
1. Draw the layer's shapes with **hand-cut edges**: `cutPoly()` (line 172) subdivides each polygon edge every ~16 px and nudges the vertices by ±1 px with a seeded RNG, so no edge is perfectly straight. Reset the seed before each bake so the edges are identical on every re-bake.
2. Texture it: fill a fibre-noise pattern with `source-atop`, so only the paper gets texture.
3. Draw it onto the final layer canvas **with `shadowBlur` and an offset**. The whole layer casts one soft shadow onto the layer behind it.

At runtime each layer is drawn with parallax: `drawImage(layer, -camX * par, 0)` with `par` = 0.1, 0.22, 0.5, 1, 1.28. A foreground layer with `par > 1` (drifts, fence) passes in front of the character. Baking keeps it at 60 fps even with hundreds of shapes and shadows.

### 4.4 The character as a split-pin puppet (`drawKid` line 621, `arm` line 609)
- Origin at the feet. The whole puppet is drawn in local coordinates, then `ctx.scale(facing, 1)` mirrors it. Asymmetric details (mouth offset, pupils) flip for free.
- Each arm is a separate piece rotated about a shoulder pin, with a small brass pin drawn on top (radial gradient). Arms swing when walking, go up when jumping, and wave.
- **Stepped animation**: limb poses use `frame = floor(t * 12)`, i.e. 12 fps, while position stays smooth. That's what makes it feel like cut-out animation.
- **Paper flip turn**: when direction changes, the x scale squeezes to 10 %, swaps sides, and opens back up over 0.16 s.
- **Squash and stretch**: squash on landing, stretch while rising.
- **Idle life**: blink every 2–5 s, look around after 3 s idle, stamp feet, breath puffs every ~2.4 s, snow slowly piling on the hat (shaken off when jumping).
- **Speech bubble**: word-wrapped with `measureText`, sized for the whole line up front, with a typewriter reveal; the mouth flaps only while letters are still appearing.

### 4.5 World details
Footprints on each step frame (fade over 30 s), snowballs with gravity that splat into particles and leave a mark, chimney smoke (spawned only near the camera), icicles, wreaths, siding lines, two depths of snowflakes, and a vignette.

### 4.6 Day, dusk and night lighting
- Sky and tint colours are defined for day, dusk and night and interpolated (`mix3`).
- The scenery gets one `multiply` fill with the tint colour. This darkens everything consistently and cheaply.
- **Lights go on after the tint** (`drawLights` line 743): windows filled warm, plus radial glows drawn with `lighter` (additive), street-lamp glow and a flattened pool of light on the snow.
- **Order matters**: the character must be drawn *after* the lights (or windows glow through his face) but still be tinted. Fix: draw him to a small offscreen canvas and tint it with `tintCanvas()` (line 847): copy the image, `multiply` fill, then `destination-in` with the original to restore transparency. The foreground layer gets a cached tinted copy, rebuilt only when the tint changes (`drawForegroundTinted` line 872).
- The paper moon's "bite" disc must use the *tinted* sky colour at its height, or it shows as a lighter circle.

---

## 5. Felt puppet from a reference image (`cutout/grenadier.html`)

### 5.1 Tracing the reference into code
1. Work in the **reference image's own units** (1024 × 1536, feet at y = 1500). Read coordinates straight off the image: hat top y ≈ 158, eyes at (452, 452) and (572, 452) r ≈ 43, and so on.
2. Write every piece as a polygon or oval in those units. Left/right pairs use `mirror(pts)` (x → 1024 − x).
3. At draw time: `translate(x, FEET) → scale(K) → translate(-512, -1500)`, with `K = 0.46`.
4. Match the reference's **draw order** (what overlaps what): legs → coat back → torso → belts → buttons → pouches → arms → epaulettes → collar → hair → ears → head → eyes → hat → plume → visor → badge. Raised arms are drawn after the head so the hand passes in front of the face.

Result: 63 pieces, each a `Path2D` built once with `cut()` (line 115) and `oval()` (line 129), both using jittered scissor edges.

### 5.2 Felt, not paper
- **No ink outlines.** The reference has none; each piece is defined only by colour and its shadow.
- `piece(path, color)` (line 403): fill the colour with a soft drop shadow, then fill the same path with a **felt fibre pattern** (`feltTile` line 220: thousands of tiny random light and dark strokes at ~10 % alpha).
- A second, darker shade of the same colour for folds (hat side, coat-tail folds, boot tops, pouch flaps) adds depth cheaply.
- Fringe on the epaulettes: a row of small jittered strips along an edge.

### 5.3 Jointed limbs with two-link IK (`ik` line 281)
Arms are two pieces (upper arm, then forearm + cuff + hand) with a brass pin at the elbow. To place the hand exactly (salute at the hat brim, a waving hand up and to the side), solve two-link inverse kinematics:
- `d = |target − shoulder|`, clamped to `L1 + L2`.
- Elbow offset angle from the law of cosines: `acos((L1² + d² − L2²) / (2·L1·d))`.
- Try both elbow solutions and **keep the one with the elbow pointing outward**.
- Convert to `ctx.rotate` values: rotation = direction angle − π/2 (the arm is modelled hanging down +y).

`targetPose()` (line 298) returns target angles for each state (rest, marching, attention, salute, wave), and the drawn pose eases toward them each frame. Marching lifts the legs alternately and bobs the body; the plume is a **damped spring** that lags behind movement.

### 5.4 Stop-motion ("my twist")
- The canvas is only redrawn **12 times a second** (accumulate `dt` and draw when ≥ 1/12 s); the state still updates every frame.
- **Boil**: on each drawn frame, every piece is offset by a tiny deterministic amount, `hash(pieceIndex, frameNumber)`, ±1.2 units. Real stop-motion looks like this because pieces are re-placed between shots.
- There's a toggle for smooth mode. With `prefers-reduced-motion` it starts smooth.

### 5.5 Setting and small touches
A green cutting mat baked once (1 cm grid, bold every 5 cm, 45° guides, ruler numbers, felt offcuts with shadows), a contact shadow under the feet, pupils that follow the pointer, blink by squashing the eye vertically, and a museum-style tag that reports the real piece count and frame rate.

---

## 6. Page design rules that were followed

- A short `<title>` that is a *name* ("Snowbank Shuffle", "Felt Grenadier").
- Colours and fonts as CSS tokens on `:root`; a characterful display face (Bowlby One, Fraunces) plus a readable body face (Nunito) from Google Fonts, with fallbacks.
- Fit a phone: a 16 px gutter, wrapping control rows, canvas height from the width (`min(width × ratio, 70–78 % of viewport)`); tested at 400 px with no horizontal scroll.
- The first frame already shows something happening (a greeting bubble, a wave), not an empty stage.
- Every control has a keyboard key and a visible focus style.
- Styling tied to the subject: kraft paper and tape strips for the diorama, felt-clipped buttons and a museum tag for the felt puppet.

---

## 7. How to do this again in Claude Code (step by step)

1. **Get references in.** Ask the user to paste or upload images if a URL is blocked. Look at them with the Read tool and write down the style traits: medium (pencil / paper / felt), outlines or none, palette, what overlaps what, small signature details.
2. **Plan in 5 lines**: the medium, the layers, the pieces, the interactions, and one twist of your own. Say it to the user before writing code.
3. **Start from the toolkit that fits**:
   - Pencil or ink drawing → `sketches/lib/sketch.js` (`stroke`, `hatch`, `finish`).
   - Paper or felt cut-outs → copy `cutPoly`/`cut`, `oval`, `bake`, `piece` from the cut-out pages.
4. **Build static first, then motion.** Get one frame looking right against the reference, then add the animation.
5. **Render and look** after every meaningful change: rest pose, each action, each mode (night), and a phone width. Fix draw order, proportions and colours from what you see.
6. **Seed everything**, and reset the seed before each bake so shapes stay stable.
7. **Performance**: bake anything static to offscreen canvases (with its shadows); keep live shadows to a few dozen shapes; spawn particles only near the camera.
8. **Commit and push** each finished step with a clear message.

### Prompts that work
- "Recreate this image as a canvas puppet: trace pieces in the image's own pixel coordinates, no outlines, each piece a felt shape with a jittered cut edge and a soft drop shadow."
- "Add a render script with Playwright that screenshots the page at rest and mid-action, then look at the PNGs and fix what doesn't match the reference."
- "One more quality pass: list the ten details a craftsperson would add to this, add them, and give it one twist of your own."

---

## 8. Ideas for next steps
- Remaining plates from the original tweet: PCB (octilinear trace bundles, pin rows, via grids), cloud swarm (scalloped puffs along Bézier paths, painted back to front), jet blueprint (orthographic views on shared guide lines, radial fan blades).
- Pull Denny's and the grenadier's shared code (`cut`, `piece`, `bake`, `tintCanvas`, `ik`) into a small `cutout/lib.js`.
- A character creator (pick hat, coat and hair colours), more characters walking around on their own, or exporting a stop-motion GIF by capturing frames with Playwright.
