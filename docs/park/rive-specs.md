# Rive animations for the park pages

Two `.riv` files, six slots. Every slot already shows a code-drawn fallback, so
you can ship them one at a time. You build them in the Rive editor; the site
does the rest.

| File | Artboard | Where it shows | Page writes |
|---|---|---|---|
| `sun-arc.riv` | `SunArc` | Landing hero, "Open now" card | `hour` (number), `open` (boolean) |
| `venue-icons.riv` | `Pool` | Landing, 8:00 swim | `hover` (boolean) |
| | `Food` | Landing, 12:30 lunch | `hover` |
| | `Futsal` | Landing, 16:00 futsal | `hover` |
| | `Games` | Landing, game shop card | `hover` |
| | `Billiards` | Landing, billiards card | `hover` |

## The contract (all files)

The site loads files with `@rive-app/react-canvas` 4.36 (runtime 2.44) and
**data binding**, not legacy state machine inputs. Each artboard needs:

1. **A state machine named exactly `Main`.**
2. **A view model** set as the artboard's default, with the properties in the
   table above, named exactly as written (case matters). The page binds the
   default instance (`autoBind: true`) and writes the values with
   `viewModelInstance.number('hour')` / `.boolean('hover')`.
3. **Transparent background** and the artboard size given below. The page draws
   it with `Fit.Contain`, centred.
4. **No text.** The site is English and Burmese; words stay in HTML.

Drive transitions from the view model directly: in the transition's condition,
pick the view model property (for example `hover` is true). If your editor
build doesn't offer view model conditions, add a state machine boolean with
the same name and data-bind it to the property.

### Shipping a file

1. Export to `PointSystem_AkoATP/public/rive/<file>.riv`.
2. In `lib/park/rive.ts`, set `ready: true` on each entry that uses the file.
3. `npm run dev`, open `/`, and check:
   - the canvas fades in over the fallback;
   - the console shows no Rive errors (a wrong artboard name logs one and the
     fallback stays);
   - with reduced motion turned on in the OS, the fallback shows and the file
     is never fetched.

Nothing is fetched while `ready` is false. The runtime and its WASM load only
when a ready slot scrolls near the screen. The WASM comes from our own origin
(`/rive/rive.wasm`, copied by `scripts/copy-rive-wasm.mjs`) because CDNs can be
blocked in Myanmar.

### Palette

| Name | Hex | Use |
|---|---|---|
| Jungle | `#0F4D3C` | Lines, horizon |
| Pool | `#2BB3C0` | Water |
| Sun | `#FFCB47` | Sun, highlights |
| Line | `#CFE3D8` | Dashed arc, faint strokes |
| Dusk | `#1C2C48` | Moon side, night |
| Futsal green | `#0B4327` | Futsal chip |
| Game blue | `#2F5FD0` / amber `#F2B84B` | Games chip |
| Oxblood | `#8A3324` / brass `#D9B26A` | Billiards chip |
| White | `#FFFFFF` | Icon strokes on dark chips |

Strokes are 2 px at 1x (4 px on the 2x artboards below), round caps and joins.

---

## 1. `sun-arc.riv`

**Artboard `SunArc`, 128 × 80.** That's 2x the 64 × 40 slot, so it stays sharp
on phones.

**View model `SunArcVM`:**
- `hour`: number, 0 to 24, fractional (14.5 is 2:30 PM, Myanmar time). Default 9.
- `open`: boolean. True while the futsal court is open. Default true.

**What it shows.** A dashed half circle sits on a horizon line. From 6:00 to
18:00 the sun travels left to right along the arc, with a soft glow that
breathes. At night a moon rests at the top of the arc and five small stars
twinkle. When `open` is false, the horizon line dims to a muted grey-blue. When
`hour` changes, the sun glides to the new spot over about half a second instead
of jumping.

**How to build it.** The motion is procedural, so one Node script draws the
whole thing:

