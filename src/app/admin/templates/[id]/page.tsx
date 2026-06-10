import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import QuestionEditor from '@/components/templates/QuestionEditor'
import { DEPARTMENT_LABELS } from '@/components/templates/TemplateList'
import type { Department, TemplateQuestionRow } from '@/lib/templates/types'

export const dynamic = 'force-dynamic'

export default async function AdminTemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: template, error } = await supabaseAdmin
    .from('form_templates')
    .select('id, name, department, current_version, is_archived, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !template) notFound()

  const { data: questions } = await supabaseAdmin
    .from('template_questions')
    .select('id, user_id, template_id, prompt, question_type, options, position, required, created_at')
    .eq('template_id', id)
    .eq('user_id', userId)
    .order('position', { ascending: true })

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <span aria-hidden>·</span>
        <Link href="/admin/templates" className="hover:text-foreground transition-colors">
          Şablonlar
        </Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">{template.name}</span>
      </p>

      <header className="space-y-3 pb-8 border-b border-border">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {DEPARTMENT_LABELS[template.department as Department]}
          </Badge>
          {template.current_version > 0 ? (
            <Badge>v{template.current_version}</Badge>
          ) : (
            <Badge variant="outline">Taslak</Badge>
          )}
        </div>
        <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] leading-[1.02] tracking-tight text-foreground">
          {template.name}
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-[60ch]">
          Soruları düzenle, sırala ve hazır olduğunda yayınla. Yayınlanan sürümler
          değişmez — sonraki düzenlemeler yeni bir sürüm oluşturur.
        </p>
      </header>

      <QuestionEditor
        templateId={template.id}
        initialQuestions={(questions ?? []) as TemplateQuestionRow[]}
        currentVersion={template.current_version}
      />
    </main>
  )
}
