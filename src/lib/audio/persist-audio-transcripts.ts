import { extractAudioOrderEvents } from '@/lib/audio/extract-order-events'
import { loadAudioProductAliasDictionary } from '@/lib/audio/product-alias'
import type {
  AudioImportCatalogProductInput,
  AudioOrderEventCreateItem,
  AudioTranscriptCreateItem,
  AudioTranscriptListRow,
  AudioTranscriptPersistInput,
} from '@/types/audio-analytics'

function normalizeTranscriptInput(item: AudioTranscriptCreateItem | AudioTranscriptPersistInput) {
  const spokenAt = String(item.spoken_at ?? '').trim()
  const transcriptText = String(item.transcript_text ?? '').trim()

  if (!spokenAt) {
    throw new Error('spoken_at は必須です')
  }

  if (!transcriptText) {
    throw new Error('transcript_text は必須です')
  }

  const parsedSpokenAt = new Date(spokenAt)
  if (Number.isNaN(parsedSpokenAt.getTime())) {
    throw new Error('spoken_at は ISO 形式の日付文字列で指定してください')
  }

  return {
    spoken_at: parsedSpokenAt.toISOString(),
    transcript_text: transcriptText,
    speaker_type: item.speaker_type ?? 'staff',
    confidence: item.confidence ?? null,
  }
}

export async function persistAudioTranscriptsWithEvents(
  supabase: any,
  userId: string,
  sessionId: string,
  chunkId: string,
  transcriptsInput: Array<AudioTranscriptCreateItem | AudioTranscriptPersistInput>,
  options?: {
    importCatalogProducts?: AudioImportCatalogProductInput[]
  }
) {
  if (transcriptsInput.length === 0) {
    throw new Error('transcripts は1件以上必要です')
  }

  const transcriptRows = transcriptsInput.map((item) => {
    const normalized = normalizeTranscriptInput(item)
    return {
      chunk_id: chunkId,
      session_id: sessionId,
      user_id: userId,
      spoken_at: normalized.spoken_at,
      speaker_type: normalized.speaker_type,
      transcript_text: normalized.transcript_text,
      confidence: normalized.confidence,
    }
  })

  const { data: createdTranscripts, error: transcriptInsertError } = await (supabase as any)
    .from('audio_transcripts')
    .insert(transcriptRows)
    .select('*')

  if (transcriptInsertError) {
    throw new Error(transcriptInsertError.message)
  }

  const dictionary = await loadAudioProductAliasDictionary(
    supabase,
    userId,
    options?.importCatalogProducts ?? []
  )
  const eventRows: AudioOrderEventCreateItem[] = []

  ;(createdTranscripts ?? []).forEach((transcript: any) => {
    const extracted = extractAudioOrderEvents(dictionary, transcript.transcript_text)
    for (const event of extracted) {
      eventRows.push({
        transcript_id: transcript.id,
        product_id: event.productId,
        product_name_raw: event.productNameRaw,
        normalized_product_name: event.normalizedProductName,
        quantity: event.quantity,
        confidence: transcript.confidence ?? null,
        event_at: transcript.spoken_at,
      })
    }
  })

  let createdEvents: any[] = []
  if (eventRows.length > 0) {
    const { data: insertedEvents, error: eventInsertError } = await (supabase as any)
      .from('audio_order_events')
      .insert(
        eventRows.map((event) => ({
          transcript_id: event.transcript_id,
          session_id: sessionId,
          user_id: userId,
          product_id: event.product_id ?? null,
          product_name_raw: event.product_name_raw,
          normalized_product_name: event.normalized_product_name ?? null,
          quantity: event.quantity,
          confidence: event.confidence ?? null,
          event_at: event.event_at,
        }))
      )
      .select('*')

    if (eventInsertError) {
      throw new Error(eventInsertError.message)
    }

    createdEvents = insertedEvents ?? []
  }

  const { error: chunkUpdateError } = await (supabase as any)
    .from('audio_capture_chunks')
    .update({ transcription_status: 'completed' })
    .eq('id', chunkId)
    .eq('user_id', userId)

  if (chunkUpdateError) {
    throw new Error(chunkUpdateError.message)
  }

  const eventsByTranscriptId = new Map<string, any[]>()
  for (const event of createdEvents) {
    const bucket = eventsByTranscriptId.get(event.transcript_id) ?? []
    bucket.push(event)
    eventsByTranscriptId.set(event.transcript_id, bucket)
  }

  const transcripts: AudioTranscriptListRow[] = (createdTranscripts ?? []).map((transcript: any) => ({
    ...transcript,
    extracted_events: eventsByTranscriptId.get(transcript.id) ?? [],
  }))

  const matchedTranscriptCount = transcripts.filter((transcript) => transcript.extracted_events.length > 0).length
  const unmatchedTranscriptCount = transcripts.length - matchedTranscriptCount

  return {
    transcripts,
    orderEventCount: createdEvents.length,
    matchedTranscriptCount,
    unmatchedTranscriptCount,
  }
}
