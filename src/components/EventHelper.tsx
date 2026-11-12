import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { askHelper, type AskTurn } from '../api/ask.ts'
import { formatWhen, venueLine } from '../lib/format.ts'
import { field } from '../lib/styles.ts'
import type { EventItem } from '../types.ts'

type Props = {
  place: string
  scope: 'nearby' | 'saved'
  filters: string
  events: EventItem[]
}

const SUGGESTIONS = ['What should I see nearby?', 'Help me find music']

export function EventHelper({ place, scope, filters, events }: Props) {
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [turns, pending, error, open])

  async function send(question: string) {
    const content = question.trim()
    if (!content || pending) return
    const nextTurns: AskTurn[] = [...turns, { role: 'user', content } satisfies AskTurn].slice(-8)
    setTurns(nextTurns)
    setDraft('')
    setError(null)
    setPending(true)
    try {
      const reply = await askHelper({
        place,
        scope,
        filters,
        events: events.slice(0, 15).map((event) => ({
          name: event.name,
          when: formatWhen(event.localDate, event.localTime),
          where: venueLine(event.venue, event.city),
          price: event.price,
          category: event.category,
        })),
        turns: nextTurns,
      })
      setTurns((current) => [...current, { role: 'assistant', content: reply } satisfies AskTurn].slice(-8))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not answer that. Try again.')
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(draft)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-3 p-3 sm:p-4">
      {open ? (
        <section
          id={panelId}
          aria-label="Ask about events"
          className="pointer-events-auto flex max-h-[min(32rem,calc(100dvh-6.5rem))] w-full flex-col overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-[0_16px_50px_rgb(0_0_0_/_28%)] sm:w-[24rem]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
            <div>
              <h2 className="font-display text-xl leading-tight">Ask LocalFind</h2>
              <p className="text-sm text-ink/65">Questions about the events on this page.</p>
            </div>
            <button
              type="button"
              className="cursor-pointer rounded-full px-2 py-1 text-sm text-ink/70 hover:text-ink"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <div ref={logRef} className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {turns.length === 0 && !pending ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink/70">Ask what is nearby, or ask for help narrowing the list.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="cursor-pointer rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-left text-sm text-ink hover:border-ink/40"
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((turn, index) => (
              <p
                key={`${turn.role}-${index}`}
                className={
                  turn.role === 'user'
                    ? 'ml-8 rounded-2xl bg-ink px-3 py-2 text-sm text-paper'
                    : 'mr-6 text-sm leading-relaxed text-ink'
                }
              >
                {turn.content}
              </p>
            ))}
            {pending ? <p className="text-sm text-ink/60">Looking…</p> : null}
            {error ? (
              <p className="text-sm text-ink" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-ink/10 p-3">
            <input
              ref={inputRef}
              className={`${field} flex-1`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about nearby events"
              aria-label="Question"
              maxLength={500}
              disabled={pending}
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-full bg-amber px-4 py-2 text-sm font-semibold text-on-amber disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pending || draft.trim().length === 0}
            >
              Send
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="pointer-events-auto cursor-pointer rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper shadow-[0_10px_30px_rgb(0_0_0_/_35%)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Ask
      </button>
    </div>
  )
}
