'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Upload, FileText, AlertCircle, ChevronRight, Loader } from 'lucide-react'
import Link from 'next/link'
import { formatFileSize } from '@/lib/utils'

interface DetectedSection {
  sectionNumber: string
  title: string
  family: string
  label: string
  text: string
}

const PRODUCT_FAMILIES: Record<string, string> = {
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

export default function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sections, setSections] = useState<DetectedSection[]>([])
  const [parsed, setParsed] = useState(false)
  const [error, setError] = useState('')
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [manualFamily, setManualFamily] = useState('')

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setSections([])
    setError('')
    setParsed(false)
    setExtractedText('')
    setManualFamily('')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  async function handleParse() {
    setParsing(true)
    setError('')
    setSections([])

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
      setSections(data.sections ?? [])
      setExtractedText(data.text ?? pasteText)
      setParsed(true)

      if ((data.sections ?? []).length === 0) {
        setError('No HVAC sections were auto-detected. Select a product family below to generate manually.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  async function handleGenerate(section: DetectedSection) {
    setGenerating(true)
    setError('')

    try {
      // Upload file first if not done
      let docId = uploadedDocId
      if (!docId && (file || pasteText)) {
        const fd = new FormData()
        fd.append('projectId', projectId)
        if (file) {
          fd.append('file', file)
        } else {
          const textBlob = new Blob([pasteText], { type: 'text/plain' })
          fd.append('file', textBlob, 'spec.txt')
        }
        const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error)
        docId = uploadData.document.id
        setUploadedDocId(docId)
      }

      // Generate compliance report
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

      router.push(`/projects/${projectId}/reports/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={`/projects/${projectId}`}>
        <button className="flex items-center gap-2 text-sm mb-6 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Back to Project
        </button>
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload Specification</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Upload a PDF, Word, or Excel spec — or paste text directly</p>

        {/* Mode toggle */}
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

        {mode === 'file' ? (
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
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatFileSize(file.size)}</p>
              </>
            ) : (
              <>
                <Upload size={32} className="mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drop file here or click to browse</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, DOCX, XLSX — max 10MB</p>
              </>
            )}
          </motion.div>
        ) : (
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
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-4 text-sm" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.button
          onClick={handleParse}
          disabled={parsing || (mode === 'file' ? !file : !pasteText.trim())}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold mb-6 flex items-center justify-center gap-2"
          style={{
            background: 'var(--brand-primary)',
            color: 'oklch(0.98 0.002 260)',
            opacity: parsing || (mode === 'file' ? !file : !pasteText.trim()) ? 0.5 : 1,
            cursor: parsing || (mode === 'file' ? !file : !pasteText.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          {parsing ? <><Loader size={14} className="animate-spin" /> Detecting sections…</> : 'Detect HVAC Sections'}
        </motion.button>

        {/* Detected sections */}
        <AnimatePresence>
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                Detected Sections ({sections.length})
              </h2>
              <div className="space-y-2">
                {sections.map((section, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {section.sectionNumber} — {section.label}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {section.family} · {section.text.length.toLocaleString()} chars
                      </p>
                    </div>
                    <motion.button
                      onClick={() => handleGenerate(section)}
                      disabled={generating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                      style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', opacity: generating ? 0.5 : 1 }}
                    >
                      {generating ? <Loader size={10} className="animate-spin" /> : null}
                      Generate Table
                      <ChevronRight size={10} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual product family selection — always shown after parsing */}
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
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: manualFamily ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <option value="">Select product family…</option>
                  {Object.entries(PRODUCT_FAMILIES).map(([code, label]) => (
                    <option key={code} value={code}>{label} ({code})</option>
                  ))}
                </select>
                <motion.button
                  onClick={() => {
                    if (!manualFamily) return
                    handleGenerate({
                      sectionNumber: '1',
                      title: PRODUCT_FAMILIES[manualFamily] ?? manualFamily,
                      family: manualFamily,
                      label: PRODUCT_FAMILIES[manualFamily] ?? manualFamily,
                      text: extractedText.slice(0, 12000),
                    })
                  }}
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
