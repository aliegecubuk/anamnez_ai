// Client-side PDF export (pdfmake — built-in Roboto covers Turkish glyphs).
// Sections mirror the on-screen Özgeçmiş/Soygeçmiş layout so the hekim reads
// the same structure on paper.

import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import {
  AI_REPORT_DISCLAIMER,
  BLOCKS_TREATMENT_LABELS,
  GROUP_LABELS,
  GROUP_ORDER,
  SECTION_GROUPS,
  SECTION_LABELS,
  type AiReportDTO,
  type AnamnesisEntryDTO,
  type MedicationDTO,
  type SectionGroup,
} from '@/lib/anamnesis/structured-types'

export interface AnamnesisPdfData {
  patientName: string
  sessionDate: string // pre-formatted tr-TR string
  entries: AnamnesisEntryDTO[]
  medications: MedicationDTO[]
  report: AiReportDTO | null
}

function sectionContent(entries: AnamnesisEntryDTO[], sectionKey: string): Content {
  const items = entries.filter((e) => e.section_key === sectionKey).map((e) => e.content)
  if (items.length === 0) {
    return { text: 'Kayıt yok.', italics: true, color: '#777777', margin: [0, 2, 0, 8] }
  }
  return { ul: items, margin: [0, 2, 0, 8] }
}

function groupContent(group: SectionGroup, entries: AnamnesisEntryDTO[]): Content[] {
  const content: Content[] = [
    { text: GROUP_LABELS[group], style: 'groupHeader' },
  ]
  for (const key of SECTION_GROUPS[group]) {
    content.push({ text: SECTION_LABELS[key], style: 'sectionHeader' })
    content.push(sectionContent(entries, key))
  }
  return content
}

function medicationsContent(medications: MedicationDTO[]): Content[] {
  const content: Content[] = [{ text: 'KULLANILAN İLAÇLAR', style: 'groupHeader' }]
  if (medications.length === 0) {
    content.push({ text: 'Bildirilen ilaç yok.', italics: true, color: '#777777', margin: [0, 2, 0, 8] })
    return content
  }

  content.push({
    table: {
      headerRows: 1,
      widths: ['auto', 'auto', '*', '*', 'auto'],
      body: [
        [
          { text: 'İlaç', style: 'tableHeader' },
          { text: 'Etken Madde', style: 'tableHeader' },
          { text: 'Diş Hekimliği Önemi', style: 'tableHeader' },
          { text: 'Cerrahi / İşlem Önlemi', style: 'tableHeader' },
          { text: 'Engel Durumu', style: 'tableHeader' },
        ],
        ...medications.map((m) => [
          { text: m.name, bold: true },
          m.active_ingredient ?? '—',
          m.dental_significance ?? '—',
          m.surgical_precautions ?? '—',
          m.blocks_treatment ? BLOCKS_TREATMENT_LABELS[m.blocks_treatment] : '—',
        ]),
      ],
    },
    fontSize: 8,
    margin: [0, 2, 0, 4],
  })

  // Genel özetler ayrı satırlarda — tabloyu şişirmemek için.
  const summaries = medications.filter((m) => m.summary)
  if (summaries.length > 0) {
    content.push({
      ul: summaries.map((m) => ({ text: [{ text: `${m.name}: `, bold: true }, m.summary ?? ''] })),
      fontSize: 8,
      margin: [0, 2, 0, 8],
    })
  }
  return content
}

function reportContent(report: AiReportDTO | null): Content[] {
  const content: Content[] = [{ text: 'AI DEĞERLENDİRME RAPORU', style: 'groupHeader' }]
  if (!report) {
    content.push({ text: 'Rapor oluşturulmamış.', italics: true, color: '#777777' })
    return content
  }

  content.push({ text: report.summary, margin: [0, 2, 0, 8] })

  const listBlock = (title: string, items: string[]): Content[] =>
    items.length === 0
      ? []
      : [
          { text: title, style: 'sectionHeader' },
          { ul: items, margin: [0, 2, 0, 8] },
        ]

  content.push(
    ...listBlock('Dental tedavi planlamasında dikkat edilecekler', report.dental_considerations),
    ...listBlock('Risk uyarıları', report.risk_flags),
    ...listBlock('Öneriler', report.recommendations),
    { text: AI_REPORT_DISCLAIMER, italics: true, fontSize: 8, color: '#777777', margin: [0, 6, 0, 0] },
  )
  return content
}

export function buildAnamnesisDocDefinition(data: AnamnesisPdfData): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    info: { title: 'Hasta Anamnez Raporu' },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'AnamnezAI — yapay zekâ destekli anamnez', fontSize: 7, color: '#999999' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7, color: '#999999' },
      ],
      margin: [40, 10, 40, 0],
    }),
    content: [
      { text: 'HASTA ANAMNEZ RAPORU', style: 'title' },
      {
        columns: [
          { text: [{ text: 'Hasta: ', bold: true }, data.patientName] },
          { text: [{ text: 'Seans tarihi: ', bold: true }, data.sessionDate], alignment: 'right' },
        ],
        fontSize: 10,
        margin: [0, 4, 0, 14],
      },
      ...GROUP_ORDER.flatMap((group) => groupContent(group, data.entries)),
      ...medicationsContent(data.medications),
      ...reportContent(data.report),
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      groupHeader: {
        fontSize: 12,
        bold: true,
        color: '#0f766e',
        margin: [0, 12, 0, 4],
      },
      sectionHeader: { fontSize: 10, bold: true, margin: [0, 6, 0, 2] },
      tableHeader: { bold: true, fillColor: '#f0fdfa' },
    },
    defaultStyle: { fontSize: 9, lineHeight: 1.25 },
  }
}

export async function downloadAnamnesisPdf(data: AnamnesisPdfData): Promise<void> {
  // Dynamic import: pdfmake + embedded fonts are ~1MB, load only on demand.
  const pdfMakeModule = await import('pdfmake/build/pdfmake')
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pdfMake = ((pdfMakeModule as any).default ?? pdfMakeModule) as any
  const pdfFonts = ((pdfFontsModule as any).default ?? pdfFontsModule) as any
  // pdfmake 0.3: vfs_fonts exports the vfs object directly; 0.2 nests it.
  const vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs ?? pdfFonts
  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(vfs)
  } else {
    pdfMake.vfs = vfs
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const safeName = data.patientName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  const date = new Date().toISOString().slice(0, 10)
  pdfMake.createPdf(buildAnamnesisDocDefinition(data)).download(`anamnez-${safeName}-${date}.pdf`)
}