1. Create a Script asset of type **Node** named `SunArc` and paste the code below.
2. Add it to the artboard at position (0, 0). The script draws in artboard
   pixels.
3. Select the node. In the right sidebar, right-click the `hour` input, choose
   **Data Bind**, and pick `SunArcVM/hour`. Do the same for `open`.
4. Add an empty state machine named `Main` so the artboard advances. The
   script does all the drawing.

```lua
-- SunArc: sun or moon on a horizon arc for a given hour.
-- Inputs are data-bound to the SunArcVM view model (hour, open).

type SunArc = {
  hour: Input<number>,
  open: Input<boolean>,
  shown: number, -- eased hour actually drawn
  clock: number, -- seconds, for glow and twinkle
  arc: Path,
  horizon: Path,
  glow: Path,
  body: Path,
  stars: Path,
  arcPaint: Paint,
  horizonPaint: Paint,
  glowPaint: Paint,
  sunPaint: Paint,
  moonPaint: Paint,
  starPaint: Paint,
}

local RISE, SET = 6, 18
local CX, CY, R = 64, 68, 52 -- arc centre (on the horizon) and radius
local KAPPA = 0.5523

local JUNGLE = Color.rgb(15, 77, 60)
local MUTED = Color.rgb(120, 140, 150)
local LINE = Color.rgb(207, 227, 216)
local SUN = Color.rgb(255, 203, 71)
local MOON = Color.rgb(242, 245, 255)

local STARS = { { 30, 30 }, { 48, 14 }, { 84, 18 }, { 100, 34 }, { 70, 40 } }

local function circle(path: Path, cx: number, cy: number, r: number)
  local k = r * KAPPA
  path:moveTo(Vector.xy(cx + r, cy))
  path:cubicTo(Vector.xy(cx + r, cy + k), Vector.xy(cx + k, cy + r), Vector.xy(cx, cy + r))
  path:cubicTo(Vector.xy(cx - k, cy + r), Vector.xy(cx - r, cy + k), Vector.xy(cx - r, cy))
  path:cubicTo(Vector.xy(cx - r, cy - k), Vector.xy(cx - k, cy - r), Vector.xy(cx, cy - r))
  path:cubicTo(Vector.xy(cx + k, cy - r), Vector.xy(cx + r, cy - k), Vector.xy(cx + r, cy))
  path:close()
end

local function pointOnArc(t: number): (number, number)
  local a = math.pi * (1 - t)
  return CX + R * math.cos(a), CY - R * math.sin(a)
end

local function isDay(hour: number): boolean
  return hour >= RISE and hour < SET
end

local function init(self: SunArc): boolean
  self.arcPaint = Paint.with({ style = 'stroke', thickness = 3, cap = 'round', color = LINE })
  self.horizonPaint = Paint.with({ style = 'stroke', thickness = 4, cap = 'round', color = JUNGLE })
  self.glowPaint = Paint.with({ style = 'fill', feather = 10, color = Color.opacity(SUN, 0.45) })
  self.sunPaint = Paint.with({ style = 'fill', color = SUN })
  self.moonPaint = Paint.with({ style = 'fill', color = MOON })
  self.starPaint = Paint.with({ style = 'fill', color = MOON })

  -- The dashed arc never changes: build it once.
  local dashes = 14
  for i = 0, dashes - 1 do
    local x1, y1 = pointOnArc(i / dashes)
    local x2, y2 = pointOnArc((i + 0.45) / dashes)
    self.arc:moveTo(Vector.xy(x1, y1))
    self.arc:lineTo(Vector.xy(x2, y2))
  end
  self.horizon:moveTo(Vector.xy(4, CY))
  self.horizon:lineTo(Vector.xy(124, CY))
  self.shown = self.hour
  return true
end

local function advance(self: SunArc, seconds: number): boolean
  self.clock += seconds
  -- Ease toward the bound hour (about half a second to settle).
  self.shown += (self.hour - self.shown) * math.min(1, seconds * 6)

  self.horizonPaint.color = if self.open then JUNGLE else MUTED

  self.glow:reset()
  self.body:reset()
  self.stars:reset()

  if isDay(self.shown) then
    local t = math.clamp((self.shown - RISE) / (SET - RISE), 0, 1)
    local x, y = pointOnArc(t)
    local breathe = 1 + 0.08 * math.sin(self.clock * 2.2)
    circle(self.glow, x, y, 20 * breathe)
    circle(self.body, x, y, 13)
  else
    circle(self.body, CX, CY - R, 11)
    for i, s in STARS do
      local twinkle = 0.5 + 0.5 * math.sin(self.clock * (1.3 + i * 0.37) + i)
      circle(self.stars, s[1], s[2], 1 + 1.2 * twinkle)
    end
  end
  return true
end

local function draw(self: SunArc, renderer: Renderer)
  renderer:drawPath(self.arc, self.arcPaint)
  if isDay(self.shown) then
    renderer:drawPath(self.glow, self.glowPaint)
    renderer:drawPath(self.body, self.sunPaint)
  else
    renderer:drawPath(self.stars, self.starPaint)
    renderer:drawPath(self.body, self.moonPaint)
  end
  renderer:drawPath(self.horizon, self.horizonPaint)
end

return function(): Node<SunArc>
  return {
    hour = 9,
    open = true,
    shown = 9,
    clock = 0,
    arc = Path.new(),
    horizon = Path.new(),
    glow = Path.new(),
    body = Path.new(),
    stars = Path.new(),
    arcPaint = late(),
    horizonPaint = late(),
    glowPaint = late(),
    sunPaint = late(),
    moonPaint = late(),
    starPaint = late(),
    init = init,
    advance = advance,
    draw = draw,
  }
end
```

