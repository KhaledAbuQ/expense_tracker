import { loadEnv } from 'vite'

const env = { ...loadEnv('android', process.cwd(), 'VITE_'), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (
  !url ||
  !key ||
  !URL.canParse(url) ||
  new URL(url).protocol !== 'https:' ||
  url === 'your-project-url-here' ||
  url === 'https://placeholder.supabase.co'
) {
  console.log('Building standalone APK without baked-in Supabase credentials.')
  console.log('Users will be prompted to enter their own Supabase URL and anon key on first launch.')
  process.exit(0)
}

// Only a publishable/anon key belongs in a distributed client.
let isAnon = false
try {
  isAnon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'
} catch { /* New publishable keys are not JWTs. */ }

if (!key.startsWith('sb_publishable_') && !isAnon) {
  throw new Error('The APK requires a Supabase publishable or anon key; privileged keys cannot be bundled.')
}

console.log('Android Supabase configuration validated (public client key default provided).')

