# Player's Guide

*A fantasy tabletop roleplaying game of strategy, exploration, and adventure.*

This file is the canonical rules. The Rules tab of the site renders it directly, and the app follows it. Where a rule
is a guess rather than a ruling, `docs/IMPLEMENTATION.md` says so. Section 15 is generated from the app's data
(`npm run rules:sync`); everything else is written by hand, and a test checks that every ability in the app is listed
here with the same type and cost.

## 1. Core Rules

Players control adventurers exploring dangerous places, overcoming challenges, and fighting enemies.

Most uncertain actions are resolved using a **token bag** and one of your character's seven SPECIAL attributes.

### Making Tests

When you attempt something uncertain, the Game Master (GM) may ask you to make a test.

1. The GM determines which SPECIAL attribute applies and sets a Difficulty.
2. Draw a token from your bag.
3. Add the token's modifier to your SPECIAL attribute.
4. If the result meets or exceeds the Difficulty, you succeed.

**Test Result = SPECIAL + Token Modifiers**

For example, a character with Strength 3 who draws a +2 token gets a result of 5.

Some tokens have special effects or cause you to draw additional tokens.

### SPECIAL Attributes

Every character has seven attributes, collectively called **SPECIAL**.

| Attribute | Used for |
| ----- | ----- |
| **Strength** | Physical power, lifting, pushing, grappling, and breaking objects |
| **Perception** | Noticing details, detecting danger, tracking, and awareness |
| **Endurance** | Resisting poison, exhaustion, harsh conditions, and physical hardship |
| **Charisma** | Persuasion, deception, intimidation, negotiation, and performance |
| **Intelligence** | Knowledge, reasoning, investigation, and understanding complex things |
| **Agility** | Speed, balance, stealth, precision, and coordination |
| **Luck** | Fortunate coincidences, unexpected discoveries, and circumstances beyond your control |

The GM determines which attribute applies to each test.

Luck is generally used when the outcome depends on chance rather than a deliberate action. For example, searching for a trap might use Perception, while determining whether you happen to step on a hidden pressure plate might use Luck.

## 2. Character Creation

Characters are defined by their profession, SPECIAL attributes, species, and background.

### Step 1: Choose a Profession

Your profession determines your adventuring abilities, starting HP, and profession-specific tokens.

| Profession | Starting HP | Important SPECIAL | Focus |
| ----- | ----- | ----- | ----- |
| **Warrior** | 12 | Strength, Endurance, Agility | Protection, battlefield control, and weapons |
| **Rogue** | 10 | Agility, Perception, Charisma | Stealth, mobility, and opportunistic attacks |
| **Priest** | 8 | Charisma, Intelligence, Endurance | Healing, blessings, and supernatural support |
| **Wizard** | 8 | Intelligence, Perception, Endurance | Powerful magic and resource management |
| **Ranger** | TBD | Perception, Agility, Strength | Ranged combat, hunting, and wilderness expertise |
| **Berserker** | TBD | Strength, Endurance, Luck | Aggressive combat and taking risks |

The listed attributes are recommendations, not requirements.

### Step 2: Assign SPECIAL

Distribute these seven values among your SPECIAL attributes:

**1, 2, 2, 2, 3, 3, 3**

### Step 3: Choose a Species

Your species grants attribute bonuses, natural traits, and modifications to your token bag.

### Step 4: Choose a Background

Your background represents your life before adventuring. It grants +1 to a SPECIAL attribute and a passive ability.

Apply all attribute bonuses and token bag modifications from your choices.

## 3. Token Bags

Every character begins with the same standard token distribution. Your profession and species may add, remove, or replace tokens.

### Standard Token Distribution

Every character begins with these **15 tokens**:

| Token | Copies |
| ----- | ----- |
| Critical Failure | 1 |
| +0 | 1 |
| +1 | 2 |
| +2 | 2 |
| +3 | 4 |
| +4 | 1 |
| Critical Success (+5) | 1 |
| Opportunity (+1, Chain) | 1 |
| Expertise (+0, Chain) | 1 |
| Complication (−1, Chain) | 1 |
| **Total** | **15** |

Ordinary numbered tokens contribute their modifier and end the draw.

### Special Tokens

| Token | Modifier | Effect |
| ----- | ----- | ----- |
| **Opportunity** | +1 | Chain |
| **Expertise** | 0 | Chain, Resource |
| **Complication** | −1 | Chain; may trigger enemy or environmental effects |
| **Critical Success** | +5 | Ends the draw; Resource worth 2 Expertise |
| **Critical Failure** | — | Automatically fails, ends the draw, and generates a Complication |

### Token Keywords and States

#### Chain

Add the token's modifier to your test and draw another token.

Leave previously drawn tokens outside the bag until the test is resolved. Continue drawing until you draw a token that ends the draw.

#### Resource

Resource tokens only come into play from a successful test, or by resting. A failed test leaves them in the bag.

A Resource token is put **in play** after being drawn during a **successful** test. Resources can be spent on abilities. Profession tokens only come back into play from a successful test or by resting.

#### In Play

A token outside your bag that is available to spend.

#### Spend

Use a token in play and return it to your bag, unless an ability instructs you to seal it.

#### Seal

Attach a token to an ongoing effect. Sealed tokens are unavailable until released.

#### Release

Return a sealed token to its owner's bag.

#### Recover

Move a token from your bag directly into play.

#### Remove

Permanently remove a token from your bag or play area, usually through treatment or another effect.

### Drawing Additional Tokens

When a token has **Chain**, add its modifier and draw another token from the remaining bag.

**Example:** Opportunity → Expertise → +3

