# Implementation notes

`docs/RULES.md` is the canonical rules and the site renders it. This file answers two other questions: where in the code
each rule lives, and which numbers are guesses that the owner has not confirmed.

When you change a rule, change `docs/RULES.md`. When you invent something, add it to the guesses table below and say so in
your summary. Never present a guess as the owner's ruling.

## Guesses to confirm

These were filled in so the tutorial would run. They are not rulings.

| Area | Guess | Where to change |
| --- | --- | --- |
| Prices | Torch 1, Ration 1, Bandage 2, Antivenom 3, Laudanum 3, Holy Water 3, Stimulant 2, Liquid Courage 2, Smoke Bomb 3, Healing Potion 5; weapons and shields 1 to 3. Starting coins 10 | `src/data/items.ts`, `weapons.ts` |
| Healing items | Bandage heals 2 HP and Healing Potion 4, more than the guide's Health Potion (1 HP). Used as an Interval action on the most wounded party member, never in combat | `heal` in `intervalActions/basic.ts` |
| Test Difficulties | Investigate 4 to 6, room interactions 4 to 6, lockpicking 6, breaking the door 7, treating a condition 6, disarming 5 to 6 | `src/data/dungeon.ts`, `TREAT_DIFFICULTY` |
| Enemy numbers | HP, Defense, attack values, damage and notice Difficulties for every enemy (see the bestiary in RULES.md) | `src/data/enemies.ts` |
| Patrol timing | Arrives 4 Intervals after the first lock opens; a noise Complication brings it 1 sooner | `patrol.delayAfterUnlock` |
| Sample party | Brann (Provoke, Disable, Intercept), Wren (Flanking, Backstab, Slip Away), Sister Maren (Heal, Prayer), Ilvara (Magic Missile, Fireball), each with a kit that spends all 10 coins | `src/lib/roster.ts` |
| Sweeping Blow damage | 1 plus weapon and Might bonuses per enemy reached | `sweepingBlow` in `battle/effects.ts` |
| Last Stand cost | 1 Resolve. The owner worded it without a cost | `offerLastStand` in `battle/reactions.ts` |
| Warrior utilities | Barricade delays the patrol 3 Intervals per use; Steel Nerves and Hearty Meal are my designs; Shoulder Through is the break Difficulty minus 2 | `intervalActions/abilities.ts` |
| Patient Shadow | The name is mine; the text is the owner's. "Gain 1 Cunning" recovers one from the bag into play, like Flanking, so it does nothing with no Cunning left in the bag. Checked when the turn ends, whether the player used both actions or ended early | `endOfTurn` in `battle/passives.ts` |
| Steadying Presence | Allies means the Warrior's other party members in the same group. It does not apply to the Warrior, and two Warriors do not stack. Applied as -2 to the attack's value, like Intercept's +2 Defend | `steadyingPresenceBonus` in `battle/reactions.ts` |
| Sealed Resolve returning | Happens once, just before the player's first action or when they end their turn. A Critical Success sealed as 2 Resolve counts as one token when returned. Provoked and Disabled end when none of the Warrior's Resolve remains | `returnSealedResolve` in `battle/sealedResolve.ts` |
| Enemy engagement | An unengaged enemy that was not shoved or provoked closes in on a random player | `closeIn` in `battle/enemies.ts` |
| Chain Lightning | 1 Mana for 2 damage, then +2 and +3 Mana for further targets, never the same enemy twice | `battle/spells.ts` |
| Conditions from enemies | Which enemies give which condition, and the Goblin Scout's Poisoned Blade trigger | `src/data/enemies.ts` |

## Where each rule lives

### Tests and tokens

| Rule | Code |
| --- | --- |
| Token draw, Chain, Critical Success and Failure | `lib/drawTest.ts` |
| Token total plus attribute against a Difficulty | `lib/skillTest.ts` |
| Resource tokens go into play only after a success; failed tests with a Complication cost a token in play | `lib/characterTest.ts` (`settleTest`, `returnTokenInPlay`) |
| Paying a cost: own tokens first, then Expertise, then Critical Success; Critical Success is spent whole and may overpay | `commitResource` in `lib/tokenFlow.ts` |
| Resting recovers one token from the bag into play | `recoverForRest` in `lib/tokenFlow.ts` |
| Light is a modifier on every test (Bright +1, Steady 0, Dim -1, none -2; Dwarf darkvision) | `lightBonusAt` in `lib/torch.ts`, `testBonuses` in `lib/characterTest.ts` |
| Power and Armor are committed before the draw for +1 each | `boostOption` in `battle/tokens.ts` |
| Tokens sealed on an enemy return to the owner when it is defeated | `releaseSealedTokens` in `battle/effects.ts` |

