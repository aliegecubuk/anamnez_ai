'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { pickSupportedMimeType } from '@/lib/sessions/codec'
import type { CreateSessionBody, FormType } from '@/lib/sessions/types'
import TemplatePicker from '@/components/sessions/TemplatePicker'

interface Props {
  patientId: string
  formType?: FormType        // defaults to 'genel' to match server default
  className?: string
  title?: string
}

export default function StartSessionButton({
  patientId,
  formType = 'genel',
  className = 'h-11 gap-2 self-start lg:self-end',
  title,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // The dentist picks a template first (TPLT-05); versionId may be null (no AI form).
  async function createSession(templateVersionId: string | null) {
    if (pending) return
    setPending(true)
    try {
      // 1. Negotiate codec on the client BEFORE creating the session.
      //    If the browser can't record, we fail loud — server never gets a session row.
      let audioFormat: ReturnType<typeof pickSupportedMimeType>
      try {
        audioFormat = pickSupportedMimeType()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Tarayıcı desteklenmiyor.')
        return
      }

      const body: CreateSessionBody = {
        patient_id: patientId,
        form_type: formType,
        audio_format: audioFormat,
        ...(templateVersionId ? { template_version_id: templateVersionId } : {}),
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? `Seans başlatılamadı (${res.status})`)
        return
      }
      const session = (await res.json()) as { id: string }
      router.push(`/patients/${patientId}/sessions/${session.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beklenmeyen hata.')
    } finally {
      setPending(false)
    }
  }

  // Perio / pathology sessions need no template — go straight to recording.
  const needsPicker = formType !== 'perio' && formType !== 'patoloji'

  function handleClick() {
    if (needsPicker) {
      setPickerOpen(true)
    } else {
      void createSession(null)
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={pending}
        className={className}
        title={title}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Başlatılıyor...
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            {title ?? 'Yeni Seans Başlat'}
          </>
        )}
      </Button>

      {needsPicker && (
        <TemplatePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(versionId) => void createSession(versionId)}
        />
      )}
    </>
  )
}