The total token modifier is +4. After resolving the test, put the Expertise token in play.

**Critical Failure** always causes the test to fail, regardless of earlier modifiers.

### Critical Success

A Critical Success contributes +5 and ends the draw.

After resolving the test, put the Critical Success token in play. It counts as **2 Expertise** when spent or sealed.

A Critical Success token must be spent or sealed as a single token. It cannot be divided into two separate resources.

### Complications

By default, a failed test that draws a Complication costs you a token in play, returned to your bag. Enemies, rooms and traps add their own consequences on top.

Complications represent additional dangers or consequences.

By default, when you draw a Complication on a failed test you must return a token in play to your bag. Conditions are sealed rather than in play, so they cannot be returned this way.

Some enemies and environmental hazards have passive abilities that activate when a player draws a Complication.

For example:

**Venomous:** When an engaged player draws a Complication, they gain 1 Poison token.

Complication effects are specified by the enemy, hazard, or ability involved.

### Returning Tokens

After resolving a test, return all drawn tokens to your bag unless an ability instructs you to put them in play or otherwise move them.

## 4. Species

Choose one species during character creation.

### Dwarf

Dwarves are hardy and resilient. Their larger token bags produce more consistent results, while their shields provide protection in battle.

**Endurance:** Increase Endurance by 1.

**Darkvision:** You can see in darkness as though it were dim light.

**Shield Tokens:** Add 3 Shield (+2) tokens to your starting bag.

When you draw a Shield token, put it in play after the test.

The next time you take damage, each Shield you have in play reduces that damage by 1. Return Shields used this way to your bag.

### Elf

Elves are exceptionally agile and graceful. Their smaller bags produce more extreme results and make special tokens more common.

**Agility:** Increase Agility by 1.

**Graceful:** You can move across narrow or unstable surfaces without making a test unless additional danger or difficulty is present.

**Focused:** Remove one +1, one +2, and one +3 token from your starting bag.

### Halfling

Halflings have an uncanny ability to find unexpected opportunities, often succeeding through extraordinary good fortune.

**Luck:** Increase Luck by 1.

**Unassuming:** Unless you give them reason to think otherwise, strangers rarely perceive you as particularly dangerous or threatening.

**Fortuitous:** Add 2 additional Opportunity tokens to your starting bag.

### Human

Humans are adaptable and versatile, capable of excelling in almost any profession.

**Versatile:** Add 1 additional Expertise token to your starting bag.

### Orc

Orcs are powerfully built and naturally suited to overcoming challenges through physical force.

**Strength:** Increase Strength by 1.

**Powerful Build:** You can carry, lift, push, and drag considerably more weight than most similarly sized creatures.

**Mighty Blows:** Replace 2 +2 tokens in your starting bag with corresponding Might tokens.

Might tokens retain their original modifiers. When drawn during a successful attack, each Might token deals 1 additional damage.

### Catfolk

Catfolk possess exceptional senses and an uncanny awareness of their surroundings.

**Perception:** Increase Perception by 1.

**Keen Senses:** Your hearing and sense of smell are considerably more sensitive than those of most species.

**Foresight:** When you draw an Opportunity, you may ignore the next token drawn and draw another token in its place.

The ignored token contributes no modifier or effects. Leave it outside the bag until the test ends.

### Jann

The Jann are a people of ancient desert cities and far-reaching trade routes. Their metallic skin ranges from copper and brass to bronze and gold.

Jann culture has a long tradition of commerce, craftsmanship, negotiation, and travel.

**Charisma:** Increase Charisma by 1.

**Appraiser:** You can quickly determine the approximate value of ordinary goods, precious metals, gems, artwork, and other valuables.

**Exchange:** When you rest, you may replace one Expertise token in your bag with an Opportunity, or one Opportunity with an Expertise token.

The replacement remains until you choose to exchange it again during a later rest.

### Verdant

Verdant are long-lived plant people with bark-like skin, leaves, flowers, moss, vines, and other plant characteristics.

Their cultures place great value on study and preserving knowledge accumulated across generations.

**Intelligence:** Increase Intelligence by 1.

**Photosynthesis:** You do not require conventional food. Given regular access to sunlight and water, you can sustain yourself through photosynthesis.

**Accumulated Knowledge:** After you succeed on a test where Opportunity tokens were drawn, you may put them into play. They can be spent as part of a test to add +1 to that test.

## 5. Backgrounds

Choose one background during character creation.

Each background increases one SPECIAL attribute by 1 and grants a passive ability reflecting your character's previous experience.

**Background abilities are subject to GM interpretation.** They are intended to provide useful advantages based on your character's experience, rather than rigid mechanical effects. The GM is encouraged to interpret these abilities generously and allow creative applications whenever they reasonably fit the character's background.

### Strength Backgrounds

#### Soldier

You served in an army, militia, mercenary company, or other organized fighting force.

* **+1 Strength**
* **Military Training:** You are familiar with military organizations, ranks, procedures, camps, fortifications, and military life.

#### Labourer

You made your living through demanding physical work such as construction, mining, logging, or hauling cargo.

* **+1 Strength**
* **Hard Work:** You are experienced with tools, construction, hauling, and other forms of physical labour.

### Perception Backgrounds

#### Hunter

You made your living hunting animals and navigating the wilderness.

* **+1 Perception**
* **Tracker:** You can identify and follow tracks and other signs left behind by creatures.

#### Guard

You spent your time watching for trouble and protecting people, places, or possessions.

* **+1 Perception**
* **Watchful:** You are experienced at identifying security weaknesses and recognizing signs that something is amiss.

### Endurance Backgrounds

#### Sailor

