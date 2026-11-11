import { useState, type FormEvent } from 'react'
import { createDaybookConnection, removeDaybookConnection } from '../api/daybook.ts'
import { chip, chipOn, field } from '../lib/styles.ts'

type Props = {
  email: string | null
  busy: boolean
  error: string | null
  open: boolean
  onToggle: () => void
  onCreate: (email: string, password: string) => Promise<boolean>
  onSignIn: (email: string, password: string) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

export function AccountButton({ open, onToggle }: Pick<Props, 'open' | 'onToggle'>) {
  return (
    <button
      type="button"
      className={open ? chipOn : chip}
      aria-expanded={open}
      aria-controls="account-panel"
      onClick={onToggle}
    >
      Account
    </button>
  )
}

export function AccountForm({ email, busy, error, onCreate, onSignIn, onSignOut }: Omit<Props, 'open' | 'onToggle'>) {
  const [mode, setMode] = useState<'create' | 'sign-in'>('create')
  const [draftEmail, setDraftEmail] = useState('')
  const [password, setPassword] = useState('')
  const [connection, setConnection] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [connectionBusy, setConnectionBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok =
      mode === 'create' ? await onCreate(draftEmail, password) : await onSignIn(draftEmail, password)
    if (!ok) return
    setPassword('')
  }

  return (
    <div id="account-panel" className="basis-full rounded-2xl border border-ink/10 bg-card px-4 py-3">
      {email ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 text-sm text-ink/80">
              Signed in as <span className="font-medium text-ink">{email}</span>. Bookmarks stay on this account.
            </p>
            <button type="button" className={chip} onClick={() => void onSignOut()} disabled={busy}>
              Sign out
            </button>
          </div>
          <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
            <p className="text-sm text-ink/70">
              Daybook can pull the bookmarks on this account. Hearts saved only on this device stay here.
            </p>
            {connection ? (
              <>
                <p className="text-sm text-ink/80">
                  Paste this into Daybook. Anyone with it can read these bookmarks until you create a new one.
                </p>
                <input className={field} readOnly value={connection} aria-label="Daybook connection" />
              </>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chipOn}
                disabled={connectionBusy}
                onClick={() => {
                  setConnectionBusy(true)
                  setConnectionError(null)
                  void createDaybookConnection()
                    .then(setConnection)
                    .catch((caught: unknown) => {
                      setConnectionError(caught instanceof Error ? caught.message : 'Could not connect Daybook.')
                    })
                    .finally(() => setConnectionBusy(false))
                }}
              >
                {connectionBusy ? 'Working…' : 'Create Daybook connection'}
              </button>
              <button
                type="button"
                className={chip}
                disabled={connectionBusy}
                onClick={() => {
                  setConnectionBusy(true)
                  setConnectionError(null)
                  void removeDaybookConnection()
                    .then(() => setConnection(null))
                    .catch((caught: unknown) => {
                      setConnectionError(caught instanceof Error ? caught.message : 'Could not disconnect Daybook.')
                    })
                    .finally(() => setConnectionBusy(false))
                }}
              >
                Turn off
              </button>
            </div>
            {connectionError ? (
              <p className="text-sm text-ink" role="alert">
                {connectionError}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
          <p className="text-sm text-ink/70">
            {mode === 'create'
              ? 'Create an account and bookmarks follow you on any device.'
              : 'Sign in to see the bookmarks on this account.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={`${field} flex-1`}
              type="email"
              value={draftEmail}
              onChange={(event) => setDraftEmail(event.target.value)}
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              required
            />
            <input
              className={`${field} flex-1`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={chipOn} disabled={busy}>
              {busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className={chip}
              onClick={() => setMode((value) => (value === 'create' ? 'sign-in' : 'create'))}
            >
              {mode === 'create' ? 'I have an account' : 'Create an account'}
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p className="mt-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
