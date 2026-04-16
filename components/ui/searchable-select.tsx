'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { ChevronDown, X, Loader2 } from 'lucide-react'

interface Option {
  id: string
  name: string
  [key: string]: unknown
}

interface SearchableSelectProps {
  /** Provide for client-side filtering */
  options?: Option[]
  /** Provide for server-side async search — called when query >= 2 chars */
  onSearch?: (query: string) => Promise<Option[]>
  /** Called when user clicks "Request to add" — receives the typed name */
  onRequestAdd?: (name: string) => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  onSearch,
  onRequestAdd,
  value,
  onChange,
  placeholder = 'Select or search…',
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen]               = useState(false)
  const [query, setQuery]             = useState('')
  const [asyncResults, setAsyncResults] = useState<Option[]>([])
  const [fetching, setFetching]       = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const containerRef  = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const listRef       = useRef<HTMLDivElement>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAsync = !!onSearch

  // Client-side filtered list
  const safeOptions = Array.isArray(options) ? options : []
  const clientFiltered = query.trim()
    ? safeOptions.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : safeOptions

  const displayList = isAsync ? asyncResults : clientFiltered

  useEffect(() => { setHighlighted(0) }, [query])

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        if (isAsync) setAsyncResults([])
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isAsync])

  // Async search with debounce
  const runSearch = useCallback(async (q: string) => {
    if (!onSearch) return
    if (q.length < 2) { setAsyncResults([]); setFetching(false); return }
    setFetching(true)
    try {
      const results = await onSearch(q)
      setAsyncResults(results)
    } finally {
      setFetching(false)
    }
  }, [onSearch])

  useEffect(() => {
    if (!isAsync) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, isAsync, runSearch])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-item]')
    items[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function select(name: string) {
    onChange(name)
    setOpen(false)
    setQuery('')
    if (isAsync) setAsyncResults([])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(i => Math.min(i + 1, displayList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (displayList[highlighted]) select(displayList[highlighted].name)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      if (isAsync) setAsyncResults([])
    }
  }

  // What to show in the dropdown body
  const showTypePrompt  = isAsync && query.length < 2
  const showEmpty       = !showTypePrompt && !fetching && displayList.length === 0
  const showRequestLink = onRequestAdd && query.trim().length >= 2 && !fetching

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={openDropdown}
        className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors"
        style={{
          background: 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--brand-primary)' : 'var(--border-default)'}`,
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          userSelect: 'none',
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <div className="flex items-center gap-1 ml-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
          {value && !disabled && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="rounded hover:opacity-70 transition-opacity"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={14}
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            minWidth: 180,
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAsync ? 'Type at least 2 characters…' : 'Search…'}
              className="w-full px-2.5 py-1.5 text-sm rounded-md outline-none"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Body */}
          <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {fetching ? (
              <div className="flex items-center justify-center gap-2 py-6" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">Searching…</span>
              </div>
            ) : showTypePrompt ? (
              <p className="px-3 py-5 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                Type to search
              </p>
            ) : showEmpty ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results</p>
              </div>
            ) : (
              displayList.map((option, i) => {
                const isSelected    = value === option.name
                const isHighlighted = i === highlighted
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-item
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => select(option.name)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{
                      background: isHighlighted
                        ? 'var(--surface-3)'
                        : isSelected
                        ? 'oklch(0.65 0.18 270 / 0.1)'
                        : 'transparent',
                      color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    {option.name}
                  </button>
                )
              })
            )}
          </div>

          {/* Request to add */}
          {showRequestLink && (
            <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  onRequestAdd!(query.trim())
                  setOpen(false)
                  setQuery('')
                  if (isAsync) setAsyncResults([])
                }}
                className="w-full text-left text-xs py-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-primary)' }}
              >
                + Request to add &quot;{query.trim()}&quot;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
