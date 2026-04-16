export interface DetectedSection {
  sectionNumber: string
  title: string
  family: string
  label: string
  text: string
  startIndex: number
  endIndex: number
}

const SECTION_PATTERNS = [
  { pattern: /backdraft.*damper|pressure.*relief.*damper/i, family: 'BDD_PRD', label: 'Backdraft & Pressure Relief Dampers' },
  { pattern: /barometric.*relief.*damper/i, family: 'PRD', label: 'Barometric Relief Dampers' },
  { pattern: /motorized.*fire.*damper/i, family: 'EFD', label: 'Motorized Fire Dampers' },
  { pattern: /combination.*fire.*smoke|fire.*smoke.*damper/i, family: 'EFSD', label: 'Combination Fire & Smoke Dampers' },
  { pattern: /smoke\s+damper/i, family: 'ESD', label: 'Smoke Dampers' },
  { pattern: /(?:fire\s+damper|fusible\s+link\s+damper)/i, family: 'EVFD', label: 'Fire Dampers' },
  { pattern: /volume.*control.*damper|balancing.*damper|vcd/i, family: 'EVCD', label: 'Volume Control Dampers' },
  { pattern: /sound.*attenuator|duct.*silencer/i, family: 'SA', label: 'Sound Attenuators' },
  { pattern: /ventilation.*louver|exhaust.*louver|fresh.*air.*louver|air.*intake.*louver/i, family: 'FAL', label: 'Fresh Air Louvers' },
]

export function detectSections(text: string): DetectedSection[] {
  const sections: DetectedSection[] = []

  // Split text into sections by common numbering patterns
  const sectionRegex = /(?:^|\n)((?:SECTION\s+)?\d+[\.\d]*\s+[A-Z][^\n]{3,80})/gm
  const matches = [...text.matchAll(sectionRegex)]

  if (matches.length === 0) {
    // No clear sections — try to detect from the whole text
    for (const sp of SECTION_PATTERNS) {
      if (sp.pattern.test(text)) {
        sections.push({
          sectionNumber: '1',
          title: sp.label,
          family: sp.family,
          label: sp.label,
          text: text.slice(0, 8000),
          startIndex: 0,
          endIndex: text.length,
        })
      }
    }
    return sections
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const startIndex = match.index ?? 0
    const endIndex = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const sectionText = text.slice(startIndex, endIndex)
    const header = match[1].trim()

    for (const sp of SECTION_PATTERNS) {
      if (sp.pattern.test(header) || sp.pattern.test(sectionText.slice(0, 200))) {
        const numMatch = header.match(/^[\d\.]+/)
        sections.push({
          sectionNumber: numMatch ? numMatch[0] : String(i + 1),
          title: header,
          family: sp.family,
          label: sp.label,
          text: sectionText.slice(0, 12000),
          startIndex,
          endIndex,
        })
        break
      }
    }
  }

  return sections
}

export async function parsePDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return data.text
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function parseXLSX(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  return workbook.SheetNames.map(name =>
    XLSX.utils.sheet_to_txt(workbook.Sheets[name])
  ).join('\n\n')
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return parsePDF(buffer)
    case 'docx':
    case 'doc':
      return parseDOCX(buffer)
    case 'xlsx':
    case 'xls':
      return parseXLSX(buffer)
    default:
      return buffer.toString('utf-8')
  }
}
