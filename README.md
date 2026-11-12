# ttrpg character creator

A character creator and rules tutorial for a fantasy tabletop RPG of strategy, exploration, and adventure.
Static React site, deployed to GitHub Pages.

**https://andrew-arnott.github.io/ttrpg/**

## What it does

The site has six tabs, kept in the URL hash so each is linkable. It opens on the home page:

- **Home**: what the site is, with a card for each of the sections below.
- **Create**: a seven-step wizard (Profession, Species, Background, SPECIAL, Abilities, Equipment, Review) with a live
  summary. Each step validates on its own and blocks *Next* with the reason. You pick a portrait (three per profession,
  or upload one), spend 10 starting coins on weapons, shields and supplies, and can export the character as JSON.
  *Save* stores it in this browser's `localStorage`; *Characters* lists, loads and deletes saved ones.
- **Sheet**: a printable character sheet.
- **Token Bag**: draws tokens from a character's bag with an animated pouch, using the real draw rule, plus a "run 5,000
  tests" check against the exact odds.
- **Dungeon**: a guided tutorial dungeon, The Sunken Crypt. Pick up to four characters (yours, saved, or samples),
  then explore with the torch ticking down: plan an action for each character every Interval, pick or break a locked
  door, find traps and secrets, fight a patrol and a boss. It is a guided demonstration; the real game is more flexible.
- **Rules**: the full rules, searchable, with links from the tutorial that open the relevant section in a popup.

## The rules

[`docs/RULES.md`](docs/RULES.md) is the canonical rules text. The Rules tab renders that file, and the app follows it. Its
last section (Reference) is generated from `src/data`: run `npm run rules:sync` after changing items, weapons or
enemies. A test fails if the file is out of date or if an ability in the app is missing from it.

[`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) says where each rule lives in the code and lists the numbers that are
guesses.

**Ranger and Berserker are not defined yet.** They appear in the UI as unselectable. Filling them in means editing
`src/data/professions.ts` only; set `defined: true` and they become selectable.

Picking abilities draws from the combat and exploration lists together: the picks come from one combined pool.

## The token bag

The interesting output is the **computed token bag**, since species and profession both mutate it. The app shows its
composition and derives the draw statistics exactly rather than by simulation:

> A test draws without replacement until it hits a token that ends the draw. Over a random permutation of the bag, a
> terminator is drawn iff it is the *first* terminator, with probability `1/T`. A Chain token is drawn iff it precedes
> every terminator, with probability `1/(T+1)`. Summing `modifier × P` over the bag gives the expected contribution in
> closed form.

This makes the rules' own claims legible: an Elf's 12-token bag crits 11.1% of the time against a Dwarf's 18-token bag
at 6.7%. Profession resources (Resolve, Cunning, Faith, Mana) are tracked separately from the bag, because they begin in
play and do not affect draw odds until spent and returned.

Portraits and item icons in `src/assets/art/` are AI-generated pixel art in a 16-bit RPG style.

## Layout

```
src/
  data/        rules content: types, tokens, species, backgrounds, professions, items, weapons, enemies, dungeon, tutorial text
  lib/         game logic and state machines, unit-tested: character building, token draws, torch, dungeon, battle, storage
  components/  wizard steps, sheet, simulators, dungeon map, battle screens, rules browser, overlays
  assets/art/  generated portraits and icons
docs/          the rules, implementation notes, architecture, handoff
tools/         the generator and checks for docs/RULES.md
scripts/       art converter and browser checks (own package.json)
```

The game logic in `src/lib` is pure and takes its random source as a parameter, so it is testable in isolation. A few
small React hooks (`useView`, `useSavedCharacters`, `useDrawAnimation`) also live there.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run lint         # oxlint
npm run build
npm run rules:sync   # regenerate the Reference section of docs/RULES.md
```

Pushing to `main` builds, tests, and deploys via `.github/workflows/deploy.yml`.

Browser checks (Playwright against the built app) and the art converter live in `scripts/`, which has its own
`package.json`:

```bash
npm run build && npm run preview:e2e &        # serves the built app on :4817
cd scripts && npm install
npm run e2e:smoke && npm run e2e:battle && npm run e2e:tutorial
```

## For contributors and agents

Start with [`AGENTS.md`](AGENTS.md). Then:

- [`docs/RULES.md`](docs/RULES.md): the rules.
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md): where each rule lives in the code, and which numbers are guesses.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the code fits together.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): current status, open questions, backlog, and a prompt for starting a new agent.
- [`.cursor/skills`](.cursor/skills): task guides for browser verification, generating art, adding game content and
  pushing from a cloud agent.
