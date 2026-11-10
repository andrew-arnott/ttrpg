import { useEffect, useState } from 'react'
import { searchSections, sectionOf, tableOfContents, topSectionSlug } from '../lib/markdown'
import { GUIDE_BLOCKS } from '../lib/rulesGuide'
import { readRulesSlug } from '../lib/useView'
import { RulesContent } from './RulesContent'

function useRulesSlug(): string | null {
  const [slug, setSlug] = useState(readRulesSlug)
  useEffect(() => {
    const onChange = () => setSlug(readRulesSlug())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return slug
}

const contents = tableOfContents(GUIDE_BLOCKS)
const titleOf = (slug: string) => contents.find((h) => h.slug === slug)?.text ?? slug

/** The whole Player's Guide to browse, with a contents list, search. */
export function RulesView() {
  const slug = useRulesSlug()
  const [query, setQuery] = useState('')
  const top = slug ? (topSectionSlug(GUIDE_BLOCKS, slug) ?? contents[0].slug) : contents[0].slug
  const results = searchSections(GUIDE_BLOCKS, query)

  useEffect(() => {
    if (!slug) return
    document.getElementById(`rules-${slug}`)?.scrollIntoView({ block: 'start' })
  }, [slug])

  return (
    <div className="layout rules-layout">
      <aside className="sidebar rules-toc">
        <section className="card">
          <label className="prompt-target" style={{ marginTop: 0 }}>
            <span className="step-index">Search the rules</span>
            <input
              type="search"
              value={query}
              placeholder="Try &ldquo;engagement&rdquo; or &ldquo;torch&rdquo;"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <nav aria-label="Rules contents">
            <ul className="rules-toc-list">
              {contents
                .filter((h) => h.level === 2)
                .map((h) => (
                  <li key={h.slug}>
                    <a
                      href={`#/rules/${h.slug}`}
                      className={top === h.slug ? 'current' : undefined}
                      aria-current={top === h.slug ? 'page' : undefined}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
            </ul>
          </nav>
        </section>
      </aside>

      <main>
        {query.trim() ? (
          <section className="card">
            <div className="card-head">
              <span className="step-index">Search</span>
              <h2>
                {results.length} {results.length === 1 ? 'section' : 'sections'} for &ldquo;{query.trim()}&rdquo;
              </h2>
            </div>
            <ul className="rules-results">
              {results.map((h) => (
                <li key={h.slug}>
                  <a
                    href={`#/rules/${h.slug}`}
                    onClick={() => setQuery('')}
                  >
                    {h.text}
                  </a>
                  <span className="hint"> in {titleOf(topSectionSlug(GUIDE_BLOCKS, h.slug) ?? h.slug)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="card">
            <RulesContent blocks={sectionOf(GUIDE_BLOCKS, top)} />
          </section>
        )}
      </main>
    </div>
  )
}

