import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { consolidate } from '@/lib/orenda/consolidator'
import TruthMap from '@/components/truth-map'

// The home surface: the one cross-project truth map. Server component —
// reads the logged-in user's consolidated map (RLS-scoped) and hands it to
// the client renderer. No auth = go to login.
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const map = await consolidate(supabase, user.id)

  return <TruthMap map={map} email={user.email ?? ''} />
}
