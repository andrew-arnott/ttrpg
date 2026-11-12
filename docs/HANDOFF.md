# Handoff

Everything a new agent needs to carry on. The paste-ready prompt is at the bottom; the sections above it are the
detail it points to.

## Where things stand

The app is feature-complete for a first full tutorial and is deployed from `main`.

| Area | State |
| --- | --- |
| Home | The site opens on a landing page with a card for each section (`HomeView.tsx`) |
| Character creator | Seven-step wizard (Profession, Species, Background, SPECIAL, Abilities, Equipment, Review) with portraits (three per profession or an upload), starting weapons and shields, live summary, JSON import and export |
| Saved characters | Saved to `localStorage`, listed, loaded, updated, deleted |
| Character sheet | Printable parchment-style sheet with the character portrait |
| Rules | A Rules tab renders `docs/RULES.md` with contents and search. The tutorial links to sections in popups |
| Token bag simulator | Animated draws using the real rule, plus a "run 5,000 tests" check against the exact odds |
| Dungeon (exploration) | Interval planner; torch burns and is a modifier on every test; Investigate finds secrets and traps; locked doors; Founders' Seal; room interactions and complications; hidden passage; optional Ossuary with a Bone Colossus; patrol clock |
| Combat | Step-by-step turns, engagement groups, Defense scores, surprise, Triggered abilities that pause to ask the player, conditions, hands and weapons, a boss fight. Warrior, Rogue, Priest and Wizard abilities are implemented |
| Tutorial framing | Intro on the setup screen, goal checklist, outro explaining the real game is more flexible |

Tests: run `npm test` (about 450). Lint clean. CI (`deploy.yml`) runs `npm test` and `npm run build` (which runs
`tsc -b`) but not `npm run lint`.

## How it was built (so you can read the history)

Roughly one feature per commit on `main`: step reorder, SNES theme, creator features (saved characters, sheet, equipment,
art, bag simulator, dungeon), Interval planning, sample battle, battle wizard and surprise, tutorial dungeon.
`git log --oneline` reads as a changelog.

## Environment

This work was done by a Cursor cloud agent. To run in the same environment:

- Linux, Node 22 (`v22.23.4`), npm 10, Git. Google Chrome 156 at `/usr/local/bin/google-chrome` for the browser checks.
- Network is restricted: GitHub and the npm registry work; Google Docs does not.
- A secret named `GH_TOKEN` is available as an environment variable and is what pushes to GitHub use. Never print it.
  See `.cursor/skills/push-to-github/SKILL.md`.
- The agent had an image generation tool (used for all the art) and Playwright via `scripts/`. If you have no image
  tool, ask the owner for art or leave placeholders; `Portrait` renders nothing for a missing file.
- The session's default workspace was an unrelated, empty repository. The real project was cloned from
  https://github.com/andrew-arnott/ttrpg into `/tmp/ttrpg`. Clone it fresh; do not assume your starting directory is it.

```bash
git clone https://github.com/andrew-arnott/ttrpg && cd ttrpg
npm ci
npm test && npm run lint && npm run build
npm run dev                      # or the e2e preview below
cd scripts && npm install && cd ..
npm run build && npm run preview:e2e &
(cd scripts && npm run e2e:smoke && npm run e2e:battle && npm run e2e:tutorial)
```

## Owner and working style

- Direct, collaborative, happy for agents to make reasonable calls, and wants assumptions flagged clearly. Say what you
  invented. `docs/IMPLEMENTATION.md` is where guesses live.
- The app is canonical. `docs/RULES.md` is the rules text, the site renders it, and the owner's rulings go straight into
  it. Section 15 is generated: run `npm run rules:sync` after changing `src/data`.
- Has allowed pushing straight to `main` for this toy project. Otherwise: draft PRs, and post the link on updates.
- Asks for a note on any refactoring opportunity spotted but not taken, so they can choose.
- Wants things verified in the real UI, with screenshots checked, not only unit tests.
- Abilities cost class resources (Resolve, Cunning, Faith, Mana) or a consumable; there are no "once per combat" limits.

## Open questions for the owner

1. Class design target: every class starts with a core passive (Rogue: Flanking), 4 combat abilities and 2 utility
   abilities. Character creation still picks 4 abilities from one pool, and only the Rogue has a passive.
2. Warrior passive: Combat Challenge, Stand Firm or Armored Instinct (all unbuilt).
3. Should healing items follow the guide (Health Potion 1 HP, Bandage treats Wounds only)? That makes the tutorial harder.
4. Engage Difficulty scaling is agreed as a starting point and still being workshopped.

## Backlog, roughly in order of value

1. **Class design**: separate combat and utility picks, add passives, widen the Rogue, Priest and Wizard pools (ideas for
   each are in the conversation history: shoves, stances, riders, Turn Undead, Ice Shackles, Counterspell).
