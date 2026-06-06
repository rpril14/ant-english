import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Supabase OAuth redirect handler.
 * Google sends the user here with a `code` param after consent.
 * We exchange the code for a session, then redirect to the intended page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