You spent years aboard ships, travelling waterways and working alongside other sailors.

* **+1 Endurance**
* **Sea Legs:** You are at home aboard ships and accustomed to swimming, sailing, and the hazards of life at sea.

#### Farmer

You worked the land and learned to depend on crops, animals, weather, and the changing seasons.

* **+1 Endurance**
* **Country Living:** You are knowledgeable about crops, livestock, weather, and rural life.

### Charisma Backgrounds

#### Entertainer

You made your living performing as a musician, actor, dancer, storyteller, or another kind of entertainer.

* **+1 Charisma**
* **Performer:** You can usually find somewhere to perform in exchange for modest food, lodging, or coin.

#### Merchant

You made your living buying, selling, and transporting goods.

* **+1 Charisma**
* **Commerce:** You know how to find markets, buyers, sellers, and sources for ordinary goods in populated areas.

### Intelligence Backgrounds

#### Scholar

You devoted yourself to study, research, and the pursuit of knowledge.

* **+1 Intelligence**
* **Academic:** You know how to find libraries, archives, scholars, and other sources of specialized knowledge.

#### Artisan

You trained extensively in a particular trade or craft.

* **+1 Intelligence**
* **Craft:** Choose a craft. You can create, repair, and assess items related to it when you have appropriate tools and materials.

### Agility Backgrounds

#### Urchin

You grew up surviving on the streets and learned how to navigate places where you were often overlooked.

* **+1 Agility**
* **Streetwise:** You are adept at finding shortcuts, shelter, and overlooked ways through populated settlements.

#### Criminal

You made your living outside the law and learned to navigate the criminal underworld.

* **+1 Agility**
* **Underworld Connections:** You know how to locate fences, illicit goods and services, and members of the local criminal element.

### Luck Backgrounds

#### Gambler

You spent your time around cards, dice, wagers, and people willing to risk their fortunes on chance.

* **+1 Luck**
* **Games of Chance:** You are familiar with common gambling games and know how to find places and people where serious gambling occurs.

#### Treasure Hunter

You made a career of searching ruins, forgotten places, and other dangerous locations for valuable discoveries.

* **+1 Luck**
* **Treasure Sense:** You can recognize signs that a location has previously been searched, looted, or deliberately used to conceal valuables.

## 6. Dungeon Exploration

Dungeon exploration is divided into **Intervals**, each representing approximately 10 minutes.

During each Interval, every character may perform one exploration action. All characters act during the same Interval.

After their actions are resolved, time advances. Torches burn down, and wandering monsters or other dungeon events may occur.

Intervals are specific to dungeon exploration. Overworld travel will use a separate system.

### Universal Interval Actions

#### Move

**Interval**

Move to an adjacent room or dungeon location.

Entering a room reveals its obvious features and occupants. Hidden features must be discovered through searching or other means.

#### Investigate

Search is called Investigate. It is one Perception test, and everything hidden at or below your result turns up: secrets, traps and hidden passages. Room interactions set off a trap in the room until it has been found and disarmed.

**Interval — Perception Test**

Investigate a room or area for hidden objects, traps, treasure, clues, or secret passages.

The GM determines the Difficulty of hidden discoveries. A successful test reveals anything your search could reasonably discover at or below your result.

You may investigate the same area repeatedly, spending another Interval for each attempt.

Room interactions can set off a trap in the room unless it was found and disarmed first.

#### Room Interaction

**Interval — Test Varies**

Investigate, manipulate, or interact with a particular feature of the room.

Examples include deciphering an inscription, activating a magical glyph, moving furniture, operating a mechanism, or forcing a locked door.

The GM determines whether a test is required and which SPECIAL attribute applies.

Some rooms require multiple interactions to complete an objective. For example, opening a magical doorway might require activating three separate glyphs.

#### Rest

Resting moves one token from your bag into play: your profession’s resource if the bag has one, otherwise Expertise, otherwise a Critical Success.

**Interval**

Spend an Interval resting to recover **1 additional Resource token** from your bag into play.

Sealed tokens cannot be recovered.

#### Treat Conditions

**Interval — SPECIAL Test, Difficulty 6**

Spend an Interval treating yourself or another character. Consume the appropriate item, then the character receiving treatment makes the test, choosing either listed SPECIAL attribute where applicable.

On success, remove 1 matching condition token from the patient's bag. On failure, the token remains, but the consumable is spent.

| Condition | Required Item | SPECIAL |
| ----- | ----- | ----- |
| Wound | Bandage | Intelligence or Endurance |
| Poison | Antivenom | Strength or Endurance |
| Insanity | Laudanum | Perception or Charisma |
| Curse | Holy Water | Luck |
| Fatigue | Stimulant | Strength or Endurance |
| Fear | Liquid Courage | Charisma or Luck |

#### Keep Watch

Keeping watch adds +2 to your party’s Perception tests to spot enemies before a fight.

**Interval**

Watch for approaching enemies while the party explores or rests.

When determining whether enemies receive a surprise round, treat the current light level as **one level brighter**.

| Actual Light | Effective Light |
| ----- | ----- |
| Bright | Bright |
| Steady | Bright |
| Dim | Steady |
| Dark | Dim |

## 7. Torches and Light

Torches provide light during dungeon exploration and are consumed as Intervals pass.

### Torch Duration

Light is a modifier on every test, in the dungeon and in a fight: Bright +1, Steady 0, Dim −1, no torch −2. A dwarf’s darkvision counts no torch as dim. The party carries three spare torches between them.

A torch lasts **6 Intervals (60 minutes)**.

