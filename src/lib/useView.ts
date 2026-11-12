import { useCallback, useEffect, useState } from 'react'

export const VIEWS = [
  { id: 'home', label: 'Home' },
  { id: 'creator', label: 'Create' },
  { id: 'sheet', label: 'Sheet' },
  { id: 'bag', label: 'Token Bag' },
  { id: 'dungeon', label: 'Dungeon' },
  { id: 'rules', label: 'Rules' },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

function readHash(): ViewId {
  const id = window.location.hash.replace(/^#\/?/, '').split('/')[0]
  return VIEWS.find((v) => v.id === id)?.id ?? 'home'
}

/** The section named after `#/rules/`, if any. */
export function readRulesSlug(): string | null {
  const [view, slug] = window.location.hash.replace(/^#\/?/, '').split('/')
  return view === 'rules' && slug ? slug : null
}

/** Keeps the active view in the URL hash so views are linkable and the back button works. */
export function useView(): [ViewId, (view: ViewId) => void] {
  const [view, setViewState] = useState<ViewId>(readHash)

  useEffect(() => {
    const onHashChange = () => setViewState(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setView = useCallback((next: ViewId) => {
    window.location.hash = `/${next}`
    window.scrollTo({ top: 0 })
  }, [])

  return [view, setView]
}
