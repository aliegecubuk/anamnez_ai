// Client-side periodontal chart PDF (pdfmake, landscape A4 — 16 tooth columns).
// Cell format per tooth/side: "3·2·3" pocket depths (MB·B·DB / ML·L·DL),
// "•" appended when any point on that side bled. "–" = not measured (NULL ≠ 0).

import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import {
  BUCCAL_POINTS,
  LINGUAL_POINTS,
  UPPER_TEETH,
  LOWER_TEETH,
  type PerioMeasurementDTO,
  type PerioPoint,
} from '@/lib/perio/types'

export interface PerioPdfData {
  patientName: string
  sessionDate: string // pre-formatted tr-TR string
  measurements: PerioMeasurementDTO[]
}

type MeasIndex = Map<number, Partial<Record<PerioPoint, PerioMeasurementDTO>>>

function indexMeasurements(measurements: PerioMeasurementDTO[]): MeasIndex {
  const index: MeasIndex = new Map()
  for (const m of measurements) {
    const tooth = index.get(m.tooth_number) ?? {}
    tooth[m.point] = m
    index.set(m.tooth_number, tooth)
  }
  return index
}

function sideCell(
  index: MeasIndex,
  tooth: number,
  points: PerioPoint[],
  field: 'pocket_depth' | 'attachment_loss',
): TableCell {
  const entries = points.map((p) => index.get(tooth)?.[p])
  const values = entries.map((m) => {
    const v = m?.[field]
    return v === null || v === undefined ? '–' : String(v)
  })
  const bled = entries.some((m) => m?.bleeding === true)
  const empty = values.every((v) => v === '–')
  return {
    text: values.join('·') + (bled && field === 'pocket_depth' ? ' •' : ''),
    alignment: 'center',
    color: empty ? '#bbbbbb' : bled && field === 'pocket_depth' ? '#b91c1c' : undefined,
  }
}

function jawTable(
  title: string,
  teeth: readonly number[],
  frontLabel: string,
  backLabel: string,
  index: MeasIndex,
  includeAttachmentLoss: boolean,
): Content[] {
  const header: TableCell[] = [
    { text: '', style: 'tableHeader' },
    ...teeth.map((t) => ({ text: String(t), style: 'tableHeader', alignment: 'center' as const })),
  ]

  const body: TableCell[][] = [
    header,
    [
      { text: `${frontLabel} CD`, style: 'rowLabel' },
      ...teeth.map((t) => sideCell(index, t, BUCCAL_POINTS, 'pocket_depth')),
    ],
    [
      { text: `${backLabel} CD`, style: 'rowLabel' },
      ...teeth.map((t) => sideCell(index, t, LINGUAL_POINTS, 'pocket_depth')),
    ],
  ]

  if (includeAttachmentLoss) {
    body.push(
      [
        { text: `${frontLabel} AK`, style: 'rowLabel' },
        ...teeth.map((t) => sideCell(index, t, BUCCAL_POINTS, 'attachment_loss')),
      ],
      [
        { text: `${backLabel} AK`, style: 'rowLabel' },
        ...teeth.map((t) => sideCell(index, t, LINGUAL_POINTS, 'attachment_loss')),
      ],
    )
  }

  return [
    { text: title, style: 'groupHeader' },
    {
      table: {
        headerRows: 1,
        widths: [52, ...teeth.map(() => '*' as const)],
        body,
      },
      fontSize: 7,
      margin: [0, 2, 0, 10],
    },
  ]
}

export function buildPerioDocDefinition(data: PerioPdfData): TDocumentDefinitions {
  const index = indexMeasurements(data.measurements)
  const hasAttachmentLoss = data.measurements.some((m) => m.attachment_loss !== null)

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 40, 30, 40],
    info: { title: 'Periodontal Chart' },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'AnamnezAI — yapay zekâ destekli anamnez', fontSize: 7, color: '#999999' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7, color: '#999999' },
      ],
      margin: [30, 10, 30, 0],
    }),
    content: [
      { text: 'PERİODONTAL CHART', style: 'title' },
      {
        columns: [
          { text: [{ text: 'Hasta: ', bold: true }, data.patientName] },
          { text: [{ text: 'Seans tarihi: ', bold: true }, data.sessionDate], alignment: 'right' },
        ],
        fontSize: 10,
        margin: [0, 4, 0, 10],
      },
      ...jawTable('Üst Çene (Maksilla)', UPPER_TEETH, 'Bukkal', 'Palatal', index, hasAttachmentLoss),
      ...jawTable('Alt Çene (Mandibula)', LOWER_TEETH, 'Bukkal', 'Lingual', index, hasAttachmentLoss),
      {
        text: 'CD = cep derinliği (mm, MB·B·DB / ML·L·DL sırasıyla) · AK = ataşman kaybı · • = kanama · – = ölçülmedi (boş ≠ 0)',
        fontSize: 7,
        color: '#777777',
        margin: [0, 4, 0, 0],
      },
    ],
    styles: {
      title: { fontSize: 15, bold: true },
      groupHeader: { fontSize: 11, bold: true, color: '#0f766e', margin: [0, 8, 0, 2] },
      tableHeader: { bold: true, fillColor: '#f0fdfa' },
      rowLabel: { bold: true },
    },
    defaultStyle: { fontSize: 8, lineHeight: 1.2 },
  }
}

export async function downloadPerioPdf(data: PerioPdfData): Promise<void> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake')
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pdfMake = ((pdfMakeModule as any).default ?? pdfMakeModule) as any
  const pdfFonts = ((pdfFontsModule as any).default ?? pdfFontsModule) as any
  const vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs ?? pdfFonts
  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(vfs)
  } else {
    pdfMake.vfs = vfs
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const safeName = data.patientName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  const date = new Date().toISOString().slice(0, 10)
  pdfMake.createPdf(buildPerioDocDefinition(data)).download(`perio-${safeName}-${date}.pdf`)
}
