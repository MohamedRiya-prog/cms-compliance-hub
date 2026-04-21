'use client'

import { useState, useCallback, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Upload, FileText, AlertCircle, ChevronRight, Loader, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'
import { formatFileSize } from '@/lib/utils'

interface DetectedSection {
  sectionNumber: string
  title: string
  family: string
  label: string
  text: string
}

// Maps detection family codes → representative individual product code (for division lookup)
const DETECTION_FAMILY_REPR: Record<string, string> = {
  BDD_PRD: 'BDD',
  EVFD:    'EVFD',
  EFD:     'EFD',
  EFSD:    'EFSD',
  ESD:     'ESD',
  EVCD:    'VCD',
  SA:      'SA',
  FAL:     'FAL_A',
  PRD:     'PRD',
}

export default function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()

  const [productFamilies, setProductFamilies] = useState<Record<string, string>>({})

  // Built-in product families (hardcoded display names for products without labels in DB)
  const BUILTIN_FAMILIES: Record<string, string> = {
    BDD_PRD: 'Backdraft & Pressure Relief Dampers',
    EVFD: 'Fire Dampers',
    EFD: 'Motorized Fire Dampers',
    EFSD: 'Combination Fire & Smoke Dampers',
    ESD: 'Smoke Dampers',
    EVCD: 'Volume Control Dampers',
    SA: 'Sound Attenuators',
    FAL: 'Fresh Air Louvers',
    PRD: 'Barometric Relief Dampers',
  }

  // Load user role + divisions, then product families
  useEffect(() => {
    async function init() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      let isAdmin = false
      let divisions: string[] = []
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, divisions')
          .eq('id', user.id)
          .single()
        isAdmin = profile?.role === 'admin'
        divisions = (profile as unknown as { divisions?: string[] } | null)?.divisions ?? []
      }
      try {
        const res = await fetch('/api/admin/products')
        const rows: { family: string; label: string | null; division: string | null }[] = res.ok ? await res.json() : []

        // Build division map: product code → division
        const divisionMap = new Map<string, string>()
        for (const row of rows) {
          if (row.division) divisionMap.set(row.family, row.division)
        }

        const map: Record<string, string> = {}

        // Filter built-in detection families by division
        for (const [code, label] of Object.entries(BUILTIN_FAMILIES)) {
          const reprCode = DETECTION_FAMILY_REPR[code] ?? code
          const div = divisionMap.get(reprCode)
          if (isAdmin || !divisions.length || !div || divisions.includes(div)) {
            map[code] = label
          }
        }

        // Add custom products filtered by division
        for (const row of rows) {
          if (row.label && !(row.family in BUILTIN_FAMILIES)) {
            if (isAdmin || !divisions.length || !row.division || divisions.includes(row.division)) {
              map[row.family] = row.label
            }
          }
        }

        setProductFamilies(map)
      } catch {
        setProductFamilies(isAdmin || !divisions.length ? BUILTIN_FAMILIES : {})
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [mode, setMode] = useState<'file' | 'text'>('text')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [sections, setSections] = useState<DetectedSection[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [parsed, setParsed] = useState(false)
  const [error, setError] = useState('')
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [manualFamily, setManualFamily] = useState('')

  // Generation progress
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState<{ current: number; total: number; label: string } | null>(null)
  const [genDone, setGenDone] = useState<Set<number>>(new Set())
  const [genErrors, setGenErrors] = useState<Map<number, string>>(new Map())

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setSections([])
    setSelected(new Set())
    setError('')
    setParsed(false)
    setExtractedText('')
    setManualFamily('')
    setGenDone(new Set())
    setGenErrors(new Map())
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === sections.length
        ? new Set()
        : new Set(sections.map((_, i) => i))
    )
  }

  async function handleParse() {
    setParsing(true)
    setError('')
    setSections([])
    setSelected(new Set())
    setGenDone(new Set())
    setGenErrors(new Map())

    try {
      const fd = new FormData()
      if (mode === 'file' && file) {
        fd.append('file', file)
      } else if (mode === 'text' && pasteText) {
        fd.append('text', pasteText)
      }

      const res = await fetch('/api/documents/parse', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)
      const detected: DetectedSection[] = data.sections ?? []
      setSections(detected)
      setSelected(new Set(detected.map((_, i) => i))) // pre-select all
      setExtractedText(data.text ?? pasteText)
      setParsed(true)

      if (detected.length === 0) {
        setError('No HVAC sections were auto-detected. Select a product family below to generate manually.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  async function ensureDocUploaded(): Promise<string | null> {
    if (uploadedDocId) return uploadedDocId
    if (!file && !pasteText) return null

    const fd = new FormData()
    fd.append('projectId', projectId)
    if (file) {
      fd.append('file', file)
    } else {
      const blob = new Blob([pasteText], { type: 'text/plain' })
      fd.append('file', blob, 'spec.txt')
    }
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error)
    setUploadedDocId(d.document.id)
    return d.document.id
  }

  async function handleGenerateSelected() {
    const toGenerate = sections
      .map((s, i) => ({ section: s, index: i }))
      .filter(({ index }) => selected.has(index))

    if (toGenerate.length === 0) return
    setGenerating(true)
    setError('')
    setGenDone(new Set())
    setGenErrors(new Map())

    try {
      const docId = await ensureDocUploaded()

      for (let g = 0; g < toGenerate.length; g++) {
        const { section, index } = toGenerate[g]
        setGenStep({ current: g + 1, total: toGenerate.length, label: section.label })

        try {
          const res = await fetch('/api/compliance/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              specText: section.text,
              productFamily: section.family,
              specDocumentId: docId,
              projectId,
              title: `${section.sectionNumber} — ${section.label}`,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          setGenDone(prev => new Set([...prev, index]))
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed'
          setGenErrors(prev => new Map([...prev, [index, msg]]))
        }
      }

      setGenStep(null)
      router.push(`/projects/${projectId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setGenStep(null)
      setGenerating(false)
    }
  }

  async function handleGenerateManual() {
    if (!manualFamily) return
    setGenerating(true)
    setError('')
    setGenStep({ current: 1, total: 1, label: productFamilies[manualFamily] ?? manualFamily })

    try {
      const docId = await ensureDocUploaded()
      const res = await fetch('/api/compliance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specText: extractedText.slice(0, 12000),
          productFamily: manualFamily,
          specDocumentId: docId,
          projectId,
          title: productFamilies[manualFamily] ?? manualFamily,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGenStep(null)
      router.push(`/projects/${projectId}/reports/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenStep(null)
      setGenerating(false)
    }
  }

  const allSelected = sections.length > 0 && selected.size === sections.length
  const noneSelected = selected.size === 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={`/projects/${projectId}`}>
        <button className="flex items-center gap-2 text-sm mb-6 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Back to Project
        </button>
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>New Compliance Report</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Paste your specification text to detect HVAC sections and generate compliance tables</p>

        {/* File upload mode toggle — hidden, kept for future use */}
        {false && (
          <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--surface-2)' }}>
            {(['file', 'text'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
                style={{
                  background: mode === m ? 'var(--surface-3)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {m === 'file' ? 'Upload File' : 'Paste Text'}
              </button>
            ))}
          </div>
        )}

        {/* File drop zone — hidden, kept for future use */}
        {mode === 'file' && false && (
          <motion.div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            animate={{ scale: dragging ? 1.02 : 1 }}
            className="relative flex flex-col items-center justify-center py-14 px-6 rounded-2xl border-2 border-dashed mb-4 cursor-pointer transition-all"
            style={{
              background: dragging ? 'oklch(0.65 0.18 270 / 0.05)' : 'var(--surface-1)',
              borderColor: dragging ? 'var(--brand-primary)' : file ? 'oklch(0.72 0.19 155 / 0.5)' : 'var(--border-default)',
              boxShadow: dragging ? 'var(--shadow-glow)' : 'none',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <>
                <FileText size={32} className="mb-3" style={{ color: 'var(--status-comply)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file!.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatFileSize(file!.size)}</p>
              </>
            ) : (
              <>
                <Upload size={32} className="mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drop file here or click to browse</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, DOCX, XLSX — max 10MB</p>
              </>
            )}
          </motion.div>
        )}

        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder="Paste your specification text here…"
          rows={12}
          className="w-full rounded-xl p-4 text-sm font-mono resize-y mb-4"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-4 text-sm" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.button
          onClick={handleParse}
          disabled={parsing || generating || (mode === 'file' ? !file : !pasteText.trim())}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold mb-6 flex items-center justify-center gap-2"
          style={{
            background: 'var(--brand-primary)',
            color: 'oklch(0.98 0.002 260)',
            opacity: parsing || generating || (mode === 'file' ? !file : !pasteText.trim()) ? 0.5 : 1,
            cursor: parsing || generating || (mode === 'file' ? !file : !pasteText.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          {parsing ? <><Loader size={14} className="animate-spin" /> Detecting sections…</> : 'Detect HVAC Sections'}
        </motion.button>

        {/* Generation progress bar */}
        <AnimatePresence>
          {genStep && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 rounded-xl border"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Generating {genStep.current} of {genStep.total} — {genStep.label}
                </span>
                <Loader size={12} className="animate-spin" style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--brand-primary)' }}
                  animate={{ width: `${((genStep.current - 1) / genStep.total) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detected sections */}
        <AnimatePresence>
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={toggleAll}
                  disabled={generating}
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {allSelected
                    ? <CheckSquare size={15} style={{ color: 'var(--brand-primary)' }} />
                    : <Square size={15} style={{ color: 'var(--text-muted)' }} />
                  }
                  {sections.length} section{sections.length !== 1 ? 's' : ''} detected
                  {!allSelected && selected.size > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      · {selected.size} selected
                    </span>
                  )}
                </button>

                <motion.button
                  onClick={handleGenerateSelected}
                  disabled={generating || noneSelected}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: 'var(--brand-primary)',
                    color: 'oklch(0.98 0.002 260)',
                    opacity: generating || noneSelected ? 0.45 : 1,
                    cursor: generating || noneSelected ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating
                    ? <Loader size={10} className="animate-spin" />
                    : <ChevronRight size={10} />
                  }
                  Generate {selected.size > 0 ? `(${selected.size})` : ''}
                </motion.button>
              </div>

              <div className="space-y-2">
                {sections.map((section, i) => {
                  const isSelected = selected.has(i)
                  const isDone = genDone.has(i)
                  const errMsg = genErrors.get(i)
                  const isActive = genStep && sections.findIndex((_, idx) => idx === i) !== -1

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => !generating && toggleSelect(i)}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: isSelected ? 'oklch(0.65 0.18 270 / 0.06)' : 'var(--surface-1)',
                        borderColor: isSelected ? 'oklch(0.65 0.18 270 / 0.3)' : 'var(--border-subtle)',
                        opacity: generating && !isDone ? 0.7 : 1,
                      }}
                    >
                      {/* Checkbox */}
                      <div className="shrink-0">
                        {isDone
                          ? <CheckSquare size={16} style={{ color: 'var(--status-comply)' }} />
                          : errMsg
                            ? <AlertCircle size={16} style={{ color: 'var(--status-not-comply)' }} />
                            : isSelected
                              ? <CheckSquare size={16} style={{ color: 'var(--brand-primary)' }} />
                              : <Square size={16} style={{ color: 'var(--text-muted)' }} />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {section.sectionNumber} — {section.label}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: errMsg ? 'var(--status-not-comply)' : 'var(--text-muted)' }}>
                          {errMsg ?? `${section.family} · ${section.text.length.toLocaleString()} chars`}
                        </p>
                      </div>

                      {/* Active spinner */}
                      {generating && isActive && !isDone && !errMsg && (
                        <Loader size={13} className="animate-spin shrink-0" style={{ color: 'var(--brand-primary)' }} />
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual product family selection — shown after parsing when no sections found */}
        <AnimatePresence>
          {parsed && extractedText && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-xl border p-4"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                {sections.length > 0 ? 'Or generate manually' : 'Select product family'}
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Choose a product family and generate a compliance table from the full document text.
              </p>
              <div className="flex gap-2">
                <select
                  value={manualFamily}
                  onChange={e => setManualFamily(e.target.value)}
                  disabled={generating}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: manualFamily ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <option value="">Select product family…</option>
                  {Object.entries(productFamilies).map(([code, label]) => (
                    <option key={code} value={code}>{label} ({code})</option>
                  ))}
                </select>
                <motion.button
                  onClick={handleGenerateManual}
                  disabled={!manualFamily || generating}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shrink-0"
                  style={{
                    background: 'var(--brand-primary)',
                    color: 'oklch(0.98 0.002 260)',
                    opacity: !manualFamily || generating ? 0.5 : 1,
                    cursor: !manualFamily || generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? <Loader size={10} className="animate-spin" /> : <ChevronRight size={10} />}
                  Generate
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
