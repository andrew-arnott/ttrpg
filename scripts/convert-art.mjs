/**
 * Shrinks generated PNGs to the 256px WebP files the app ships.
 *
 *   node convert-art.mjs <source-dir-of-pngs> [destination-dir]
 *
 * File names must follow `<kind>-<id>.png` (kind: profession, portrait, species, bg, item, enemy), because
 * src/lib/art.ts finds images by that name. The destination defaults to ../src/assets/art.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const [source, destination = path.join(here, '..', 'src', 'assets', 'art')] = process.argv.slice(2)

if (!source) {
  console.error('Usage: node convert-art.mjs <source-dir-of-pngs> [destination-dir]')
  process.exit(1)
}

fs.mkdirSync(destination, { recursive: true })
const kinds = ['profession', 'portrait', 'species', 'bg', 'item', 'enemy']
let converted = 0

for (const file of fs.readdirSync(source)) {
  if (!file.endsWith('.png')) continue
  if (!kinds.some((k) => file.startsWith(`${k}-`))) {
    console.warn(`Skipping ${file}: name must start with one of ${kinds.join(', ')} followed by a dash`)
    continue
  }
  await sharp(path.join(source, file))
    .resize(256, 256)
    .webp({ quality: 82 })
    .toFile(path.join(destination, file.replace('.png', '.webp')))
  converted += 1
}

console.log(`Converted ${converted} image(s) into ${destination}`)
