// Copies the Rive runtime's WASM into public/rive/ so the park pages load it
// from our own origin instead of unpkg (some Myanmar networks block CDNs the
// way they block *.supabase.co). Runs before `dev` and `build`; the copied
// file is gitignored. The URL carries the @rive-app/canvas version for cache
// busting (see components/park/RiveSlot.tsx), so the runtime and its WASM
// always match.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = require.resolve('@rive-app/canvas/rive.wasm')
const outDir = join(root, 'public', 'rive')

mkdirSync(outDir, { recursive: true })
copyFileSync(src, join(outDir, 'rive.wasm'))
console.log(`rive.wasm copied (canvas ${require('@rive-app/canvas/package.json').version})`)
