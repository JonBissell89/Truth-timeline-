import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabasePool } from '@/lib/orenda/supabase-pool'
import ClimbMap from '@/components/climb-map'

// The home surface: the one cross-project truth map. Server component —
// reads the logged-in user's consolidated map (RLS-scoped) and hands it to
// the client renderer. No auth = go to login.
//
// Resilient auth landing: Supabase sometimes redirects the magic link to
// the Site URL root (/) instead of /auth/callback, carrying the PKCE code
// here. So if we arrive with a ?code=, exchange it for a session right here
// before checking the user — the sign-in completes wherever the link lands.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const supabase = await createClient()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    // drop the code from the URL so a refresh doesn't re-exchange a used code
    redirect('/')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const pool = new SupabasePool(supabase)
  const rows = await pool.all()

  return <ClimbMap rows={rows} email={user.email ?? ''} />
}
