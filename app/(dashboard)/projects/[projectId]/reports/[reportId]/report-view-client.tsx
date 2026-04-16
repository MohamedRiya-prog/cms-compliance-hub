'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  ArrowLeft, Download, CheckCircle, MessageSquare, Filter,
  ChevronDown, Edit2, Check, X, Send, Loader, RotateCcw
} from 'lucide-react'
import { cn, formatStatus, getStatusBgClass, formatDate } from '@/lib/utils'

interface Row {
  id: string
  sort_order: number
  clause: string
  requirement: string
  product_response: string
  status: string
  remark: string
  confidence: string
  is_edited: boolean
}

interface Report {
  id: string
  title: string
  productFamily: string
  status: string
  summary: Record<string, number> | null
  specText: string | null
  createdAt: string
  updatedAt: string
  generationMetadata: Record<string, unknown> | null
}

interface Props {
  report: Report
  project: { id: string; name: string }
  initialRows: Row[]
}

type FilterStatus = 'all' | 'comply' | 'not_comply' | 'noted' | 'not_part_of_proposal' | 'header'

const STATUS_COLORS: Record<string, string> = {
  comply: 'var(--status-comply)',
  not_comply: 'var(--status-not-comply)',
  noted: 'var(--status-noted)',
  not_part_of_proposal: 'var(--status-not-part)',
  header: 'var(--brand-primary)',
}

const container: Variants = { animate: { transition: { staggerChildren: 0.025 } } }
const rowVariant: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface RowUpdate {
  rowId: string
  clause: string
  productResponse: string
  status: string
  remark: string
}

