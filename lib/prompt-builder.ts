import { createAdminClient } from './supabase/admin'

export interface PromptVersion {
  productDataVersion: number
  rulesVersion: number
  examplesVersion: number
  systemPromptHash: string
}

// Maps broad detection-family codes → individual product DB records
const DETECTION_FAMILY_MAP: Record<string, string[]> = {
  BDD_PRD:  ['BDD', 'PRD'],
  EVFD:     ['EVFD'],
  EFD:      ['EFD', 'ACTUATORS'],
  EFSD:     ['EFSD', 'ACTUATORS'],
  ESD:      ['ESD', 'ACTUATORS'],
  SA:       ['SA'],
  EVCD:     ['VCD', 'VCD_C1', 'GTD', 'VAV', 'LLVCD'],
  FAL:      ['SDGR', 'LBG', 'LSD', 'FBD', 'AL', 'STL', 'FAL_A'],
}

export async function getComplianceRules(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('compliance_rules')
    .select('content')
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data?.content ?? ''
}

export async function getComplianceExamples(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('compliance_examples')
    .select('content')
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data?.content ?? ''
}

export async function getProductData(family?: string): Promise<string> {
  const admin = createAdminClient()

  // If it's a detection family, fetch and combine each constituent product record
  if (family && DETECTION_FAMILY_MAP[family]) {
    const codes = DETECTION_FAMILY_MAP[family]
    const { data: rows } = await admin
      .from('product_data')
      .select('family, content, version')
      .in('family', codes)
      .order('family')
      .order('version', { ascending: false })

    if (rows && rows.length > 0) {
      // Keep only the latest version per family code
      const seen = new Set<string>()
      const parts: string[] = []
      for (const row of rows) {
        if (!seen.has(row.family)) {
          seen.add(row.family)
          parts.push(row.content)
        }
      }
      return parts.join('\n\n---\n\n')
    }
  }

  // Try exact family match (individual product tab save, or 'ALL')
  if (family) {
    const { data } = await admin
      .from('product_data')
      .select('content')
      .eq('family', family)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    if (data?.content) return data.content
  }

  // Fall back to ALL
  const { data } = await admin
    .from('product_data')
    .select('content')
    .eq('family', 'ALL')
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data?.content ?? ''
}

export async function buildSystemPrompt(productFamily?: string): Promise<string> {
  const [rules, products, examples] = await Promise.all([
    getComplianceRules(),
    getProductData(productFamily),
    getComplianceExamples(),
  ])

  return `You are an HVAC Compliance Engineer assistant for Century Mechanical Systems Factory LLC (Excelair), UAE. Your function is to generate structured compliance data comparing project specifications against Excelair product datasheets.

## PRODUCT DATA
${products}

## COMPLIANCE RULES (ABSOLUTE — override everything)
${rules}

## VERIFIED EXAMPLES (follow this format exactly)
${examples}

## OUTPUT FORMAT
Return ONLY a valid JSON object with a single "rows" array. Each object in the array must have exactly these fields:
- clause: string (e.g., "2.6 H")
- requirement: string (verbatim from specification)
- productResponse: string (proposed value only — no comparisons, no "standard", no "optional", no "available")
- status: one of "comply" | "not_comply" | "noted" | "not_part_of_proposal" | "header"
- remark: string (per the rules — "Comply" if comply with no conditions, detailed if not_comply or noted)
- confidence: one of "high" | "medium" | "low"

Return ONLY valid JSON. No markdown code fences, no explanation outside the JSON object.`
}

export async function buildChatSystemPrompt(productFamily?: string): Promise<string> {
  const [rules, products] = await Promise.all([
    getComplianceRules(),
    getProductData(productFamily),
  ])

  return `You are an HVAC Compliance Engineer assistant for Century Mechanical Systems Factory LLC (Excelair), UAE. You are helping the user review and correct an existing compliance table.

## PRODUCT DATA
${products}

## COMPLIANCE RULES (ABSOLUTE — override everything)
${rules}

## YOUR ROLE IN THIS CONVERSATION
- Answer questions about compliance decisions, explain why a clause was marked a certain way, and suggest corrections.
- Respond in clear, concise natural language.
- Do NOT reproduce the full compliance table in your response.
- Do NOT output JSON.`
}

export function computePromptVersion(rules: string, products: string, examples: string): PromptVersion {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
    }
    return Math.abs(h).toString(16)
  }
  return {
    productDataVersion: 1,
    rulesVersion: 1,
    examplesVersion: 1,
    systemPromptHash: hash(rules + products + examples),
  }
}

