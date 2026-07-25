// Hospital module PDF: identity header (device-only data, injected client-side)
// + the same flowing clinical text shown in the Medula box (bare negative
// answers keep their question heading — see src/lib/hospital/medula.ts).
// Optional sections: FİZİK MUAYENE findings and the AI clinical summary.
// NOTE: AI differentials and red flags are intentionally NOT printed — the PDF
// is the official record (Medula); the differential list stays on screen only.

import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { AI_INSIGHT_DISCLAIMER } from '@/lib/hospital/types'

export interface HospitalPdfData {
  fullName: string
  tcNo: string
  phone: string
  dateStr: string // pre-formatted tr-TR string
  modeLabel: string
  clinicalText: string
  examText?: string
  summary?: string // AI clinical summary — printed WITH the fixed disclaimer
}

const BLUE = '#1e40af'

export function buildHospitalDocDefinition(data: HospitalPdfData): TDocumentDefinitions {
  const optionalSections: Content[] = []
  if (data.examText) {
    optionalSections.push(
      { text: 'FİZİK MUAYENE', style: 'groupHeader' },
      { text: data.examText, margin: [0, 2, 0, 8], lineHeight: 1.4 },
    )
  }
  if (data.summary) {
    optionalSections.push(
      { text: 'KLİNİK ÖZET (YAPAY ZEKÂ)', style: 'groupHeader' },
      { text: data.summary, margin: [0, 2, 0, 4], lineHeight: 1.4 },
      { text: AI_INSIGHT_DISCLAIMER, fontSize: 7, color: '#999999', italics: true, margin: [0, 0, 0, 8] },
    )
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    info: { title: 'Hastane Anamnez Raporu' },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'AnamnezAI — yapay zekâ destekli anamnez', fontSize: 7, color: '#999999' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7, color: '#999999' },
      ],
      margin: [40, 10, 40, 0],
    }),
    content: [
      { text: 'HASTANE ANAMNEZ RAPORU', style: 'title' },
      {
        columns: [
          {
            stack: [
              { text: [{ text: 'Hasta: ', bold: true }, data.fullName || '—'] },
              { text: [{ text: 'TC: ', bold: true }, data.tcNo || '—'], margin: [0, 2, 0, 0] },
              { text: [{ text: 'Telefon: ', bold: true }, data.phone || '—'], margin: [0, 2, 0, 0] },
            ],
          },
          {
            stack: [
              { text: [{ text: 'Tarih: ', bold: true }, data.dateStr], alignment: 'right' },
              { text: [{ text: 'Mod: ', bold: true }, data.modeLabel], alignment: 'right', margin: [0, 2, 0, 0] },
            ],
          },
        ],
        fontSize: 10,
        margin: [0, 6, 0, 14],
      },
      { text: 'ANAMNEZ', style: 'groupHeader' },
      {
        text: data.clinicalText || 'Kayıt yok.',
        margin: [0, 2, 0, 8],
        lineHeight: 1.4,
      },
      ...optionalSections,
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      groupHeader: { fontSize: 12, bold: true, color: BLUE, margin: [0, 12, 0, 4] },
    },
    defaultStyle: { fontSize: 10, lineHeight: 1.25 },
  }
}

export async function downloadHospitalPdf(data: HospitalPdfData): Promise<void> {
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

  const safeName =
    data.fullName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'hasta'
  const date = new Date().toISOString().slice(0, 10)

  // download() fires the browser save dialog; resolves synchronously after queuing.
  pdfMake.createPdf(buildHospitalDocDefinition(data)).download(`anamnez-${safeName}-${date}.pdf`)
}
