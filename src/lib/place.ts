export function parsePlace(input: string): { city: string; stateCode?: string } {
  const trimmed = input.trim()
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  const state = parts[1]
  if (parts.length >= 2 && state && /^[a-z]{2}$/i.test(state)) {
    return { city: parts[0] ?? trimmed, stateCode: state.toUpperCase() }
  }
  return { city: trimmed }
}
