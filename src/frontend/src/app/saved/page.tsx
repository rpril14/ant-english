import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SavedClient } from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? ''
  const res = await fetch(`${apiBase}/api/saved`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  const items: SavedItem[] = res.ok ? await res.json() : []

  return <SavedClient initialItems={items} apiBase={apiBase} />
}

export interface SavedItem {
  sentenceId: string
  text: string
  translation: string | null
  videoTitle: string
  videoId: string
  note: string | null
  savedAt: string
}
