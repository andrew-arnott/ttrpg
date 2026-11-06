import { useCallback, useEffect, useState } from 'react'
import type { CharacterDraft } from './buildCharacter'
import {
  deleteSaved,
  listSaved,
  saveCharacter,
  STORAGE_KEY,
  type KeyValueStorage,
  type SavedCharacter,
} from './savedCharacters'

/** Used when localStorage is unavailable (private mode, blocked cookies) so saving still works for the session. */
const sessionOnlyStorage: KeyValueStorage = (() => {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
})()

function browserStorage(): KeyValueStorage {
  try {
    window.localStorage.getItem(STORAGE_KEY)
    return window.localStorage
  } catch {
    return sessionOnlyStorage
  }
}

export function useSavedCharacters() {
  const [saved, setSaved] = useState<SavedCharacter[]>(() => listSaved(browserStorage()))

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setSaved(listSaved(browserStorage()))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const save = useCallback((draft: CharacterDraft, id: string | null) => {
    const storage = browserStorage()
    const entry = saveCharacter(storage, draft, id)
    setSaved(listSaved(storage))
    return entry
  }, [])

  const remove = useCallback((id: string) => {
    const storage = browserStorage()
    deleteSaved(storage, id)
    setSaved(listSaved(storage))
  }, [])

  return { saved, save, remove }
}
