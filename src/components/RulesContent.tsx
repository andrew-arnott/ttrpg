import type { ReactNode } from 'react'
import type { Block } from '../lib/markdown'

/** Renders **bold**, *italic* and `code` within a line of the guide. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let key = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const token = match[0]
    if (token.startsWith('**')) parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) parts.push(<code key={key++}>{token.slice(1, -1)}</code>)
    else parts.push(<em key={key++}>{token.slice(1, -1)}</em>)
    last = at + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** A run of guide blocks. */
export function RulesContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="rules-content">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${Math.min(6, block.level + 1)}` as 'h3'
            return (
              <div key={i} id={`rules-${block.slug}`} className="rules-heading">
                <Tag>{block.text}</Tag>
              </div>
            )
          }
          case 'paragraph':
            return <p key={i}>{inline(block.text)}</p>
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul'
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </List>
            )
          }
          case 'table':
            return (
              <div key={i} className="rules-table-wrap">
                <table className="rules-table">
                  <thead>
                    <tr>
                      {block.header.map((h, j) => (
                        <th key={j}>{inline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>{inline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
