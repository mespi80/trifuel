'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState, useTransition } from 'react'
import { X, PlusCircle } from 'lucide-react'
import { addBodyMeasurement } from '@/actions/analytics'
import type { BodyPoint } from '@/actions/analytics'

interface Props {
  onAdded: (point: BodyPoint) => void
  t: {
    addMeasurement: string
    dateLabel: string
    weightLabel: string
    fatLabel: string
    save: string
    saving: string
    saved: string
    cancel: string
  }
}

export function AddMeasurementModal({ onAdded, t }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState('')
  const [fat, setFat] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, start] = useTransition()

  function handleSave() {
    const weightKg = weight ? parseFloat(weight) : undefined
    const bodyFatPct = fat ? parseFloat(fat) : undefined
    if (!weightKg && !bodyFatPct) return

    start(async () => {
      const res = await addBodyMeasurement({ date, weightKg, bodyFatPct })
      if (res.ok) {
        setSaved(true)
        onAdded({ date, weightKg: weightKg ?? null, bodyFatPct: bodyFatPct ?? null })
        setTimeout(() => {
          setSaved(false)
          setOpen(false)
          setWeight('')
          setFat('')
          setDate(today)
        }, 900)
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          <PlusCircle className="h-4 w-4" />
          {t.addMeasurement}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {t.addMeasurement}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.dateLabel}</label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.weightLabel}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70.5"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-gray-400">
                  kg
                </span>
              </div>
            </div>

            {/* Body fat */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.fatLabel}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="3"
                  max="60"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="18.0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-gray-400">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Dialog.Close asChild>
              <button className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                {t.cancel}
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={isPending || saved || (!weight && !fat)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saved ? t.saved : isPending ? t.saving : t.save}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
