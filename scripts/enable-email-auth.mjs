import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PROJECT_ID = 'localfind-fb'

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
  auth.setActiveAccount({ project: PROJECT_ID, projectId: PROJECT_ID }, account)
  return {
    Client: require(join(root, 'lib', 'apiv2.js')).Client,
    ensure: require(join(root, 'lib', 'ensureApiEnabled.js')).ensure,
  }
}

const { Client, ensure } = firebaseTools()
await ensure(PROJECT_ID, 'identitytoolkit.googleapis.com', 'auth', true)

const headers = new Headers({ 'x-goog-user-project': PROJECT_ID })
const identity = new Client({
  urlPrefix: 'https://identitytoolkit.googleapis.com',
  apiVersion: 'v2',
})
await identity.post(`/projects/${PROJECT_ID}/identityPlatform:initializeAuth`, {}, { headers })

const admin = new Client({
  urlPrefix: 'https://identitytoolkit.googleapis.com',
  apiVersion: 'admin/v2',
})
await admin.patch(
  `/projects/${PROJECT_ID}/config`,
  { signIn: { email: { enabled: true, passwordRequired: true } } },
  {
    headers,
    queryParams: { updateMask: 'signIn.email.enabled,signIn.email.passwordRequired' },
  },
)
console.log('Email and password accounts are enabled.')
