import OpenAI from 'openai'
import type { AudioFormat } from '@/lib/sessions/types'

// Lazy singleton — avoids constructing the client during build / Edge runtime probing.
let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new WhisperError('OPENAI_API_KEY is not configured', 'missing_api_key')
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

export type WhisperErrorCode =
  | 'missing_api_key'
  | 'upstream_error'
  | 'unsupported_format'
  | 'empty_audio'

export class WhisperError extends Error {
  code: WhisperErrorCode
  constructor(message: string, code: WhisperErrorCode) {
    super(message)
    this.name = 'WhisperError'
    this.code = code
  }
}

// Map our AudioFormat to a filename extension Whisper accepts.
// Whisper uses the file's name extension to detect format — sending blob without
// a filename causes "Invalid file format" errors.
function extensionFor(format: AudioFormat): string {
  if (format.startsWith('audio/webm')) return 'webm'
  if (format.startsWith('audio/mp4')) return 'm4a'
  if (format === 'audio/mpeg') return 'mp3'
  if (format === 'audio/wav') return 'wav'
  throw new WhisperError(`Unsupported format: ${format}`, 'unsupported_format')
}

/**
 * Transcribe a single audio chunk via OpenAI Whisper.
 * - language is hardcoded to 'tr' (STT-02 explicit requirement).
 * - Uses 'whisper-1' model — gpt-4o-transcribe is also valid but whisper-1 is the
 *   broadly-available stable endpoint as of 2026-05; swap is a one-line change.
 * - Throws WhisperError on any failure; route handlers must catch and translate to HTTP.
 */
export async function transcribeAudio(
  audio: Blob | ArrayBuffer | Uint8Array,
  format: AudioFormat,
): Promise<string> {
  const ext = extensionFor(format)

  // Normalize to a Blob with proper type so the openai SDK gives it the right filename.
  let blob: Blob
  if (audio instanceof Blob) {
    blob = audio.size === 0
      ? (() => { throw new WhisperError('Empty audio chunk', 'empty_audio') })()
      : audio
  } else if (audio instanceof Uint8Array) {
    if (audio.byteLength === 0) throw new WhisperError('Empty audio chunk', 'empty_audio')
    blob = new Blob([audio.buffer as ArrayBuffer], { type: format })
  } else {
    if (audio.byteLength === 0) throw new WhisperError('Empty audio chunk', 'empty_audio')
    blob = new Blob([audio], { type: format })
  }

  // openai SDK accepts a File-like object — use Web File constructor (Node 20+ has it global).
  const file = new File([blob], `chunk.${ext}`, { type: format })

  const openai = getOpenAIClient()
  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'gpt-4o-transcribe',
      language: 'tr',
      response_format: 'json',
    })
    return result.text ?? ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Whisper error'
    throw new WhisperError(`Whisper API error: ${message}`, 'upstream_error')
  }
}
