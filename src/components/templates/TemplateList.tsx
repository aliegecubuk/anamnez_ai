'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Department, TemplateListItem } from '@/lib/templates/types'

export const DEPARTMENT_LABELS: Record<Department, string> = {
  genel: 'Genel',
  periodontoloji: 'Periodontoloji',
  pedodonti: 'Pedodonti',
  endodonti: 'Endodonti',
  cerrahi: 'Cerrahi',
  ortodonti: 'Ortodonti',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function TemplateList({ templates }: { templates: TemplateListItem[] }) {
  const router = useRouter()

  if (templates.length === 0) {
    return (
      <div className="border-y border-border py-16 text-center">
        <p className="font-display text-[28px] leading-tight tracking-tight text-foreground">
          Henüz şablon yok.
        </p>
        <p className="mt-3 text-[15px] text-muted-foreground max-w-[44ch] mx-auto">
          İlk form şablonunu oluştur, sorularını ekle ve yayınla.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad</TableHead>
          <TableHead>Bölüm</TableHead>
          <TableHead>Sürüm</TableHead>
          <TableHead className="text-right">Soru sayısı</TableHead>
          <TableHead className="text-right">Güncellendi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((t) => (
          <TableRow
            key={t.id}
            className="cursor-pointer"
            onClick={() => router.push(`/admin/templates/${t.id}`)}
          >
            <TableCell className="font-medium">{t.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{DEPARTMENT_LABELS[t.department]}</Badge>
            </TableCell>
            <TableCell>
              {t.current_version > 0 ? (
                <Badge>v{t.current_version}</Badge>
              ) : (
                <Badge variant="outline">Taslak</Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{t.question_count}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatDate(t.updated_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
