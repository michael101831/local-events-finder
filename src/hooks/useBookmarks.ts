import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { isEventItem, toBookmark } from '../lib/bookmark.ts'
import { db } from '../lib/firebase.ts'
import type { EventItem } from '../types.ts'

const STORAGE_KEY = 'localfind.favorites'

function readLocal(): EventItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEventItem)
  } catch {
    return []
  }
}

function writeLocal(items: EventItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function bookmarks(uid: string) {
  return collection(db, 'users', uid, 'bookmarks')
}

export function useBookmarks(user: User | null) {
  const [localItems, setLocalItems] = useState<EventItem[]>(() => readLocal())
  const [remoteItems, setRemoteItems] = useState<EventItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) return
    writeLocal(localItems)
  }, [localItems, user])

  useEffect(() => {
    if (!user) return
    const local = readLocal()
    if (local.length === 0) return
    const batch = writeBatch(db)
    for (const event of local) {
      batch.set(doc(bookmarks(user.uid), event.id), toBookmark(event))
    }
    void batch
      .commit()
      .then(() => localStorage.removeItem(STORAGE_KEY))
      .catch(() => {
        setError('Could not move bookmarks on this device to your account.')
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    const list = query(bookmarks(user.uid), orderBy('savedAt', 'desc'))
    return onSnapshot(
      list,
      (snapshot) => {
        const next = snapshot.docs.flatMap((item) => {
          const event = item.data()
          return isEventItem(event) ? [event] : []
        })
        setRemoteItems(next)
        setError(null)
      },
      () => {
        setError('Could not load bookmarks for this account.')
      },
    )
  }, [user])

  const items = user ? (remoteItems ?? localItems) : localItems

  const toggle = useCallback(
    (event: EventItem) => {
      if (!user) {
        setLocalItems((current) => {
          if (current.some((item) => item.id === event.id)) {
            return current.filter((item) => item.id !== event.id)
          }
          return [toBookmark(event), ...current]
        })
        return
      }

      const ref = doc(bookmarks(user.uid), event.id)
      const saved = (remoteItems ?? []).some((item) => item.id === event.id)
      const write = saved ? deleteDoc(ref) : setDoc(ref, toBookmark(event))
      void write.catch(() => {
        setError('Could not update bookmarks for this account.')
      })
    },
    [remoteItems, user],
  )

  const isSaved = useCallback((id: string) => items.some((item) => item.id === id), [items])

  return { items, toggle, isSaved, error }
}
