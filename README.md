# ttrpg character creator

A character creator for a fantasy tabletop RPG of strategy, exploration, and adventure.
Static React site, deployed to GitHub Pages.

**https://andrew-arnott.github.io/ttrpg/**

## What it does

Walks the four character creation steps from the Player's Guide and computes the result live:

1. **Profession** — sets starting HP and profession tokens
2. **SPECIAL** — distribute the fixed array `1, 2, 2, 2, 3, 3, 3`
3. **Species** — attribute bonus, traits, and token bag modifications
4. **Background** — +1 to an attribute and a passive ability

Then profession resource allocation and ability selection.

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

- `choose 4 abilities` is read as applying to the combat ability list only. Exploration abilities
  are granted in full, since the guide attaches no choice language to them.

## Layout

```
src/
  data/        transcribed rules — types, tokens, species, backgrounds, professions
  lib/         buildCharacter.ts — pure calculation, fully unit-tested
  components/  wizard steps, token bag chart, summary sidebar
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
