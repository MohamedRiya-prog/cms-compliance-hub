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
  { pattern: /backdraft.*damper|pressure.*relief.*damper/i,                                                      family: 'BDD_PRD', label: 'Backdraft & Pressure Relief Dampers' },
  { pattern: /barometric.*relief.*damper/i,                                                                      family: 'PRD',     label: 'Barometric Relief Dampers' },
  { pattern: /motorized.*fire.*damper/i,                                                                         family: 'EFD',     label: 'Motorized Fire Dampers' },
  { pattern: /combination.*fire.*smoke|fire.*smoke.*damper/i,                                                    family: 'EFSD',    label: 'Combination Fire & Smoke Dampers' },
  { pattern: /smoke\s+damper/i,                                                                                  family: 'ESD',     label: 'Smoke Dampers' },
  { pattern: /fire\s+damper|fusible\s+link\s+damper/i,                                                          family: 'EVFD',    label: 'Fire Dampers' },
  { pattern: /volume.*control.*damper|balancing.*damper|\bvcd\b/i,                                              family: 'EVCD',    label: 'Volume Control Dampers' },
  // SA aliases: "sound attenuator", "duct attenuator", "duct silencer", "silencer", "noise attenuator"
  { pattern: /sound\s+attenuator|duct\s+attenuator|noise\s+attenuator|duct\s+silenc(?:er|ing)|\bsilencer\b/i,  family: 'SA',      label: 'Sound Attenuators' },
  { pattern: /ventilation.*louver|exhaust.*louver|fresh.*air.*louver|air.*intake.*louver/i,                     family: 'FAL',     label: 'Fresh Air Louvers' },
]

/**
 * Pattern that identifies a line as a pure cross-reference rather than a product heading.
 * e.g. "2.3.7.1 Equipment shall comply with Section 2.4.1"
 */
const CROSS_REF_RE = /shall\s+comply\s+with\s+(?:section|clause)\s+[\d\.]+/i

/**
 * Regex to match a numbered heading line.
 *
 * Group 1 — full heading text (used as display title)
 * Group 2 — section number only, e.g. "2.3.7" or "15820"
 *
 * Requires the first non-whitespace char after the number (and optional dash)
 * to be an uppercase letter so we don't match numbered list items mid-sentence.
 */
const HEADING_RE = /(?:^|\n)((?:SECTION\s+)?(\d+(?:\.\d+)*)\s*[-–—]?\s*[A-Z][^\n]{2,80})/gm

/** Number of dot-separated segments, e.g. "2.3.7" → 3, "15820" → 1 */
function dotDepth(num: string): number {
  return num.split('.').length
}

export interface SectionPattern {
  pattern: RegExp
  family: string
  label: string
}

/** Build a regex from a comma-separated keyword string, e.g. "ceiling fan, exhaust fan" */
export function buildDetectionPattern(keywords: string): RegExp {
  const terms = keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(terms.join('|'), 'i')
}

export function detectSections(text: string, extraPatterns: SectionPattern[] = []): DetectedSection[] {
  const allPatterns: SectionPattern[] = [...SECTION_PATTERNS, ...extraPatterns]
  const matches = [...text.matchAll(HEADING_RE)]

  // ── No numbered headings at all → whole-text fallback ──────────────────
  if (matches.length === 0) {
    const sections: DetectedSection[] = []
    for (const sp of allPatterns) {
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

  // ── Depth-aware section detection ──────────────────────────────────────
  //
  // Algorithm:
  //   For each heading (in document order):
  //     - If already "owned" by an ancestor product section, skip it.
  //     - Test ONLY the heading line itself against product patterns
  //       (not the body — that would cause a parent section like "2.3.7 Tunnel
  //       Ventilation Equipment" to match SA just because its first child is
  //       "2.3.7.1 Sound Attenuators").
  //     - If it matches a product pattern:
  //         • Collect all text up to the next heading at the SAME or LESSER
  //           depth (a sibling or parent), which is the natural boundary of
  //           this product section.
  //         • Mark every deeper heading inside that range as "owned" so they
  //           are not treated as separate product sections (they become rows
  //           in the compliance table, handled by Claude).
  //     - Skip headings that look like pure cross-references.
  //
  const owned = new Set<number>()
  const sections: DetectedSection[] = []

  for (let i = 0; i < matches.length; i++) {
    if (owned.has(i)) continue

    const match   = matches[i]
    const numStr  = match[2]               // e.g. "2.3.7"
    const header  = match[1].trim()        // full heading line
    const depth   = dotDepth(numStr)
    const startIdx = match.index ?? 0

    // Skip pure cross-reference headings
    if (CROSS_REF_RE.test(header)) continue

    // Test ONLY the heading line for a product keyword
    let matched: SectionPattern | null = null
    for (const sp of allPatterns) {
      if (sp.pattern.test(header)) { matched = sp; break }
    }
    if (!matched) continue

    // Determine section end: next heading at same or lesser depth
    let endIdx = text.length
    for (let j = i + 1; j < matches.length; j++) {
      const nextDepth = dotDepth(matches[j][2])
      if (nextDepth <= depth) {
        endIdx = matches[j].index ?? text.length
        break
      }
      // Deeper heading → sub-clause of this product section; mark as owned
      owned.add(j)
    }

    sections.push({
      sectionNumber: numStr,
      title:         header,
      family:        matched.family,
      label:         matched.label,
      text:          text.slice(startIdx, endIdx).slice(0, 12000),
      startIndex:    startIdx,
      endIndex:      endIdx,
    })
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

  const parts: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
    const lines = rows
      .map(row => row.map(cell => String(cell ?? '').trim()).filter(Boolean).join('  '))
      .filter(line => line.trim().length > 0)
    if (lines.length > 0) {
      parts.push(`[Sheet: ${sheetName}]\n` + lines.join('\n'))
    }
  }
  return parts.join('\n\n')
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  switch (fileType.toLowerCase()) {
    case 'pdf':  return parsePDF(buffer)
    case 'docx':
    case 'doc':  return parseDOCX(buffer)
    case 'xlsx':
    case 'xls':  return parseXLSX(buffer)
    default:     return buffer.toString('utf-8')
  }
}
