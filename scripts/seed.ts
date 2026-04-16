import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Manually load .env.local (tsx doesn't auto-load it)
const envPath = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* .env.local not found */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Map a section heading to its individual product family code
function headingToFamilyCode(heading: string): string | null {
  const h = heading.toUpperCase()
  // Skip intro/meta headings
  if (h.includes('CENTURY MECHANICAL') || h.includes('EXCELAIR PRODUCT DATA')) return null

  if (h.startsWith('BDD') && !h.includes('PRD')) return 'BDD'
  if (h.startsWith('PRD') || h.includes('PRESSURE RELIEF')) return 'PRD'
  if (h.startsWith('EVFD')) return 'EVFD'
  if (h.startsWith('EFSD')) return 'EFSD'
  if (h.startsWith('EFD') && !h.includes('EFSD')) return 'EFD'
  if (h.startsWith('ESD') && !h.includes('EFSD')) return 'ESD'
  if (h.includes('ACTUATOR')) return 'ACTUATORS'
  if (h.includes('SOUND ATTENUATOR') || h.includes('DUCT SILENCER')) return 'SA'
  if (h.includes('VOLUME CONTROL') && (h.includes('CLASS I') || h.includes('LEKAGE'))) return 'VCD_C1'
  if (h.includes('VOLUME CONTROL') || h.includes('BALANCING DAMPER')) return 'VCD'
  if (h.includes('GAS TIGHT')) return 'GTD'
  if (h.includes('PRESSURE INDEPENDENT') || h.includes('VAV')) return 'VAV'
  if (h.includes('LOW LEAKAGE') && h.includes('ALUMINUM')) return 'LLVCD'
  if (h.includes('DEFLECTION') || (h.includes('GRILLE') && !h.includes('LINEAR'))) return 'SDGR'
  if (h.includes('LINEAR BAR') || (h.includes('LINEAR') && h.includes('GRILLE'))) return 'LBG'
  if (h.includes('LINEAR SLOT') || h.includes('SLOT DIFFUSER')) return 'LSD'
  if (h.includes('FLOW BAR')) return 'FBD'
  if (h.includes('ACOUSTIC LOUVER')) return 'AL'
  if (h.includes('SAND TRAP')) return 'STL'
  if (h.includes('FRESH AIR LOUVER') || h.startsWith('FAL')) return 'FAL_A'

  return null
}

// Split products.md into sections by ## headings, map each to a family code
function parseProductSections(content: string): Array<{ family: string; content: string }> {
  const lines = content.split('\n')
  const results: Array<{ family: string; content: string }> = []
  let currentHeading = ''
  let currentLines: string[] = []

  function flush() {
    if (!currentHeading) return
    const code = headingToFamilyCode(currentHeading)
    if (code) {
      results.push({ family: code, content: currentLines.join('\n').trimEnd() })
    }
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      currentHeading = line.slice(3).trim()
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return results
}

async function upsertProduct(
  admin: ReturnType<typeof createClient>,
  family: string,
  content: string
) {
  const { data: existing } = await admin
    .from('product_data')
    .select('id, version')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    const { error } = await admin
      .from('product_data')
      .update({ content, version: existing.version + 1 })
      .eq('id', existing.id)
    if (error) console.error(`  ${family} error:`, error.message)
    else console.log(`  ✓ ${family} updated (v${existing.version + 1})`)
  } else {
    const { error } = await admin
      .from('product_data')
      .insert({ family, content, version: 1 })
    if (error) console.error(`  ${family} error:`, error.message)
    else console.log(`  ✓ ${family} inserted`)
  }
}

async function seed() {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const rules = readFileSync(join(process.cwd(), 'references/rules.md'), 'utf-8')
  const products = readFileSync(join(process.cwd(), 'references/products.md'), 'utf-8')
  const examples = readFileSync(join(process.cwd(), 'references/examples.md'), 'utf-8')

  // ── Compliance rules ────────────────────────────────────────────────────────
  console.log('Seeding compliance_rules…')
  const { error: rulesError } = await admin
    .from('compliance_rules')
    .upsert({ content: rules, version: 1 }, { onConflict: 'id' })
  if (rulesError) console.error('Rules error:', rulesError.message)
  else console.log('✓ compliance_rules seeded')

  // ── Compliance examples ─────────────────────────────────────────────────────
  console.log('Seeding compliance_examples…')
  const { error: examplesError } = await admin
    .from('compliance_examples')
    .upsert({ content: examples, version: 1 }, { onConflict: 'id' })
  if (examplesError) console.error('Examples error:', examplesError.message)
  else console.log('✓ compliance_examples seeded')

  // ── Product data — ALL (full document) ─────────────────────────────────────
  console.log('\nSeeding product_data…')
  await upsertProduct(admin, 'ALL', products)

  // ── Product data — one record per section ──────────────────────────────────
  const sections = parseProductSections(products)
  for (const { family, content } of sections) {
    await upsertProduct(admin, family, content)
  }

  console.log('\nSeed complete.')
}

seed().catch(console.error)