| Interval | Light Level |
| ----- | ----- |
| 1 | Bright |
| 2 | Steady |
| 3 | Steady |
| 4 | Steady |
| 5 | Dim |
| 6 | Dim |
| 7 onward | Dark |

Light levels affect how easily enemies can surprise the party.

### Lighting a Torch

At the beginning of any Interval, the party may light a new torch without spending an action.

The new torch replaces the currently active torch, which is extinguished even if it has time remaining.

The new torch begins at Bright and follows the normal six-Interval lifespan.

Only one torch determines the party's light level at a time.

## 8. Inventory and Equipment

Every character has **6 inventory slots**, separate from their equipped items.

Items occupy one inventory slot unless otherwise specified. Consumables of the same type can share a slot up to their stack limit.

Different item types cannot share a slot.

Items can be transferred between characters when circumstances permit. You cannot carry more than your available inventory slots.

Ordinary coins and insignificant personal belongings do not consume inventory space.

### Equipment Slots

For now each character has two hand slots, Main Hand and Off Hand. Weapons and shields are bought with your starting coins when you create your character. A shield adds 2 Shield (+2) tokens to your bag.

| Slot | Purpose |
| ----- | ----- |
| Main Hand | Weapon, shield, or held equipment |
| Off Hand | Secondary weapon, shield, or held equipment |
| Body | Armor |
| Accessory | Ring, amulet, or other special equipment |

Two-handed equipment occupies both hand slots.

Equipped items do not consume inventory space. Spare weapons, armor, and other equipment carried in your inventory do.

### Consumables

| Item | Stack Size | Effect |
| ----- | ----- | ----- |
| Torch | 3 | Provides light for 6 Intervals |
| Bandage | 3 | Used to treat Wounds |
| Antivenom | 2 | Used to treat Poison |
| Laudanum | 2 | Used to treat Insanity |
| Holy Water | 2 | Used to treat Curses |
| Stimulant | 2 | Used to treat Fatigue |
| Liquid Courage | 2 | Used to treat Fear |
| Health Potion | 2 | Restores 1 HP |
| Rations | 3 | Food for extended expeditions |

#### Using Consumables

During combat, using a consumable costs **1 action** unless otherwise specified.

During dungeon exploration, using a consumable generally requires an appropriate Interval action.

Lighting a torch is an exception and is free at the beginning of an Interval.

Consumables are removed from inventory when used.

### Tools and Exploration Equipment

| Item | Slots | Use |
| ----- | ----- | ----- |
| Rope | 1 | Climbing, descending, securing objects, crossing gaps |
| Thieves' Tools | 1 | Picking locks and manipulating delicate mechanisms |
| Climbing Gear | 1 | Pitons, hooks, and other equipment for difficult climbs |
| Crowbar | 1 | Forcing doors, opening containers, moving heavy objects |
| Writing Kit | 1 | Recording maps, copying inscriptions, making notes |

Tools provide practical capabilities rather than automatic numerical bonuses. The GM determines their reasonable applications.

### Treasure

Treasure occupies inventory space according to its size and bulk.

| Treasure Type | Inventory Treatment |
| ----- | ----- |
| Coins and small valuables | No slots unless found in unusually large quantities |
| Portable treasure | Usually 1 slot |
| Bulky treasure | Multiple slots or special handling |

Players may discard items to free inventory space or leave treasure behind to retrieve later.

## 9. Combat

Combat takes place in rounds.

On your turn, you may perform **2 actions**.

Actions include attacking, defending, changing engagement, and using abilities.

### Ability Types

Triggered abilities ask you when they come up. Fast abilities cost no action. An ability is greyed out when it has no valid target, and targets you cannot pick are listed but disabled.

| Type | Description |
| ----- | ----- |
| **Fight** | An action that includes an attack. Additional effects occur on a successful hit. |
| **Defend** | An action that includes a Defend test. |
| **Engage** | An action that changes engagement. |
| **Fast** | Costs no action and can be used during your turn. |
| **Triggered** | Costs no action and is used in response to a specified event. |
| **Interval** | An exploration action that takes one Interval. |

Abilities may combine action types, such as **Engage + Fight**, to perform both as one action.

### Attacking

Your weapon decides what an attack tests: sword and mace Strength, dagger Agility, shortbow Perception, magic staff Intelligence, bare hands Strength. A two-handed weapon does 1 extra damage. A ranged weapon can attack enemies you are not engaged with, but is at −2 against ones you are. Melee weapons can only attack enemies you are engaged with.

To attack an enemy, make a test using the appropriate SPECIAL attribute against the enemy's **Defense**.

On success, the attack hits and applies its damage and any additional effects.

Enemies have a single Defense value. Some enemies may have weaknesses or resistances that modify their Defense against particular attack types.

### Defending

You may spend an action to make a Defend test.

Add the result to your **Defend score** for the round. Multiple Defend actions can increase this score.

Enemy attacks occur automatically. Each attack has an Attack value and hit effects, usually damage.

You choose the order in which incoming attacks are resolved against your Defend score.

* Subtract an attack's Attack value from your available Defend score.
* If the score was sufficient to cover the attack, prevent its hit effects.
* Otherwise, reduce your remaining Defend score to 0 and suffer the attack's hit effects.

Your Defend score resets each round.

### Engagement

Changing engagement only takes a test if an enemy is engaged with you; otherwise you simply move. The test is Agility, with a Difficulty of 4, plus 1 for each enemy in the group you leave or join, minus 1 for each ally who stays behind, and never below 2. The Difficulty is shown for each destination.

Characters and enemies are organized into engagement groups. A group may contain multiple players and enemies.

For example, two players might be engaged with three enemies, while another player is engaged with a different enemy.

Changing engagement costs **1 action**.

