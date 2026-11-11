import { auth } from '../lib/firebase.ts'

async function readMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message
  }
  return 'Could not update the Daybook connection.'
}

async function accountFetch(path: string, method: string): Promise<Response> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in to connect Daybook.')
  const idToken = await user.getIdToken()
  return fetch(path, { method, headers: { Authorization: `Bearer ${idToken}` } })
}

export async function createDaybookConnection(): Promise<string> {
  const response = await accountFetch('/api/bookmarks/feed', 'POST')
  if (!response.ok) throw new Error(await readMessage(response))
  const payload: unknown = await response.json().catch(() => null)
  const token =
    payload && typeof payload === 'object' && typeof (payload as { token?: unknown }).token === 'string'
      ? (payload as { token: string }).token
      : ''
  if (!token) throw new Error('Daybook did not receive a connection.')
  return token
}

export async function removeDaybookConnection(): Promise<void> {
  const response = await accountFetch('/api/bookmarks/feed', 'DELETE')
  if (!response.ok) throw new Error(await readMessage(response))
}
