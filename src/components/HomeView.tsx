import { artUrl } from '../lib/art'
import type { ViewId } from '../lib/useView'

interface Destination {
  view: Exclude<ViewId, 'home'>
  title: string
  art: Parameters<typeof artUrl>
  text: string
  action: string
}

const DESTINATIONS: Destination[] = [
  {
    view: 'creator',
    title: 'Create a character',
    art: ['portrait', 'rogue-2'],
    text: 'Choose a profession, species and background, spread your SPECIAL scores, pick abilities and gear, and give your adventurer a face.',
    action: 'Start creating',
  },
  {
    view: 'dungeon',
    title: 'Try the tutorial dungeon',
    art: ['item', 'torch'],
    text: 'Lead a party through The Sunken Crypt with a torch burning down. Doors, traps, a patrol and a boss teach how the game plays.',
    action: 'Enter the dungeon',
  },
  {
    view: 'rules',
    title: 'Read the rules',
    art: ['profession', 'priest'],
    text: 'The complete rules, searchable and organised by topic, from making tests to combat and every profession.',
    action: 'Open the rules',
  },
  {
    view: 'bag',
    title: 'Explore the token bag',
    art: ['item', 'pouch'],
    text: 'Every test draws from a bag of tokens. Draw from a character\u2019s bag and see the exact odds.',
    action: 'Draw tokens',
  },
  {
    view: 'sheet',
    title: 'View a character sheet',
    art: ['portrait', 'warrior-1'],
    text: 'A printable sheet for any character you have made, saved or loaded.',
    action: 'See the sheet',
  },
]

interface Props {
  savedCount: number
  onGo: (view: Exclude<ViewId, 'home'>) => void
  onOpenCharacters: () => void
}

/** The landing page: what this site is and where to go next. */
export function HomeView({ savedCount, onGo, onOpenCharacters }: Props) {
  return (
    <div className="home">
      <section className="card home-hero">
        <h2>Welcome, adventurer</h2>
        <p>
          A fantasy tabletop roleplaying game of strategy, exploration and adventure. Make a character, learn the rules by
          playing a short dungeon, or look something up. Everything runs in your browser.
        </p>
        <div className="home-hero-actions">
          <button className="btn primary" onClick={() => onGo('creator')}>
            Create a character
          </button>
          <button className="btn" onClick={() => onGo('dungeon')}>
            Play the tutorial
          </button>
          {savedCount > 0 && (
            <button className="btn" onClick={onOpenCharacters}>
              Your characters ({savedCount})
            </button>
          )}
        </div>
      </section>

      <ul className="home-grid" aria-label="Where to go">
        {DESTINATIONS.map((d) => {
          const src = artUrl(...d.art)
          return (
            <li key={d.view} className="card home-card">
              {src && <img className="portrait md" src={src} alt="" width={256} height={256} draggable={false} />}
              <div>
                <h3>{d.title}</h3>
                <p>{d.text}</p>
                <button className="btn" onClick={() => onGo(d.view)}>
                  {d.action}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
