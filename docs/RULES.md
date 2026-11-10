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
| Surprise | Owner ruling: each player makes one Perception test against the median notice Difficulty of the enemies (Goblin Scout 6, Cave Troll 3, Skeleton Guard 6, Barrow Warden 5, Bone Colossus 2, all invented; with an even number the middle two are averaged and rounded up). If anyone passes the party sees the danger coming; if nobody does every enemy gets a surprise round. Keeping watch adds +2, and a Secured room skips the check | `medianNoticeDifficulty` in `battle/start.ts` |
| Patrol | No patrol until the first door is unlocked |
| Locked doors | Entrance door can be picked (Agility) or broken (Strength). Retrying is intended, to make torches a constraint |
| Final room | Sealed by a lock that only opens through actions in other rooms; guarded by a boss |
| Lighting a torch | Free, at the start of an Interval. The tutorial warns when the torch goes Dim and says to right-click a torch in a pack |
| Keep watch | The basic Interval action adds +2 to the surprise check. (Stand Watch was removed because it did exactly this.) (The guide words it as "treat the light as one level brighter"; see the table below.) |
| Hands and weapons | Owner ruling: each character has two hand slots. A weapon sets the attribute an ordinary attack tests (sword and mace Strength, dagger Agility, shortbow Perception, magic staff Intelligence, bare hands Strength). A two-handed weapon takes both hands and does +1 damage. A ranged weapon can attack enemies you are not engaged with and is -2 against ones you are. A shield adds 2 Shield (+2) tokens to the bag. The first weapon held (main hand first) is used; a second weapon is a spare. Hand items are bought with the starting coins (dagger 1, sword, mace and shield 2, greataxe, shortbow and magic staff 3). Spell attacks keep their own attribute and ignore weapon damage | `src/data/weapons.ts`, `attackEnemy` |
| After a fight | Characters who were down wake with 1 HP |
| Tutorial framing | Intro and outro explain that real play is more flexible than this guided dungeon |

## Assumptions we made (guesses)

