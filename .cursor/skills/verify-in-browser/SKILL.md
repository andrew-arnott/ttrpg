---
name: verify-in-browser
description: Run, read and extend the Playwright browser checks for the ttrpg app. Use after any UI or game-flow change, when asked to test or screenshot the app, or when adding a new end-to-end check.
---

# Verify in the browser

Unit tests cover the rules; they do not show whether a screen looks right. Use the scripts in `scripts/`.

## Run the checks

```bash
npm run build && npm run preview:e2e &      # serves the built app at http://localhost:4817/ttrpg/
cd scripts && npm install                   # first time only (playwright-core + sharp)
npm run e2e:smoke                           # creator wizard, save/load, sheet, bag simulator, dungeon setup
npm run e2e:battle                          # sample battle, enemy stat card, animated clash
npm run e2e:tutorial                        # a bot plays the whole tutorial dungeon
```

Exit codes: `0` passed. `1` failed (an assertion, a stall, or a console error). `2` from `e2e:tutorial` means the bot
lost a fight, which is possible and not an app bug.

Screenshots are written to `/tmp/ttrpg-e2e` (`OUT_DIR`). Open the PNGs and look at them; checking the assertions is not
enough for a visual change. Environment variables: `BASE_URL`, `OUT_DIR`, `CHROME_PATH` (default
`/usr/local/bin/google-chrome`).

Stop the preview server when done: `pkill -f "vite preview"`.

## Traps

- Serve with `--base /ttrpg/` (`npm run preview:e2e` does). Plain `vite preview` serves assets from `/` while the built
  HTML asks for `/ttrpg/...`, so the page loads blank.
- Do not use `google-chrome --headless --screenshot` from the CLI; it hangs or captures before React renders. Use
  Playwright (`scripts/e2e/lib.mjs` has `launch`).
- Overlays: `ResolutionOverlay` types its text and auto-advances. In scripts click **Skip to summary** then
  **Continue** (`skipOverlay`) instead of waiting.
- Use `{ exact: true }` with `getByLabel` when two controls share a prefix ("Action for X" versus a target select).
- Game dice are random. Make scripts robust to either outcome, or assert on structure (buttons, headings), not on a
  specific result.

## Useful selectors

| Thing | Selector |
| --- | --- |
| Wizard next button | `.wizard-nav .btn.primary` |
| Interval action select for a character | `getByLabel('Action for <name>')` |
| Resolve an Interval | button "Resolve Interval" |
| Battle prompt heading | `.card-head h2` containing "what should they do" |
| Do the chosen battle action | button "Do it" (or "Use it (free)") |
| Overlay | `.resolution`, `.clash`, `.resolution-math`, `.resolution-list` |
| Goal checklist | `.checklist li.done` |
| Enemy on the board | `.combatant.enemy` (hover shows `.statcard`) |
| Torch level text | `.torch-level` |

## Adding a check

Copy `scripts/e2e/battle.mjs`, import `launch`, `enterDungeon`, `skipOverlay`, `screenshotter` and `report` from
`lib.mjs`, assert with `node:assert/strict`, and end with `report(errors)` so console errors fail the run. Add an npm
script to `scripts/package.json`.