On success, you may change your engagement as follows:

**Engage:** Move an enemy from its current engagement group into yours.

**Disengage:** Leave your current engagement group. As part of the same action, you may join another engagement group or form a new group containing only yourself.

On failure, your engagement remains unchanged.

An enemy that is not engaged with anyone spends its whole turn closing in on a player, and does nothing else. If it was knocked out of a group by a Shield Bash, it closes in on the one who did it; otherwise on a player of its choice.

### Starting Combat and Surprise

Each player makes one Perception test against the median notice Difficulty of the enemies. If anyone passes, the party sees the danger coming and the fight starts on even terms. If nobody does, every enemy gets a surprise round before the players act.

The GM determines the initial engagement groups based on the encounter and the circumstances when combat begins.

#### Surprise Round

If nobody in the party notices the enemies, the enemies receive a **Surprise Round**.

During the Surprise Round, each combatant on the surprising side may perform **1 action**. Surprised combatants do not act.

Afterward, combat proceeds normally.

## 10. Conditions

Conditions are represented by special tokens added to your bag.

All condition tokens have **−1, Chain**.

When you draw a condition token during a failed test, seal it on your character and apply its additional effect.

### Sealed Conditions

Sealed conditions remain attached to your character until released.

**At the end of each combat round**, you must release **1 sealed condition token of your choice**, if you have an eligible token.

You cannot release a condition that was sealed during your most recent turn. Every condition must remain active for at least one full turn.

**At the end of each dungeon Interval**, release all remaining sealed condition tokens. Combat counts as one Interval, so all remaining sealed conditions are released when combat ends.

Releasing a condition returns its token to your bag. It does not permanently remove the condition.

### Condition Effects

| Condition | Effect |
| ----- | ----- |
| **Wound** | While a Wound is sealed, drawing another Wound causes a Critical Failure and seals the new Wound. |
| **Poison** | When sealed, take 1 damage for each Poison currently sealed on you. |
| **Insanity** | While sealed, you cannot use Fast or Triggered abilities. |
| **Curse** | Automatically draw the sealed Curse on your next test. |
| **Fatigue** | While sealed, lose 1 action at the beginning of your turn, regardless of how many Fatigue tokens are sealed. |
| **Fear** | While sealed, you cannot attack enemies. |

#### Wounds

Wounds represent lasting physical injuries.

When you draw a Wound and have no Wounds sealed, it contributes −1 and Chains. If the test fails, seal the Wound.

If you already have a Wound sealed, drawing another Wound counts as a **Critical Failure** instead. Seal the newly drawn Wound.

This means a single Wound is relatively manageable, but accumulating multiple Wounds creates an increasing risk of automatic failure.

#### Poison

When a Poison token contributes to a failed test, seal it.

Then take **1 damage for every Poison token currently sealed on you**, including the newly sealed token.

#### Insanity

When an Insanity token contributes to a failed test, seal it.

While Insanity is sealed, you cannot use **Fast** or **Triggered** abilities.

#### Curse

When a Curse token contributes to a failed test, seal it.

Your next test automatically begins with the sealed Curse token, contributing −1 and Chaining into another token.

If that test fails, the Curse becomes sealed again. Otherwise, it returns to your bag normally.

If no further test occurs before the end of the Interval, the Curse is released normally.

#### Fatigue

When a Fatigue token contributes to a failed test, seal it.

At the start of your turn, if you have one or more Fatigue tokens sealed, lose **1 action**.

Multiple sealed Fatigue tokens do not increase the number of actions lost during a single turn.

#### Fear

When a Fear token contributes to a failed test, seal it.

While Fear is sealed, you cannot attack enemies. You may still defend, move, use items, and perform other actions.

### Removing Conditions

Condition tokens remain part of your character's collection until removed through treatment or another effect.

Successfully using Treat Conditions permanently removes one matching token.

## 11. Warrior

Warriors specialize in protecting allies, controlling enemies, and holding the line in battle.

**Starting HP:** 12

**Important SPECIAL:** Strength, Endurance, Agility

### Starting Tokens

A Warrior begins with the standard 15-token distribution, plus:

* **3 Resolve tokens**
* **3 combat tokens**, chosen in any combination of Armor and Power

Resolve, Armor, and Power are **+0, Chain, Resource** tokens.

All Resolve, Armor, and Power tokens begin in play.

### Warrior Resources

| Token | Effect when spent |
| ----- | ----- |
| **Resolve** | Activate Warrior abilities |
| **Armor** | Add +1 to a Defend result |
| **Power** | Add +1 to an Attack result |
| **Expertise** | Spend as Resolve, Armor, or Power |

Armor and Power must be spent before drawing tokens for their respective tests.

Multiple Armor or Power tokens may be spent on the same test.

When you draw Resolve, Armor, Power, or Expertise during any test, put it in play after resolving the test.

Spending a resource normally returns it to your bag. Some abilities instead seal the resource.

A Critical Success token in play counts as 2 Expertise and must be spent or sealed as a single token.

### Warrior Abilities

At character creation, choose **4 Warrior abilities**.

Resources spent on Fight abilities are committed before drawing tokens for the attack. If the attack fails, those resources return to the bag.

#### Provoke

Provoke can target any enemy in the room, not only the ones you are engaged with.

**Fight — 1 Resolve**

Make an attack against an enemy.

On success, deal damage normally, seal the Resolve on the enemy, and apply **Provoked**.

While Provoked:

* The enemy becomes engaged with you, joining your engagement group.
* Its attacks that would normally affect every player in the room instead affect only you.

#### Disable

**Fight — 1 Resolve**

Make an attack against an enemy.

