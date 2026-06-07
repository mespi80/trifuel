import { Waves, Bike, PersonStanding, Zap, Dumbbell, Heart } from 'lucide-react'
import type { CalendarSession } from '@/actions/training'

export type Discipline = CalendarSession['discipline']

export const DISCIPLINE_COLOR: Record<Discipline, string> = {
  swim: '#3B82F6',
  bike: '#22C55E',
  run: '#F97316',
  brick: '#A855F7',
  strength: '#EAB308',
  recovery: '#6B7280',
}

export const DISCIPLINE_BG: Record<Discipline, string> = {
  swim: 'bg-blue-500',
  bike: 'bg-green-500',
  run: 'bg-orange-500',
  brick: 'bg-purple-500',
  strength: 'bg-yellow-500',
  recovery: 'bg-gray-400',
}

export const DISCIPLINE_LIGHT_BG: Record<Discipline, string> = {
  swim: 'bg-blue-50 border-blue-200',
  bike: 'bg-green-50 border-green-200',
  run: 'bg-orange-50 border-orange-200',
  brick: 'bg-purple-50 border-purple-200',
  strength: 'bg-yellow-50 border-yellow-200',
  recovery: 'bg-gray-50 border-gray-200',
}

export const DISCIPLINE_TEXT: Record<Discipline, string> = {
  swim: 'text-blue-700',
  bike: 'text-green-700',
  run: 'text-orange-700',
  brick: 'text-purple-700',
  strength: 'text-yellow-700',
  recovery: 'text-gray-600',
}

export const DISCIPLINE_ICON = {
  swim: Waves,
  bike: Bike,
  run: PersonStanding,
  brick: Zap,
  strength: Dumbbell,
  recovery: Heart,
} as const

export const ZONE_COLORS: Record<string, string> = {
  z1: 'bg-gray-100 text-gray-700',
  z2: 'bg-blue-100 text-blue-700',
  z3: 'bg-green-100 text-green-700',
  z4: 'bg-yellow-100 text-yellow-700',
  z5: 'bg-orange-100 text-orange-700',
  z6: 'bg-red-100 text-red-700',
}
