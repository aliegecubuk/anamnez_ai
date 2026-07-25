'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mic, RefreshCw } from 'lucide-react'

interface Props {
  // '' = browser default mic.
  value: string
  onChange: (deviceId: string) => void
  // Disabled while recording/paused — switching the source of a live stream
  // would require a restart, which stays under user control.
  disabled?: boolean
}

/**
 * Microphone input picker. Lists audioinput devices via enumerateDevices();
 * until mic permission is granted the labels come back empty, in which case a
 * note + manual refresh is shown instead. Selection persistence lives in the
 * parent (useMicDevice); this component is controlled.
 */
export default function MicSelector({ value, onChange, disabled = false }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'audioinput'))
    } catch {
      // Enumeration failed — keep whatever list we had.
    }
  }, [])

  useEffect(() => {
    refresh()
    // Plug/unplug (yaka mikrofonu takılınca) listeyi tazele.
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
  }, [refresh])

  const labelsVisible = devices.some((d) => d.label)
  // Stored device is unplugged right now — keep the selection so it applies
  // again when reconnected, but show it honestly in the list.
  const valueMissing = value !== '' && !devices.some((d) => d.deviceId === value)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
        <select
          aria-label="Mikrofon seçimi"
          className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Varsayılan mikrofon</option>
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Mikrofon ${i + 1}`}
            </option>
          ))}
          {valueMissing && (
            <option value={value}>Önceki mikrofon (şu an bağlı değil)</option>
          )}
        </select>
      </div>
      {!labelsVisible && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Mikrofon izni sonrası liste görünür.
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Yenile
          </button>
        </p>
      )}
    </div>
  )
}
