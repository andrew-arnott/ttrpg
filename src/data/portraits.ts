/** How many portraits each profession offers. They are plain options, not tied to anything about the character. */
export const PORTRAIT_COUNT = 3

export const portraitOptions = (professionId: string): string[] =>
  Array.from({ length: PORTRAIT_COUNT }, (_, i) => `${professionId}-${i + 1}`)

/** Uploads are stored in the character, so they are kept small. */
export const MAX_UPLOAD_CHARS = 200_000
