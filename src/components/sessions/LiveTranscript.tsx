'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

interface Props {
  segments: TranscriptSegmentDTO[]
  connected: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LiveTranscript({ segments, connected }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to newest segment when one is added.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [segments.length])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}
        />
        {connected ? 'Canlı transkript' : 'Bağlantı yeniden kuruluyor...'}
      </div>
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[160px] overflow-y-auto rounded-md border border-border bg-card p-4 space-y-2 text-sm leading-relaxed"
      >
        {segments.length === 0 ? (
          <p className="text-muted-foreground italic">
            Konuşmaya başladığınızda metin burada belirecek...
          </p>
        ) : (
          segments.map((seg) => (
            <p key={seg.sequence} className="text-foreground">
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {formatTime(seg.started_at)}
              </span>
              {seg.content || <span className="text-muted-foreground italic">[sessizlik]</span>}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
