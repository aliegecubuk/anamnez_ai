'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowUpRight, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CreatePatientDialog from './CreatePatientDialog'
import type { PatientListItem } from '@/lib/patients/types'

export default function PatientTable() {
  const router = useRouter()
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const fetchPatients = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: PatientListItem[] = await res.json()
        setPatients(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients('')
  }, [fetchPatients])

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(query), 300)
    return () => clearTimeout(timer)
  }, [query, fetchPatients])

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Header — editorial */}
      <div className="mb-10 flex items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span aria-hidden>·</span>
            <span>Hastalar</span>
          </p>
          <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] leading-[1.02] tracking-tight text-foreground">
            Hastalar
          </h1>
          <p className="text-[15px] text-muted-foreground max-w-[52ch]">
            Kayıtlı hastalarını ad veya TC ile ara, yeni hasta ekle, profilden seans geçmişini incele.
          </p>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="h-11 shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" />
          Yeni Hasta
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10 pr-10 h-11 bg-card focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Ad veya TC ile ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setQuery('')}
            aria-label="Aramayı temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Yükleniyor…</p>
      ) : patients.length === 0 && !query ? (
        <EmptyState onCreate={() => setCreateDialogOpen(true)} />
      ) : patients.length === 0 && query ? (
        <NoResults query={query} onClear={() => setQuery('')} />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {patients.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => router.push(`/patients/${p.id}`)}
                className="group w-full grid grid-cols-[1fr_auto] items-center gap-6 py-5 text-left transition-colors hover:bg-secondary/40 -mx-2 px-2 rounded-md"
              >
                <div className="min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 sm:gap-6">
                  <span className="font-display text-[20px] leading-tight tracking-tight text-foreground truncate">
                    {p.full_name}
                  </span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {p.tc_kimlik_no_masked}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Son seans: <span className="text-foreground">{formatDate(p.last_session_at)}</span>
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all duration-300 ease-out group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreatePatientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(p) => {
          setPatients((prev) => [p, ...prev])
          toast.success('Hasta oluşturuldu.')
        }}
      />
    </main>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border-y border-border py-16 text-center">
      <p className="font-display text-[28px] leading-tight tracking-tight text-foreground">
        Henüz hastan yok.
      </p>
      <p className="mt-3 text-[15px] text-muted-foreground max-w-[44ch] mx-auto">
        İlk kaydını oluştur. Ad ve TC kimlik yeterli, gerisi ses ile dolar.
      </p>
      <Button onClick={onCreate} className="mt-6 h-11 gap-2">
        <Plus className="h-4 w-4" />
        İlk Hastayı Ekle
      </Button>
    </div>
  )
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="border-y border-border py-16 text-center">
      <p className="font-display text-[24px] leading-tight tracking-tight text-foreground">
        Eşleşen hasta yok.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        “{query}” için sonuç yok. TC&apos;nin tamamını veya adın bir parçasını dene.
      </p>
      <Button variant="outline" onClick={onClear} className="mt-6 h-10">
        Aramayı temizle
      </Button>
    </div>
  )
}
