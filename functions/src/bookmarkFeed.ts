import { bearerToken, feedHash, isJwt, newFeedToken, toDaybookEvent, type DaybookEvent } from './daybookEvents.js'

const FEED_GAP_MS = 15_000

type Firestore = import('firebase-admin/firestore').Firestore

type Store = {
  db: Firestore
  FieldValue: typeof import('firebase-admin/firestore').FieldValue
}

async function store(): Promise<Store> {
  const { getApps, initializeApp } = await import('firebase-admin/app')
  const { FieldValue, getFirestore } = await import('firebase-admin/firestore')
  if (getApps().length === 0) initializeApp()
  return { db: getFirestore(), FieldValue }
}

async function uidFromIdToken(token: string): Promise<string | null> {
  const { getApps, initializeApp } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (getApps().length === 0) initializeApp()
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid || null
  } catch {
    return null
  }
}

async function uidFromFeed(db: Firestore, token: string): Promise<string | null> {
  const snap = await db.doc(`feeds/${feedHash(token)}`).get()
  const uid = snap.get('uid')
  return typeof uid === 'string' && uid.length > 0 ? uid : null
}

export async function uidForRead(authorization: string | undefined): Promise<string | null> {
  const token = bearerToken(authorization)
  if (!token) return null
  if (isJwt(token)) return uidFromIdToken(token)
  const { db } = await store()
  return uidFromFeed(db, token)
}

export async function uidForAccount(authorization: string | undefined): Promise<string | null> {
  const token = bearerToken(authorization)
  if (!token || !isJwt(token)) return null
  return uidFromIdToken(token)
}

export async function listDaybookEvents(uid: string): Promise<DaybookEvent[]> {
  const { db } = await store()
  const snap = await db.collection(`users/${uid}/bookmarks`).orderBy('savedAt', 'desc').limit(100).get()
  return snap.docs.flatMap((item) => {
    const event = toDaybookEvent(item.data())
    return event ? [event] : []
  })
}

export async function replaceFeed(uid: string, now = Date.now()): Promise<{ token: string } | { retry: true }> {
  const { db, FieldValue } = await store()
  const token = newFeedToken()
  const hash = feedHash(token)
  const pointer = db.doc(`users/${uid}/private/daybook`)
  const created = await db.runTransaction(async (tx) => {
    const current = await tx.get(pointer)
    const previousHash = current.get('hash')
    const createdAt = current.get('createdAt')
    if (typeof createdAt === 'number' && now - createdAt < FEED_GAP_MS) return false
    if (typeof previousHash === 'string' && previousHash !== hash) tx.delete(db.doc(`feeds/${previousHash}`))
    tx.set(pointer, { hash, createdAt: now, updatedAt: FieldValue.serverTimestamp() })
    tx.set(db.doc(`feeds/${hash}`), { uid, createdAt: now })
    return true
  })
  return created ? { token } : { retry: true }
}

export async function removeFeed(uid: string): Promise<void> {
  const { db } = await store()
  const pointer = db.doc(`users/${uid}/private/daybook`)
  await db.runTransaction(async (tx) => {
    const current = await tx.get(pointer)
    const previousHash = current.get('hash')
    if (typeof previousHash === 'string') tx.delete(db.doc(`feeds/${previousHash}`))
    tx.delete(pointer)
  })
}
