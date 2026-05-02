import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { userId, orgId } = await auth()
  const { slug } = await params

  const supabase = await createSupabaseServerClient()
  const { data: tenantData, error } = await supabase
    .from('tenants')
    .select('name, slug')
    .single()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Hoş geldiniz
      </h1>
      {tenantData && (
        <p className="text-muted-foreground mt-2">{tenantData.name}</p>
      )}
    </main>
  )
}