| Area | Assumption | Where to change |
| --- | --- | --- |
| Equipment | Prices Torch 1, Ration 1, Bandage 2, Antidote 3, Smoke Bomb 3, Healing Potion 5; effects as described in the item text | `src/data/items.ts` |
| Healing items | Used as an Interval action; heals the most wounded party member (Bandage 2 HP, Potion 4 HP) | `src/lib/intervalActions.ts` (`healWithItem`) |
| Light | Owner ruling: the torch is a modifier on every test the party makes, in the dungeon and in a fight, attacks and Defend included: Bright +1, Steady 0, Dim -1, no torch -2. A dwarf's darkvision treats no torch as dim (-1). It replaces the old +3 Difficulty in the dark | `lightBonusAt` in `torch.ts`, `testBonuses` in `characterTest.ts` |
| Portraits | Owner ruling: no gender choice. A character picks one of three portraits for their profession or uploads a picture (cropped square, shrunk, stored with the character). The profession art is now a symbol | `src/data/portraits.ts`, `StepPortrait` |
| Light | Owner ruling: the torch is a modifier on every test the party makes, in the dungeon and in a fight, attacks and Defend included: Bright +1, Steady 0, Dim -1, no torch -2. A dwarf's darkvision treats no torch as dim (-1). It replaces the old +3 Difficulty in the dark | `lightBonusAt` in `torch.ts`, `testBonuses` in `characterTest.ts` |
| Portraits | Owner ruling: no gender choice. A character picks one of three portraits for their profession or uploads a picture (cropped square, shrunk, stored with the character). The profession art is now a symbol | `src/data/portraits.ts`, `StepPortrait` |
| Skill tests | Token total + attribute must be at least the Difficulty. Critical Success always passes, Critical Failure always fails | `src/lib/skillTest.ts` |
| Rest | Regain 1 of the profession's main resource, up to 2 above the starting amount | `REST_BONUS_LIMIT` |
| Surprise round | When nobody passes, every enemy takes its turn before the players act. A hit on someone with no Defense lands | `surpriseCheck` in `battle/start.ts` |
| Patrol timing | Arrives 4 Intervals after the first lock opens; a Complication-driven noise brings it one Interval sooner | `patrol.delayAfterUnlock` |
| Room Difficulties | Search 4 to 6, interactions 4 to 6, lockpicking 6, breaking the door 7; rewards are items | `src/data/dungeon.ts` |
| Room complications | Damage (never below 1 HP), an extra step of torch burn, noise (patrol sooner), or a lost spare torch, per room | `room.complication` in `dungeon.ts` |
| Seal | Opens when the Library scrolls, the Shrine braziers and the Cistern stone interactions are all done | `link.lock.requires` in `dungeon.ts` |
| Boss | Barrow Warden (HP 7, Defense 5, Greatsword 6 attack for 2, Grave Chill 3 area) with two Skeleton Guards; arrives with no surprise check | `src/data/enemies.ts`, `dungeon.boss` |
| Enemy stats | Goblin HP 3 Defense 3 attack 4; Troll HP 4 Defense 5, Club 6 for 2, Slam 3 area | `src/data/enemies.ts` |
| Attack damage | 1 damage per hit; Backstab +2 | `battle.ts` |
| Engaging | Owner ruling: changing engagement only takes a test if you are engaged (an enemy is in your own group); otherwise you just move. With a test it is Agility, Difficulty = 4 + enemies in the group you leave + enemies in the group you join - allies who stay behind, never below 2. Agreed with the owner as a starting point to workshop; the guide's flat 6 is the fallback | `engageDifficulty`, `needsEngageTest` in `src/lib/battle/engagement.ts` |
| Starting engagement | Each player starts in their own group; each enemy joins a random player | `startBattle` |
| Sealed tokens | Resolve and Cunning sealed on an enemy return to their owner when it is defeated | `releaseSealedTokens` |
| Resource tokens | Owner ruling: resource tokens drawn in a test only go into play if the test succeeded, and otherwise come back only by Rest. Spending one moves it to the bag. Tokens sealed on an enemy return to their owner's bag when it is defeated. The same settling happens after dungeon tests | `src/lib/characterTest.ts`, `afterTest` |
| Complication default | Owner ruling: a failed test that draws a Complication costs the character a token in play, returned to the bag (their choice if several kinds are in play). Sealed conditions are not in play. Room, trap and enemy consequences come on top | `returnTokenInPlay` in `characterTest.ts` |
| Paying a cost | Own tokens first, then Expertise, then a Critical Success. A Critical Success is spent whole and may overpay. Sealing Expertise or a Critical Success counts as 1 or 2 of the resource | `commitResource` |
| Power and Armor | Committed before the draw for +1 each. Power applies to the basic Attack and to a Warrior's Fight abilities, Armor to Defend. Returned to the bag afterwards, hit or miss | `boostOption` in `tokens.ts` |
| Resting | Recovers one token from the bag into play: the profession's resource if the bag has one, otherwise Expertise, otherwise a Critical Success | `recoverForRest` in `tokenFlow.ts` |
| Reactions | A Triggered ability is offered as a question when it comes up. Prayer is for allies only, for failed tests that are not Critical Failures (not Defend). Intercept is for single-target attacks, not area attacks; the +2 Defend is taken off that attack's Attack value. Cleave follows an attack that defeats an enemy, Opportunist any defeat in the reactor's group by an ally, and both are offered when the action ends. Nobody reacts during a surprise round. Flanking is automatic and needs a Cunning in the bag | `src/lib/battle/reactions.ts`, `followUps.ts` |
| Shield Wall | A Defend test for 1 Resolve. For the rest of the round the warrior is asked whether to spend their Defense score on each attack against an ally in the same group; what the score cannot cover is set against the ally's own Defense. Armor can be added to it | `offerShieldWall` in `battle/reactions.ts` |
| Chain Lightning | 1 Mana, an Intelligence attack for 2 damage, then the caster is asked about each further target at +2 and then +3 Mana. The same enemy is never hit twice | `src/lib/battle/spells.ts` |
| Transpose, Arcane Focus | Transpose swaps groups with any other living character or enemy. Arcane Focus draws five tokens at random from the bag; Complications are not set off as test Complications, so enemy triggers do not fire | `spells.ts` |
| Smite | 2 extra damage against enemies marked `supernatural` (Skeleton Guard, Barrow Warden) | `data/enemies.ts` |
| Torches | Owner ruling: the party carries only 3 spare torches between them. Sample characters share 3, and any other party is trimmed to 3 in party order when it enters the dungeon | `limitTorches` in `dungeonState.ts` |
| Sample party | Brann takes Provoke, Disable and Intercept, Wren Backstab and Flanking, Sister Maren Heal and Prayer, Ilvara Magic Missile and Fireball. No rations. Every kit spends all 10 coins on a weapon, treatments and torches (Brann sword, shield, torch, Bandage, Antivenom; Wren dagger, torch, Antivenom, Healing Potion; Maren mace, torch, Bandage, Healing Potion; Ilvara magic staff, Healing Potion, Bandage). Portraits: Brann warrior 1, Wren rogue 2, Maren priest 1, Ilvara wizard 2 | `src/lib/roster.ts` |
| Conditions | Enemy attacks and triggers can give a condition token (Cave Troll's Club Smash a Wound, the Barrow Warden's Grave Chill Fear, the Goblin Scout's Poisoned Blade trigger Poison for an engaged character who draws a Complication; all invented content). It goes in the bag; drawn in a failed test it is sealed and takes effect as the guide describes. A Fatigue takes effect from the round after it was sealed. At the end of each combat round everyone releases one condition sealed in an earlier round, choosing if there are several, and all are released when the fight ends. Divine Intervention is for allies only. In the dungeon a condition drawn in a failed test is sealed too, takes effect for that test (Poison hurts, but never below 1 HP) and is released when the Interval ends | `src/lib/battle/conditions.ts`, `conditionRules.ts`, `data/enemies.ts` |
| Treat Conditions | An Interval action. The patient tests at Difficulty 6 with the better of the two listed attributes; success removes the token from their bag for good, and the item is used up either way. Tend the Afflicted does the same with no test | `treatCondition` in `intervalActions.ts` |
| Fireball | One Intelligence draw, compared with every enemy in the group (Critical Success hits all, Critical Failure none). X Mana (1 to 3 offered as separate options); the caster is hurt too if they stand in the target group; 3 Mana adds a Fatigue token | `fireball` in `battle.ts` |
| Complications | Owner ruling: a Complication sets off only the enemies the character is engaged with, unless an enemy's trigger is marked global (the Barrow Warden's Undying) | `trigger.global` in `data/enemies.ts` |
| Targets | Owner ruling: abilities list every enemy but disable the ones they cannot reach, pick the first usable one, and are themselves disabled when none is usable. Provoke can hit any enemy in the room; Attack, Disable, Cheap Shot and Smite need an engaged enemy | `src/lib/battle/targets.ts` |
| Investigate | Owner ruling: Search is now Investigate and also finds traps. One Perception test; whatever is hidden at or below the result is found (secret and trap each have their own Difficulty) | `investigate` in `intervalActions/basic.ts` |
| Traps | The Library has a poisoned needle (find 6, Agility 5 to disarm) and the Shrine a searing glyph (find 5, Intelligence 6 to disarm, magical). A room interaction sets off an armed trap once; a failed disarm sets it off too. Found traps are listed on the room card | `trap` in `data/dungeon.ts` |
| Dispel Magic | Owner ruling: it must never block the dungeon. Shrine: disarms the glyph. Library: reveals the secret the ward hid. Crypt: the Barrow Warden loses Undying | `magic.effect` in `data/dungeon.ts` |
| Breaking the door | A failed attempt that draws a Complication gives the character a Fatigue token | `complication` on the door's lock option |
| Ossuary | An optional room between the Storeroom and the Cistern with one Bone Colossus. It starts engaged with everyone and drags everyone back into its group at the end of its turn. Scout Ahead shows what is inside, and a hidden crawlspace from the Storeroom to the Cistern (found by Investigate at 6 or Find a Shortcut) goes round it | `data/dungeon.ts`, `data/enemies.ts` |
| Unengaged enemies | Owner ruling: an enemy with no player in its group spends its whole turn closing in on a player and does nothing else, area attacks included. A Shield Bash target returns to the warrior who bashed it, then a Provoker, then a random player | `closeIn` in `battle/enemies.ts` |
| Shield Bash | Fight, 1 Resolve, engaged enemies only. A hit knocks the enemy into a group of its own and costs it its next turn | `shieldBash` in `battle/abilities.ts` |
| Sweeping Blow | Fight, 2 Resolve. One attack test compared with every enemy's Defense in your group, like Fireball. Each enemy reached takes 1 damage plus weapon and Might bonuses | `sweepingBlow` in `battle/effects.ts` |
| Last Stand | Triggered, 1 Resolve (owner worded it without a cost; the Resolve is my addition, since abilities cost class resources). Offered when an enemy attack or a Fireball backlash drops the warrior to 0 HP. Poison damage does not offer it | `offerLastStand` in `battle/reactions.ts` |
| Interval ability costs | Warrior utility abilities spend Resolve (1) or a consumable. A spent Resolve goes back to the bag, so it is only a cost until the warrior rests or draws it again | `payCost` in `intervalActions/abilities.ts` |
| Barricade | Owner asked for it to do something concrete now that enemies do not make tests: each use delays the patrol by 3 Intervals, however often it is used, limited by Resolve and torch time | `patrolDelay` in `dungeonState.ts` |
| Secure Area | Combat that begins in a Secured room has no surprise check | `surpriseIn` in `dungeonState.ts` |
| Shoulder Through | Owner's "break down the door" idea. Strength against the door's break Difficulty minus 2, no Complication on failure | `shoulderThrough` in `intervalActions/abilities.ts` |
| Steel Nerves, Hearty Meal | Steel Nerves uses up a Liquid Courage to remove a Fear token with no test, and costs no Resolve because the item is the cost. Hearty Meal uses a Ration to heal everyone 1 HP and remove a Fatigue token from each bag. Both are my designs | `intervalActions/abilities.ts` |
| Fortify | Owner ruling: everyone in the party, not just the warrior, begins combat with +2 Defense | `FORTIFY_DEFENSE` |
| Set an Ambush | A free attack on a random enemy at the start of the fight | `startBattle` |

