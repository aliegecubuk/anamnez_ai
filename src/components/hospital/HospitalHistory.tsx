'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, History, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HOSPITAL_MODE_LABELS } from '@/lib/hospital/types'
import {
  RETENTION_OPTIONS,
  DEFAULT_RETENTION_DAYS,
  daysLeft,
  type HospitalRecordDTO,
} from '@/lib/hospital/records'

interface Props {
  // Bump to refetch after a new record is saved from the workspace.
  refreshKey: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function expiryChip(record: HospitalRecordDTO) {
  const left = daysLeft(record.expires_at)
  if (left === null) return 'Süresiz'
  if (left === 0) return 'Bugün silinir'
  return `${left} gün kaldı`
}

/**
 * Saved anamnesis snapshots: collapsible list above the workspace with a
 * read-only detail view, manual delete and the retention preference select.
 * The retention change applies only to records saved afterwards — existing
 * rows keep the expiry they were saved with.
 */
export default function HospitalHistory({ refreshKey }: Props) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<HospitalRecordDTO[] | null>(null)
  const [retention, setRetention] = useState<number | null>(DEFAULT_RETENTION_DAYS)
  const [savingRetention, setSavingRetention] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/hospital/records')
      if (!res.ok) throw new Error()
      setRecords((await res.json()) as HospitalRecordDTO[])
    } catch {
      toast.error('Geçmiş kayıtlar alınamadı.')
      setRecords([])
    }
  }, [])

  useEffect(() => {
    void fetchRecords()
  }, [fetchRecords, refreshKey])

  useEffect(() => {
    fetch('/api/hospital/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { retention_days: number | null } | null) => {
        if (data) setRetention(data.retention_days)
      })
      .catch(() => {})
  }, [])

  async function handleRetentionChange(value: string) {
    const retentionDays = value === 'none' ? null : Number(value)
    setSavingRetention(true)
    try {
      const res = await fetch('/api/hospital/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: retentionDays }),
      })
      if (!res.ok) throw new Error()
      setRetention(retentionDays)
      toast.success('Saklama süresi güncellendi.')
    } catch {
      toast.error('Saklama süresi kaydedilemedi.')
    } finally {
      setSavingRetention(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/hospital/records/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRecords((prev) => prev?.filter((r) => r.id !== id) ?? prev)
      if (expandedId === id) setExpandedId(null)
      toast.success('Kayıt silindi.')
    } catch {
      toast.error('Kayıt silinemedi.')
    } finally {
      setDeletingId(null)
      setConfirmingDeleteId(null)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <History className="h-4 w-4 text-primary" />
          Geçmiş Kayıtlar
          {records !== null && (
            <span className="text-xs font-normal text-muted-foreground">({records.length})</span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="hospital-retention" className="text-xs text-muted-foreground">
            Saklama süresi:
          </label>
          <select
            id="hospital-retention"
            value={retention === null ? 'none' : String(retention)}
            disabled={savingRetention}
            onChange={(e) => handleRetentionChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {RETENTION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} gün
              </option>
            ))}
            <option value="none">Otomatik silme yok</option>
          </select>
        </div>
      </div>

      {open && (
        <div className="border-t border-border">
          <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
            Süre değişikliği yeni kayıtlara uygulanır. Kayıtlarda kimlik ve konuşma metni saklanmaz;
            yalnızca anamnez çıktısı tutulur.
          </p>

          {records === null ? (
            <p className="inline-flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </p>
          ) : records.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Henüz kayıt yok — çalışma alanındaki <strong>Kaydet</strong> butonuyla anamnezi
              etiketleyip saklayabilirsiniz.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {records.map((record) => {
                const expanded = expandedId === record.id
                return (
                  <li key={record.id}>
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : record.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        title={record.label}
                      >
                        {record.label}
                      </button>
                      <Badge variant="secondary">{HOSPITAL_MODE_LABELS[record.mode]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(record.created_at)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          record.expires_at === null
                            ? 'border-border text-muted-foreground'
                            : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                        }`}
                      >
                        {expiryChip(record)}
                      </span>

                      {confirmingDeleteId === record.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Silinsin mi?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === record.id}
                            onClick={() => handleDelete(record.id)}
                          >
                            {deletingId === record.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'Evet'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingDeleteId(null)}
                          >
                            Vazgeç
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmingDeleteId(record.id)}
                          aria-label="Kaydı sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {expanded && (
                      <div className="space-y-4 border-t border-dashed border-border bg-secondary/20 px-4 py-4">
                        {record.entries.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Anamnez
                            </p>
                            <dl className="space-y-1.5">
                              {record.entries.map((e, i) => (
                                <div key={i} className="text-sm leading-relaxed">
                                  <dt className="inline font-medium text-foreground">{e.question}: </dt>
                                  <dd className="inline text-muted-foreground">{e.answer}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}

                        {record.exam_entries.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Fizik Muayene
                            </p>
                            <dl className="space-y-1.5">
                              {record.exam_entries.map((e, i) => (
                                <div key={i} className="text-sm leading-relaxed">
                                  <dt className="inline font-medium text-foreground">{e.question}: </dt>
                                  <dd className="inline text-muted-foreground">{e.answer}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Medula Metni
                          </p>
                          <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
                            {record.medula_text}
                          </p>
                        </div>

                        {record.ai_summary && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Klinik Özet
                            </p>
                            <p className="text-sm leading-relaxed text-foreground">
                              {record.ai_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
