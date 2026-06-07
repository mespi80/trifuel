'use client'

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
  Step7Data,
  OnboardingData,
} from './schema'

// ── State ─────────────────────────────────────────────────────────────────────
export interface OnboardingState {
  step2?: Partial<Step2Data>
  step3?: Partial<Step3Data>
  step4?: Partial<Step4Data>
  step5?: Partial<Step5Data>
  step6?: Partial<Step6Data>
  step7?: Partial<Step7Data>
}

// ── Actions ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_STEP2'; data: Step2Data }
  | { type: 'SET_STEP3'; data: Step3Data }
  | { type: 'SET_STEP4'; data: Step4Data }
  | { type: 'SET_STEP5'; data: Step5Data }
  | { type: 'SET_STEP6'; data: Step6Data }
  | { type: 'SET_STEP7'; data: Step7Data }
  | { type: 'RESET' }

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_STEP2':
      return { ...state, step2: action.data }
    case 'SET_STEP3':
      return { ...state, step3: action.data }
    case 'SET_STEP4':
      return { ...state, step4: action.data }
    case 'SET_STEP5':
      return { ...state, step5: action.data }
    case 'SET_STEP6':
      return { ...state, step6: action.data }
    case 'SET_STEP7':
      return { ...state, step7: action.data }
    case 'RESET':
      return {}
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
interface OnboardingContextValue {
  state: OnboardingState
  dispatch: Dispatch<Action>
  isComplete: () => boolean
  getFullData: () => OnboardingData | null
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {})

  const isComplete = useCallback(() => {
    return Boolean(
      state.step2 && state.step3 && state.step4 && state.step5 && state.step6 && state.step7
    )
  }, [state])

  const getFullData = useCallback((): OnboardingData | null => {
    if (
      !state.step2 ||
      !state.step3 ||
      !state.step4 ||
      !state.step5 ||
      !state.step6 ||
      !state.step7
    )
      return null
    // Cast — each step was validated by its own Zod schema before being stored
    return {
      step2: state.step2 as Step2Data,
      step3: state.step3 as Step3Data,
      step4: state.step4 as Step4Data,
      step5: state.step5 as Step5Data,
      step6: state.step6 as Step6Data,
      step7: state.step7 as Step7Data,
    }
  }, [state])

  return (
    <OnboardingContext.Provider value={{ state, dispatch, isComplete, getFullData }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider')
  return ctx
}
