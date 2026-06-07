/**
 * POST /api/import/fit
 *
 * Accepts multipart/form-data with one or more .FIT file fields named "files".
 * For each file:
 *  1. Parse the FIT binary with fit-file-parser.
 *  2. For each session in the file, try to match a planned training_session
 *     on the same date + discipline (status = 'planned').
 *     → Match:   update to 'completed' + set actualData + completedAt.
 *     → No match: insert a new 'completed' session under the user's active plan.
 *  3. Return per-file, per-session results so the UI can show granular feedback.
 *
 * Security: authenticated users only; imported sessions are scoped to the
 * calling user's plans — no cross-user data access is possible.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { trainingSessions, trainingPlans } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { parseFitBuffer } from '@/services/garmin/fit-parser'
import type { ParsedActivity } from '@/services/garmin/activity-parser'

// ── Config ─────────────────────────────────────────────────────────────────────

/** 10 MB per file, 100 MB total multipart body */
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 50

// ── Result types ───────────────────────────────────────────────────────────────

export interface SessionImportResult {
  discipline: string
  date: string
  durationMinutes: number
  outcome: 'matched' | 'created' | 'duplicate' | 'no_plan'
}

export interface FileImportResult {
  filename: string
  status: 'ok' | 'parse_error' | 'empty'
  sessions: SessionImportResult[]
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the user's active plan ID, or null if none.
 */
async function getActivePlanId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, 'active')))
    .limit(1)
  return rows[0]?.id ?? null
}

/**
 * Imports a single parsed activity for the given user.
 * Returns the import outcome.
 */
async function importActivity(
  userId: string,
  activity: ParsedActivity,
  activePlanId: string | null
): Promise<SessionImportResult['outcome']> {
  const completedAt = new Date(activity.startTimestamp * 1000)

  // ── 1. Look for a matching PLANNED session ─────────────────────────────────
  //    Matching rules mirror the Garmin Connect webhook handler exactly.
  const planned = activePlanId
    ? await db
        .select({ id: trainingSessions.id, status: trainingSessions.status })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.planId, activePlanId),
            eq(trainingSessions.date, activity.date),
            eq(trainingSessions.discipline, activity.discipline),
            eq(trainingSessions.status, 'planned')
          )
        )
        .limit(1)
    : []

  if (planned.length > 0 && planned[0]) {
    // Update the planned session
    await db
      .update(trainingSessions)
      .set({
        status: 'completed',
        actualData: activity.actualData,
        completedAt,
        durationMinutes: activity.durationMinutes,
      })
      .where(eq(trainingSessions.id, planned[0].id))

    return 'matched'
  }

  // ── 2. Check for a duplicate (same date + discipline already completed) ─────
  const duplicate = activePlanId
    ? await db
        .select({ id: trainingSessions.id })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.planId, activePlanId),
            eq(trainingSessions.date, activity.date),
            eq(trainingSessions.discipline, activity.discipline),
            eq(trainingSessions.status, 'completed')
          )
        )
        .limit(1)
    : []

  if (duplicate.length > 0) {
    return 'duplicate'
  }

  // ── 3. No match — create a new completed session ───────────────────────────
  if (!activePlanId) return 'no_plan'

  await db.insert(trainingSessions).values({
    planId: activePlanId,
    date: activity.date,
    discipline: activity.discipline,
    durationMinutes: activity.durationMinutes,
    intensityZone: null,
    intervals: [],
    objective: activity.activityName ?? null,
    status: 'completed',
    actualData: activity.actualData,
    completedAt,
  })

  return 'created'
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  const userId = session.user.id

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const fileEntries = formData.getAll('files')
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }
  if (fileEntries.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }

  // Fetch the user's active plan once for all files
  const activePlanId = await getActivePlanId(userId)

  const results: FileImportResult[] = []

  for (const entry of fileEntries) {
    if (!(entry instanceof File)) {
      results.push({
        filename: 'unknown',
        status: 'parse_error',
        sessions: [],
        error: 'Invalid entry',
      })
      continue
    }

    const filename = entry.name

    // Size check
    if (entry.size > MAX_FILE_BYTES) {
      results.push({
        filename,
        status: 'parse_error',
        sessions: [],
        error: `File exceeds 10 MB limit (${(entry.size / 1024 / 1024).toFixed(1)} MB)`,
      })
      continue
    }

    // Parse
    let parsed: Awaited<ReturnType<typeof parseFitBuffer>>
    try {
      const buffer = await entry.arrayBuffer()
      parsed = await parseFitBuffer(buffer, filename)
    } catch (err) {
      results.push({
        filename,
        status: 'parse_error',
        sessions: [],
        error: err instanceof Error ? err.message : 'Failed to parse FIT file',
      })
      continue
    }

    if (parsed.activities.length === 0) {
      results.push({ filename, status: 'empty', sessions: [], error: 'No sessions found in file' })
      continue
    }

    // Import each session
    const sessionResults: SessionImportResult[] = []

    for (const activity of parsed.activities) {
      try {
        const outcome = await importActivity(userId, activity, activePlanId)
        sessionResults.push({
          discipline: activity.discipline,
          date: activity.date,
          durationMinutes: activity.durationMinutes,
          outcome,
        })
      } catch (err) {
        console.error('[FIT import] session import failed', err)
        sessionResults.push({
          discipline: activity.discipline,
          date: activity.date,
          durationMinutes: activity.durationMinutes,
          outcome: 'no_plan',
        })
      }
    }

    results.push({ filename, status: 'ok', sessions: sessionResults })
  }

  return NextResponse.json({ results })
}
