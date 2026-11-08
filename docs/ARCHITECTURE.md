# Architecture

## Shape of the app

One page, no router library. `src/App.tsx` owns the character being edited and switches between four sections using
the URL hash (`#/creator`, `#/sheet`, `#/bag`, `#/dungeon`, see `src/lib/useView.ts`). The dungeon section keeps its
own state.

```
src/
  data/        Transcribed rules and content. Plain objects, no behaviour.
  lib/         Pure game logic, state machines and hooks. Unit-tested.
  components/  React UI. Calls into lib and plays results back.
  assets/art/  Generated pixel art (WebP, 256px), looked up by name.
  index.css    The whole stylesheet (SNES Final Fantasy menu look).
scripts/       Dev tooling with its own package.json: art conversion and browser checks.
docs/          This file, RULES.md, HANDOFF.md.
```

## The pattern that repeats everywhere

Every game engine is a pure function over plain data that returns the **new state plus a list of playback steps**:

```
resolveInterval(state, plan, rng)  ->  { state, steps }      src/lib/intervalActions.ts
takeAction(battle, planned, rng)   ->  { battle, steps }     src/lib/battle.ts
runEnemyPhase(battle, rng)         ->  { battle, steps }
startBattle(...)                   ->  battle (steps in battle.opening)
```

The UI does not apply the new state straight away. It plays the `steps` in `ResolutionOverlay` (typed text, animated
token draws, enemy attack clashes) and commits the new state when the player finishes or skips. That is why the board
behind an overlay still shows the old numbers.

`ResolutionStep` (`src/lib/resolution.ts`) is the shared playback unit: an actor, a title, intro and outcome text, an
optional token `test`, an optional enemy `clash`, a tone, and a few display overrides.

Randomness is always passed in (`rng: () => number`). Tests use `mulberry32(seed)` or bags that can only draw one
kind of token (`testFixtures.ts`).

## Character creation

- `data/types.ts`: SPECIAL attributes, token and ability types.
- `data/{species,backgrounds,professions,tokens,items}.ts`: content.
- `lib/buildCharacter.ts`: `CharacterDraft` (what the wizard collects) to `BuiltCharacter` (derived bag, SPECIAL,
  inventory, validation issues per step). `STEP_IDS` is the wizard order; `App.tsx` mirrors it in `STEPS`.
- Persistence: `draftIO.ts` (parse and sanitise imports), `savedCharacters.ts` (localStorage store, pure over a storage
  interface), `useSavedCharacters.ts` (React hook), `roster.ts` (current + saved + sample characters for the
  simulators).
- UI: `Steps.tsx`, `Summary.tsx`, `Review.tsx`, `CharacterSheet.tsx` (printable), `SavedCharactersDialog.tsx`.

## Token draws

`lib/drawTest.ts`: `drawTest(bag, rng)` draws without replacement until a non-chain token. `lib/skillTest.ts` wraps it
as "token total + attribute against a Difficulty". `drewComplication()` treats a Critical Failure as a Complication.
`BagSimulator.tsx` and the overlays animate it through `useDrawAnimation` and `DrawStage`.

## Dungeon (exploration)

- `data/dungeon.ts`: rooms (secret, interactions, magic, complication trigger), links (hidden or locked), locks (door or
  seal), patrol, boss. Rooms are laid out so linked room centres line up and corridors stay straight (hidden links
  are exempt).
- `lib/dungeonState.ts`: `DungeonState`, `dungeonReducer` (move, light a torch, start battle, replace), passage helpers
  (`passagesOf`, `adjacentRoomIds`, `lockedExits`, `visibleRoomIds`), the patrol clock (`patrolStartedAt`,
  `patrolIsDue`), `unlockLock`, `breakReadySeals`, `springPatrol`/`springBoss`, `endBattle`.
- `lib/intervalActions.ts`: `availableActions` (per character, per state) and `resolveInterval`. Each Interval,
  characters act in party order, room complication triggers fire, the torch burns, and the patrol may arrive.
