/**
 * Tests for Garmin workout serialiser.
 */

import { describe, it, expect } from 'vitest'
import { serializeWorkout, type SessionToSerialize } from './workout-push'

function baseSession(overrides: Partial<SessionToSerialize> = {}): SessionToSerialize {
  return {
    discipline: 'run',
    durationMinutes: 60,
    intensityZone: 'z2',
    objective: 'Easy aerobic run',
    ...overrides,
  }
}

describe('serializeWorkout', () => {
  it('returns correct sportType for each discipline', () => {
    const disciplines = [
      ['run', 'RUNNING'],
      ['bike', 'CYCLING'],
      ['swim', 'SWIMMING'],
      ['strength', 'STRENGTH_TRAINING'],
      ['recovery', 'OTHER'],
    ] as [SessionToSerialize['discipline'], string][]

    for (const [discipline, expected] of disciplines) {
      const workout = serializeWorkout(baseSession({ discipline }), 'Test')
      expect(workout.sportType.sportTypeKey).toBe(expected)
    }
  })

  it('sets workout name and description', () => {
    const session = baseSession({ objective: 'Tempo intervals' })
    const workout = serializeWorkout(session, 'Thursday Run')
    expect(workout.workoutName).toBe('Thursday Run')
    expect(workout.description).toBe('Tempo intervals')
  })

  it('sets estimatedDurationInSecs to durationMinutes * 60', () => {
    const workout = serializeWorkout(baseSession({ durationMinutes: 45 }), 'Short run')
    expect(workout.estimatedDurationInSecs).toBe(2700)
  })

  it('has exactly one segment', () => {
    const workout = serializeWorkout(baseSession(), 'Test')
    expect(workout.workoutSegments).toHaveLength(1)
  })

  it('includes warmup, main, and cooldown steps for zone session', () => {
    const workout = serializeWorkout(baseSession(), 'Test')
    const steps = workout.workoutSegments[0]!.workoutSteps
    expect(steps.length).toBeGreaterThanOrEqual(3)
    const stepTypes = steps.map((s) => s.stepType)
    expect(stepTypes).toContain('WARMUP')
    expect(stepTypes).toContain('COOLDOWN')
  })

  it('includes repeat steps when intervals are provided', () => {
    const session = baseSession({
      intervals: [{ reps: 8, distance: 200, restSeconds: 30, targetPace: '1:45/100m' }],
    })
    const workout = serializeWorkout(session, 'Track workout')
    const steps = workout.workoutSegments[0]!.workoutSteps
    const repeatStep = steps.find((s) => s.stepType === 'REPEAT')
    expect(repeatStep).toBeDefined()
    expect(repeatStep!.type).toBe('WorkoutRepeatStep')
    // @ts-expect-error accessing repeatValue
    expect(repeatStep!.repeatValue).toBe(8)
  })

  it('builds time-based repeat step when distance not provided', () => {
    const session = baseSession({
      intervals: [{ reps: 5, durationSeconds: 60, restSeconds: 60 }],
    })
    const workout = serializeWorkout(session, 'Intervals')
    const steps = workout.workoutSegments[0]!.workoutSteps
    const repeatStep = steps.find((s) => s.stepType === 'REPEAT')
    expect(repeatStep).toBeDefined()
  })

  it('uses power target when targetPower is set', () => {
    const session = baseSession({
      discipline: 'bike',
      intervals: [{ reps: 3, durationSeconds: 300, restSeconds: 120, targetPower: 280 }],
    })
    const workout = serializeWorkout(session, 'FTP intervals')
    const repeatStep = workout.workoutSegments[0]!.workoutSteps.find(
      (s) => s.stepType === 'REPEAT'
    )!
    // @ts-expect-error accessing steps inside repeat
    const workStep = repeatStep.steps[0]
    expect(workStep.targetType).toBe('POWER')
    expect(workStep.targetValueLow).toBe(266) // 280 * 0.95
    expect(workStep.targetValueHigh).toBe(294) // 280 * 1.05
  })

  it('uses HR target when targetHr is set', () => {
    const session = baseSession({
      intervals: [{ reps: 1, durationSeconds: 1800, restSeconds: 0, targetHr: 150 }],
    })
    const workout = serializeWorkout(session, 'Steady HR')
    const repeatStep = workout.workoutSegments[0]!.workoutSteps.find(
      (s) => s.stepType === 'REPEAT'
    )!
    // @ts-expect-error accessing steps inside repeat
    const workStep = repeatStep.steps[0]
    expect(workStep.targetType).toBe('HEART_RATE')
  })

  it('uses HEART_RATE target for zone-based steady state (no intervals)', () => {
    const workout = serializeWorkout(baseSession({ intensityZone: 'z3' }), 'Z3 run')
    const steps = workout.workoutSegments[0]!.workoutSteps
    // The main interval step (not warmup or cooldown) should have HR target
    const mainStep = steps.find(
      (s) => s.stepType !== 'WARMUP' && s.stepType !== 'COOLDOWN' && s.type === 'WorkoutStep'
    )
    expect(mainStep).toBeDefined()
    // @ts-expect-error WorkoutStep field
    expect(mainStep!.targetType).toBe('HEART_RATE')
  })

  it('warmup duration is 10% of total, capped at 600s', () => {
    // 60 min → warmup = 360s (10%)
    const w60 = serializeWorkout(baseSession({ durationMinutes: 60 }), 'Test')
    const steps60 = w60.workoutSegments[0]!.workoutSteps
    const warmup60 = steps60.find((s) => s.stepType === 'WARMUP')!
    // @ts-expect-error WorkoutStep field
    expect(warmup60.durationValue).toBe(360)

    // 120 min → warmup should be capped at 600s
    const w120 = serializeWorkout(baseSession({ durationMinutes: 120 }), 'Test')
    const steps120 = w120.workoutSegments[0]!.workoutSteps
    const warmup120 = steps120.find((s) => s.stepType === 'WARMUP')!
    // @ts-expect-error WorkoutStep field
    expect(warmup120.durationValue).toBe(600)
  })
})