## Where the implementation differs from the Player's Guide

The owner pasted the full guide on 8 Nov 2026. These are the places where the code does something different, none of
them settled yet. Rows marked "owner ruling" were decided in conversation and win over the guide text.

| Area | Guide | Implementation |
| --- | --- | --- |
| Surprise check | Concealment levels against light, with a single check | Owner's per-player Perception test against the median notice Difficulty. The guide's table is not used |
| Surprise round | Each combatant on the surprising side takes 1 action; the surprised side does not act | Every enemy takes its whole turn (all its attacks) |
| Engage and disengage | Agility test, Difficulty 6. Engage pulls an enemy into your group. Disengage leaves your group and may join another or form a new one | Agility, Difficulty from the formula in the assumptions table (4 base, up with enemies, down with allies). Owner is still workshopping it. A popup explains it the first time a player picks Change engagement |
| Consumables | Torch, Bandage (treats Wounds), Antivenom, Laudanum, Holy Water, Stimulant, Liquid Courage, Health Potion (restores 1 HP), Rations; stack sizes 2 or 3; using one in combat costs 1 action | The treatments are in, but Bandage also heals 2 HP, Healing Potion heals 4 HP, Smoke Bomb is not in the guide, and prices are invented. Items cannot be used in combat. The new treatments reuse existing icons |
| Inventory | 6 inventory slots, stacking, and four equipment slots (Main Hand, Off Hand, Body, Accessory), plus tools such as Rope and Thieves' Tools | No slot limit, no equipment slots, no tools |
| Healing | Heal restores 2 HP, Group Heal 1 HP, Health Potion 1 HP | Items heal more than the guide, which makes the tutorial easier than the guide's numbers imply |

## Not implemented yet

- Species traits that are not bag changes (Catfolk Foresight, Jann Exchange, Verdant Accumulated Knowledge) and
  background abilities: flavour only.
- Scry beyond showing a neighbouring room.
- Weapons and armor, other equipment effects, buying or selling in play.
- Smarter enemy engagement than random, and players choosing the order enemies resolve in.
- Ranger and Berserker (TBD in the guide).
