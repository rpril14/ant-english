import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LibraryClient } from './LibraryClient'
import type { LibraryVideo } from '@/lib/library'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? ''
  const res = await fetch(`${apiBase}/api/library`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  const videos: LibraryVideo[] = res.ok ? await res.json() : []

  return <LibraryClient initialVideos={videos} apiBase={apiBase} />
}
