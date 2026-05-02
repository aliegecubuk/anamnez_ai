'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, Users, SearchX } from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import CreatePatientDialog from './CreatePatientDialog'
import type { PatientListItem } from '@/lib/patients/types'

interface Props {
  slug: string
}

export default function PatientTable({ slug }: Props) {
  const router = useRouter()
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const fetchPatients = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/orgs/${slug}/patients?q=${encodeURIComponent(q)}`
        )
        if (res.ok) {
          const data: PatientListItem[] = await res.json()
          setPatients(data)
        }
      } finally {
        setLoading(false)
      }
    },
    [slug]
  )

  // Initial load
  useEffect(() => {
    fetchPatients('')
  }, [fetchPatients])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, fetchPatients])

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="p-6 space-y-4">
      {/* Page header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hastalar</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>Yeni Hasta</Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 pr-9 h-10"
          placeholder="Ad veya TC ile ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery('')}
            aria-label="Aramayı temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Patient table or empty state */}
      {loading ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
          Yükleniyor...
        </div>
      ) : patients.length === 0 && !query ? (
        /* Empty state: no patients at all */
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold">Henüz hasta kaydı yok</p>
          <p className="text-sm text-muted-foreground">
            İlk hastanızı oluşturmak için &apos;Yeni Hasta&apos; butonuna tıklayın.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>Yeni Hasta</Button>
        </div>
      ) : patients.length === 0 && query ? (
        /* Empty state: no search results */
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold">Eşleşen hasta bulunamadı</p>
          <p className="text-sm text-muted-foreground">
            &apos;{query}&apos; için sonuç yok. TC kimlik numarasının tamamını veya adın bir bölümünü deneyin.
          </p>
          <Button variant="ghost" onClick={() => setQuery('')}>
            Aramayı Temizle
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead className="w-40">TC Kimlik No</TableHead>
              <TableHead className="w-36">Son Seans</TableHead>
              <TableHead className="w-24">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((p) => (
              <TableRow
                key={p.id}
                className="h-12 hover:bg-secondary cursor-pointer"
                onClick={() => router.push(`/orgs/${slug}/patients/${p.id}`)}
              >
                <TableCell>{p.full_name}</TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{p.tc_kimlik_no_masked}</span>
                </TableCell>
                <TableCell>{formatDate(p.last_session_at)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/orgs/${slug}/patients/${p.id}`}
                    className={cn(buttonVariants({ variant: 'link' }))}
                  >
                    Görüntüle
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreatePatientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        slug={slug}
        onSuccess={(p) => {
          setPatients((prev) => [p, ...prev])
          toast.success('Hasta başarıyla oluşturuldu.')
        }}
      />
    </div>
  )
}
