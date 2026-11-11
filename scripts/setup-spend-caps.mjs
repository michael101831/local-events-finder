import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PROJECT_ID = 'localfind-fb'
const PROJECT_NUMBER = '975619308856'
const CAPS = [
  { name: 'LocalFind Cloud Run functions cap', service: 'services/29E7-DA93-CA13' },
  { name: 'LocalFind Cloud Run cap', service: 'services/152E-C115-5142' },
]

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
}

function firebaseTools() {
  const found = run('where.exe', ['firebase'])
  const candidates = `${found.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((command) => join(dirname(command), 'node_modules', 'firebase-tools'))
  const root = candidates.find((candidate) => existsSync(join(candidate, 'package.json')))
  if (!root) throw new Error('Firebase CLI is installed, but its package could not be found.')
  const require = createRequire(join(root, 'package.json'))
  const auth = require(join(root, 'lib', 'auth.js'))
  const account = auth.getGlobalDefaultAccount()
  if (!account) throw new Error('Firebase CLI is not logged in. Run firebase login, then try again.')
  const options = { project: PROJECT_ID, projectId: PROJECT_ID }
  auth.setActiveAccount(options, account)
  return {
    Client: require(join(root, 'lib', 'apiv2.js')).Client,
    ensure: require(join(root, 'lib', 'ensureApiEnabled.js')).ensure,
  }
}

function budgetBody(cap) {
  return {
    displayName: cap.name,
    budgetFilter: {
      projects: [`projects/${PROJECT_NUMBER}`],
      services: [cap.service],
      creditTypesTreatment: 'EXCLUDE_ALL_CREDITS',
      calendarPeriod: 'MONTH',
    },
    amount: { specifiedAmount: { units: '1', nanos: 0 } },
    thresholdRules: [
      { thresholdPercent: 0.5 },
      { thresholdPercent: 0.8 },
      { thresholdPercent: 1.0 },
    ],
    notificationsRule: { enableProjectLevelRecipients: true },
    spendCap: { inputState: 'CONFIGURED' },
  }
}

function quotaHeaders() {
  return new Headers({ 'x-goog-user-project': PROJECT_ID })
}

async function listBudgets(client, billingAccount) {
  const budgets = []
  let pageToken = ''
  do {
    const response = await client.get(`/${billingAccount}/budgets`, {
      headers: quotaHeaders(),
      queryParams: pageToken ? { pageSize: '100', pageToken } : { pageSize: '100' },
    })
    budgets.push(...(response.body?.budgets ?? []))
    pageToken = response.body?.nextPageToken ?? ''
  } while (pageToken)
  return budgets
}

function pruneFunctionImages() {
  const version = run('gcloud', ['--version'])
  if ((version.status ?? 1) !== 0) return
  const listed = run('gcloud', [
    'artifacts',
    'repositories',
    'list',
    '--project',
    PROJECT_ID,
    '--location=us-central1',
    '--format=value(name)',
  ])
  if ((listed.status ?? 1) !== 0) return
  const repo = `${listed.stdout || ''}`
    .split(/\s+/)
    .map((name) => name.trim())
    .find((name) => name.endsWith('/gcf-artifacts') || name === 'gcf-artifacts')
  if (!repo) return
  const applied = run('gcloud', [
    'artifacts',
    'repositories',
    'set-cleanup-policies',
    repo,
    '--location=us-central1',
    '--project',
    PROJECT_ID,
    `--policy=${join('scripts', 'artifact-cleanup.json')}`,
    '--no-dry-run',
  ])
  if ((applied.status ?? 1) === 0) {
    console.log('Old function images will be deleted so container storage stays small.')
  }
}

const { Client, ensure } = firebaseTools()
await ensure(PROJECT_ID, 'cloudbilling.googleapis.com', 'billing', true)
await ensure(PROJECT_ID, 'billingbudgets.googleapis.com', 'billing', true)

const billing = new Client({ urlPrefix: 'https://cloudbilling.googleapis.com', apiVersion: 'v1' })
const info = await billing.get(`/projects/${PROJECT_ID}/billingInfo`, { headers: quotaHeaders() })
const billingAccount = info.body?.billingAccountName ?? ''
if (!info.body?.billingEnabled || !billingAccount) {
  console.log('No billing account is linked yet, so the $1 spend caps were not created.')
  process.exit(0)
}

const budgets = new Client({ urlPrefix: 'https://billingbudgets.googleapis.com', apiVersion: 'v1' })
const existing = await listBudgets(budgets, billingAccount)
for (const cap of CAPS) {
  const found = existing.find((budget) => budget.displayName === cap.name)
  if (found) {
    console.log(`${cap.name} is already set.`)
    continue
  }
  await budgets.post(`/${billingAccount}/budgets`, budgetBody(cap), { headers: quotaHeaders() })
  console.log(`Created ${cap.name} at $1. Google pauses that service for the rest of the month if charges reach it.`)
}

pruneFunctionImages()
