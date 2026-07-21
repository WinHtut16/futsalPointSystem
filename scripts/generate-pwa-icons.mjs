// One-off generator for the admin PWA icon set. Run manually:
//   node scripts/generate-pwa-icons.mjs
// Source: figures/logo_black.jpg (dark mark, light background).
// Regenerate whenever branding changes — see CLAUDE.md PWA section.
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const source = path.join(root, 'figures', 'logo_black.jpg')
const outDir = path.join(root, 'public', 'pwa')

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

async function regularIcon(size, outFile) {
  // Mark centered edge-to-edge on a white square.
  const buf = await sharp(source)
    .resize(size, size, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer()
  await sharp(buf).toFile(path.join(outDir, outFile))
}

async function maskableIcon(size, outFile) {
  // Shrink the mark so all content sits inside the ~80% central safe-zone
  // Android's circle/squircle masks respect, then pad out to a white square.
  const inner = Math.round(size * 0.6)
  const markBuf = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: markBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, outFile))
}

async function main() {
  await sharp({ create: { width: 1, height: 1, channels: 4, background: WHITE } })
    .png()
    .toBuffer() // sanity: sharp is functional before we touch the filesystem

  await Promise.all([
    regularIcon(192, 'icon-192.png'),
    regularIcon(512, 'icon-512.png'),
    maskableIcon(192, 'icon-maskable-192.png'),
    maskableIcon(512, 'icon-maskable-512.png'),
    regularIcon(180, 'apple-touch-icon-180.png'),
  ])

  console.log('PWA icons written to public/pwa/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
