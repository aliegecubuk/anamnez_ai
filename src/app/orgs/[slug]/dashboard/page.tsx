import { createSupabaseServerClient } from '@/lib/supabase/server'

// Dashboard page for a tenant org. params.slug used in future for tenant-specific queries.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenantData } = await supabase
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
