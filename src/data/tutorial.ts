/** Text that frames the tutorial dungeon for someone new to the game. */

export const TUTORIAL_GOAL =
  'Get through the locked door, break the Founders\u2019 Seal on the crypt, and defeat whatever guards it.'

export const TUTORIAL_INTRO = [
  'This dungeon is a guided tutorial, not the full game. Real play is a tabletop RPG: a GM describes the world, you can try almost anything, and the GM decides which test, if any, fits.',
  'Here the options are laid out for you so you can see how the pieces fit together: torches and Intervals as a ticking clock, tests drawn from your token bag, exploring and searching, and combat with engagement groups and Defense.',
]

export const TUTORIAL_OUTRO = [
  'You broke the seal, beat the Warden, and finished the tutorial.',
  'In a real game you will have far more freedom. You might talk your way past the goblins, sneak around the troll, take the door off its hinges, or try something nobody planned for. The GM decides what is possible and which test applies. This dungeon just shows how the rules work underneath.',
]

export const ENGAGE_HELP = {
  title: 'Changing engagement',
  paragraphs: [
    'Fighters and enemies stand in engagement groups. You can only attack enemies in your own group, and enemies mostly attack whoever is in theirs.',
    'Changing engagement costs one action. You can join another group, or break away to stand alone. If no enemy is engaged with you, you simply move. If one is, it takes an Agility test.',
    'Enemies in the group you are leaving try to hold you in place, and any enemies in the group you are joining make the move harder. Allies who stay behind cover your escape and make it easier.',
    'The Difficulty starts at 4, goes up by 1 for each enemy you are leaving or joining, and goes down by 1 for each ally in the group you leave. It is never lower than 2.',
  ],
}