On success, deal damage normally, seal the Resolve on the enemy, and apply **Disabled**.

While Disabled, reduce damage from the enemy's attacks by 1 for each Resolve you have sealed on it, to a minimum of 0.

#### Cleave

**Triggered — 1 Resolve**

When you defeat an enemy with an attack, spend 1 Resolve to immediately make another attack against a different enemy you can reach.

#### Intercept

**Triggered — 1 Resolve**

When an enemy attacks an ally in your room, spend 1 Resolve to become the target instead.

Gain +2 Defend against that attack.

#### Shield Wall

**Defend — 1 Resolve**

Spend 1 Resolve and make a normal Defend test.

You may use your resulting Defend score to protect yourself and allies in your engagement group.

You choose which incoming attacks consume your Defend score.

#### Shield Bash

**Fight — 1 Resolve**

Make an attack against an enemy you are engaged with.

On success, deal damage normally and knock the enemy out of its engagement group. It is no longer engaged with anyone, so on its next turn it can only close in on you.

#### Sweeping Blow

**Fight — 2 Resolve**

Make one attack against every enemy in your engagement group. Compare the single result with each enemy's Defense, and deal damage to every enemy it reaches.

#### Last Stand

**Triggered — 1 Resolve**

When you drop to 0 HP, stay at 1 HP instead.

### Warrior Exploration Abilities

#### Fortify

Everyone in the party begins combat with +2 Defend, not just the Warrior.

**Interval**

Prepare the current room for defense. If combat begins in this room before the party leaves, **everyone in the party** begins combat with **+2 Defend**.

#### Secure Area

**Interval — 1 Resolve**

Watch every approach to the current room. If combat begins here before the party leaves, nobody can be surprised.

#### Barricade

**Interval — 1 Resolve**

Block the doors and passages with whatever is at hand. The patrol takes 3 Intervals longer to find the party. It can be used again for another 3.

#### Shoulder Through

**Interval — 1 Resolve**

Room interaction: put your weight behind a locked door. Make a Strength test against the door's break Difficulty minus 2. A failure draws no Complication.

#### Steel Nerves

**Interval — Liquid Courage**

Use up a Liquid Courage to talk an ally down. Remove 1 Fear token from their bag. No test is needed.

#### Hearty Meal

**Interval — Ration**

Use up a Ration and feed the party. Everyone recovers 1 HP and removes 1 Fatigue token from their bag.

### Sealed Resolve

Some Warrior abilities seal Resolve on enemies to maintain conditions.

* Sealed Resolve remains attached until released by an effect or the enemy is defeated.
* Conditions remain active while you have at least one Resolve sealed on the enemy.
* Different conditions applied by the same Warrior share the same pool of sealed Resolve.
* Disable reduces damage based on the total number of Resolve tokens that Warrior has sealed on the enemy.
* When an enemy is defeated, release all sealed tokens and return them to their owners' bags.

**Example:** A Warrior uses Disable on an Ogre, sealing 1 Resolve and reducing its attack damage by 1.

Later, the Warrior successfully uses Provoke on the same Ogre, sealing another Resolve.

The Ogre is now both Provoked and Disabled. Its attack damage is reduced by 2 because the Warrior has 2 Resolve sealed on it.

The conditions remain until the sealed Resolve is released.

## 12. Rogue

Rogues are agile and opportunistic adventurers who specialize in mobility, precision attacks, and exploiting weaknesses.

They excel at moving between engagement groups, striking vulnerable enemies, and scouting dangerous locations.

**Starting HP:** 10

**Important SPECIAL:** Agility, Perception, Charisma

### Starting Tokens

A Rogue begins with the standard 15-token distribution, plus:

* **3 Cunning tokens**

Cunning tokens are **+0, Chain, Resource** tokens.

All 3 Cunning tokens begin in play.

### Cunning

Cunning represents a Rogue's quick thinking, precision, and ability to exploit opportunities.

When you draw Cunning during a test, put it in play after resolving the test.

Spend Cunning to activate Rogue abilities. Spent Cunning returns to your bag unless an ability instructs you to seal it.

Expertise may be spent as Cunning. A Critical Success token in play counts as 2 Expertise.

### Rogue Abilities

At character creation, choose **4 Rogue abilities**.

#### Backstab

**Engage + Fight — 1 Cunning**

You must not be engaged when using this ability.

Engage an enemy without making an engagement test, then attack it.

On success, deal **2 additional damage**.

#### Slip Away

**Fast — 1 Cunning**

Change your engagement without spending an action or making an engagement test.

You may join another engagement group or remain unengaged.

#### Cheap Shot

**Fight — 1 Cunning**

Make an attack against an enemy.

On success, deal damage normally, seal the Cunning on the target, and apply **Exposed**.

While Exposed, reduce the enemy's Defense by 1 for each Cunning you have sealed on it.

#### Flanking

**Triggered — No cost**

Once per combat round, when you successfully attack an enemy in an engagement group containing at least one of your allies, **recover 1 Cunning**.

#### Opportunist

**Triggered — 1 Cunning**

When an ally defeats an enemy in your engagement group, spend 1 Cunning to immediately make an attack against another enemy in that group.

### Rogue Exploration Abilities

#### Scout Ahead

**Interval**

Carefully scout an adjacent room without entering it.

The GM reveals its obvious occupants, hazards, and notable features that you can reasonably observe from your position.

#### Case the Joint

**Interval**

Study a room, building, or location to identify opportunities for infiltration or theft.

The GM reveals one useful detail about its security, inhabitants, valuables, or potential entry and escape routes.

#### Set an Ambush

**Interval**

Prepare an ambush in your current room.

