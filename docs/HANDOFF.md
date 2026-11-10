# Handoff

Everything a new agent needs to carry on. The paste-ready prompt is at the bottom; the sections above it are the
detail it points to.

## Where things stand

The app is feature-complete for a first full tutorial. It is deployed from `main`.

| Area | State |
| --- | --- |
| Character creator | Seven-step wizard (Profession, Species, Background, SPECIAL, Abilities, Equipment, Review), live summary, JSON import and export |
| Saved characters | Saved to `localStorage`, listed, loaded, updated, deleted |
| Character sheet | Printable parchment-style sheet with a print stylesheet |
| Art | 39 generated pixel-art portraits and icons (professions, species, backgrounds, items, enemies) |
| Token bag simulator | Animated draws using the real rule, plus a "run 5,000 tests" check against the exact odds |
| Dungeon (exploration) | Interval planner: each character chooses an action, resolved in order with animation; torch burns; light reach by torch level; hidden passage; locked door; Founders' Seal; room secrets and interactions; room complication consequences; healing items |
| Combat | Triggered abilities (Cleave, Opportunist, Intercept, Prayer, Flanking, Shield Wall, Divine Intervention) ask the player mid-action, in battle and in the dungeon; Armor, Power and Expertise can be spent; engage Difficulty scales with the groups; conditions from enemy attacks are sealed on failed tests; Treat Conditions is an Interval action. Step-by-step turns ("Brann's action 1: what should they do?"), engagement groups, Defense scores, animated enemy attacks, enemy stat cards, surprise check, boss fight |
| Rules | A Rules tab shows the whole Player's Guide with contents and search, plus a page of where this app plays it differently. The tutorial links to sections in popups |
| Tutorial framing | Intro on the setup screen, goal checklist, Congratulations and "real game is more flexible" outro |

Tests: 311 passing (`npm test`). Lint clean. CI (`deploy.yml`) runs `npm test` and `npm run build` (which runs `tsc -b`)
but does not run `npm run lint`.

## How it was built (so you can read the history)

Roughly one feature per commit on `main`: step reorder, SNES theme, creator features (saved characters, sheet, equipment,
art, bag simulator, dungeon), Interval planning, sample battle, battle wizard and surprise, tutorial dungeon.
`git log --oneline` reads as a changelog.

## Environment

This work was done by a Cursor cloud agent. To run in the same environment:

- Linux, Node 22 (`v22.23.4`), npm 10, Git. Google Chrome 156 at `/usr/local/bin/google-chrome` for the browser checks.
- Network is restricted: GitHub and the npm registry work; Google Docs does not. The Player's Guide cannot be opened from
  the sandbox.
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
  invented. `docs/RULES.md` is where assumptions live.
- Has allowed pushing straight to `main` for this toy project. Otherwise: draft PRs, and post the link on updates.
- Asked for a note on any refactoring opportunity spotted but not taken, so they can choose.
- Wants things verified in the real UI, with screenshots checked, not only unit tests.
- Rules come from the Player's Guide; for anything uncertain, ask for the text.

## Open questions for the owner

Answered on 8 Nov 2026 (now owner rulings in `docs/RULES.md`): bright light makes surprise harder; Keep watch gives +2;
lighting a torch is free; attacks use Strength until weapons exist; fallen characters wake with 1 HP.

Still open:

1. Engage and disengage: how should Difficulty scale with enemies engaged and allies engaged? (Needs workshopping.)
2. Skill-test rule: token total + attribute at least the Difficulty. Difficulties per room are guesses.
3. Should healing items follow the guide (Health Potion 1 HP, Bandage treats Wounds)? That makes the tutorial harder.

## Backlog, roughly in order of value

1. **Surprise** follow-ups: a 1-action surprise round (unspotted enemies currently take their whole turn), and enemies that are hidden by more than a number.
2. **Inventory** with 6 slots, stack sizes, and the Body and Accessory slots (hands and weapons are done). Weapon and shield art, more portraits (three per profession today), damage types, and a way to swap hands mid-delve.
3. **Healing items**: decide whether to follow the guide (Health Potion 1 HP, Bandage treats Wounds only).
4. **Smaller gaps**: Scry beyond a neighbouring room, species traits that are not bag
   changes (Catfolk Foresight, Jann Exchange, Verdant Accumulated Knowledge), art for the new treatment items.
5. **More content**: a second dungeon, more enemies (use the `add-game-content` skill), Ranger and Berserker once the
   guide defines them.
6. **Smarter enemies**: engagement behaviour beyond random; let players choose the order enemies resolve in.
7. **Quality**:
   - Add `npm run lint` to the deploy workflow. The agent token has no `workflow` scope, so the owner has to edit `deploy.yml`.
   - Component tests, or at least run `scripts/e2e` in CI.
   - Keyboard operation of the map and a focus trap in the overlays.
   - A mobile layout pass on the dungeon and battle screens.
8. **Refactors worth considering** (none urgent):
   - `ResolutionStep` carries several optional display fields; they could be grouped by kind of step.
   - The "species · background · profession" summary line is built in several components.
   - `battle/effects.ts` is still the biggest battle file; strikes and triggers could move to their own module.
   - `BattlePlayer` and `PartyMember` overlap a lot; a shared `Adventurer` base would remove the field-by-field copy in
     `startBattle` and `endBattle`.

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
2. Read AGENTS.md, then docs/ARCHITECTURE.md, docs/RULES.md and docs/HANDOFF.md. Project skills are in
   .cursor/skills (verify-in-browser, generate-art, add-game-content, push-to-github); read the one you need.
3. Confirm the baseline: set -o pipefail; npx tsc -b && npm run lint && npm test && npm run build
   (311 tests should pass).

ENVIRONMENT (same as the previous agent)
- Linux, Node 22, npm 10, Chrome at /usr/local/bin/google-chrome. Network is restricted: GitHub and npm work, Google
  Docs does not. The Player's Guide (the rules source of truth) is a Google Doc you probably cannot open, so ask the
  owner for text instead of guessing.
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
- If you must invent a rule, add it to the assumptions table in docs/RULES.md and flag it in your summary. Never
  present it as the guide's.
- Verify in the real UI, not only with unit tests. Keep commits small and logical.
- Comments only for non-obvious intent. No emoji in player-facing text. No personal data in fixtures.
- Git: the owner allows pushing straight to main for this toy project (each push deploys; keep main green). If told to
  use PRs, open draft PRs only and post the link on updates. Never comment on GitHub or post to Slack unless asked.
- In your final message summarise what shipped, list assumptions you made, and mention any refactor you noticed but
  did not do.

NEXT STEPS (pick with the owner; see the backlog in docs/HANDOFF.md)
1. Ask the owner for the actual rules text and reconcile docs/RULES.md.
2. Resolve the open questions listed in docs/HANDOFF.md (engage scaling, healing items).
3. Implement Triggered abilities (needs an interrupt/react prompt in the battle engine), then the remaining combat
   abilities, Armor/Power spending and condition tokens.
4. Add npm run lint to the deploy workflow; consider component tests or running scripts/e2e in CI.

First, tell me you have read the docs and confirm the baseline passes, then propose which next step you will take.
```
