export interface ComplianceRowInput {
  clause: string
  requirement: string
  productResponse?: string
  status: string
  remark?: string
  confidence?: string
}

const FORBIDDEN_WORDS = ['standard', 'optional', 'available', 'not confirmed', 'to be confirmed', 'tbc']

export function validateAndCorrectRow(row: ComplianceRowInput, index: number): ComplianceRowInput {
  const corrected = { ...row }

  // Rule 7: not_part_of_proposal must have blank product response
  if (corrected.status === 'not_part_of_proposal') {
    corrected.productResponse = ''
  }

  // Rule 6: comply with no conditions → remark must be "Comply"
  if (corrected.status === 'comply' && !corrected.remark?.toLowerCase().includes('condition')) {
    corrected.remark = 'Comply'
  }

  // Rule 1: Remove forbidden words from product response (flag for review)
  if (corrected.productResponse) {
    const lower = corrected.productResponse.toLowerCase()
    for (const word of FORBIDDEN_WORDS) {
      if (lower.includes(word)) {
        // Auto-flag with low confidence instead of silently removing
        corrected.confidence = 'low'
        break
      }
    }
  }

  // Rule 20: No "not confirmed" language in product response
  if (corrected.productResponse) {
    const lower = corrected.productResponse.toLowerCase()
    if (lower.includes('not confirmed') || lower.includes('to be confirmed') || lower.includes('tbc')) {
      corrected.productResponse = corrected.productResponse
        .replace(/not confirmed/gi, '')
        .replace(/to be confirmed/gi, '')
        .replace(/\btbc\b/gi, '')
        .trim()
      corrected.confidence = 'low'
    }
  }

  // Normalize status values
  const validStatuses = ['comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header']
  if (!validStatuses.includes(corrected.status)) {
    corrected.status = 'noted'
    corrected.confidence = 'low'
  }

  // Default confidence
  if (!corrected.confidence) corrected.confidence = 'high'

  return corrected
}

export function parseClaudeResponse(text: string): ComplianceRowInput[] {
  // Strip markdown code fences if present
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON object from the text
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No valid JSON found in Claude response')
    parsed = JSON.parse(match[0])
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Response is not a JSON object')
  }

  const obj = parsed as Record<string, unknown>
  const rows = Array.isArray(obj.rows) ? obj.rows : Array.isArray(parsed) ? parsed : []

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No rows found in Claude response')
  }

  return rows.map((row: unknown, i: number) => {
    if (typeof row !== 'object' || row === null) {
      return { clause: String(i + 1), requirement: '', status: 'noted', confidence: 'low' }
    }
    const r = row as Record<string, unknown>
    return validateAndCorrectRow({
      clause: String(r.clause ?? ''),
      requirement: String(r.requirement ?? ''),
      productResponse: r.productResponse != null ? String(r.productResponse) : undefined,
      status: String(r.status ?? 'noted'),
      remark: r.remark != null ? String(r.remark) : undefined,
      confidence: r.confidence != null ? String(r.confidence) : 'high',
    }, i)
  })
}

export function computeSummary(rows: ComplianceRowInput[]) {
  const dataRows = rows.filter(r => r.status !== 'header')
  return {
    total: dataRows.length,
    comply: dataRows.filter(r => r.status === 'comply').length,
    notComply: dataRows.filter(r => r.status === 'not_comply').length,
    noted: dataRows.filter(r => r.status === 'noted').length,
    notPartOfProposal: dataRows.filter(r => r.status === 'not_part_of_proposal').length,
  }
}
