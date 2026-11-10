import { useState, type ReactNode } from 'react'
import { RulesDialog } from './RulesDialog'

/** A link that opens a section of the rules in a popup, leaving whatever the player is doing in place. */
export function RulesLink({ slug, children }: { slug: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <RulesDialog slug={slug} onClose={() => setOpen(false)} />}
    </>
  )
}
