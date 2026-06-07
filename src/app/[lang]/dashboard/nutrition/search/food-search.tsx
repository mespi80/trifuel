'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, ScanLine, X, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchFoodItems, searchFoodByBarcode } from '@/actions/nutrition'
import { FoodDetailModal } from '../food-detail-modal'
import type { FoodItemData, MealSlot } from '@/actions/nutrition'
import type { Dictionary } from '@/lib/dictionaries'

interface FoodSearchProps {
  slot: MealSlot
  date: string
  lang: string
  locale: string
  dict: Dictionary
  recentItems: FoodItemData[]
  frequentItems: FoodItemData[]
}

type Tab = 'search' | 'recent' | 'frequent'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function FoodRow({
  food,
  locale,
  onClick,
}: {
  food: FoodItemData
  locale: string
  onClick: () => void
}) {
  const name = locale === 'es' && food.nameEs ? food.nameEs : food.nameEn
  const m = food.macros
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-medium text-gray-900">{name}</p>
          {food.isVegan && <Leaf className="h-3 w-3 shrink-0 text-green-500" aria-label="Vegan" />}
        </div>
        {food.brand && <p className="truncate text-xs text-gray-400">{food.brand}</p>}
        <p className="mt-0.5 text-xs text-gray-400">
          {food.servingSize}
          {food.servingUnit}
          {' · '}
          <span className="text-amber-600">{m.choG}g C</span>
          {' · '}
          <span className="text-blue-600">{m.proteinG}g P</span>
          {' · '}
          <span className="text-green-600">{m.fatG}g F</span>
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-gray-500 tabular-nums">
        {m.calories} kcal
      </span>
    </button>
  )
}

export function FoodSearch({
  slot,
  date,
  lang,
  locale,
  dict,
  recentItems,
  frequentItems,
}: FoodSearchProps) {
  const router = useRouter()
  const t = dict.dashboard.nutrition
  const ts = t.search
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('recent')
  const [searchResults, setSearchResults] = useState<FoodItemData[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodItemData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Barcode scanner state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSupported] = useState<boolean | null>(() =>
    typeof window !== 'undefined' ? 'BarcodeDetector' in window : null
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)

  const debouncedQuery = useDebounce(query, 280)

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }

  // Auto-switch tab when typing
  useEffect(() => {
    const query = debouncedQuery.trim()
    if (!query) {
      void Promise.resolve().then(() => setSearchResults([]))
      return
    }
    void Promise.resolve().then(() => {
      setTab('search')
      setSearching(true)
      startTransition(async () => {
        const results = await searchFoodItems(query)
        setSearchResults(results)
        setSearching(false)
      })
    })
  }, [debouncedQuery])

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function startBarcodeScanner() {
    if (!scanSupported) {
      setScanError(ts.scanUnsupported)
      return
    }
    setScanError(null)
    setScanning(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // @ts-expect-error BarcodeDetector is not yet in TS lib
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      })

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const rawValue: string = barcodes[0].rawValue
            stopCamera()
            // Search by barcode
            startTransition(async () => {
              const food = await searchFoodByBarcode(rawValue)
              if (food) {
                openFoodDetail(food)
              } else {
                setScanError(ts.scanError)
              }
            })
            return
          }
        } catch {
          // detection frame error — continue
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    } catch {
      setScanError(ts.scanError)
      stopCamera()
    }
  }

  function openFoodDetail(food: FoodItemData) {
    setSelectedFood(food)
    setModalOpen(true)
  }

  const handleModalClose = useCallback(() => {
    setModalOpen(false)
    setSelectedFood(null)
  }, [])

  const mealLabel = (t.meals as Record<string, string>)[slot] ?? slot
  const addingLabel = ts.addingTo.replace('{slot}', mealLabel)

  // Items for current tab
  const displayItems: FoodItemData[] =
    tab === 'search' ? searchResults : tab === 'recent' ? recentItems : frequentItems

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 space-y-2.5 border-b border-gray-200 bg-white px-4 py-3">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label={ts.back}
            className="-ml-1.5 rounded-lg p-1.5 transition-colors hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-gray-900">{ts.title}</h1>
            <p className="truncate text-xs text-gray-400">{addingLabel}</p>
          </div>
          {/* Barcode button */}
          <button
            onClick={scanning ? stopCamera : startBarcodeScanner}
            aria-label={ts.scanBarcode}
            className={cn(
              'shrink-0 rounded-lg p-2 transition-colors',
              scanning ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            <ScanLine className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ts.placeholder}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pr-9 pl-9 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setTab('recent')
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        {!query && (
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {(['recent', 'frequent'] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => setTab(t_)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-xs font-medium transition-all',
                  tab === t_
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t_ === 'recent' ? ts.recentTab : ts.frequentTab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barcode scanner overlay */}
      {scanning && (
        <div className="relative flex flex-col items-center bg-black">
          <video ref={videoRef} className="max-h-56 w-full object-cover" playsInline muted />
          {/* Viewfinder overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-48 rounded-lg border-2 border-blue-400 opacity-80" />
          </div>
          <p className="absolute bottom-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {ts.scanning}
          </p>
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {scanError}
        </div>
      )}

      {/* Scan not supported */}
      {scanSupported === false && (
        <div className="mx-4 mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {ts.scanUnsupported}
        </div>
      )}

      {/* Results list */}
      <div className="mt-2 flex-1 overflow-y-auto rounded-t-2xl bg-white">
        {searching ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Searching…
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {tab === 'search' && query ? ts.noResults : ts.noResults}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {displayItems.map((food) => (
              <li key={food.id}>
                <FoodRow food={food} locale={locale} onClick={() => openFoodDetail(food)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Food detail modal */}
      <FoodDetailModal
        food={selectedFood}
        slot={slot}
        date={date}
        lang={lang}
        locale={locale}
        open={modalOpen}
        onClose={handleModalClose}
        mealLabel={mealLabel}
        t={dict.dashboard.nutrition.foodDetail}
      />
    </div>
  )
}
