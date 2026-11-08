---
name: generate-art
description: Create new portraits or icons for the ttrpg app in its 16-bit SNES Final Fantasy pixel-art style and register them. Use when adding a species, profession, background, item or enemy that needs art.
---

# Generate art

All art is AI-generated pixel art in one style so the UI stays consistent. Images are 256px WebP files in
`src/assets/art/`, named `<kind>-<id>.webp`.

| Kind | Id | Used for |
| --- | --- | --- |
| `profession` | profession id (`warrior`) | wizard, party avatars, battle |
| `species` | species id (`catfolk`) | wizard, sheet |
| `bg` | background id (`treasureHunter`) | wizard, sheet |
| `item` | art key (`potion`) | equipment, pack, bag simulator |
| `enemy` | enemy id (`warden`) | battle board, overlays, stat card |

Items whose id differs from the art key are mapped in `ITEM_ART_ID` in `src/data/items.ts` (for example
`healingPotion` maps to `potion`, `smokeBomb` to `smokebomb`).

## Steps

1. Generate with the image tool, square (`1:1`). Use this prompt shape and swap the subject:

   > 16-bit SNES Final Fantasy style pixel art portrait of <subject, with 2 or 3 identifying details and an
   > expression>, facing forward, bust shot, deep royal blue background with a subtle gradient, limited color palette,
   > crisp pixels, no text, no border

   For items use "pixel art icon of <item>, centered" instead of "portrait". Name the file `<kind>-<id>.png`.
2. Look at the result. Regenerate if it has text, a different background, or the wrong subject.
3. Convert: `cd scripts && npm install && node convert-art.mjs <dir-with-the-pngs>`. This writes WebP files to
   `src/assets/art/` and skips names that do not start with a known kind.
4. Nothing else to register. `src/lib/art.ts` picks files up with `import.meta.glob`, and `Portrait` returns nothing
   if a file is missing. Make sure you use the right `kind` and `id` in the component.
5. Check it in the browser (`verify-in-browser`) and commit the `.webp` files with the code that uses them.

Keep each file around 10 to 20 KB; larger means the source was not resized.