### Exploration

| Rule | Code |
| --- | --- |
| Interval actions resolve in party order; torch burns; conditions released | `lib/intervalActions/index.ts` |
| Investigate finds secrets and traps with one Perception test | `intervalActions/investigate.ts` |
| Traps spring on room interactions until found and disarmed | `armedTrap`, `springTrap` in `intervalActions/context.ts` |
| Locked doors can be picked or broken; a failed break with a Complication gives Fatigue | `unlockDoor` in `intervalActions/basic.ts` |
| Torches: the party carries three spare | `limitTorches` in `lib/dungeonState.ts` |
| Dispel Magic never blocks the dungeon | `magic.effect` in `src/data/dungeon.ts` |
| Patrol, Barricade delay, Secured rooms | `patrolIsDue`, `patrolDelay`, `surpriseIn` in `lib/dungeonState.ts` |
| Ossuary: optional room, Bone Colossus, hidden crawlspace | `src/data/dungeon.ts`, `src/data/enemies.ts` |

### Combat

| Rule | Code |
| --- | --- |
| Two actions per turn; Fast and Triggered abilities are free | `lib/battle/flow.ts`, `actions.ts` |
| Defend adds Agility plus the draw to the round's Defense score | `defend` in `battle/effects.ts` |
| Enemy attacks wear down Defense; damage lands if it is exceeded | `strikePlayer` in `battle/effects.ts` |
| Engagement groups; a test is needed only if you are engaged; Difficulty scales with groups | `battle/engagement.ts` |
| Unengaged enemies spend their turn closing in | `closeIn` in `battle/enemies.ts` |
| Surprise: one Perception test per player against the median notice Difficulty | `medianNoticeDifficulty`, `surpriseCheck` in `battle/start.ts` |
| Targets: unreachable enemies listed but disabled, abilities disabled when nothing is usable | `battle/targets.ts` |
| Weapons set the attribute; two-handed +1 damage; ranged -2 when engaged | `src/data/weapons.ts`, `battle/attackPlan.ts` |
| Triggered abilities are asked as a question when they come up; nobody reacts in a surprise round | `battle/reactions.ts`, `followUps.ts`, `lib/reactorRules.ts` |
| Complications set off only the enemies the character is engaged with, unless a trigger is global | `runTriggers` in `battle/effects.ts` |
| Conditions: sealed on failed tests, effects, released at round end | `battle/conditions.ts`, `lib/conditionRules.ts` |

### Abilities

| Ability | Code |
| --- | --- |
| Warrior passives: Steadying Presence, Relentless Pressure (one chosen, stored as `passiveId`) | `battle/reactions.ts`, `battle/sealedResolve.ts` |
| Warrior combat: Provoke, Disable, Shield Bash, Sweeping Blow, Shield Wall | `battle/abilities.ts`, `battle/effects.ts` |
| Warrior triggered: Cleave, Intercept, Last Stand | `battle/followUps.ts`, `battle/reactions.ts` |
| Rogue passives: Flanking, Patient Shadow (one chosen) | `flankingRecovery` in `battle/effects.ts`, `battle/passives.ts` |
| Rogue: Backstab, Slip Away, Cheap Shot, Opportunist | `battle/abilities.ts`, `battle/followUps.ts` |
| Priest: Heal, Bless, Cleanse, Smite, Prayer, Divine Intervention | `battle/abilities.ts`, `lib/reactorRules.ts`, `battle/conditions.ts` |
| Wizard: Magic Missile, Fireball, Chain Lightning, Transpose, Arcane Focus | `battle/effects.ts`, `battle/spells.ts` |
| Interval abilities and their resource costs | `intervalActions/abilities.ts` |

## Not implemented yet

- Species traits that are not bag changes (Catfolk Foresight, Jann Exchange, Verdant Accumulated Knowledge) and
  background abilities.
- Scry beyond showing a neighbouring room.
- Armor, the Body and Accessory slots, inventory limits and stacks, tools, and buying or selling in play.
- Using items in combat.
- A one-action surprise round. Surprised enemies take their whole turn.
- Players choosing the order enemies resolve in.
- Ranger and Berserker, which the rules do not define yet.
- Poison damage does not offer Last Stand.
