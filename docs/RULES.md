# Rules: what is implemented, and what was made up

The source of truth is the Player's Guide (Google Doc, owned by the repo owner; a copy is in `docs/PLAYERS_GUIDE.md`). `src/data` is a transcription of it.
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
| Surprise | The enemy group makes a Perception test to surprise the party. Better light and watchfulness make it harder for them: Bright torch +1, Steady 0, Dim -1, no torch -2 to the party's side of the Difficulty, and Stand Watch or Keep watch +2 (the better one applies) |
| Patrol | No patrol until the first door is unlocked |
| Locked doors | Entrance door can be picked (Agility) or broken (Strength). Retrying is intended, to make torches a constraint |
| Final room | Sealed by a lock that only opens through actions in other rooms; guarded by a boss |
| Lighting a torch | Free, at the start of an Interval. The tutorial warns when the torch goes Dim and says to right-click a torch in a pack |
| Keep watch | The basic Interval action adds +2 to the surprise check, the same as Stand Watch. (The guide words it as "treat the light as one level brighter"; see the table below.) |
| Attack | A test of the held weapon's attribute. Weapons are not modelled yet, so Strength is used for every attack |
| After a fight | Characters who were down wake with 1 HP |
| Tutorial framing | Intro and outro explain that real play is more flexible than this guided dungeon |

## Assumptions we made (guesses)

| Area | Assumption | Where to change |
| --- | --- | --- |
| Equipment | Prices Torch 1, Ration 1, Bandage 2, Antidote 3, Smoke Bomb 3, Healing Potion 5; effects as described in the item text | `src/data/items.ts` |
| Healing items | Used as an Interval action; heals the most wounded party member (Bandage 2 HP, Potion 4 HP) | `src/lib/intervalActions.ts` (`healWithItem`) |
| Light | Bright shows rooms two doorways away, Steady one, Dim and Out only your own room; light does not pass a locked door | `LIGHT_REACH` in `src/lib/dungeonState.ts` |
| Darkness | Tests made with the torch out get +3 Difficulty | `DARKNESS_PENALTY` in `intervalActions.ts` |
| Skill tests | Token total + attribute must be at least the Difficulty. Critical Success always passes, Critical Failure always fails | `src/lib/skillTest.ts` |
| Rest | Regain 1 of the profession's main resource, up to 2 above the starting amount | `REST_BONUS_LIMIT` |
| Surprise round | A successful enemy test gives them a full round of attacks first; a hit on someone with no Defense lands | `surpriseCheck` in `battle.ts` |
| Patrol timing | Arrives 4 Intervals after the first lock opens; a Complication-driven noise brings it one Interval sooner | `patrol.delayAfterUnlock` |
| Room Difficulties | Search 4 to 6, interactions 4 to 6, lockpicking 6, breaking the door 7; rewards are items | `src/data/dungeon.ts` |
| Room complications | Damage (never below 1 HP), an extra step of torch burn, noise (patrol sooner), or a lost spare torch, per room | `room.complication` in `dungeon.ts` |
| Seal | Opens when the Library scrolls, the Shrine braziers and the Cistern stone interactions are all done | `link.lock.requires` in `dungeon.ts` |
| Boss | Barrow Warden (HP 7, Defense 5, Greatsword 6 attack for 2, Grave Chill 3 area) with two Skeleton Guards; arrives with no surprise check | `src/data/enemies.ts`, `dungeon.boss` |
| Enemy stats | Goblin HP 3 Defense 3 attack 4; Troll HP 4 Defense 5, Club 6 for 2, Slam 3 area | `src/data/enemies.ts` |
| Attack damage | 1 damage per hit; Backstab +2 | `battle.ts` |
| Engaging | Changing engagement is an Agility test, Difficulty 4. The guide says 6, and the owner wants it to scale with enemies and allies in the group; still being workshopped | `ENGAGE_DIFFICULTY` |
| Starting engagement | Each player starts in their own group; each enemy joins a random player | `startBattle` |
| Sealed tokens | Resolve and Cunning sealed on an enemy return to their owner when it is defeated | `releaseSealedTokens` |
| Fireball | X Mana (1 to 3 offered as separate options); the caster is hurt too if they stand in the target group; 3 Mana adds a Fatigue token | `fireball` in `battle.ts` |
| Fortify | +2 Defense in round 1 for the character who prepared it | `FORTIFY_DEFENSE` |
| Set an Ambush | A free attack on a random enemy at the start of the fight | `startBattle` |

## Where the implementation differs from the Player's Guide

The owner pasted the full guide on 8 Nov 2026. These are the places where the code does something different, none of
them settled yet. Rows marked "owner ruling" were decided in conversation and win over the guide text.

| Area | Guide | Implementation |
| --- | --- | --- |
| Surprise check | Each enemy has a concealment (Obvious, Concealed, Hidden). The current light level decides whether the party notices, must make a test, or is surprised, using a table. Keep Watch counts the light as one level brighter | Enemies make a Perception test against a base Difficulty adjusted by light and watchfulness. Keep watch is +2 (owner ruling, for now) |
| Surprise round | Each combatant on the surprising side takes 1 action; the surprised side does not act | Enemies get a full round of attacks |
| Engage and disengage | Agility test, Difficulty 6. Engage pulls an enemy into your group. Disengage leaves your group and may join another or form a new one | Agility, Difficulty 4. Owner: needs workshopping; Difficulty should rise with enemies engaged and fall with allies engaged |
| Resting | Recover 1 additional Resource token from the bag into play; sealed tokens cannot be recovered | Regain 1 of the main resource, capped at 2 above the starting amount |
| Armor, Power, Expertise | Spent before the draw: Armor +1 to a Defend result, Power +1 to an Attack result, several can be stacked, Expertise can stand in for Resolve, Armor or Power, and a Critical Success in play counts as 2 Expertise. Resources committed to a Fight ability return if the attack fails | Not implemented |
| Conditions | Wound, Poison, Insanity, Curse, Fatigue and Fear tokens (-1, Chain) go in the bag, are sealed when they contribute to a failed test, have their own effects, and are released one per combat round and all at the end of an Interval | Not implemented, apart from Fireball's Fatigue note |
| Treat Conditions | Interval action, Difficulty 6, needs the matching consumable | Not implemented |
| Consumables | Torch, Bandage (treats Wounds), Antivenom, Laudanum, Holy Water, Stimulant, Liquid Courage, Health Potion (restores 1 HP), Rations; stack sizes 2 or 3; using one in combat costs 1 action | Torch, Ration, Bandage (heals 2 HP), Antidote, Smoke Bomb, Healing Potion (heals 4 HP). Prices are invented. Items cannot be used in combat |
| Inventory | 6 inventory slots, stacking, and four equipment slots (Main Hand, Off Hand, Body, Accessory), plus tools such as Rope and Thieves' Tools | No slot limit, no equipment slots, no tools |
| Healing | Heal restores 2 HP, Group Heal 1 HP, Health Potion 1 HP | Items heal more than the guide, which makes the tutorial easier than the guide's numbers imply |
| Mana | Mana drawn in a test goes into play only if the test succeeds | Not checked |

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
