# Agent guide

A character creator and rules tutorial for a fantasy tabletop RPG. Static React + TypeScript + Vite site, deployed to
GitHub Pages at https://andrew-arnott.github.io/ttrpg/. The rules come from the Player's Guide (a Google Doc the
owner holds; agents usually cannot open it from a sandbox, so ask for text rather than guessing). Where a rule had to
be invented, it is listed in `docs/RULES.md`.

Read next: `docs/PLAYERS_GUIDE.md` (the rules text itself), `docs/ARCHITECTURE.md` (how the code fits together), `docs/RULES.md` (rules and assumptions),
`docs/HANDOFF.md` (current status and backlog).

## Commands

```bash
npm ci                 # install (Node 22, npm 10)
npm run dev            # http://localhost:5173
npm test               # vitest, run once
npm run lint           # oxlint
npm run build          # tsc -b && vite build
npm run preview:e2e    # serve the built app on :4817 at /ttrpg/ for the browser checks
```

Browser checks live in `scripts/` with their own dependencies (kept out of the app's lockfile):

```bash
cd scripts && npm install
npm run e2e:smoke      # wizard, save/load, sheet, bag simulator, dungeon setup
npm run e2e:torch      # torch burns down and the dim warning appears
npm run e2e:engage     # Change engagement popup and Difficulty preview
npm run e2e:resources  # commit Armor to a Defend
npm run e2e:inventory  # item hover boxes, three-torch limit, token bag viewer
npm run e2e:prayer     # Sister Maren is asked about Prayer during an Interval in the dungeon
npm run e2e:reaction   # plays rounds until a Triggered ability question appears and answers it
npm run e2e:battle     # sample battle, stat card, animated enemy clash
npm run e2e:tutorial   # bot plays the whole tutorial dungeon; exit 2 means the bot lost, not an app bug
```

They need the app built and served (`npm run build && npm run preview:e2e`) and Chrome at
`/usr/local/bin/google-chrome` (override with `CHROME_PATH`). Screenshots go to `/tmp/ttrpg-e2e` (`OUT_DIR`).

## Before you call something done

Run all of these and read the output. Do not pipe them into `tail`/`head` without `set -o pipefail`, because that
hides a failing exit code:

```bash
set -o pipefail
npx tsc -b && npm run lint && npm test && npm run build
```

For UI changes also run the relevant `scripts/e2e` check and look at the screenshots. Passing tests do not prove the
screen looks right.

## Conventions

- **Rules logic is pure and tested.** Everything under `src/lib` that decides game outcomes takes state in and returns
  new state (plus playback steps), with the random source passed in as `rng`. UI components call it and play back
  the result. Add tests next to the logic; use the helpers in `src/lib/testFixtures.ts` (`ALWAYS_PASS`,
  `ALWAYS_FAIL`, `bagOf`, `playRound`) so outcomes are certain instead of lucky.
- **Rules content is data.** Species, professions, items, enemies, rooms, locks and tutorial text are in `src/data`.
  Prefer changing data over adding conditionals.
- **Document invented rules.** If you have to make a rule up, add it to the assumptions table in `docs/RULES.md` and
  say so in your summary. Never present an invented rule as the guide's.
- **Comments** explain non-obvious intent or constraints only. Do not narrate what code does, mention tasks or
  plans, or label your own edits. Change rationale belongs in commit messages.
- **Player-facing text** has no emoji. The pixel fonts lack those glyphs; use CSS shapes or text.
- **No personal data** in fixtures; sample characters use invented names.
- **Motion** respects `prefers-reduced-motion` (see `Typewriter`, `useDrawAnimation`, the CSS media queries).
- **Art** is generated pixel art in `src/assets/art/<kind>-<id>.webp`; see the `generate-art` skill.

## Gotchas that have already cost time

- **Lint thinks `use*` is a hook.** A plain helper named like `useAbility` or `useHealingItem` fails
  `react-hooks/rules-of-hooks`. Name such functions `performAbility`, `healWithItem`.
- **Lint forbids synchronous `setState` in effects.** Drive animations from timers/callbacks, and use the
  "latest callback in a ref" pattern seen in `ResolutionOverlay` rather than stale closures.
- **`vite preview` needs `--base /ttrpg/`.** Production builds use that base, dev uses `/`. Use `npm run preview:e2e`.
- **Headless Chrome from the CLI is unreliable** (hangs, or screenshots before the app renders). Use the Playwright
  scripts instead.
- **The battle engine clones state with `structuredClone`.** Keep battle and dungeon state to plain data (no
  functions, classes or Maps).
- **A Critical Success always passes a skill test and a Critical Failure always fails**, even against a Difficulty
  that arithmetic says is impossible. A Critical Failure also counts as drawing a Complication.
- **Local `main` can be stale.** Fetch `origin/main` before branching or pushing, and check the command succeeded.
- **The Google Doc cannot be fetched from a sandbox.** `docs/PLAYERS_GUIDE.md` is a copy pasted by the owner; for anything it does not cover, ask.

## Git and deploys

- Pushing to `main` runs `.github/workflows/deploy.yml` (install, test, build, publish to GitHub Pages). Keep `main`
  green.
- The owner has said agents may push straight to `main` for this toy project. If they say otherwise, open a
  **draft** pull request instead, and post the link when you push updates to it.
- Make a new commit per logical change. Do not amend or force-push unless asked.
- Pushing from a cloud agent uses a token header; see the `push-to-github` skill.

## Owner preferences

- Draft PRs only. Never comment on GitHub issues or PRs, or post in Slack, unless asked.
- Keep PR descriptions short and about intent (the "why"). Do not list the checks you ran.
- Prefer small, focused changes; keep refactors separate from features. If you spot a shared abstraction you did not
  extract, mention it in your summary instead of doing it unasked.
- Order cheap checks before expensive ones; prefer the idiomatic library construct; decompose multi-behaviour
  functions, but do not wrap single calls in helpers.
- Tests and lint must pass before you say a change is done.

## Skills

Project skills live in `.cursor/skills/`:

- `verify-in-browser`: run and extend the Playwright checks, with the selectors and traps.
- `generate-art`: make new portraits and icons in the house style and register them.
- `add-game-content`: checklists for adding species, abilities, items, enemies and dungeon rooms.
- `push-to-github`: fetch, branch and push from a cloud agent using the token, without a stale `main`.
