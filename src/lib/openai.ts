export interface ParsedScheduleDraftDay {
  date: string
  operation_type: 'open' | 'closed' | 'event'
  location_name: string | null
  municipality: string | null
  event_name: string | null
  business_start_time: string | null
  business_end_time: string | null
  notes: string | null
  ai_source_text: string | null
  ai_confidence: number | null
}

interface KnownLocation {
  name: string
  address?: string | null
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AIの応答からJSONを取り出せませんでした')
  }

  return text.slice(start, end + 1)
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return null

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] ?? '0')

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function normalizePlanMonth(value: string | null | undefined) {
  if (!value) return null

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])

  if (month < 1 || month > 12) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function normalizeDateToPlanMonth(
  rawDate: string | null | undefined,
  planMonth: string,
  fallbackText?: string | null
) {
  const [planYear, planMonthNumber] = planMonth.split('-').map(Number)
  const maxDay = getDaysInMonth(planYear, planMonthNumber)

  const normalizedRaw = rawDate?.trim().replace(/\//g, '-') ?? ''
  const fullMatch = normalizedRaw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (fullMatch) {
    const day = Number(fullMatch[3])
    if (day >= 1 && day <= maxDay) {
      return `${String(planYear).padStart(4, '0')}-${String(planMonthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const dayOnlyMatch = normalizedRaw.match(/^(\d{1,2})$/) ?? fallbackText?.match(/(^|\D)(\d{1,2})(\D|$)/)
  const day = Number(dayOnlyMatch?.[1] ?? dayOnlyMatch?.[2] ?? NaN)

  if (Number.isFinite(day) && day >= 1 && day <= maxDay) {
    return `${String(planYear).padStart(4, '0')}-${String(planMonthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

function matchKnownLocation(
  locationName: string | null | undefined,
  municipality: string | null | undefined,
  knownLocations: KnownLocation[]
) {
  const locationText = (locationName ?? '').trim()
  const municipalityText = (municipality ?? '').trim()

  const exactMatch = knownLocations.find((item) => item.name === locationText)
  if (exactMatch) {
    return {
      location_name: exactMatch.name,
      municipality: exactMatch.address ?? (municipalityText || null),
    }
  }

  const fuzzyMatch = knownLocations.find(
    (item) =>
      locationText &&
      (item.name.includes(locationText) || locationText.includes(item.name))
  )

  if (fuzzyMatch) {
    return {
      location_name: fuzzyMatch.name,
      municipality: fuzzyMatch.address ?? (municipalityText || null),
    }
  }

  return {
    location_name: locationText || null,
    municipality: municipalityText || null,
  }
}

function normalizeOperationType(
  operationType: string | null | undefined,
  sourceText: string | null | undefined,
  locationName: string | null | undefined,
  eventName: string | null | undefined,
  notes: string | null | undefined
): 'open' | 'closed' | 'event' {
  const text = [operationType, sourceText, locationName, eventName, notes]
    .filter(Boolean)
    .join(' ')

  if (/休|定休|休業/.test(text)) return 'closed'
  if (/まつり|祭|フェス|マルシェ|イベント|グランドオープン/.test(text)) return 'event'
  if (eventName?.trim()) return 'event'
  return 'open'
}

export async function parseCalendarImageToDraft(
  imageDataUrl: string,
  knownLocations: KnownLocation[] = []
): Promise<{
  title: string | null
  plan_month: string
  days: ParsedScheduleDraftDay[]
}> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY が未設定です')
  }

  const knownLocationLines =
    knownLocations.length > 0
      ? knownLocations
          .map((item) => `- ${item.name}${item.address ? ` / ${item.address}` : ''}`)
          .join('\n')
      : 'なし'

  const prompt = [
    'あなたはキッチンカーの営業カレンダーを読み取り、営業予定案をJSONで返すアシスタントです。',
    'まず画像が営業カレンダーか確認し、営業カレンダーである前提で処理してください。',
    '画像左上などにある年・月を最優先で読み取り、plan_month は必ずその月の1日 (YYYY-MM-01) にしてください。',
    '前月や翌月の灰色表示セルは無視してください。',
    'days には「その月の日付」だけを入れてください。別年や別月の日付を絶対に出力してはいけません。',
    '各日の date は、画像で判読した日番号を plan_month の年・月に当てはめて YYYY-MM-DD にしてください。',
    '休み・定休日・休のマークがある日は operation_type を closed にしてください。',
    '通常営業の場所名は location_name に、イベント名は event_name に入れてください。',
    '「市役所」「道の駅」など市町村が読み取れる場合は municipality にも入れてください。',
    '画像下部などに共通営業時間が書かれている場合は、それを通常営業日に反映してください。',
    'イベント営業時間が別扱いと書かれている場合、イベント日は時間を null にして notes にその旨を残してください。',
    '以下の既知の出店場所候補がある場合は、できるだけこの表記に寄せてください。',
    knownLocationLines,
    '返答はJSONのみ。説明文は禁止です。',
    '形式は {"title": string|null, "plan_month": "YYYY-MM-01", "days": [{...}]} です。',
    'days の各要素は date, operation_type, location_name, municipality, event_name, business_start_time, business_end_time, notes, ai_source_text, ai_confidence を持ってください。',
    'date は YYYY-MM-DD、time は HH:MM:SS、ai_confidence は 0 から 1 の数値です。',
    '誤読しやすいので、date を 2023 など別年にしないでください。必ず画像の月に合わせてください。',
  ].join('\n')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${errorText}`)
  }

  const data = await response.json()
  const outputText =
    data.output_text ??
    data.output?.flatMap((item: any) => item.content ?? []).map((item: any) => item.text ?? '').join('\n') ??
    ''

  const parsed = JSON.parse(extractJsonObject(outputText))
  const normalizedPlanMonth = normalizePlanMonth(parsed.plan_month)

  if (!normalizedPlanMonth) {
    throw new Error('AIの応答から対象月を正しく判定できませんでした')
  }

  const normalizedDays: ParsedScheduleDraftDay[] = Array.isArray(parsed.days)
    ? parsed.days
        .map((day: any): ParsedScheduleDraftDay | null => {
          const sourceText = day.ai_source_text ?? day.location_name ?? day.event_name ?? day.notes ?? ''
          const normalizedDate = normalizeDateToPlanMonth(
            day.date,
            normalizedPlanMonth,
            sourceText
          )

          if (!normalizedDate) return null

          const matchedLocation = matchKnownLocation(
            day.location_name,
            day.municipality,
            knownLocations
          )

          const normalizedEventName =
            day.event_name?.trim() ||
            (/まつり|祭|フェス|マルシェ|イベント|グランドオープン/.test(sourceText)
              ? sourceText.trim()
              : null)

          return {
            date: normalizedDate,
            operation_type: normalizeOperationType(
              day.operation_type,
              sourceText,
              matchedLocation.location_name,
              normalizedEventName,
              day.notes
            ),
            location_name: matchedLocation.location_name,
            municipality: matchedLocation.municipality,
            event_name: normalizedEventName,
            business_start_time: normalizeTime(day.business_start_time),
            business_end_time: normalizeTime(day.business_end_time),
            notes: day.notes?.trim() || null,
            ai_source_text: sourceText || null,
            ai_confidence:
              typeof day.ai_confidence === 'number'
                ? Math.max(0, Math.min(1, day.ai_confidence))
                : null,
          }
        })
        .filter((day: ParsedScheduleDraftDay | null): day is ParsedScheduleDraftDay => Boolean(day))
        .filter(
          (
            day: ParsedScheduleDraftDay,
            index: number,
            self: ParsedScheduleDraftDay[]
          ) => self.findIndex((item) => item.date === day.date) === index
        )
        .sort(
          (a: ParsedScheduleDraftDay, b: ParsedScheduleDraftDay) =>
            a.date.localeCompare(b.date)
        )
    : []

  return {
    title: parsed.title ?? null,
    plan_month: normalizedPlanMonth,
    days: normalizedDays,
  }
}