What to check in the editor before exporting:
- **Scrub `hour`** from 0 to 24 in the view model panel. The sun should rise at
  6, peak at 12 and set at 18. The moon and stars should take over from 18 to 6.
- **Toggle `open`** and watch the horizon line dim.
- **Check the API.** The script follows Rive's Node script reference
  (`init`/`advance`/`draw`, `Path`, `Paint.with`, `Color.rgb`/`opacity`,
  `Renderer:drawPath`). Two things I couldn't confirm from the published docs:
  `Input<boolean>` (the docs only show a number input) and `late()` for non-input
  fields. If either fails, make `open` a number (0 or 1, compare `> 0.5`) and
  create the paints directly in the factory table instead of in `init`.

---

## 2. `venue-icons.riv`

**Five artboards, each 112 × 112** (2x the 56 px slot): `Pool`, `Food`,
`Futsal`, `Games`, `Billiards`. Each one is a filled circle chip, edge to edge,
with a white or ink pictogram inside. The fallback is the same chip with a
static icon, so the swap is seamless. Match the chip colours exactly.

**One view model, `IconVM`, shared by all five artboards:** `hover` (boolean,
default false). The page sets it while the pointer is over the section or card
(and on keyboard focus for cards).

**State machine `Main`, the same shape on every artboard:**
- `Idle` state: a looping, gentle animation that's always on.
- `Hover` state: a livelier loop.
- Idle → Hover when `hover` is true, with a 150 ms blend.
- Hover → Idle when `hover` is false, with a 250 ms blend. Exit at the end of
  the current loop pass if you can, so it never snaps mid-move.

Keep every idle quiet. Five icons can be on screen at once and nothing should
compete with the hero. Easing is cubic in-out unless a motion says otherwise.

