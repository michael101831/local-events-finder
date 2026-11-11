import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const names = ['TICKETMASTER_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']

function valuesIn(text) {
  const found = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const name = trimmed.slice(0, separator).trim()
    if (!names.includes(name)) continue
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) found[name] = value
  }
  return found
}

const values = {}
for (const file of ['.env', '.env.local']) {
  try {
    Object.assign(values, valuesIn(readFileSync(resolve(root, file), 'utf8')))
  } catch {
    // Optional until the keys are added.
  }
}

if (!values.TICKETMASTER_API_KEY) {
  console.error('Add TICKETMASTER_API_KEY to .env before deploying search.')
  process.exit(1)
}

const lines = names
  .filter((name) => values[name])
  .map((name) => {
    const value = values[name]
    const encoded = /^[A-Za-z0-9._~-]+$/.test(value) ? value : JSON.stringify(value)
    return `${name}=${encoded}`
  })

mkdirSync(resolve(root, 'functions'), { recursive: true })
writeFileSync(resolve(root, 'functions', '.env'), `${lines.join('\n')}\n`)
console.log('Synced function env from the local env files.')
