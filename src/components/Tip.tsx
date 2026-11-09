import type { ReactNode } from 'react'

/** Wraps something so a text box appears the moment it is hovered or focused. */
export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="tip">
      {children}
      <span className="tip-box" role="tooltip">
        {content}
      </span>
    </span>
  )
}
