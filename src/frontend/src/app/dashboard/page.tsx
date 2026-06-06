import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth smoke test ✓</h1>
      <pre className="bg-gray-100 rounded p-4 text-sm text-black">
        {JSON.stringify({ id: user.id, email: user.email }, null, 2)}
      </pre>
    </div>
  )
}
