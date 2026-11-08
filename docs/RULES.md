# Rules: what is implemented, and what was made up

The source of truth is the Player's Guide (Google Doc, owned by the repo owner). `src/data` is a transcription of it.
Two other sources feed the code:

- **Owner rulings**: things the owner told us directly during development. These are firm.
- **Assumptions**: gaps we filled ourselves so the tutorial would run. These are guesses. Each one has a place to
  change it. If the owner corrects one, update the table below in the same change.

## Rules from the guide (transcribed)

- Seven SPECIAL attributes distributed from the fixed array `1, 2, 2, 2, 3, 3, 3`; species and background each add +1.
- The standard 15-token bag; species modify it (`bagMods`); profession resources start in play, not in the bag.
- A test draws without replacement until a token that does not Chain; modifiers add up. Critical Success ends the draw
  and Critical Failure automatically fails and generates a Complication.
- Species traits that change the bag (Dwarf shields, Elf focus, Halfling, Human, Orc Might). Shield tokens wait in play
  and absorb damage from the next hit, then return. Might adds 1 damage to a successful attack. Bless tokens are used
  up when drawn.
- Profession abilities as transcribed in `src/data/professions.ts` (Ranger and Berserker are TBD in the guide and cannot
  be selected).
- Holy Light lights a torch that burns Bright 3, Steady 3, Dim 2.

## Owner rulings

| Topic | Ruling |
| --- | --- |
| Step order | Profession, Species, Background, SPECIAL, Abilities, Equipment, Review |
| Starting coins | 10, spent on basic consumables. No weapons or armor yet |
| Torch | An ordinary torch burns Bright 1, Steady 3, Dim 2 Intervals |
| Moving | Moving to another room takes an Interval |
| Interval actions | Each character picks an action (search, rest, keep watch, room interaction, class ability); they resolve in order |
| Combat round | Each player has 2 actions; Fast and Triggered abilities cost none; Fight, Defend and Engage cost one |
| Defend | An Agility test whose result (Agility + token result) is added to the Defense score for the round. Defense resets each round |
| Enemies | Defense score, HP, abilities that run after all players have acted, in random order. No bag, no tests |
| Enemy attacks | Attack value is subtracted from the target's Defense. If it exceeds it, the attack deals its damage (usually 1). Several attacks keep depleting the same score |
| Engagement | Groups of players and enemies. You can usually only attack within your group. Enemies engage randomly for now. An action changes group; some abilities (Provoke) force it |
| Triggers | Enemy triggered abilities usually fire when a Complication is drawn |
| End | The fight ends when all of one side is at 0 HP |
| Surprise | The enemy group makes a Perception test to surprise the party. Stand Watch +2, bright torch +1, dim torch -1 (see assumption on direction) |
| Patrol | No patrol until the first door is unlocked |
| Locked doors | Entrance door can be picked (Agility) or broken (Strength). Retrying is intended, to make torches a constraint |
| Final room | Sealed by a lock that only opens through actions in other rooms; guarded by a boss |
| Tutorial framing | Intro and outro explain that real play is more flexible than this guided dungeon |

## Assumptions we made (guesses)