export function ReportViewClient({ report, project, initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<RowUpdate | null>(null)
  const [exporting, setExporting] = useState(false)
  const [approving, setApproving] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const summary = report.summary ?? { total: 0, comply: 0, notComply: 0, noted: 0, notPartOfProposal: 0 }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Inline edit handlers
  function startEdit(rowId: string, field: string, value: string) {
    setEditingCell({ rowId, field })
    setEditValue(value)
  }

  async function saveEdit(rowId: string, field: string) {
    setEditingCell(null)
    const fieldMap: Record<string, string> = {
      product_response: 'productResponse',
      remark: 'remark',
      status: 'status',
    }
    const apiField = fieldMap[field] ?? field

    const res = await fetch(`/api/compliance/${report.id}/rows/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [apiField]: editValue }),
    })

    if (res.ok) {
      setRows(prev => prev.map(r =>
        r.id === rowId ? { ...r, [field]: editValue, is_edited: true } : r
      ))
    }
  }

  function cancelEdit() {
    setEditingCell(null)
    setEditValue('')
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/compliance/export?reportId=${report.id}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    await fetch(`/api/compliance/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setApproving(false)
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    const res = await fetch(`/api/compliance/${report.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatInput, referencedRowId: selectedRowId }),
    })

    if (!res.ok) {
      const errText = await res.text()
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Error: ' + errText }])
      setChatLoading(false)
      return
    }

    // Stream response
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    const assistantId = Date.now().toString()
    setChatMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      fullText += chunk
      setChatMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
      )
    }

    // Parse UPDATE_ROW tags
    const updateMatch = fullText.match(/\[UPDATE_ROW\]([\s\S]*?)\[\/UPDATE_ROW\]/)
    if (updateMatch) {
      try {
        const update = JSON.parse(updateMatch[1]) as RowUpdate
        setPendingUpdate(update)
      } catch {}
    }

    setChatLoading(false)
  }

  function acceptRowUpdate() {
    if (!pendingUpdate) return
    setRows(prev => prev.map(r =>
      r.id === pendingUpdate.rowId
        ? {
            ...r,
            clause: pendingUpdate.clause ?? r.clause,
            product_response: pendingUpdate.productResponse ?? r.product_response,
            status: pendingUpdate.status ?? r.status,
            remark: pendingUpdate.remark ?? r.remark,
            is_edited: true,
          }
        : r
    ))
    // Persist
    fetch(`/api/compliance/${report.id}/rows/${pendingUpdate.rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productResponse: pendingUpdate.productResponse,
        status: pendingUpdate.status,
        remark: pendingUpdate.remark,
      }),
    })
    setPendingUpdate(null)
  }

  const complianceRate = summary.total > 0
    ? Math.round((summary.comply / summary.total) * 100)
    : 0

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-b shrink-0"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
      >
        <Link href={`/projects/${project.id}`}>
          <button className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={16} />
          </button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {report.title}
            </h1>
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
            >
              {report.status}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {project.name} · {report.productFamily}
          </p>
        </div>

        {/* Summary chips */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { label: 'Comply', value: summary.comply, color: 'var(--status-comply)' },
            { label: 'Not Comply', value: summary.notComply ?? 0, color: 'var(--status-not-comply)' },
            { label: 'Noted', value: summary.noted, color: 'var(--status-noted)' },
          ].map(s => (
            <span key={s.label} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.color + '20' }}>
              {s.value} {s.label}
            </span>
          ))}
          <span className="text-xs font-bold ml-1" style={{ color: complianceRate >= 80 ? 'var(--status-comply)' : 'var(--status-noted)' }}>
            {complianceRate}%
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
          >
            {exporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
            Export
          </motion.button>
          {/* Chat toggle — desktop only */}
          <button
            onClick={() => setChatOpen(o => !o)}
            className={cn('hidden md:flex p-1.5 rounded-lg transition-all border', chatOpen && 'border-[var(--brand-primary)]')}
            style={{
              background: chatOpen ? 'oklch(0.65 0.18 270 / 0.1)' : 'var(--surface-2)',
              color: chatOpen ? 'var(--brand-primary)' : 'var(--text-muted)',
              borderColor: chatOpen ? 'var(--brand-primary)' : 'var(--border-default)',
            }}
          >
            <MessageSquare size={14} />
          </button>
        </div>
      </div>

      {/* Body — resizable split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Table */}
        <div className={cn('flex flex-col overflow-hidden transition-all', chatOpen ? 'flex-1' : 'flex-1')}>
          {/* Filter bar */}
          <div
            className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0 overflow-x-auto"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
          >
            <Filter size={12} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            {(['all', 'comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                style={{
                  background: filter === f
                    ? (f === 'all' ? 'var(--surface-3)' : STATUS_COLORS[f] + '25')
                    : 'transparent',
                  color: filter === f
                    ? (f === 'all' ? 'var(--text-primary)' : STATUS_COLORS[f])
                    : 'var(--text-muted)',
                  fontWeight: filter === f ? 500 : 400,
                }}
              >
                {f === 'all' ? `All (${rows.length})` : formatStatus(f)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 700 }}>
              <thead>
                <tr
                  className="sticky top-0 z-10"
                  style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  {['Clause', 'Requirement', 'Product Response', 'Status', 'Remark'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={container} initial="initial" animate="animate">
                <AnimatePresence>
                  {filtered.map(row => {
                    const isEditing = (field: string) => editingCell?.rowId === row.id && editingCell.field === field
                    const isExpanded = expandedRow === row.id
                    const isSelected = selectedRowId === row.id

                    return (
                      <motion.tr
                        key={row.id}
                        variants={rowVariant}
                        layout
                        onClick={() => setSelectedRowId(id => id === row.id ? null : row.id)}
                        className="cursor-pointer transition-colors group"
                        style={{
                          background: isSelected
                            ? 'oklch(0.65 0.18 270 / 0.07)'
                            : row.status === 'header' ? 'oklch(0.65 0.18 270 / 0.05)' : 'transparent',
                          borderBottom: '1px solid var(--border-subtle)',
                          borderLeft: isSelected ? '2px solid var(--brand-primary)' : '2px solid transparent',
                        }}
                      >
                        {/* Clause */}
                        <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {row.clause}
                          {row.is_edited && (
                            <span className="ml-1 text-[9px] px-1 rounded" style={{ background: 'oklch(0.78 0.16 85 / 0.2)', color: 'var(--status-noted)' }}>
                              edited
                            </span>
                          )}
                        </td>

                        {/* Requirement */}
                        <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)', maxWidth: 280 }}>
                          <div
                            className={cn('leading-relaxed', !isExpanded && 'line-clamp-3 cursor-pointer')}
                            onClick={e => { e.stopPropagation(); setExpandedRow(id => id === row.id ? null : row.id) }}
                          >
                            {row.requirement}
                          </div>
                        </td>

                        {/* Product Response — editable */}
                        <td className="px-3 py-2.5 align-top" style={{ maxWidth: 240 }}>
                          {isEditing('product_response') ? (
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <textarea
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="flex-1 text-xs p-1.5 rounded resize-none"
                                style={{ background: 'var(--surface-3)', border: '1px solid var(--brand-primary)', color: 'var(--text-primary)', minHeight: 64 }}
                                rows={3}
                              />
                              <div className="flex flex-col gap-1">
                                <button onClick={() => saveEdit(row.id, 'product_response')} className="p-1 rounded" style={{ background: 'oklch(0.72 0.19 155 / 0.2)', color: 'var(--status-comply)' }}>
                                  <Check size={10} />
                                </button>
                                <button onClick={cancelEdit} className="p-1 rounded" style={{ background: 'oklch(0.68 0.22 25 / 0.2)', color: 'var(--status-not-comply)' }}>
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="leading-relaxed group/cell relative cursor-text"
                              style={{ color: 'var(--text-primary)' }}
                              onClick={e => { e.stopPropagation(); startEdit(row.id, 'product_response', row.product_response ?? '') }}
                            >
                              <span className={cn(!isExpanded && 'line-clamp-3')}>{row.product_response || '—'}</span>
                              <Edit2 size={10} className="absolute top-0 right-0 opacity-0 group-hover/cell:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                        </td>

                        {/* Status — clickable to cycle */}
                        <td className="px-3 py-2.5 align-top" onClick={e => e.stopPropagation()}>
                          {isEditing('status') ? (
                            <select
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'status')}
                              className="text-xs p-1 rounded"
                              style={{ background: 'var(--surface-3)', border: '1px solid var(--brand-primary)', color: 'var(--text-primary)' }}
                            >
                              {['comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header'].map(s => (
                                <option key={s} value={s}>{formatStatus(s)}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-pointer whitespace-nowrap"
                              style={{
                                color: STATUS_COLORS[row.status] ?? 'var(--text-muted)',
                                background: (STATUS_COLORS[row.status] ?? '#888') + '18',
                                borderColor: (STATUS_COLORS[row.status] ?? '#888') + '40',
                              }}
                              onClick={() => startEdit(row.id, 'status', row.status)}
                            >
                              {formatStatus(row.status)}
                            </span>
                          )}
                          {row.confidence === 'low' && (
                            <span className="mt-0.5 block text-[9px]" style={{ color: 'var(--status-noted)' }}>low confidence</span>
                          )}
                        </td>

                        {/* Remark — editable */}
                        <td className="px-3 py-2.5 align-top" style={{ maxWidth: 220 }}>
                          {isEditing('remark') ? (
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <textarea
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="flex-1 text-xs p-1.5 rounded resize-none"
                                style={{ background: 'var(--surface-3)', border: '1px solid var(--brand-primary)', color: 'var(--text-primary)', minHeight: 48 }}
                                rows={2}
                              />
                              <div className="flex flex-col gap-1">
                                <button onClick={() => saveEdit(row.id, 'remark')} className="p-1 rounded" style={{ background: 'oklch(0.72 0.19 155 / 0.2)', color: 'var(--status-comply)' }}>
                                  <Check size={10} />
                                </button>
                                <button onClick={cancelEdit} className="p-1 rounded" style={{ background: 'oklch(0.68 0.22 25 / 0.2)', color: 'var(--status-not-comply)' }}>
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="leading-relaxed cursor-text group/remark relative"
                              style={{ color: 'var(--text-secondary)' }}
                              onClick={e => { e.stopPropagation(); startEdit(row.id, 'remark', row.remark ?? '') }}
                            >
                              <span className={cn(!isExpanded && 'line-clamp-2')}>{row.remark || '—'}</span>
                              <Edit2 size={10} className="absolute top-0 right-0 opacity-0 group-hover/remark:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </motion.tbody>
            </table>

            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">No rows match this filter</p>
              </div>
            )}

            {/* Summary row at bottom */}
            {filter === 'all' && summary.total > 0 && (
              <div
                className="flex items-center gap-6 px-4 py-3 border-t text-xs font-medium"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <span>Total: {summary.total}</span>
                <span style={{ color: 'var(--status-comply)' }}>Comply: {summary.comply}</span>
                <span style={{ color: 'var(--status-not-comply)' }}>Not Comply: {summary.notComply ?? 0}</span>
                <span style={{ color: 'var(--status-noted)' }}>Noted: {summary.noted}</span>
                <span style={{ color: 'var(--status-not-part)' }}>Not Part: {summary.notPartOfProposal ?? 0}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat Panel — desktop only */}
        <div className="hidden md:flex">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col border-l overflow-hidden shrink-0"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              {/* Chat header */}
              <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Re-verify with Claude
                  </h3>
                  {selectedRowId && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'oklch(0.65 0.18 270 / 0.15)', color: 'var(--brand-primary)', border: '1px solid oklch(0.65 0.18 270 / 0.3)' }}
                    >
                      Row: {rows.find(r => r.id === selectedRowId)?.clause}
                    </motion.span>
                  )}
                </div>
                {selectedRowId && (
                  <button
                    onClick={() => setSelectedRowId(null)}
                    className="text-xs mt-1 hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Click a row to reference it, then ask Claude to re-verify.
                    </p>
                    {['Show all non-compliant rows', 'Explain the product response for this clause', 'Can we offer an alternative?'].map(q => (
                      <button
                        key={q}
                        onClick={() => setChatInput(q)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border transition-all hover:border-[var(--brand-primary)]"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {chatMessages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed', msg.role === 'user' ? 'ml-auto' : 'mr-auto')}
                    style={{
                      background: msg.role === 'user' ? 'oklch(0.65 0.18 270 / 0.15)' : 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      border: msg.role === 'user' ? '1px solid oklch(0.65 0.18 270 / 0.3)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Strip UPDATE_ROW tags from display */}
                    {msg.content.replace(/\[UPDATE_ROW\][\s\S]*?\[\/UPDATE_ROW\]/g, '').trim()}
                  </motion.div>
                ))}

                {chatLoading && (
                  <div className="flex gap-1.5 px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--text-muted)' }}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                )}

                {/* Update suggestion card */}
                <AnimatePresence>
                  {pendingUpdate && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl p-3 border"
                      style={{ background: 'oklch(0.65 0.18 270 / 0.08)', borderColor: 'oklch(0.65 0.18 270 / 0.3)' }}
                    >
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--brand-primary)' }}>
                        Claude suggests updating clause {pendingUpdate.clause}
                      </p>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Status: <span style={{ color: STATUS_COLORS[pendingUpdate.status] }}>{formatStatus(pendingUpdate.status)}</span>
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={acceptRowUpdate} className="flex-1 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.72 0.19 155 / 0.2)', color: 'var(--status-comply)' }}>
                          Accept
                        </button>
                        <button onClick={() => setPendingUpdate(null)} className="flex-1 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.68 0.22 25 / 0.15)', color: 'var(--status-not-comply)' }}>
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex gap-2 items-end">
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                    placeholder="Ask about a clause…"
                    rows={2}
                    className="flex-1 text-xs p-2.5 rounded-lg resize-none outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <motion.button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg shrink-0 transition-all"
                    style={{
                      background: chatInput.trim() ? 'var(--brand-primary)' : 'var(--surface-3)',
                      color: chatInput.trim() ? 'oklch(0.98 0.002 260)' : 'var(--text-muted)',
                    }}
                  >
                    {chatLoading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                  </motion.button>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Shift+Enter for new line
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
