import type { Database } from '@/types/database'

export type AudioCaptureSessionRow =
  Database['public']['Tables']['audio_capture_sessions']['Row']

export type AudioCaptureChunkRow =
  Database['public']['Tables']['audio_capture_chunks']['Row']

export type AudioTranscriptRow =
  Database['public']['Tables']['audio_transcripts']['Row']

export type AudioOrderEventRow =
  Database['public']['Tables']['audio_order_events']['Row']

export type ProductAliasRow =
  Database['public']['Tables']['product_aliases']['Row']

export type AudioCaptureSessionStatus =
  AudioCaptureSessionRow['status']

export type AudioChunkUploadStatus =
  AudioCaptureChunkRow['upload_status']

export type AudioChunkTranscriptionStatus =
  AudioCaptureChunkRow['transcription_status']

export type AudioTranscriptSpeakerType =
  AudioTranscriptRow['speaker_type']

export type AudioSessionCreatePayload = {
  device_label?: string | null
  microphone_label?: string | null
  notes?: string | null
}

export type AudioSessionUpdatePayload = {
  status?: AudioCaptureSessionStatus
  ended_at?: string | null
  notes?: string | null
}

export type AudioSessionMutationPayload = {
  session: AudioCaptureSessionRow
}

export type AudioSessionListPayload = {
  sessions: AudioCaptureSessionRow[]
}

export type AudioChunkCreatePayload = {
  session_id: string
  started_at: string
  ended_at: string
  duration_sec: number
  storage_bucket?: string | null
  storage_path?: string | null
  audio_file_url?: string | null
  upload_status?: AudioChunkUploadStatus
  transcription_status?: AudioChunkTranscriptionStatus
}

export type AudioChunkMutationPayload = {
  chunk: AudioCaptureChunkRow
}

export type AudioChunkListPayload = {
  chunks: AudioCaptureChunkRow[]
}

export type AudioTranscriptCreateItem = {
  spoken_at: string
  transcript_text: string
  speaker_type?: AudioTranscriptSpeakerType
  confidence?: number | null
}

export type AudioTranscriptCreatePayload = {
  session_id: string
  chunk_id: string
  transcripts: AudioTranscriptCreateItem[]
}

export type AudioTranscriptListRow = AudioTranscriptRow & {
  extracted_events: AudioOrderEventRow[]
}

export type AudioTranscriptListPayload = {
  transcripts: AudioTranscriptListRow[]
}

export type AudioTranscriptMutationPayload = {
  transcripts: AudioTranscriptListRow[]
}

export type AudioTranscriptPersistInput = {
  spoken_at: string
  transcript_text: string
  speaker_type?: AudioTranscriptSpeakerType
  confidence?: number | null
}

export type AudioImportCatalogProductInput = {
  product_name: string
  aliases?: string[]
}

export type AudioOrderEventCreateItem = {
  transcript_id: string
  product_id?: string | null
  product_name_raw: string
  normalized_product_name?: string | null
  quantity: number
  confidence?: number | null
  event_at: string
}

export type AudioOrderEventCreatePayload = {
  session_id: string
  events: AudioOrderEventCreateItem[]
}

export type AudioOrderEventMutationPayload = {
  events: AudioOrderEventRow[]
}

export type AudioOrderEventListRow = AudioOrderEventRow & {
  transcript_text: string | null
  speaker_type: AudioTranscriptSpeakerType | null
}

export type AudioOrderEventListPayload = {
  rows: AudioOrderEventListRow[]
}

export type AudioTranscriptImportSessionInput = {
  device_label?: string | null
  microphone_label?: string | null
  notes?: string | null
  started_at?: string | null
  ended_at?: string | null
  status?: AudioCaptureSessionStatus
}

export type AudioTranscriptImportChunkInput = {
  chunk_label?: string | null
  started_at?: string | null
  ended_at?: string | null
  duration_sec?: number | null
  transcripts: AudioTranscriptPersistInput[]
}

export type AudioTranscriptImportPayload = {
  source_label?: string | null
  session?: AudioTranscriptImportSessionInput
  product_catalog?: {
    products: AudioImportCatalogProductInput[]
  }
  assumptions?: {
    products?: string[]
  }
  chunks?: AudioTranscriptImportChunkInput[]
  chunk_payload_templates?: Array<{
    chunk_label?: string | null
    transcripts: AudioTranscriptPersistInput[]
  }>
}

export type AudioTranscriptImportResultPayload = {
  session: AudioCaptureSessionRow
  chunk_count: number
  transcript_count: number
  order_event_count: number
  matched_transcript_count: number
  unmatched_transcript_count: number
  chunks: Array<{
    chunk_id: string
    chunk_label: string | null
    transcript_count: number
    order_event_count: number
    matched_transcript_count: number
    unmatched_transcript_count: number
  }>
}

export type ProductAliasCreatePayload = {
  product_id: string
  alias: string
}

export type ProductAliasUpdatePayload = {
  alias: string
}

export type ProductAliasListPayload = {
  aliases: ProductAliasRow[]
}

export type AudioAnalyticsProductRow = {
  product_id: string | null
  product_name: string
  total_quantity: number
  order_event_count: number
}

export type AudioAnalyticsProductsPayload = {
  rows: AudioAnalyticsProductRow[]
}

export type AudioAnalyticsHourlyRow = {
  hour: number
  label: string
  total_quantity: number
  order_event_count: number
}

export type AudioAnalyticsHourlyPayload = {
  rows: AudioAnalyticsHourlyRow[]
}
