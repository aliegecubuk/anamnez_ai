// Evaluation harness for the hospital anamnesis extractor
// (src/lib/openai/hospital-anamnesis.ts -> parseHospitalAnamnesis).
//
// Modes:
//   --mock   No OpenAI call. A deterministic stub simulates a "decent model"
//            (question-title variants + light answer rewording) so the harness,
//            matching and metric logic can be validated offline / in CI.
//   default  Live mode. Reads OPENAI_API_KEY from .env.local (never printed)
//            and calls the real parseHospitalAnamnesis.
//
// Usage:
//   npm run eval            -> live mode, all golden cases
//   npm run eval:mock       -> mock mode, all golden cases
//   npm run eval -- --case acil-karin-agrisi
//
// Exit codes: 0 = all cases pass, 1 = at least one case failed, 2 = usage/env error.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { HospitalMode } from '../src/lib/hospital/types'
import {
  ANSWER_OVERLAP_THRESHOLD,
  DEFAULT_MIN_PRECISION,
  DEFAULT_MIN_RECALL,
  evaluateCase,
  QUESTION_JACCARD_THRESHOLD,
  type CaseReport,
  type ExtractResult,
  type GoldenCase,
} from './score.js'

type ParseFn = (transcript: string, mode: HospitalMode) => Promise<ExtractResult>

// ---------------------------------------------------------------------------
// Mock parser — simulates a decent model, deterministically.
// Question titles are swapped for near-synonym variants and answers get light
// rewording so the fuzzy matcher is what makes the run pass, not string equality.
// ---------------------------------------------------------------------------

const QUESTION_VARIANTS: Record<string, string> = {
  Şikâyet: 'Ana şikâyet',
  'Şikâyet süresi': 'Şikâyet süresi ve başlangıcı',
  'Eşlik eden semptomlar': 'Eşlik eden semptomlar ve yakınmalar',
  'Kronik hastalıklar': 'Bilinen kronik hastalıklar',
  'Kullandığı ilaçlar': 'Kullandığı ilaçlar (düzenli)',
}

const ANSWER_REWORDING: Array<[RegExp, string]> = [
  [/\bmevcut\b/g, 'var'],
  [/\byok\b/g, 'bulunmuyor'],
]

function mockParseFor(gc: GoldenCase): ParseFn {
  return async () => ({
    entries: gc.expected_entries.map((e) => ({
      question: QUESTION_VARIANTS[e.question] ?? e.question,
      answer: ANSWER_REWORDING.reduce((s, [re, sub]) => s.replace(re, sub), e.answer),
    })),
  })
}

// ---------------------------------------------------------------------------
// Live mode: .env.local loading + dynamic import of the real extractor
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), '.env.local')
  if (!existsSync(file)) return
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

async function loadLiveParser(): Promise<ParseFn> {
  loadEnvLocal()
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY bulunamadı. .env.local dosyasına ekleyin ya da --mock ile çalıştırın.',
    )
  }
  // Variable specifier so tsc does not resolve the .ts extension; Node's
  // type-stripping runtime + evals/alias-loader.mjs handle it at run time.
  const specifier = '../src/lib/openai/hospital-anamnesis.ts'
  const mod = (await import(specifier)) as { parseHospitalAnamnesis: ParseFn }
  return mod.parseHospitalAnamnesis
}

// ---------------------------------------------------------------------------
// Golden case loading
// ---------------------------------------------------------------------------

function loadGoldenCases(caseFilter?: string): GoldenCase[] {
  const dir = path.resolve(process.cwd(), 'evals/golden')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const cases: GoldenCase[] = files.map((f) => {
    const gc = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as GoldenCase
    if (!gc.id || !gc.mode || !gc.transcript || !Array.isArray(gc.expected_entries)) {
      throw new Error(`Geçersiz golden vaka dosyası: ${f} (id/mode/transcript/expected_entries zorunlu)`)
    }
    if (!Array.isArray(gc.forbidden_entries)) gc.forbidden_entries = []
    return gc
  })
  if (caseFilter) {
    const filtered = cases.filter((c) => c.id === caseFilter)
    if (filtered.length === 0) {
      throw new Error(`--case '${caseFilter}' ile eşleşen vaka yok. Mevcut: ${cases.map((c) => c.id).join(', ')}`)
    }
    return filtered
  }
  return cases
}

// ---------------------------------------------------------------------------
// Output: console table + timestamped JSON report
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toFixed(2)
}

function printTable(reports: CaseReport[]): void {
  const rows = reports.map((r) => [
    r.id,
    r.mode,
    fmt(r.precision),
    fmt(r.recall),
    String(r.hallucinations),
    r.pass ? 'PASS' : 'FAIL',
  ])
  const header = ['Vaka', 'Mod', 'P', 'R', 'Hall', 'Durum']
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()

  console.log('\nSonuçlar')
  console.log(line(header))
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  for (const r of rows) console.log(line(r))

  const totalMatched = reports.reduce((s, r) => s + r.matched, 0)
  const totalExtracted = reports.reduce((s, r) => s + r.extractedCount, 0)
  const totalExpected = reports.reduce((s, r) => s + r.expectedCount, 0)
  const totalHalluc = reports.reduce((s, r) => s + r.hallucinations, 0)
  const microP = totalExtracted === 0 ? 1 : totalMatched / totalExtracted
  const microR = totalExpected === 0 ? 1 : totalMatched / totalExpected
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  console.log(line(['GENEL (mikro)', '-', fmt(microP), fmt(microR), String(totalHalluc), reports.every((r) => r.pass) ? 'PASS' : 'FAIL']))
}

