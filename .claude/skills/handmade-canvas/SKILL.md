---
name: handmade-canvas
description: Make drawings, characters and animated scenes that look hand-made (pencil on graph paper, construction-paper cut-outs, felt puppets) in plain canvas 2D JavaScript, including recreating a reference image as an interactive puppet. Use when asked for generative or procedural art, a cut-out or stop-motion character, or to "draw this in code".
---

# Hand-made canvas art

Read `HANDOFF.md` at the repo root first. It is the full method, with line references into the working examples:

- `sketches/lib/sketch.js` + `sketches/scenes/saturn.js`: graphite toolkit (wobbly multi-pass strokes, tonal hatching, grain).
- `cutout/snowbank.html`: paper diorama, split-pin character, day/night lighting.
- `cutout/grenadier.html`: reference image traced into felt pieces, two-link IK, 12 fps stop-motion with boil.

## Workflow
1. Look at the reference images and write down the medium, outlines (or none), palette, overlap order and signature details.
2. Tell the user a 5-line plan: medium, layers, pieces, interactions, one twist of your own.
3. Reuse the closest example's helpers (`stroke`/`hatch`/`finish`, or `cut`/`oval`/`bake`/`piece`). Seed all randomness.
4. Get one still frame right, then add motion.
5. Render with Playwright (`sketches/render.mjs`, or `page.setContent` + canvas screenshot for single-file pages), Read the PNGs, and fix draw order, proportions and colours. Check rest, each action, each mode, and 400 px width.
6. Bake static layers (with their shadows) to offscreen canvases; draw lights after the tint pass and the character after the lights.
7. Commit and push each finished step.

Don't copy existing copyrighted characters; borrow the style and make an original character.
