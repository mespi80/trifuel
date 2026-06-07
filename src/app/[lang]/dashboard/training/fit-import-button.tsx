'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, RefreshCw, FileText, Sparkles } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import type { FileImportResult, SessionImportResult } from '@/app/api/import/fit/route'

// ── i18n slice ─────────────────────────────────────────────────────────────────

export interface FitImportT {
  buttonLabel: string
  title: string
  subtitle: string
  dropzone: string
  dropzoneActive: string
  browse: string
  importButton: string
  importing: string
  cancel: string
  done: string
  clearFiles: string
  outcomes: {
    matched: string
    created: string
    duplicate: string
    no_plan: string
  }
  fileStatus: {
    pending: string
    uploading: string
    ok: string
    parse_error: string
    empty: string
  }
  summary: string
  fileTooLarge: string
  wrongFormat: string
}

// ── Types ──────────────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'uploading' | 'ok' | 'parse_error' | 'empty'

interface FileEntry {
  id: string
  file: File
  status: FileStatus
  result?: FileImportResult
  error?: string
}

// ── Outcome icon / color ───────────────────────────────────────────────────────

const OUTCOME_STYLE: Record<
  SessionImportResult['outcome'],
  { icon: React.ReactNode; colour: string }
> = {
  matched: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, colour: 'text-green-600' },
  created: { icon: <Sparkles className="h-3.5 w-3.5" />, colour: 'text-blue-600' },
  duplicate: { icon: <RefreshCw className="h-3.5 w-3.5" />, colour: 'text-gray-400' },
  no_plan: { icon: <AlertCircle className="h-3.5 w-3.5" />, colour: 'text-amber-500' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function buildSummaryLine(results: FileImportResult[], t: FitImportT): string {
  let matched = 0,
    created = 0,
    duplicates = 0,
    errors = 0

  for (const r of results) {
    if (r.status !== 'ok') {
      errors++
      continue
    }
    for (const s of r.sessions) {
      if (s.outcome === 'matched') matched++
      else if (s.outcome === 'created') created++
      else if (s.outcome === 'duplicate') duplicates++
      else errors++
    }
  }

  return t.summary
    .replace('{matched}', String(matched))
    .replace('{created}', String(created))
    .replace('{duplicates}', String(duplicates))
    .replace('{errors}', String(errors))
}

// ── FileRow ────────────────────────────────────────────────────────────────────

function FileRow({
  entry,
  onRemove,
  t,
}: {
  entry: FileEntry
  onRemove: (id: string) => void
  t: FitImportT
}) {
  const sizeKb = (entry.file.size / 1024).toFixed(0)

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      {/* File header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">{entry.file.name}</p>
            <p className="text-xs text-gray-400">{sizeKb} KB</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Status pill */}
          {entry.status === 'pending' && (
            <span className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              {t.fileStatus.pending}
            </span>
          )}
          {entry.status === 'uploading' && (
            <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-blue-500 uppercase">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              {t.fileStatus.uploading}
            </span>
          )}
          {entry.status === 'ok' && (
            <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-green-600 uppercase">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {t.fileStatus.ok}
            </span>
          )}
          {(entry.status === 'parse_error' || entry.status === 'empty') && (
            <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-red-500 uppercase">
              <AlertCircle className="h-2.5 w-2.5" />
              {t.fileStatus[entry.status]}
            </span>
          )}

          {entry.status === 'pending' && (
            <button
              onClick={() => onRemove(entry.id)}
              className="text-gray-300 transition-colors hover:text-gray-500"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {entry.error && <p className="mt-1.5 pl-6 text-xs text-red-500">{entry.error}</p>}

      {/* Session results */}
      {entry.result?.sessions && entry.result.sessions.length > 0 && (
        <div className="mt-2 space-y-1 pl-6">
          {entry.result.sessions.map((s, i) => {
            const style = OUTCOME_STYLE[s.outcome]
            return (
              <div key={i} className={cn('flex items-center gap-1.5 text-xs', style.colour)}>
                {style.icon}
                <span className="font-medium capitalize">{s.discipline}</span>
                <span className="text-gray-400">·</span>
                <span>{s.date}</span>
                <span className="text-gray-400">·</span>
                <span>{formatDuration(s.durationMinutes)}</span>
                <span className="text-gray-400">·</span>
                <span>{t.outcomes[s.outcome]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main dialog component ──────────────────────────────────────────────────────

interface Props {
  t: FitImportT
  onImported?: () => void
}

export function FitImportButton({ t, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── File validation & add ────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const entries: FileEntry[] = arr
      .filter((f) => f.name.toLowerCase().endsWith('.fit'))
      .map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: 'pending' as FileStatus,
      }))
    setFiles((prev) => [...prev, ...entries])
    setDone(false)
  }, [])

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  // ── Upload ───────────────────────────────────────────────────────────────────

  async function handleImport() {
    const pending = files.filter((f) => f.status === 'pending')
    if (pending.length === 0) return

    setImporting(true)

    // Mark all pending as uploading
    setFiles((prev) =>
      prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' } : f))
    )

    // Build FormData with all pending files
    const formData = new FormData()
    pending.forEach((f) => formData.append('files', f.file))

    try {
      const res = await fetch('/api/import/fit', { method: 'POST', body: formData })
      const json = (await res.json()) as { results?: FileImportResult[]; error?: string }

      if (!res.ok || !json.results) {
        // Mark all uploading as error
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading'
              ? { ...f, status: 'parse_error', error: json.error ?? 'Upload failed' }
              : f
          )
        )
        return
      }

      // Match results back to file entries by index
      const resultMap = new Map<string, FileImportResult>()
      pending.forEach((entry, idx) => {
        const result = json.results![idx]
        if (result) resultMap.set(entry.id, result)
      })

      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== 'uploading') return f
          const result = resultMap.get(f.id)
          if (!result) return { ...f, status: 'parse_error', error: 'No result from server' }
          return { ...f, status: result.status, result, error: result.error }
        })
      )

      setDone(true)
      onImported?.()
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? {
                ...f,
                status: 'parse_error',
                error: err instanceof Error ? err.message : 'Network error',
              }
            : f
        )
      )
    } finally {
      setImporting(false)
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function handleClose() {
    if (!importing) {
      setOpen(false)
      setTimeout(() => {
        setFiles([])
        setDone(false)
      }, 300)
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const uploadingCount = files.filter((f) => f.status === 'uploading').length
  const completedFiles = files.filter((f) => ['ok', 'parse_error', 'empty'].includes(f.status))
  const summaryLine =
    done && completedFiles.length > 0
      ? buildSummaryLine(
          completedFiles.map(
            (f): FileImportResult =>
              f.result ?? {
                filename: f.file.name,
                status: f.status as FileImportResult['status'],
                sessions: [],
              }
          ),
          t
        )
      : null

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
        else setOpen(true)
      }}
    >
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
          <Upload className="h-4 w-4" />
          {t.buttonLabel}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />

        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between p-5 pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-gray-900">{t.title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-gray-500">
                {t.subtitle}
              </Dialog.Description>
            </div>
            <Dialog.Close
              onClick={handleClose}
              disabled={importing}
              className="mt-0.5 ml-4 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Drop zone */}
          <div className="shrink-0 px-5">
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !importing && inputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <Upload
                className={cn('mx-auto mb-2 h-8 w-8', dragging ? 'text-blue-400' : 'text-gray-300')}
              />
              <p className="text-sm font-medium text-gray-600">
                {dragging ? t.dropzoneActive : t.dropzone}
              </p>
              <p className="mt-1 text-xs text-gray-400">.fit · max 10 MB per file</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
                className="mt-3 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                {t.browse}
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".fit"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
              {files.map((entry) => (
                <FileRow
                  key={entry.id}
                  entry={entry}
                  t={t}
                  onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
                />
              ))}
            </div>
          )}

          {/* Summary banner */}
          {summaryLine && (
            <div className="mx-5 shrink-0 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
              <p className="text-sm font-medium text-green-700">{summaryLine}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-2 flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 p-5 pt-3">
            <div className="flex items-center gap-2">
              {files.some((f) => f.status === 'pending') && !importing && (
                <button
                  onClick={() => setFiles((prev) => prev.filter((f) => f.status !== 'pending'))}
                  className="text-xs text-gray-400 transition-colors hover:text-gray-600"
                >
                  {t.clearFiles}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {done ? (
                <button
                  onClick={handleClose}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  {t.done}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleClose}
                    disabled={importing}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={pendingCount === 0 || importing || uploadingCount > 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t.importing}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {t.importButton.replace('{n}', String(pendingCount))}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