| Area | Assumption | Where to change |
| --- | --- | --- |
| Equipment | Prices Torch 1, Ration 1, Bandage 2, Antidote 3, Smoke Bomb 3, Healing Potion 5; effects as described in the item text | `src/data/items.ts` |
| Healing items | Used as an Interval action; heals the most wounded party member (Bandage 2 HP, Potion 4 HP) | `src/lib/intervalActions.ts` (`healWithItem`) |
| Light | Bright shows rooms two doorways away, Steady one, Dim and Out only your own room; light does not pass a locked door | `LIGHT_REACH` in `src/lib/dungeonState.ts` |
| Lighting a torch | Right-clicking a torch lights it at once and takes no Interval | `lightTorch` in `dungeonReducer` |
| Darkness | Tests made with the torch out get +3 Difficulty | `DARKNESS_PENALTY` in `intervalActions.ts` |
| Skill tests | Token total + attribute must be at least the Difficulty. Critical Success always passes, Critical Failure always fails | `src/lib/skillTest.ts` |
| Rest | Regain 1 of the profession's main resource, up to 2 above the starting amount | `REST_BONUS_LIMIT` |
| Keep watch | Counts as watching for +1 to the surprise check; the better of Stand Watch (+2) and Keep watch applies | `KEEP_WATCH`, `STAND_WATCH` |
| Surprise direction | Light and watchfulness are read as helping the party spot the enemies, so they raise the Difficulty of the enemy test. Torch Steady is 0 and out is -2. Base Difficulty 4, patrol Perception 2, draw from the standard bag | `TORCH_AWARENESS`, `SURPRISE_BASE_DIFFICULTY`, `patrol.perception` |
| Surprise round | A successful enemy test gives them a full round of attacks first; a hit on someone with no Defense lands | `surpriseCheck` in `battle.ts` |
| Patrol timing | Arrives 4 Intervals after the first lock opens; a Complication-driven noise brings it one Interval sooner | `patrol.delayAfterUnlock` |
| Room Difficulties | Search 4 to 6, interactions 4 to 6, lockpicking 6, breaking the door 7; rewards are items | `src/data/dungeon.ts` |
| Room complications | Damage (never below 1 HP), an extra step of torch burn, noise (patrol sooner), or a lost spare torch, per room | `room.complication` in `dungeon.ts` |
| Seal | Opens when the Library scrolls, the Shrine braziers and the Cistern stone interactions are all done | `link.lock.requires` in `dungeon.ts` |
| Boss | Barrow Warden (HP 7, Defense 5, Greatsword 6 attack for 2, Grave Chill 3 area) with two Skeleton Guards; arrives with no surprise check | `src/data/enemies.ts`, `dungeon.boss` |
| Enemy stats | Goblin HP 3 Defense 3 attack 4; Troll HP 4 Defense 5, Club 6 for 2, Slam 3 area | `src/data/enemies.ts` |
| Attack | A Strength test against the enemy's Defense; 1 damage; Backstab +2 | `ATTACK_ATTRIBUTE` in `battle.ts` |
| Engaging | Changing engagement is an Agility test, Difficulty 4 | `ENGAGE_DIFFICULTY` |
| Starting engagement | Each player starts in their own group; each enemy joins a random player | `startBattle` |
| Sealed tokens | Resolve and Cunning sealed on an enemy return to their owner when it is defeated | `releaseSealedTokens` |
| After a fight | Characters who were down wake with 1 HP | `endBattle` |
| Fireball | X Mana (1 to 3 offered as separate options); the caster is hurt too if they stand in the target group; 3 Mana adds a Fatigue token | `fireball` in `battle.ts` |
| Fortify | +2 Defense in round 1 for the character who prepared it | `FORTIFY_DEFENSE` |
| Set an Ambush | A free attack on a random enemy at the start of the fight | `startBattle` |

## Not implemented yet

- Triggered abilities: Cleave, Intercept, Flanking, Opportunist, Prayer, Divine Intervention. Battle options hide them.
- Combat abilities shown greyed out as "Not in the sample battle yet": Shield Wall, Cleanse, Chain Lightning, Transpose,
  Arcane Focus.
- Spending Armor and Power tokens, or Expertise as another resource.
- Acquiring condition tokens (Wound, Poison, Fear and so on) from enemy attacks, and the abilities that remove them.
- Species traits that are not bag changes (Catfolk Foresight, Jann Exchange, Verdant Accumulated Knowledge) and
  background abilities: flavour only.
- Room preparations other than Fortify and Ambush (Secure Area, Barricade) are recorded but have no effect in a fight.
- Smite's bonus against supernatural enemies; Scry beyond showing a neighbouring room.
- Weapons and armor, other equipment effects, buying or selling in play.
- Smarter enemy engagement than random, and players choosing the order enemies resolve in.
- Ranger and Berserker (TBD in the guide).
