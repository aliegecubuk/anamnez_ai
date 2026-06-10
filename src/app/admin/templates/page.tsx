import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import TemplateList from '@/components/templates/TemplateList'
import CreateTemplateDialog from '@/components/templates/CreateTemplateDialog'
import type { TemplateListItem } from '@/lib/templates/types'

export const dynamic = 'force-dynamic'

export default async function AdminTemplatesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data, error } = await supabaseAdmin
    .from('form_templates')
    .select('id, name, department, current_version, updated_at, template_questions(count)')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[admin templates page]', { code: error.code, message: error.message })
  }

  const templates: TemplateListItem[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    department: t.department,
    current_version: t.current_version,
    question_count: (t.template_questions as { count: number }[] | null)?.[0]?.count ?? 0,
    updated_at: t.updated_at,
    latest_version_id: null, // admin list view does not use this; picker route resolves it
  }))

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <span aria-hidden>·</span>
            <span>Admin</span>
            <span aria-hidden>·</span>
            <span className="text-foreground">Şablonlar</span>
          </p>
          <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] leading-[1.02] tracking-tight text-foreground">
            Form Şablonları
          </h1>
          <p className="text-[15px] text-muted-foreground max-w-[52ch]">
            Bölüm bazlı anamnez formlarını oluştur, sorularını düzenle ve yayınla.
          </p>
        </div>

        <CreateTemplateDialog />
      </div>

      <TemplateList templates={templates} />
    </main>
  )
}
