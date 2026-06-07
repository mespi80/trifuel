'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/lib/onboarding/store'
import type { Step7Data } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

const PROVIDERS = ['garmin', 'wahoo', 'coros'] as const
type Provider = (typeof PROVIDERS)[number]

export function Step7Wearables({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step7
  const { state, dispatch } = useOnboarding()
  const [selected, setSelected] = useState<Provider | undefined>(state.step7?.connectedProvider)
  const [connecting, setConnecting] = useState<Provider | null>(null)

  function handleSelect(provider: Provider) {
    setConnecting(provider)
    // Simulate OAuth redirect / connection — in prod this would call the real OAuth flow
    setTimeout(() => {
      setSelected(provider)
      setConnecting(null)
    }, 1200)
  }

  function handleContinue() {
    const data: Step7Data = { connectedProvider: selected }
    dispatch({ type: 'SET_STEP7', data })
    goNext()
  }

  function handleSkip() {
    dispatch({ type: 'SET_STEP7', data: {} })
    goNext()
  }

  const providerMeta: Record<Provider, { name: string; desc: string }> = {
    garmin: { name: t.garmin, desc: t.garminDesc },
    wahoo: { name: t.wahoo, desc: t.wahooDesc },
    coros: { name: t.coros, desc: t.corosDesc },
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const isSelected = selected === provider
          const isConnecting = connecting === provider
          const meta = providerMeta[provider]

          return (
            <button
              key={provider}
              type="button"
              onClick={() => !isSelected && handleSelect(provider)}
              disabled={isConnecting || (!!selected && !isSelected)}
              className={`w-full rounded-xl border px-4 py-4 text-left transition-colors disabled:opacity-50 ${
                isSelected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}
                  >
                    {meta.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{meta.desc}</p>
                </div>
                <span className="text-xs font-medium">
                  {isConnecting ? t.connecting : isSelected ? `✓ ${t.connected}` : null}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {selected ? (
        <Button size="lg" className="w-full" onClick={handleContinue}>
          {dict.onboarding.next}
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-center text-xs">{t.skipHint}</p>
          <Button variant="outline" size="lg" className="w-full" onClick={handleSkip}>
            {t.skipButton}
          </Button>
        </div>
      )}
    </div>
  )
}