- `lib/torch.ts`: torch specs and levels. `lib/partyMember.ts` builds a dungeon party member from a draft.
- UI: `DungeonView.tsx` (setup screen, HUD, goal card, room card), `DungeonMap.tsx` (SVG map, light, doors, avatars),
  `IntervalPlanner.tsx`, `ResolutionOverlay.tsx`.

## Combat

`lib/battle/` is a state machine with a cursor. `index.ts` is the public surface; the rest is split by job:

- `types.ts`: `BattleState`, `BattlePlayer`, `BattleEnemy`, `CombatOption`, `PlannedCombat`, reaction types, constants.
- `state.ts`: lookups (living combatants, engagement groups), the `Engine` (state, rng, steps, defeats, `ask`) and `addStep`.
- `tokens.ts`: resource tokens. `commitResource` takes tokens out of play to pay a cost (Expertise and Critical Success
  can stand in), `releaseCommitment` returns the unsealed ones to the bag, `putDrawnResourcesInPlay` runs after tests.
  `lib/tokenFlow.ts` has the bag helpers shared with the dungeon (Rest).
- `effects.ts`: what happens: enemy strikes, triggers, tests, attacks, Defend, engagement changes, heals, Fireball.
- `engagement.ts`: the Difficulty of changing engagement.
- `abilities.ts`: a table of ability handlers (`options` builds the menu entries, `perform` does it). Add an ability by
  adding a handler; `actions.ts` builds the menu (`availableCombatActions`) and runs a choice (`performAction`).
- `reactions.ts` and `followUps.ts`: Triggered abilities (Prayer, Intercept, Cleave, Opportunist).
- `enemies.ts`: the enemy phase. `start.ts`: `startBattle` and the surprise check. `flow.ts`: turn order and the
  public engine calls.

Public calls:

- `availableCombatActions(battle, player)` lists what the current player can do, with targets, disabled reasons and the
  Armor or Power that can be added.
- `takeAction` resolves one choice (a Fast ability is free), `endTurn` skips the rest of a turn, `runEnemyPhase` plays
  all enemy attacks in random order, resets Defense and starts the next round.
- `startBattle` sets up engagement groups, applies preparations (Fortify, Ambush), runs the surprise check and, if the
  enemies win it, their surprise round. Those steps are stored in `battle.opening`. Nobody reacts during it.
- Enemies are data (`data/enemies.ts`): Defense, HP, attacks (attack value, damage, area) and triggers that fire on
  a Complication.

### Asking the player in the middle of an action

An engine call is synchronous, but a Triggered ability needs an answer from a person. `takeAction` and `runEnemyPhase`
run through `runFlow`, which gives the engine an `ask` function. When `ask` finds no answer yet it throws, the call
stops, and the battle comes back with `pending` set (the question, a snapshot from before the call, the dice rolled so
far on a `tape`, and the answers so far). Only the steps played before the question are returned. `respondToReaction`
runs the same flow again from the snapshot with one more answer, replaying the tape so the dice repeat, and returns
only the new steps. Keep everything in battle state plain data so the snapshot can be cloned.

UI: `BattleView.tsx` (orchestrates prompts, overlays and results), `ActionPrompt.tsx` (one question at a time, with the
Armor or Power picker and the Engage helper), `ReactionPrompt.tsx` (the Triggered ability question),
`RuleHelpDialog.tsx`, `BattleBoard.tsx` (engagement groups), `EnemyStatCard.tsx` (hover card),
`ResolutionOverlay.tsx`.

## Presentation

- `Portrait.tsx` and `lib/art.ts`: `import.meta.glob` over `src/assets/art/*.webp`; the name is `<kind>-<id>.webp`.
- `ResolutionOverlay.tsx`: a small stage machine (intro, drawing, clash, outcome) with `Typewriter` text. Timers call
  the latest callbacks through a ref.
- `index.css`: CSS variables at the top define the window gradient, frame and colours. Sections are labelled by
  comments.

## Tests

`npm test` runs Vitest over `src/**/*.test.ts` (environment: node, no DOM). There are no component tests; UI is
covered by the browser scripts in `scripts/e2e`. Shared fixtures live in `src/lib/testFixtures.ts`.