If enemies enter the room before the party leaves, you may make **one free attack** against an entering enemy at the beginning of combat.

#### Find a Shortcut

**Interval**

Search for an alternative route through the surrounding area.

If a hidden or overlooked route exists nearby, the GM reveals it. This may include concealed passages, narrow openings, rooftops, or other ways to bypass obstacles.

### Sealed Cunning

Some Rogue abilities seal Cunning on enemies to maintain conditions.

* Sealed Cunning remains attached until released by an effect or the enemy is defeated.
* Conditions remain active while you have at least one Cunning sealed on the enemy.
* Different conditions applied by the same Rogue share the same pool of sealed Cunning.
* Exposed reduces Defense based on the total number of Cunning tokens that Rogue has sealed on the enemy.
* When an enemy is defeated, release all sealed tokens and return them to their owners' bags.

## 13. Priest

Priests are healers and spiritual guides who use divine power to restore health, remove afflictions, and strengthen their allies.

Their abilities are especially valuable during long dungeon expeditions, where wounds, limited supplies, and time pressure can gradually wear down the party.

**Starting HP:** 8

**Important SPECIAL:** Charisma, Intelligence, Endurance

### Starting Tokens

A Priest begins with the standard 15-token distribution, plus:

* **3 Faith tokens**

Faith tokens are **+0, Chain, Resource** tokens.

All 3 Faith tokens begin in play.

### Faith

Faith represents the Priest's spiritual power and devotion.

When you draw Faith during a test, put it in play after resolving the test.

Spend Faith to activate Priest abilities. Spent Faith returns to your bag unless otherwise specified.

Expertise may be spent as Faith. A Critical Success token in play counts as 2 Expertise.

### Priest Abilities

At character creation, choose **4 Priest abilities**.

#### Heal

**Action — 1 Faith**

Restore **2 HP** to yourself or another character in your room.

#### Bless

**Fast — 1 Faith**

Add 1 **Bless (+2, Chain)** token to an ally's bag.

When the Bless token is drawn, it contributes +2 and Chains. After resolving the test, remove the Bless token.

Bless tokens remain in the recipient's bag until drawn. There is no limit to the number of Bless tokens a character may have.

#### Cleanse

**Action — 1 Faith**

Release all sealed condition tokens from yourself or another character in your room.

Released conditions return to their owner's bag.

#### Smite

**Fight — 1 Faith**

Make an attack against an enemy.

On success, deal normal damage plus **2 additional damage** if the target is undead or another supernatural creature vulnerable to divine power.

#### Prayer

**Triggered — 2 Faith**

When an ally fails a test, spend 2 Faith to add **+2** to their result, potentially turning the failure into a success.

Prayer cannot overcome an automatic Critical Failure.

#### Divine Intervention

**Triggered — 1 Faith**

When an ally would gain a condition token from an enemy attack, spend 1 Faith to prevent that condition token from being added.

### Priest Exploration Abilities

#### Tend the Afflicted

**Interval**

Perform a Treat Conditions action without requiring the patient to make a test.

The appropriate consumable is still required and is consumed normally.

#### Holy Light

**Interval**

Light a new torch, enhancing it with divine light.

The torch provides:

* **Bright:** 3 Intervals
* **Steady:** 3 Intervals
* **Dim:** 2 Intervals

The enhanced torch lasts **8 Intervals** in total.

This ability consumes one ordinary torch and replaces the currently active torch.

#### Group Heal

**Interval**

Restore **1 HP to every member of the party**.

## 14. Wizard

Wizards are practitioners of powerful arcane magic. They can unleash devastating attacks, manipulate the battlefield, and uncover magical secrets.

Wizards begin with a large reserve of Mana, but replenishing it takes time or requires successful tests. Powerful spells can consume considerable resources and sometimes impose additional consequences.

**Starting HP:** 8

**Important SPECIAL:** Intelligence, Perception, Endurance

### Starting Tokens

A Wizard begins with the standard 15-token distribution, plus:

* **6 Mana tokens**

Mana tokens are **+0, Chain, Resource** tokens.

All 6 Mana tokens begin in play.

### Mana

Mana represents the Wizard's available magical power.

Unlike other profession resources, Mana drawn during a test is only put in play if the test succeeds.

If the test fails, drawn Mana returns to the bag.

Mana can also be recovered through Rest and certain Wizard abilities.

Expertise may be spent as Mana. A Critical Success token in play counts as 2 Expertise.

### Wizard Abilities

At character creation, choose **4 Wizard abilities**.

#### Magic Missile

**Action — 1 Mana**

Deal **1 damage** to an enemy in your room that you are not engaged with.

No attack test is required.

#### Fireball

A Fireball makes one Intelligence draw and compares the result with every enemy’s Defense in the group.

**Fight — X Mana**

Choose an engagement group in your room and spend X Mana.

Make an Intelligence attack against each enemy in that engagement group, using each enemy's Defense.

Each enemy successfully hit takes **X damage**.

All allied characters in the targeted engagement group automatically take X damage.

For every **3 Mana spent**, add 1 Fatigue token to your bag.

| Mana Spent | Damage | Fatigue Gained |
| ----- | ----- | ----- |
| 1 | 1 | 0 |
| 2 | 2 | 0 |
| 3 | 3 | 1 |
| 4 | 4 | 1 |
| 5 | 5 | 1 |
| 6 | 6 | 2 |

#### Chain Lightning

**Fight — Escalating Mana**

Choose an enemy and make an Intelligence attack against its Defense.

On success, deal **2 damage**.

You may spend additional Mana to attack another enemy, with the cost increasing for each additional target.

