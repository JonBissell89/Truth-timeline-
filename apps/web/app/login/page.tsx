'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Login — magic-link (passwordless) email. Calm, single field, space-dark.
// Magic link keeps the first build simple (no password UI) and works the
// same on phone and laptop. The agent's amber is the only warm thing here.
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-light tracking-[0.2em] text-ink-100">
            ORENDA
          </h1>
          <p className="mt-3 text-sm text-ink-500">
            a visual representation of truth
          </p>
        </div>

        {sent ? (
          <p className="rounded-lg border border-space-3 bg-space-1 px-4 py-6 text-center text-sm text-ink-300">
            A sign-in link is on its way to{' '}
            <span className="text-amber">{email}</span>. Open it on this device.
          </p>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@somewhere.com"
              className="w-full rounded-lg border border-space-3 bg-space-1 px-4 py-3 text-ink-100 placeholder:text-ink-500 outline-none focus:border-amber/60"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-amber/90 px-4 py-3 font-medium text-space-0 transition hover:bg-amber disabled:opacity-50"
            >
              {busy ? 'sending…' : 'send sign-in link'}
            </button>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