| Artboard | Chip | Pictogram | Idle (loop) | Hover (loop) |
|---|---|---|---|---|
| `Pool` | `#2BB3C0` | Three white wave lines | Waves drift ±3 px sideways, out of phase, 2.4 s | Bigger waves (±6 px). A droplet arcs out of the middle wave and falls back in, 1.2 s |
| `Food` | `#FFCB47` | Ink bowl with chopsticks | Two steam curls rise 10 px and fade, staggered 0.6 s, 2 s loop | Chopsticks dip into the bowl and lift (300 ms down, 300 ms up), then the steam puffs bigger, 1.4 s |
| `Futsal` | `#0B4327` | White ball | Ball turns slowly, 360° in 6 s, linear | Ball bounces. Squash to 1.1 × 0.9 on impact, a small floor shadow scales with height, 0.55 s |
| `Games` | `#2F5FD0` | White gamepad, amber `#F2B84B` face buttons | Face buttons light one after another, 3 s | Pad tilts ±6°, the D-pad presses in time with it, 0.8 s |
| `Billiards` | `#8A3324` | White cue ball with brass `#D9B26A` cue tip | Cue tip slides back and forth 3 px, 2 s | Cue strikes and the ball rolls 14 px right, then both ease back, 0.9 s (strike ease-out, return in-out) |

### Optional: procedural waves for `Pool`

If timeline wave lines are fiddly, this Node script draws them and reacts to
`hover`. Add it to the `Pool` artboard over the chip and data-bind `hover` to
`IconVM/hover`. You still need the empty `Main` state machine.

```lua
-- PoolWaves: three sine waves that swell while hovered.

type PoolWaves = {
  hover: Input<boolean>,
  clock: number,
  energy: number, -- eased 0..1 hover amount
  waves: Path,
  paint: Paint,
}

local LEFT, RIGHT = 30, 82
local ROWS = { 42, 56, 70 }

local function advance(self: PoolWaves, seconds: number): boolean
  self.clock += seconds
  local target = if self.hover then 1 else 0
  self.energy += (target - self.energy) * math.min(1, seconds * 5)

  local amp = 3 + 3 * self.energy
  local speed = 2.6 + 2 * self.energy
  self.waves:reset()
  for row, y in ROWS do
    local phase = self.clock * speed + row * 1.1
    self.waves:moveTo(Vector.xy(LEFT, y + amp * math.sin(phase)))
    for x = LEFT + 4, RIGHT, 4 do
      local k = (x - LEFT) / 9
      self.waves:lineTo(Vector.xy(x, y + amp * math.sin(phase + k)))
    end
  end
  return true
end

local function draw(self: PoolWaves, renderer: Renderer)
  renderer:drawPath(self.waves, self.paint)
end

return function(): Node<PoolWaves>
  return {
    hover = false,
    clock = 0,
    energy = 0,
    waves = Path.new(),
    paint = Paint.with({ style = 'stroke', thickness = 5, cap = 'round', join = 'round', color = Color.rgb(255, 255, 255) }),
    init = function(self: PoolWaves): boolean
      return true
    end,
    advance = advance,
    draw = draw,
  }
end
```

---

## Later, if wanted

These are not wired yet. Each would need a new entry in `lib/park/rive.ts` and
a slot on the page.

- **Billiards break table.** Replace the SVG table on `/billiards` with a Rive
  version: a `break` trigger plus `racked` boolean, balls with physics-like
  easing. The current SVG version works well; do this only if the client wants
  more spectacle.
- **Hero leaf sway.** Palm fronds framing the hero photo with a slow 6 s idle
  sway. Needs real photos first, to judge the composition.

Sources used for the API: Rive docs on
[Node scripts](https://rive.app/docs/scripting/protocols/node-scripts),
[script inputs](https://rive.app/docs/scripting/script-inputs),
[Path](https://rive.app/docs/scripting/api-reference/path),
[Paint](https://rive.app/docs/scripting/api-reference/paint),
[Color](https://rive.app/docs/scripting/api-reference/color),
[Renderer](https://rive.app/docs/scripting/api-reference/renderer),
[React data binding](https://rive.app/docs/runtimes/react/data-binding) and
[self-hosting the WASM](https://rive.app/docs/runtimes/react/preloading-wasm).