function printDetails(reports: CaseReport[]): void {
  for (const r of reports) {
    if (r.missing.length === 0 && r.forbiddenHits.length === 0 && r.ungrounded.length === 0) continue
    console.log(`\n[${r.id}] detay:`)
    for (const m of r.missing) console.log(`  - KAÇIRILAN (recall): "${m.question}" -> ${m.answer}`)
    for (const f of r.forbiddenHits)
      console.log(`  - YASAKLI (hallucination): "${f.question}" -> ${f.answer}${f.reason ? `  (${f.reason})` : ''}`)
    for (const u of r.ungrounded) console.log(`  - GROUNDINGSİZ (hallucination): "${u.question}" -> ${u.answer}`)
  }
}

function writeReport(
  reports: CaseReport[],
  meta: { mode: 'mock' | 'live'; startedAt: Date },
): string {
  const totalMatched = reports.reduce((s, r) => s + r.matched, 0)
  const totalExtracted = reports.reduce((s, r) => s + r.extractedCount, 0)
  const totalExpected = reports.reduce((s, r) => s + r.expectedCount, 0)
  const totalHalluc = reports.reduce((s, r) => s + r.hallucinations, 0)
  const report = {
    generated_at: meta.startedAt.toISOString(),
    run_mode: meta.mode,
    model: meta.mode === 'mock' ? 'mock-stub' : 'gpt-4o',
    thresholds: {
      min_precision: DEFAULT_MIN_PRECISION,
      min_recall: DEFAULT_MIN_RECALL,
      answer_overlap: ANSWER_OVERLAP_THRESHOLD,
      question_jaccard: QUESTION_JACCARD_THRESHOLD,
    },
    summary: {
      cases: reports.length,
      passed: reports.filter((r) => r.pass).length,
      failed: reports.filter((r) => !r.pass).length,
      precision_micro: totalExtracted === 0 ? 1 : totalMatched / totalExtracted,
      recall_micro: totalExpected === 0 ? 1 : totalMatched / totalExpected,
      hallucinations: totalHalluc,
    },
    cases: reports,
  }
  const dir = path.resolve(process.cwd(), 'evals/results')
  mkdirSync(dir, { recursive: true })
  const stamp = meta.startedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-')
  const file = path.join(dir, `eval-${meta.mode}-${stamp}.json`)
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8')
  return file
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`Hastane anamnez çıkarımı — evaluation harness

Kullanım:
  npm run eval                    Canlı mod: tüm golden vakalar (OPENAI_API_KEY gerekir, .env.local okunur)
  npm run eval:mock               Mock mod: OpenAI çağrısı yapılmaz, harness doğrulanır (CI güvenli)

Seçenekler:
  --mock                          Modeli deterministik bir stub ile değiştirir.
  --case <id>                     Yalnızca verilen golden vakayı çalıştırır (örn. --case dis-agrisi).
  -h, --help                      Bu yardımı gösterir.

Çıkış kodları:
  0  Tüm vakalar geçti (P/R >= eşik ve hallucination = 0)
  1  En az bir vaka başarısız
  2  Kullanım ya da ortam hatası (örn. OPENAI_API_KEY eksik)

Raporlar: evals/results/eval-<mod>-<zaman>.json (git'e girmez)`)
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return 0
  }
  const mock = args.includes('--mock')
  const caseIdx = args.indexOf('--case')
  const caseFilter = caseIdx >= 0 ? args[caseIdx + 1] : undefined
  const known = new Set(['--mock', '--case', '--help', '-h'])
  const unknown = args.filter((a) => a.startsWith('-') && !known.has(a))
  if (unknown.length > 0 || (caseIdx >= 0 && !caseFilter)) {
    console.error(`Geçersiz argüman: ${unknown.join(' ') || '--case (değer eksik)'}\n`)
    printHelp()
    return 2
  }

  let cases: GoldenCase[]
  let liveParse: ParseFn | null = null
  try {
    cases = loadGoldenCases(caseFilter)
    if (!mock) liveParse = await loadLiveParser()
  } catch (err) {
    console.error(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  console.log(`MOD: ${mock ? 'mock (OpenAI çağrısı yok)' : 'canlı (gpt-4o, OPENAI_API_KEY bulundu — yazdırılmıyor)'}`)
  console.log(`Vaka sayısı: ${cases.length}\n`)

  const startedAt = new Date()
  const reports: CaseReport[] = []
  for (const gc of cases) {
    const parse = mock ? mockParseFor(gc) : liveParse!
    process.stdout.write(`- ${gc.id} (${gc.mode}) çalışıyor... `)
    try {
      const result = await parse(gc.transcript, gc.mode)
      reports.push(evaluateCase(gc, result))
      console.log('tamam')
    } catch (err) {
      console.log('HATA')
      console.error(`  ${err instanceof Error ? err.message : String(err)}`)
      return 1
    }
  }

  printTable(reports)
  printDetails(reports)
  const reportFile = writeReport(reports, { mode: mock ? 'mock' : 'live', startedAt })
  console.log(`\nRapor: ${path.relative(process.cwd(), reportFile)}`)

  const failed = reports.filter((r) => !r.pass).length
  console.log(failed === 0 ? '\nTüm vakalar geçti.' : `\n${failed} vaka BAŞARISIZ.`)
  return failed === 0 ? 0 : 1
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    console.error(`Beklenmeyen hata: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 2
  })
