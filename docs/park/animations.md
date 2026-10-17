# Park animations

The park's small animations are plain SVG moved by CSS keyframes. There is no
animation runtime, nothing extra to download, and nothing that a blocked CDN
can break.

| Animation | Component | Where it shows | Idle | While the pointer is over its block |
|---|---|---|---|---|
| Sun arc | `components/park/home/SunArc.tsx` | Hero, "Open now" card | Sun sits at the current Myanmar hour (6:00 left, 12:00 top, 18:00 right) with a breathing glow. Moon and twinkling stars from 18:00 to 6:00. Horizon dims when the futsal court is closed. | n/a |
| Pool | `components/park/VenueIcon.tsx` (`kind="pool"`) | 8:00 swim | Waves drift out of phase | Waves swell, a droplet hops |
| Food | `food` | 12:30 eat by the pool | Steam curls rise and fade in turn | Chopsticks dip, quicker steam |
| Futsal | `futsal` | 16:00 futsal | Ball turns slowly | Ball bounces and squashes, shadow shrinks |
| Games | `games` | ACJ Gaming card | Face buttons light one after another | Pad rocks, D-pad presses |
| Billiards | `billiards` | Billiards card | Cue lines up | Cue strikes, cue ball rolls into the 8 ball |
| Market | `market` | Market lane block | String lights glow in turn | Awning flaps, the pot puffs steam |

**Where the motion lives:** the `vi-*` (venue icon) and `sa-*` (sun arc)
classes at the end of `app/(park)/park.css`. Timings and distances are plain
numbers there, so tuning one is a one-line change.

**Reduced motion:** visitors with "reduce motion" turned on get the still
drawings, and the sun jumps to its spot instead of gliding.

**Artwork:** `docs/park/icon-art/` has the source drawings (one SVG per icon
plus the sun arc, with each moving part named). The components inline the
same shapes.

**History:** these were first built in Rive (17 Oct 2026). Rive's free plan
exports a black "RIVE" watermark splash at the start of every animation, so the
site switched to CSS. That dropped about 2 MB of runtime and WASM. The Rive
file `venue-icons` is still in the Rive account if it's ever wanted.