2. **Surprise round**: a 1-action surprise round (unspotted enemies currently take their whole turn), and enemies hidden by more than a number.
3. **Inventory** with 6 slots, stack sizes, Armor, and the Body and Accessory slots. Weapon and shield art, more portraits, damage types, and swapping hands mid-delve.
4. **Smaller gaps**: Scry beyond a neighbouring room, species traits that are not bag changes, items in combat, art for the treatment items.
5. **More content**: a second dungeon, more enemies (use the `add-game-content` skill), Ranger and Berserker once defined.
6. **Smarter enemies**: engagement behaviour beyond random; let players choose the order enemies resolve in.
7. **Quality**:
   - Add `npm run lint` to the deploy workflow. The agent token has no `workflow` scope, so the owner has to edit `deploy.yml`.
   - Component tests, or at least run `scripts/e2e` in CI.
   - Keyboard operation of the map and a focus trap in the overlays.
   - A mobile layout pass on the dungeon and battle screens.
8. **Refactors worth considering** (none urgent):
   - `ResolutionStep` carries several optional display fields; they could be grouped by kind of step.
   - The "species · background · profession" summary line is built in several components.
   - `battle/effects.ts` is the biggest battle file; strikes and triggers could move to their own module.
   - Interval ability costs are parsed from the cost text (`parseCost`); a structured cost field would be safer.

## Known quirks

- The board behind a playback overlay still shows the old numbers until the overlay is finished or skipped.
- A planned battle action can turn into "No move" if an earlier action changed the situation; the text does not say why.
- The tutorial bot can lose (exit code 2). That is expected play, not a bug.
- The party is expected to arrive at the boss somewhat worn down; healing items cost an Interval each.

## Paste-ready prompt

Copy everything inside the block into the new agent's first message.

```text
You are continuing work on "ttrpg", a character creator and rules tutorial for a fantasy tabletop RPG. It is a
static React 19 + TypeScript + Vite site, deployed to GitHub Pages from main at
https://andrew-arnott.github.io/ttrpg/. Repo: https://github.com/andrew-arnott/ttrpg (public).

START HERE
1. Clone it fresh (your starting directory may be an unrelated empty repo): git clone
   https://github.com/andrew-arnott/ttrpg && cd ttrpg && npm ci
2. Read AGENTS.md, then docs/ARCHITECTURE.md, docs/RULES.md, docs/IMPLEMENTATION.md and docs/HANDOFF.md. Project skills are in
   .cursor/skills (verify-in-browser, generate-art, add-game-content, push-to-github); read the one you need.
3. Confirm the baseline: set -o pipefail; npx tsc -b && npm run lint && npm test && npm run build
   (all tests should pass).

ENVIRONMENT (same as the previous agent)
- Linux, Node 22, npm 10, Chrome at /usr/local/bin/google-chrome. Network is restricted: GitHub and npm work, Google
  Docs does not. The original Google Doc is not needed: docs/RULES.md is the rules, so ask the owner when it is silent.
- GH_TOKEN is in the environment for pushing. Never print it. Pushing is done with a token header; follow the
  push-to-github skill, and fetch origin/main with the token before branching (local main goes stale).
- Browser checks: cd scripts && npm install, then with the built app served by "npm run preview:e2e":
  npm run e2e:smoke, e2e:battle, e2e:tutorial (exit 2 on the tutorial bot means it lost a fight, not an app bug).
  Always look at the screenshots in /tmp/ttrpg-e2e for UI changes.
- Do not pipe lint or tests into tail without set -o pipefail; it hides failures. Do not name non-hook functions use*
  (lint rejects them). No synchronous setState in effects.

WHAT EXISTS
Seven-step creator wizard with saved characters (localStorage), printable sheet, animated token-bag simulator, and a
guided tutorial dungeon ("The Sunken Crypt"): Interval planning with torches as the clock, a locked door that can be
picked or broken (retries cost torch), a patrol that only starts after the first door opens, rooms with several
interactions and complication consequences, a Founders' Seal that opens only via actions in three other rooms, a boss
fight, and intro/outro text explaining that the real game is more flexible. Combat is step-by-step ("Brann's action 1:
what should they do?"), with engagement groups, Defense scores, animated enemy attacks, enemy stat cards on hover, and
a surprise check. The architecture is pure engines returning { state, steps }, played back by ResolutionOverlay.

HOW TO WORK
- Match the existing patterns. Rules logic is pure and tested in src/lib (use testFixtures.ts); content is data in
  src/data; the engines take rng as a parameter.
- The rules are docs/RULES.md and the app is canonical. If you must invent something, add it to the guesses table in
  docs/IMPLEMENTATION.md and flag it in your summary. After changing src/data, run npm run rules:sync.
- Verify in the real UI, not only with unit tests. Keep commits small and logical.
- Comments only for non-obvious intent. No emoji in player-facing text. No personal data in fixtures.
- Git: the owner allows pushing straight to main for this toy project (each push deploys; keep main green). If told to
  use PRs, open draft PRs only and post the link on updates. Never comment on GitHub or post to Slack unless asked.
- In your final message summarise what shipped, list assumptions you made, and mention any refactor you noticed but
  did not do.

NEXT STEPS (pick with the owner; see the backlog in docs/HANDOFF.md)
1. Class design: core passives and a 4 combat plus 2 utility pick structure for every class.
2. Resolve the open questions listed in docs/HANDOFF.md.
3. Inventory, Armor and the remaining equipment slots.
4. Add npm run lint to the deploy workflow; consider component tests or running scripts/e2e in CI.

First, tell me you have read the docs and confirm the baseline passes, then propose which next step you will take.
```
