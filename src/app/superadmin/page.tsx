import { supabaseAdmin } from '@/lib/supabase/admin'
import { clerkClient } from '@clerk/nextjs/server'
import { UpdateRoleForm } from './update-role-form'

async function getRecentLogins() {
  const { data } = await supabaseAdmin
    .from('login_audit_log')
    .select('user_id, ip_address, user_agent, logged_in_at')
    .order('logged_in_at', { ascending: false })
    .limit(20)
  return data ?? []
}

async function getUsers() {
  try {
    const clerk = await clerkClient()
    const { data } = await clerk.users.getUserList({ limit: 50 })
    return data.map((u) => ({
      id: u.id,
      email: u.primaryEmailAddress?.emailAddress ?? '—',
      role: (u.publicMetadata as Record<string, unknown>)?.role ?? null,
      created_at: u.createdAt,
    }))
  } catch (e) {
    console.error('[superadmin] Clerk user list failed:', e)
    return []
  }
}

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [users, logins] = await Promise.all([getUsers(), getRecentLogins()])
  const { error: errorMsg } = await searchParams

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold">Süpervizör Paneli</h1>

      {errorMsg && (
        <div className="border border-destructive bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {errorMsg}
        </div>
      )}

      <section className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-medium">Kullanıcılar ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">Kullanıcı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2">E-posta</th>
                <th className="pb-2">User ID</th>
                <th className="pb-2">Rol</th>
                <th className="pb-2">Oluşturuldu</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2 font-mono text-xs">{u.id}</td>
                  <td className="py-2">{(u.role as string) ?? '—'}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-medium">Kullanıcı Rolü Güncelle</h2>
        <p className="text-xs text-muted-foreground">
          Test modunda yalnızca <code>superadmin</code> rolü atanabilir. Diğer kullanıcılar varsayılan olarak hasta yönetimi yetkisine sahip.
        </p>
        <UpdateRoleForm />
      </section>

      <section className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-medium">Son Girişler ({logins.length})</h2>
        {logins.length === 0 ? (
          <p className="text-muted-foreground text-sm">Kayıt yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2">Tarih</th>
                <th className="pb-2">User ID</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logins.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 text-xs">
                    {new Date(l.logged_in_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 font-mono text-xs">{l.user_id}</td>
                  <td className="py-2 font-mono text-xs">{l.ip_address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
