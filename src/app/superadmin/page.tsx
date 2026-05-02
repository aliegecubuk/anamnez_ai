import { supabaseAdmin } from '@/lib/supabase/admin'

async function getTenants() {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id, clerk_org_id, slug, name, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function SuperadminPage() {
  const tenants = await getTenants()

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold">Süpervizör Paneli</h1>

      {/* AUTH-01: Tenant kayıt */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-medium">Yeni Kiracı Ekle</h2>
        <form
          action="/api/superadmin/tenants"
          method="POST"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <input
            name="name"
            required
            placeholder="Üniversite adı"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            name="slug"
            required
            placeholder="slug (örn: istanbul-uni)"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            name="clerk_org_id"
            required
            placeholder="Clerk org_id (org_...)"
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-3 bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium"
          >
            Kiracı Oluştur
          </button>
        </form>
      </section>

      {/* Kiracı listesi */}
      <section className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-medium">Kiracılar ({tenants.length})</h2>
        {tenants.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz kiracı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2">İsim</th>
                <th className="pb-2">Slug</th>
                <th className="pb-2">Clerk Org ID</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="py-2">{t.name}</td>
                  <td className="py-2 font-mono text-xs">{t.slug}</td>
                  <td className="py-2 font-mono text-xs">{t.clerk_org_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* AUTH-02: Kullanıcı davet */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-medium">Kullanıcı Davet Et</h2>
        <p className="text-sm text-muted-foreground">
          Kullanıcı, Clerk organizasyonuna davet e-postası alır.
        </p>
        <form
          action="/api/superadmin/users"
          method="POST"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="E-posta"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            name="organizationId"
            required
            placeholder="Clerk org_id (org_...)"
            className="border rounded px-3 py-2 text-sm"
          />
          {/* AUTH-03: Rol seçimi davet sırasında */}
          <select name="role" required className="border rounded px-3 py-2 text-sm sm:col-span-2">
            <option value="">Rol seçin</option>
            <option value="org:admin">Klinik Yöneticisi (org:admin)</option>
            <option value="org:dentist">Diş Hekimi (org:dentist)</option>
            <option value="org:assistant">Asistan (org:assistant)</option>
          </select>
          <button
            type="submit"
            className="sm:col-span-2 bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium"
          >
            Davet Gönder
          </button>
        </form>
      </section>

      {/* AUTH-03: Mevcut kullanıcı rol güncelleme */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-medium">Kullanıcı Rolü Güncelle</h2>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="userId"
            required
            placeholder="Clerk user_id (user_...)"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            name="organizationId"
            placeholder="Clerk org_id (org rolü için)"
            className="border rounded px-3 py-2 text-sm"
          />
          <select name="role" required className="border rounded px-3 py-2 text-sm sm:col-span-2">
            <option value="">Rol seçin</option>
            <option value="superadmin">Süpervizör (superadmin)</option>
            <option value="org:admin">Klinik Yöneticisi (org:admin)</option>
            <option value="org:dentist">Diş Hekimi (org:dentist)</option>
            <option value="org:assistant">Asistan (org:assistant)</option>
          </select>
          <button
            type="submit"
            formAction="/api/superadmin/users/[userId]/role"
            className="sm:col-span-2 bg-secondary text-secondary-foreground rounded px-4 py-2 text-sm font-medium"
          >
            Rolü Güncelle
          </button>
        </form>
      </section>
    </main>
  )
}
