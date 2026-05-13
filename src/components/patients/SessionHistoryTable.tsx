import Link from 'next/link'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { SessionSummary } from '@/lib/patients/types'

interface Props {
  sessions: SessionSummary[]
  patientId: string
}

// Format date: ISO string → "dd.MM.yyyy HH:mm" in tr-TR locale
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Form type display labels (Turkish)
const FORM_TYPE_LABELS: Record<SessionSummary['form_type'], string> = {
  genel: 'Genel',
  anamnez: 'Anamnez',
  perio: 'Perio',
  patoloji: 'Patoloji',
}

// Form type badge: className variant per UI-SPEC
// anamnez → default (neutral)
// perio → outline + text-primary
// patoloji → outline + warning color inline style
// genel → secondary
function FormTypeBadge({ type }: { type: SessionSummary['form_type'] }) {
  if (type === 'perio') {
    return (
      <Badge variant="outline" className="text-primary border-primary">
        {FORM_TYPE_LABELS[type]}
      </Badge>
    )
  }
  if (type === 'patoloji') {
    return (
      <Badge variant="outline" style={{ color: '#D97706', borderColor: '#D97706' }}>
        {FORM_TYPE_LABELS[type]}
      </Badge>
    )
  }
  if (type === 'genel') {
    return <Badge variant="secondary">{FORM_TYPE_LABELS[type]}</Badge>
  }
  // anamnez → default
  return <Badge>{FORM_TYPE_LABELS[type]}</Badge>
}

// Status badge
function StatusBadge({ status }: { status: SessionSummary['status'] }) {
  if (status === 'completed') {
    return <Badge variant="secondary">Tamamlandı</Badge>
  }
  return <Badge variant="outline">Taslak</Badge>
}

export default function SessionHistoryTable({ sessions, patientId }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <p className="text-base font-semibold">Henüz seans yok</p>
        <p className="text-sm text-muted-foreground">
          Bu hasta için yeni bir seans başlatmak için yukarıdaki butonu kullanın.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ width: '160px' }}>Tarih</TableHead>
          <TableHead style={{ width: '140px' }}>Form Tipi</TableHead>
          <TableHead style={{ width: '120px' }}>Durum</TableHead>
          <TableHead style={{ width: '100px' }}>İşlemler</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id} className="h-12">
            <TableCell className="text-sm">
              {formatDate(session.started_at)}
            </TableCell>
            <TableCell>
              <FormTypeBadge type={session.form_type} />
            </TableCell>
            <TableCell>
              <StatusBadge status={session.status} />
            </TableCell>
            <TableCell>
              <Link
                href={`/patients/${patientId}/sessions/${session.id}`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {session.status === 'completed' ? 'Görüntüle' : 'Devam et'}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
