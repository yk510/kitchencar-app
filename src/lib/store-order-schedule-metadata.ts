import type { StoreOrderScheduleRow } from '@/types/api-payloads'

const SCHEDULE_METADATA_START = '[kuridas:schedule-metadata]'
const SCHEDULE_METADATA_END = '[/kuridas:schedule-metadata]'

export type StoreOrderScheduleMetadata = {
  location_id: string | null
  event_name: string | null
}

export type StoreOrderScheduleWithContext = StoreOrderScheduleRow & StoreOrderScheduleMetadata

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function extractStoreOrderScheduleMetadata(notes: string | null | undefined): StoreOrderScheduleMetadata {
  const text = String(notes ?? '')
  if (!text.includes(SCHEDULE_METADATA_START) || !text.includes(SCHEDULE_METADATA_END)) {
    return { location_id: null, event_name: null }
  }

  const pattern = new RegExp(
    `${SCHEDULE_METADATA_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${SCHEDULE_METADATA_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  )
  const match = text.match(pattern)
  if (!match?.[1]) return { location_id: null, event_name: null }

  const parsed = parseJsonObject(match[1].trim())
  if (!parsed) return { location_id: null, event_name: null }

  const metadata = parsed as Record<string, unknown>
  return {
    location_id: typeof metadata.location_id === 'string' ? metadata.location_id.trim() || null : null,
    event_name: typeof metadata.event_name === 'string' ? metadata.event_name.trim() || null : null,
  }
}

export function stripStoreOrderScheduleMetadata(notes: string | null | undefined) {
  const text = String(notes ?? '').trim()
  if (!text) return ''

  const pattern = new RegExp(
    `${SCHEDULE_METADATA_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SCHEDULE_METADATA_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g'
  )

  return text.replace(pattern, '').trim()
}

export function upsertStoreOrderScheduleMetadataInNotes(
  notes: string | null | undefined,
  metadata: StoreOrderScheduleMetadata
) {
  const baseNotes = stripStoreOrderScheduleMetadata(notes)
  const metadataBlock = `${SCHEDULE_METADATA_START}\n${JSON.stringify(metadata)}\n${SCHEDULE_METADATA_END}`

  if (!baseNotes) return metadataBlock
  return `${baseNotes}\n\n${metadataBlock}`
}

export function applyMetadataToSchedule(schedule: StoreOrderScheduleRow): StoreOrderScheduleWithContext {
  return {
    ...schedule,
    ...extractStoreOrderScheduleMetadata(schedule.notes),
  }
}
