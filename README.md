# ttrpg character creator

A character creator for a fantasy tabletop RPG of strategy, exploration, and adventure.
Static React site, deployed to GitHub Pages.

**https://andrew-arnott.github.io/ttrpg/**

## What it does

A seven-step wizard, one step per screen, with a live summary alongside:

1. **Profession** — sets starting HP and profession tokens
2. **Species** — attribute bonus, traits, and token bag modifications
3. **Background** — +1 to an attribute and a passive ability
4. **SPECIAL** — distribute the fixed array `1, 2, 2, 2, 3, 3, 3`; species and background bonuses are already shown on top
5. **Abilities** — profession resource allocation and ability picks
6. **Equipment** — spend 10 starting coins on basic consumables
7. **Review** — the finished sheet, with JSON export

Each step validates independently and blocks *Next* with the specific reason. Changing an earlier
answer that invalidates a later step pulls you back rather than stranding you.

Around the wizard are four sections, switched with the tabs under the title (the active one is kept
in the URL hash, so each is linkable):

- **Create** — the wizard above.
- **Sheet** — a printable character sheet. *Print sheet* hides everything but the sheet.
- **Token Bag** — draws tokens from a character's bag with an animated pouch and coin reveal, using
  the real draw rule, plus a "run 5,000 tests" check against the exact odds.
- **Dungeon** — a pre-made dungeon (The Sunken Crypt) to learn the game in. Pick up to four characters
  (yours, saved, or ready-made samples), then explore with the torch ticking down. Right-click a torch
  in a character's pack to light a new one.

### Saved characters

*Save* stores the current character in this browser's `localStorage`; *Characters* lists, loads and
deletes them. JSON export/import still works for moving a character between browsers.

### Equipment and torches

The guide doesn't price equipment yet, so costs and effects in `src/data/items.ts` are proposals:
Torch 1, Ration 1, Bandage 2, Antidote 3, Smoke Bomb 3, Healing Potion 5 coins. Weapons and armor are
not included.

An ordinary torch burns Bright for 1 Interval, Steady for 3, then Dim for 2. The Priest's Holy Light
lights a torch that burns Bright 3, Steady 3, Dim 2 (8 Intervals) instead, consuming one ordinary torch.

### Dungeon intervals

The party starts with one lit torch. Time passes in **Intervals**:

- **Moving** to an adjacent room takes an Interval.
- Otherwise, each Interval every character chooses what they want to do, and the choices resolve in
  party order, followed by the torch burning down one step. Light reach depends on the torch: Bright
  shows rooms two doorways away, Steady one, Dim only the room you are in.
- Right-clicking a torch in a pack lights it straight away, replacing the burning one, without using
  an Interval.

Actions on offer:

- **Search the room** — a Perception test to uncover whatever is hidden there.
- **Rest** — regain 1 of your profession's resource (Resolve, Cunning, Faith or Mana), up to 2 above
  what you started with.
- **Keep watch.**
- **Room interaction** — a one-off thing to try in the current room, such as studying the runes on the
  floor.
- **Class abilities** — any Interval ability the character chose: Fortify, Stand Watch, Barricade,
  Secure Area, Scout Ahead, Case the Joint, Set an Ambush, Find a Shortcut, Tend the Afflicted, Holy
  Light, Group Heal, Detect Magic, Identify, Dispel Magic and Scry.

Tests draw from the character's token bag with the same rule as the simulator. The total is the token
sum plus the relevant SPECIAL value against a Difficulty set per room (see `src/data/dungeon.ts`).
Critical Success always passes and Critical Failure always fails. Working with the torch out adds 3 to
the Difficulty. Resolution plays back as an animation with a text summary of what happened.

### Art

Portraits and item icons in `src/assets/art/` are AI-generated pixel art in a 16-bit RPG style, one per
profession, species, background and item.

### Token bag

The interesting output is the **computed token bag**, since species and profession both mutate it.
The app shows its composition, and derives the draw statistics exactly rather than by simulation:

> A test draws without replacement until it hits a token that ends the draw. Over a random
> permutation of the bag, a terminator is drawn iff it is the *first* terminator — probability
> `1/T`. A Chain token is drawn iff it precedes every terminator — probability `1/(T+1)`.
> Summing `modifier × P` over the bag gives the expected contribution in closed form.

This makes the guide's own claims legible — an Elf's 12-token bag crits 11.1% of the time against
a Dwarf's 18-token bag at 6.7%.

Profession resources (Resolve, Cunning, Faith, Mana…) are tracked separately from the bag, because
the guide says they **begin in play** — they don't affect draw odds until spent and returned.

## Rules source

Mechanics are transcribed from the Player's Guide
([Google Doc](https://docs.google.com/document/d/16-xrm3KVDGWmuVW1UfH9IF17kV4Im290kI-HbF0sktY/edit)).
The doc is the source of truth; `src/data/` is a transcription of it.

**Ranger and Berserker are listed as TBD** in the guide — no starting HP, tokens, or abilities. They
appear in the UI as unselectable rather than being invented. Filling them in means editing
`src/data/professions.ts` only; set `defined: true` and they become selectable.

### Interpretation calls

- `choose 4 abilities` draws from the combat and exploration lists **together** — the four picks
  come from one combined pool.

## Layout

```
src/
  data/        transcribed rules — types, tokens, species, backgrounds, professions, items, dungeon
  lib/         pure logic, unit-tested — character building, token draws, torch, dungeon state, storage
  components/  wizard steps, sheet, simulators, dungeon map, summary sidebar
  assets/art/  generated portraits and item icons
```

`src/lib/` has no React imports; all the rules maths is testable in isolation.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build
```

Pushing to `main` builds, tests, and deploys via `.github/workflows/deploy.yml`.
