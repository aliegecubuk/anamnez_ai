import type { AudioFormat } from '@/lib/sessions/types'

// Priority order: prefer opus (best quality at low bitrate); fall back to Safari mp4.
// Each entry MUST appear in the AudioFormat union AND in the sessions.audio_format DB CHECK.
export const CODEC_PRIORITY: AudioFormat[] = [
  'audio/webm;codecs=opus',         // Chrome, Edge, Firefox
  'audio/webm',                     // Chrome generic webm fallback
  'audio/mp4;codecs=mp4a.40.2',     // Safari ≥ 14.1 with explicit AAC LC codec
  'audio/mp4',                      // Safari generic mp4 fallback
  'audio/mpeg',                     // very rare; included for completeness
  'audio/wav',                      // last resort; massive payloads
]

export function isMimeTypeSupported(mime: AudioFormat): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.MediaRecorder === 'undefined') return false
  // Some browsers throw on unknown mimetypes; guard with try/catch.
  try {
    return window.MediaRecorder.isTypeSupported(mime)
  } catch {
    return false
  }
}

/**
 * Walks CODEC_PRIORITY and returns the first mimetype this browser can record.
 * Throws a descriptive Error if none work — caller surfaces this to the UI.
 */
export function pickSupportedMimeType(): AudioFormat {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    throw new Error(
      'Tarayıcınız ses kaydını desteklemiyor. Lütfen güncel Chrome veya Safari kullanın.',
    )
  }
  for (const mime of CODEC_PRIORITY) {
    if (isMimeTypeSupported(mime)) return mime
  }
  throw new Error(
    "Bu tarayıcıda desteklenen bir ses formatı bulunamadı. Lütfen Chrome veya Safari'nin son sürümünü kullanın.",
  )
}
