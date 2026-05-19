import ExcelJS from 'exceljs'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'

pdfMake.addVirtualFileSystem(pdfFonts)

export type ExportRow = Record<string, string | number | boolean | null | undefined>

export type ReportSection = {
  title: string
  rows?: ExportRow[]
  items?: { label: string; value: string | number }[]
}

const today = () => new Date().toLocaleDateString('ru-RU')

const tableFromRows = (rows: ExportRow[] = []): Content => {
  const columns = Object.keys(rows[0] ?? { Данные: 'Нет данных' })
  return {
    table: {
      headerRows: 1,
      widths: columns.map(() => '*'),
      body: [
        columns.map((column) => ({ text: column, style: 'tableHeader' })),
        ...(rows.length ? rows.map((row) => columns.map((column) => String(row[column] ?? ''))) : [[{ text: 'Нет данных', colSpan: columns.length }, ...columns.slice(1).map(() => '')]]),
      ],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 6, 0, 14],
  }
}

const keyValueTable = (items: { label: string; value: string | number }[] = []): Content => ({
  table: {
    widths: ['38%', '*'],
    body: items.map((item) => [
      { text: item.label, color: '#475569' },
      { text: String(item.value), bold: true },
    ]),
  },
  layout: 'noBorders',
  margin: [0, 6, 0, 14],
})

const buildDocument = (title: string, sections: ReportSection[], options?: { subtitle?: string; client?: string; orientation?: 'portrait' | 'landscape' }): TDocumentDefinitions => {
  const content: Content[] = [
    {
      columns: [
        { text: 'ConcreteCore', style: 'logo' },
        { text: `Дата: ${today()}`, alignment: 'right', color: '#475569' },
      ],
    },
    { text: 'Concrete Supply CRM', color: '#64748b', margin: [0, 0, 0, 18] },
    { text: title, style: 'title' },
  ]

  if (options?.subtitle) content.push({ text: options.subtitle, color: '#475569', margin: [0, 2, 0, 8] })
  if (options?.client) content.push({ text: `Клиент: ${options.client}`, bold: true, margin: [0, 0, 0, 12] })

  sections.forEach((section) => {
    content.push({ text: section.title, style: 'section' })
    if (section.items) content.push(keyValueTable(section.items))
    if (section.rows) content.push(tableFromRows(section.rows))
  })

  content.push({
      columns: [
        { text: 'Клиент ______________________', margin: [0, 28, 0, 0] },
        { text: 'Компания ____________________', alignment: 'right', margin: [0, 28, 0, 0] },
      ],
    })

  return {
    pageSize: 'A4',
    pageOrientation: options?.orientation ?? 'portrait',
    pageMargins: [36, 34, 36, 46],
    content,
    styles: {
      logo: { fontSize: 18, bold: true, color: '#0f55d9' },
      title: { fontSize: 20, bold: true, color: '#0f172a', margin: [0, 0, 0, 8] },
      section: { fontSize: 13, bold: true, color: '#0f55d9', margin: [0, 12, 0, 2] },
      tableHeader: { bold: true, fillColor: '#eef4ff', color: '#0f172a' },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.25,
    },
  }
}

export const exportPdf = (title: string, rows: ExportRow[], filename: string) => {
  pdfMake.createPdf(buildDocument(title, [{ title: 'Данные отчёта', rows }], { orientation: rows.length && Object.keys(rows[0]).length > 6 ? 'landscape' : 'portrait' })).download(`${filename}.pdf`)
}

export const exportReportPdf = (title: string, sections: ReportSection[], filename: string, options?: { subtitle?: string; client?: string; orientation?: 'portrait' | 'landscape' }) => {
  pdfMake.createPdf(buildDocument(title, sections, options)).download(`${filename}.pdf`)
}

export const printReport = (title: string, sections: ReportSection[], options?: { subtitle?: string; client?: string; orientation?: 'portrait' | 'landscape' }) => {
  pdfMake.createPdf(buildDocument(title, sections, options)).print()
}

export const exportExcel = async (rows: ExportRow[], filename: string, title = 'CRM') => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Concrete Supply CRM'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet(title.slice(0, 28) || 'CRM')
  const columns = Object.keys(rows[0] ?? { Данные: 'Нет данных' })

  worksheet.addRow([title])
  worksheet.addRow([`Дата: ${today()}`])
  worksheet.addRow([])
  worksheet.columns = columns.map((column) => ({
    header: column,
    key: column,
    width: Math.max(16, column.length + 6),
  }))
  worksheet.spliceRows(4, 0, columns)
  rows.forEach((row) => worksheet.addRow(row))
  const headerRow = worksheet.getRow(4)
  headerRow.font = { bold: true, color: { argb: '0F172A' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF4FF' } }
  worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: '0F55D9' } }
  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
