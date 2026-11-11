import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '../lib/firebase.ts'

function authMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'auth/email-already-in-use') return 'An account with that email already exists. Sign in instead.'
  if (code === 'auth/invalid-email') return 'Enter a valid email address.'
  if (code === 'auth/weak-password') return 'Use a password of at least 6 characters.'
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'That email and password did not match an account.'
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a minute and try again.'
  if (code === 'auth/network-request-failed') return 'Could not reach accounts. Check your connection and try again.'
  return 'Could not update your account. Try again.'
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next)
        setReady(true)
      }),
    [],
  )

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      setError(authMessage(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    user,
    ready,
    error,
    busy,
    signIn: (email: string, password: string) =>
      run(() => signInWithEmailAndPassword(auth, email.trim(), password)),
    createAccount: (email: string, password: string) =>
      run(() => createUserWithEmailAndPassword(auth, email.trim(), password)),
    signOut: () => run(() => signOut(auth)),
  }
}
