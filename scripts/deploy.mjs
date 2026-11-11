import { spawnSync } from 'node:child_process'

process.env.FUNCTIONS_DISCOVERY_TIMEOUT = '60'

const deploy = spawnSync(
  'firebase',
  [
    'deploy',
    '--only',
    'hosting,functions,firestore',
    '--project',
    'localfind-fb',
    '--non-interactive',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
)

if ((deploy.status ?? 1) !== 0) process.exit(deploy.status ?? 1)

const caps = spawnSync('node', ['scripts/setup-spend-caps.mjs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

process.exit(caps.status ?? 1)
