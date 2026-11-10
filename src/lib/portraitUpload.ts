import { MAX_UPLOAD_CHARS } from '../data/portraits'

const SIZE = 256

/** Crops an uploaded picture to a square, shrinks it, and returns it as a data URL small enough to keep with the character. */
export async function imageToPortrait(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const side = Math.min(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures.')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  for (const [type, quality] of [['image/webp', 0.85], ['image/jpeg', 0.75], ['image/jpeg', 0.5]] as const) {
    const url = canvas.toDataURL(type, quality)
    if (url.startsWith(`data:${type}`) && url.length <= MAX_UPLOAD_CHARS) return url
  }
  throw new Error('That picture is too detailed to keep. Try a simpler one.')
}
