---
name: add-game-content
description: Checklists for adding rules content to the ttrpg app: species, backgrounds, professions and abilities, items, enemies, dungeon rooms, locks and encounters. Use before changing anything under src/data or adding a game mechanic.
---

# Add game content

Read `docs/ARCHITECTURE.md`, `docs/RULES.md` (the canonical rules) and `docs/IMPLEMENTATION.md` first. Content is data;
mechanics are pure functions in `src/lib`. Update `docs/RULES.md` when a rule changes, run `npm run rules:sync` after
changing items, weapons, torches or enemies, and add anything you had to guess to `docs/IMPLEMENTATION.md`.

## Species, background, profession

1. Edit `src/data/species.ts`, `backgrounds.ts` or `professions.ts`. Species bag changes use `bagMods`
   (`add`, `remove`, `replace`).
2. A profession with `defined: true` becomes selectable. Add its `fixedStartingTokens`, `tokenChoices`, `abilities`,
   `explorationAbilities` and `abilityPicks`.
3. Add art (`generate-art`).
4. `src/lib/buildCharacter.test.ts` already checks that every defined profession has enough abilities and unique ids.

## An ability

- Ability text lives in the profession file, and the same ability needs a heading in `docs/RULES.md` whose next line is
  `**Type + Type — cost**` (just the type when the cost is `—`). A test fails if they disagree. Types: Fight, Defend,
  Engage, Fast, Triggered, Action, Interval. Costs are `N Resource` (parsed by `parseCost`) or the name of a consumable.
- **Interval ability** (explore): add an entry to `ABILITY_ACTIONS` in `src/lib/intervalActions/abilities.ts`
  (`targeted`, `unavailable`, `options` and `perform`). A resource cost in the ability's `cost` is checked and paid
  automatically. Add tests in `intervalActions.test.ts`.
- **Combat ability**: add a handler to `ABILITY_HANDLERS` in `src/lib/battle/abilities.ts` (`options` and `perform`),
  with the effect in `battle/effects.ts`. Anything not handled shows as "Not in the sample battle yet". A Triggered
  ability is offered through `engine.ask` (see `battle/reactions.ts`).
- If the sample characters should have it, change `SAMPLE_RECIPES` in `src/lib/roster.ts`.

## An item

`src/data/items.ts`: add to `ITEMS` (cost, description, optional `healing`). Add an art key to `ITEM_ART_ID` if the id
and file name differ. Equipment prices are guesses, so note changes in `docs/IMPLEMENTATION.md`, and run `npm run rules:sync`.

## An enemy

1. `src/data/enemies.ts`: Defense, HP, `noticeDifficulty` (the Perception Difficulty to spot it before it strikes), attacks (`attackValue`, `damage`, `area`) and triggers
   (`strike`, `empower`, `heal`, `condition`; a trigger only fires for a character engaged with the enemy unless it is `global`). Adding a new trigger kind means handling it in `applyTrigger` in `src/lib/battle/effects.ts`.
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
