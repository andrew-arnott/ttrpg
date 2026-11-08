---
name: add-game-content
description: Checklists for adding rules content to the ttrpg app: species, backgrounds, professions and abilities, items, enemies, dungeon rooms, locks and encounters. Use before changing anything under src/data or adding a game mechanic.
---

# Add game content

Read `docs/ARCHITECTURE.md` and `docs/RULES.md` first. Content is data; mechanics are pure functions in `src/lib`.
Always update `docs/RULES.md` when you add or change an assumption.

## Species, background, profession

1. Edit `src/data/species.ts`, `backgrounds.ts` or `professions.ts`. Species bag changes use `bagMods`
   (`add`, `remove`, `replace`).
2. A profession with `defined: true` becomes selectable. Add its `fixedStartingTokens`, `tokenChoices`, `abilities`,
   `explorationAbilities` and `abilityPicks`.
3. Add art (`generate-art`).
4. `src/lib/buildCharacter.test.ts` already checks that every defined profession has enough abilities and unique ids.

## An ability

- Ability text lives in the profession file. Types: Fight, Defend, Engage, Fast, Triggered, Action, Interval.
- **Interval ability** (explore): add a case in `performAbility` in `src/lib/intervalActions.ts`, and an entry in
  `TARGETED_ABILITIES` if it needs a target room. Add tests in `intervalActions.test.ts`.
- **Combat ability**: add it to `abilityOptions` (options and targets) and `performAction` (effect) in
  `src/lib/battle.ts`. Anything not handled shows as "Not in the sample battle yet". Triggered abilities are hidden
  until the engine can interrupt a resolution.
- If the sample characters should have it, change `SAMPLE_RECIPES` in `src/lib/roster.ts`.

## An item

`src/data/items.ts`: add to `ITEMS` (cost, description, optional `healing`). Add an art key to `ITEM_ART_ID` if the id
and file name differ. Equipment prices are assumptions, so note changes in `docs/RULES.md`.

## An enemy

1. `src/data/enemies.ts`: Defense, HP, attacks (`attackValue`, `damage`, `area`) and triggers
   (`strike`, `empower`, `heal`). Adding a new trigger kind means handling it in `applyTrigger` in `battle.ts`.
2. Art: `enemy-<id>.webp`.
3. Reference it by id from `dungeon.patrol` or `dungeon.boss`.
4. Check balance by simulating many fights (see below).

## Dungeon content

`src/data/dungeon.ts`:

- **Room**: position and size on a 1000 by 640 map, `secret`, `interactions` (unique ids per room), optional `magic`
  and `complication`. Interaction completion flags are `interaction:<roomId>:<interactionId>`.
- **Link**: `{ from, to }`; add `hidden` for a secret passage or `lock` for a door or seal. Keep ordinary linked
  rooms aligned so corridors are straight (a test enforces it; hidden links are exempt).
- **Door lock**: options with an attribute, Difficulty, and success and failure text. Failed tries are allowed by design.
- **Seal lock**: `requires` a list of completion flags. A test checks they point at real interactions.
- **Complication effects**: `damage`, `torch`, `noise`, `drop`. A new kind needs a case in `applyComplication`.

## Tests

Add tests beside the logic using `testFixtures.ts`. Deterministic outcomes come from `ALWAYS_PASS`, `ALWAYS_FAIL`,
`bagOf('<tokenId>')` and `playRound`. When a result depends on a random draw, search for a seed that produces it
(see `withOutcome` in `battle.test.ts`) instead of asserting conditionally.

## Balancing by simulation

Write a throwaway Vitest file that runs a few hundred fights with `startBattle`, `currentPlayer`, `takeAction`,
`suggestedAction` and `runEnemyPhase` using `mulberry32(seed)`, and print the win rate and rounds. Delete it
afterwards. Aim for roughly 80 percent for the patrol and 65 percent for the boss with naive play from the sample
party; thoughtful play does better.
