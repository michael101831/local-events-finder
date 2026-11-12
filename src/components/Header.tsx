import { useState, type FormEvent } from 'react'
import { AccountButton, AccountForm } from './AccountPanel.tsx'
import { chip, chipOn, field } from '../lib/styles.ts'

type Props = {
  keyword: string
  onKeyword: (value: string) => void
  locationLabel: string
  locating: boolean
  onUseLocation: () => void
  onCitySearch: (city: string) => void
  savedCount: number
  showSaved: boolean
  onToggleSaved: () => void
  mobileView: 'list' | 'map'
  onMobileView: (view: 'list' | 'map') => void
  accountEmail: string | null
  accountBusy: boolean
  accountError: string | null
  bookmarkError: string | null
  onCreateAccount: (email: string, password: string) => Promise<boolean>
  onSignIn: (email: string, password: string) => Promise<boolean>
  onSignOut: () => Promise<boolean>
  dark: boolean
  onToggleDark: () => void
}

export function Header({
  keyword,
  onKeyword,
  locationLabel,
  locating,
  onUseLocation,
  onCitySearch,
  savedCount,
  showSaved,
  onToggleSaved,
  mobileView,
  onMobileView,
  accountEmail,
  accountBusy,
  accountError,
  bookmarkError,
  onCreateAccount,
  onSignIn,
  onSignOut,
  dark,
  onToggleDark,
}: Props) {
  const [cityDraft, setCityDraft] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)

  function submitCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = cityDraft.trim()
    if (!next) return
    onCitySearch(next)
  }

  return (
    <header className="min-w-0 border-b border-ink/10 bg-paper/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center font-display text-2xl leading-none font-semibold tracking-tight sm:text-[1.7rem]">
            <svg className="mr-2 h-6 w-6 shrink-0 text-amber" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              />
              <circle cx="12" cy="9" r="2.5" className="fill-paper" />
            </svg>
            LocalFind
          </h1>
          <p className="mt-1 pl-8 text-sm text-ink/65">Find Events Near You</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AccountButton open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} />
          <button
            type="button"
            className={showSaved ? chipOn : chip}
            aria-pressed={showSaved}
            onClick={onToggleSaved}
          >
            Saved
            <span className="ml-1 tabular-nums">{savedCount}</span>
          </button>
          <button type="button" className={dark ? chipOn : chip} aria-pressed={dark} onClick={onToggleDark}>
            Dark
          </button>
          <div className="flex md:hidden" role="group" aria-label="View">
            <button
              type="button"
              className={`${mobileView === 'list' ? chipOn : chip} rounded-r-none`}
              aria-pressed={mobileView === 'list'}
              onClick={() => onMobileView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`${mobileView === 'map' ? chipOn : chip} rounded-l-none border-l-0`}
              aria-pressed={mobileView === 'map'}
              onClick={() => onMobileView('map')}
            >
              Map
            </button>
          </div>
        </div>
        {accountOpen ? (
          <AccountForm
            email={accountEmail}
            busy={accountBusy}
            error={accountError}
            onCreate={async (email, password) => {
              const ok = await onCreateAccount(email, password)
              if (ok) setAccountOpen(false)
              return ok
            }}
            onSignIn={async (email, password) => {
              const ok = await onSignIn(email, password)
              if (ok) setAccountOpen(false)
              return ok
            }}
            onSignOut={onSignOut}
          />
        ) : null}
        {bookmarkError ? (
          <p className="basis-full text-sm text-ink" role="alert">
            {bookmarkError}
          </p>
        ) : null}
      </div>
      <div className="px-4 pb-3">
        <input
          className={`${field} w-full`}
          type="search"
          value={keyword}
          onChange={(event) => onKeyword(event.target.value)}
          placeholder="Search artists, teams, venues"
          aria-label="Search events"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <p className="rounded-full bg-ink px-3 py-2 text-sm text-paper" aria-live="polite">
            {locationLabel}
          </p>
          <button type="button" className={chip} onClick={onUseLocation} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        <form onSubmit={submitCity} className="flex min-w-0 flex-1 gap-2">
          <input
            className={`${field} flex-1`}
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="City, ST"
            aria-label="City"
            autoComplete="off"
          />
          <button type="submit" className={chip} disabled={!cityDraft.trim()}>
            Go
          </button>
        </form>
      </div>
    </header>
  )
}
