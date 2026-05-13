'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mic, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

interface Props {
  onGranted?: () => void
  children: ReactNode   // rendered only when state === 'granted'
}

export default function MicPermissionGate({ onGranted, children }: Props) {
  const [state, setState] = useState<PermissionState>('unknown')

  useEffect(() => {
    let mounted = true
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }
    // Permissions API is not available everywhere (notably older Safari).
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (!mounted) return
          setState(status.state as PermissionState)
          status.onchange = () => mounted && setState(status.state as PermissionState)
        })
        .catch(() => mounted && setState('prompt'))
    } else {
      setState('prompt')
    }
    return () => { mounted = false }
  }, [])

  async function requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Immediately stop the probe stream — useChunkedRecorder.start() will request a fresh one.
      stream.getTracks().forEach((t) => t.stop())
      setState('granted')
      onGranted?.()
    } catch {
      setState('denied')
    }
  }

  if (state === 'granted') return <>{children}</>

  if (state === 'unsupported') {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Tarayıcı desteklemiyor</p>
          <p className="text-sm text-muted-foreground">
            Bu tarayıcıda mikrofon kaydı yapılamıyor. Lütfen güncel Chrome veya Safari kullanın.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Mikrofon izni reddedildi</p>
          <p className="text-sm text-muted-foreground">
            Tarayıcınızın adres çubuğundaki kilit simgesinden mikrofon iznini etkinleştirin,
            ardından sayfayı yenileyin.
          </p>
        </div>
      </div>
    )
  }

  // unknown / prompt
  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        Sesli anamnez almak için mikrofon iznine ihtiyacımız var.
      </p>
      <Button onClick={requestPermission} className="gap-2">
        <Mic className="h-4 w-4" /> Mikrofon iznini ver
      </Button>
    </div>
  )
}
