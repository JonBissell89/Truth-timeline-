// Create a confirmed user directly via the Supabase Admin API (secret key,
// server-side). Bypasses the email magic-link flow and its rate limit —
// the "god account" the founder can log into immediately with a password.
//
// Reads keys from ../.env.local. Writes the created credentials to
// ./.account.local (gitignored) so the password is never printed to a shared
// surface. CHANGE THE PASSWORD after first login.
//
// Usage: node scripts/create-account.mjs your@email.com
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = env.SUPABASE_SECRET_KEY
const email = process.argv[2]
if (!email) {
  console.error('usage: node scripts/create-account.mjs your@email.com')
  process.exit(1)
}

// Strong random password (24 url-safe chars). Written to a local file only.
const password = randomBytes(18).toString('base64url')

async function main() {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // confirmed immediately — no email sent
    }),
  })
  const body = await res.json()
  if (!res.ok) {
    // If the user already exists, update the password instead.
    if (res.status === 422 || /already/i.test(JSON.stringify(body))) {
      console.log('user exists — looking up id to reset password…')
      const list = await fetch(
        `${URL}/auth/v1/admin/users?per_page=200`,
        { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } },
      ).then((r) => r.json())
      const u = (list.users || []).find((x) => x.email === email)
      if (!u) {
        console.error('could not find existing user to reset:', body)
        process.exit(1)
      }
      const upd = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
        method: 'PUT',
        headers: {
          apikey: SECRET,
          Authorization: `Bearer ${SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, email_confirm: true }),
      })
      if (!upd.ok) {
        console.error('password reset failed:', await upd.json())
        process.exit(1)
      }
      console.log('password reset for existing account.')
    } else {
      console.error('create failed:', body)
      process.exit(1)
    }
  } else {
    console.log('account created.')
  }

  const out = `ORENDA god account (LOCAL ONLY — gitignored, change after first login)\nemail:    ${email}\npassword: ${password}\n`
  writeFileSync(join(root, '.account.local'), out)
  console.log('\ncredentials written to .account.local (gitignored).')
  console.log('email:', email)
  console.log('password: [written to .account.local — open that file]')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
