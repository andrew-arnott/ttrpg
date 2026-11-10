/**
 * Where this app plays a rule differently from the Player's Guide text, or adds to it. Shown under the
 * matching heading in the rules browser. The key is the heading's slug.
 */
export const RULES_NOTES: Record<string, string> = {
  resource:
    'Resource tokens only come into play from a successful test, or by resting. A failed test leaves them in the bag.',
  complications:
    'By default, a failed test that draws a Complication costs you a token in play, returned to your bag. Enemies, rooms and traps add their own consequences on top.',
  rest: 'Resting moves one token from your bag into play: your profession\u2019s resource if the bag has one, otherwise Expertise, otherwise a Critical Success.',
  investigate:
    'Search is called Investigate. It is one Perception test, and everything hidden at or below your result turns up: secrets, traps and hidden passages. Room interactions set off a trap in the room until it has been found and disarmed.',
  'keep-watch': 'Keeping watch adds +2 to your party\u2019s Perception tests to spot enemies before a fight.',
  'torch-duration':
    'Light is a modifier on every test, in the dungeon and in a fight: Bright +1, Steady 0, Dim \u22121, no torch \u22122. A dwarf\u2019s darkvision counts no torch as dim. The party carries three spare torches between them.',
  'equipment-slots':
    'For now each character has two hand slots, Main Hand and Off Hand. Weapons and shields are bought with your starting coins when you create your character. A shield adds 2 Shield (+2) tokens to your bag.',
  attacking:
    'Your weapon decides what an attack tests: sword and mace Strength, dagger Agility, shortbow Perception, magic staff Intelligence, bare hands Strength. A two-handed weapon does 1 extra damage. A ranged weapon can attack enemies you are not engaged with, but is at \u22122 against ones you are. Melee weapons can only attack enemies you are engaged with.',
  engagement:
    'Changing engagement only takes a test if an enemy is engaged with you; otherwise you simply move. The test is Agility, with a Difficulty of 4, plus 1 for each enemy in the group you leave or join, minus 1 for each ally who stays behind, and never below 2. The Difficulty is shown for each destination.',
  'starting-combat-and-surprise':
    'Each player makes one Perception test against the median notice Difficulty of the enemies. If anyone passes, the party sees the danger coming and the fight starts on even terms. If nobody does, every enemy gets a surprise round before the players act. The concealment table below is not used.',
  fireball: 'A Fireball makes one Intelligence draw and compares the result with every enemy\u2019s Defense in the group.',
  provoke: 'Provoke can target any enemy in the room, not only the ones you are engaged with.',
  fortify: 'Everyone in the party begins combat with +2 Defend, not just the Warrior.',
  'ability-types':
    'Triggered abilities ask you when they come up. Fast abilities cost no action. An ability is greyed out when it has no valid target, and targets you cannot pick are listed but disabled.',
}