Each target must be different, and each requires a separate Intelligence attack test.

| Target | Additional Mana | Total Mana |
| ----- | ----- | ----- |
| First | 1 | 1 |
| Second | 2 | 3 |
| Third | 3 | 6 |

You may decide whether to continue to another target after resolving the previous attack.

#### Transpose

**Action — 1 Mana**

Choose another character or enemy in your room.

Exchange engagement groups with that target without making an engagement test.

#### Arcane Focus

**Action — 0 Mana**

Draw exactly **5 tokens** from your bag without resolving a normal test.

* **Mana:** Put each Mana token drawn into play.
* **Complication:** Take 1 damage for each Complication drawn.
* **All other tokens:** Return them to the bag without activating their effects.

Chain effects are ignored during Arcane Focus. You always draw exactly 5 tokens.

Arcane Focus only recovers Mana. It cannot recover Expertise or other Resource tokens.

### Wizard Exploration Abilities

#### Detect Magic

**Interval**

Reveal the presence and approximate location of magical effects, enchantments, and supernatural features in the current room.

#### Identify

**Interval**

Examine a magical item, inscription, or mechanism to learn its magical properties and purpose.

#### Dispel Magic

**Interval — Intelligence Test**

Attempt to suppress or remove a magical effect in the current room.

The GM determines the Difficulty based on the strength and nature of the effect.

#### Scry

**Interval**

Magically observe an adjacent room or a nearby location you have previously visited without physically entering it.

The GM describes what you can perceive through the magical observation.

<!-- reference:start -->

## 15. Reference

These tables are generated from the app's data by `npm run rules:sync`. Do not edit them by hand; change `src/data` instead.

### Hands and Weapons

Each character has two hand slots, Main Hand and Off Hand. A two-handed weapon does 1 extra damage. A ranged weapon can attack enemies you are not engaged with, and is at -2 against ones you are.

| Item | Coins | Hands | Attacks test | Notes |
| --- | --- | --- | --- | --- |
| Sword | 2 | 1 | Strength | Attacks test Strength. |
| Mace | 2 | 1 | Strength | Attacks test Strength. |
| Dagger | 1 | 1 | Agility | Attacks test Agility. |
| Greataxe | 3 | 2 | Strength | Two-handed. Attacks test Strength and do 1 extra damage. |
| Shortbow | 3 | 2 | Perception | Two-handed and ranged. Attacks test Perception and do 1 extra damage. Can hit enemies you are not engaged with, but is at -2 against ones you are. |
| Magic Staff | 3 | 2 | Intelligence | Two-handed. Attacks test Intelligence and do 1 extra damage. |
| Shield | 2 | 1 | none | Adds 2 Shield (+2) tokens to your bag. Each one you draw soaks up damage until it is used. |

### Starting Equipment

Characters start with 10 coins.

| Item | Coins | Effect |
| --- | --- | --- |
| Torch | 1 | Lights the way underground. Burns Bright for 1 Intervals, Steady for 3, then Dim for 2 before going out. |
| Ration | 1 | Food and water for one day of travel. |
| Bandage | 2 | Treats a Wound. Also restores 2 HP when applied outside of combat. |
| Antivenom | 3 | Treats Poison. |
| Laudanum | 3 | Treats Insanity. |
| Holy Water | 3 | Treats a Curse. |
| Stimulant | 2 | Treats Fatigue. |
| Liquid Courage | 2 | Treats Fear. |
| Smoke Bomb | 3 | Fills a room with thick smoke. Those inside cannot be seen from outside until it clears. |
| Healing Potion | 5 | Restore 4 HP when drunk. Can be used as a Fast action. |

### Torch Burn Times

Intervals spent at each light level before the torch goes out.

| Torch | Bright | Steady | Dim |
| --- | --- | --- | --- |
| Torch | 1 | 3 | 2 |
| Holy torch | 3 | 3 | 2 |

### Tutorial Bestiary

Enemies have no token bag and make no tests. Notice is the Perception Difficulty to spot the enemy before it strikes.

| Enemy | HP | Defense | Notice | Attacks | Notes |
| --- | --- | --- | --- | --- | --- |
| Goblin Scout | 3 | 3 | 6 | **Rusty Knife**: attack 4, damage 1 | **Opportunist**: When a character engaged with it draws a Complication, lunges at them. **Poisoned Blade**: When an engaged character draws a Complication, they gain 1 Poison token. |
| Cave Troll | 4 | 5 | 3 | **Club Smash**: attack 6, damage 2, adds Wound; **Ground Slam**: attack 3, damage 1, hits the whole room | **Bellow**: When a character engaged with it draws a Complication, flies into a rage: +2 attack value until the end of the round. |
| Skeleton Guard | 2 | 3 | 6 | **Bone Claws**: attack 4, damage 1 | **Clatter**: When a character engaged with it draws a Complication, its bones rattle in fury: +1 attack value until the end of the round. Supernatural: Smite does extra damage. |
| Bone Colossus | 10 | 6 | 2 | **Crushing Fist**: attack 7, damage 2 | **Grinding Rage**: When a character engaged with it draws a Complication, its joints grind and it hits harder: +2 attack value until the end of the round. Starts engaged with everyone. Pulls everyone back into its group at the end of its turn. Supernatural: Smite does extra damage. |
| Barrow Warden | 7 | 5 | 5 | **Rusted Greatsword**: attack 6, damage 2; **Grave Chill**: attack 3, damage 1, hits the whole room, adds Fear | **Undying**: When anyone in the room draws a Complication, the Warden knits itself back together and regains 1 HP. Supernatural: Smite does extra damage. |

<!-- reference:end -->
