# ttrpg character creator

A character creator for a fantasy tabletop RPG of strategy, exploration, and adventure.
Static React site, deployed to GitHub Pages.

**https://andrew-arnott.github.io/ttrpg/**

## What it does

A six-step wizard, one step per screen, with a live summary alongside:

1. **Profession** — sets starting HP and profession tokens
2. **Species** — attribute bonus, traits, and token bag modifications
3. **Background** — +1 to an attribute and a passive ability
4. **SPECIAL** — distribute the fixed array `1, 2, 2, 2, 3, 3, 3`; species and background bonuses are already shown on top
5. **Abilities** — profession resource allocation and ability picks
6. **Review** — the finished sheet, with JSON export

Each step validates independently and blocks *Next* with the specific reason. Changing an earlier
answer that invalidates a later step pulls you back rather than stranding you.

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
