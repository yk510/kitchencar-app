type LineTextMessage = {
  type: 'text'
  text: string
}

type SendLinePushMessageInput = {
  to: string
  messages: LineTextMessage[]
}

type LineOrderSummaryItem = {
  productName: string
  quantity: number
}

function getLineChannelAccessToken() {
  return process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN?.trim() || null
}

export function getLineMessagingConfigStatus() {
  return {
    hasChannelAccessToken: Boolean(getLineChannelAccessToken()),
  }
}

export async function sendLinePushMessage(input: SendLinePushMessageInput) {
  const channelAccessToken = getLineChannelAccessToken()

  if (!channelAccessToken) {
    throw new Error('LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN が未設定です')
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: input.to,
      messages: input.messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE push failed: ${response.status} ${errorText}`)
  }

  return {
    requestId: response.headers.get('x-line-request-id'),
  }
}

function formatLineOrderItems(items: LineOrderSummaryItem[]) {
  const mergedItems = new Map<string, number>()

  for (const item of items) {
    const key = item.productName.trim()
    if (!key) continue
    mergedItems.set(key, (mergedItems.get(key) ?? 0) + item.quantity)
  }

  return Array.from(mergedItems.entries())
    .map(([productName, quantity]) => `・${productName} × ${quantity}`)
    .join('\n')
}

export function buildOrderCompletedLineMessages(input: {
  storeName: string
  orderNumber: string
  pickupNickname: string
  totalAmount: number
  items: LineOrderSummaryItem[]
}) {
  const itemsText = formatLineOrderItems(input.items)

  return [
    {
      type: 'text' as const,
      text:
        `${input.storeName}でのご注文ありがとうございます!\n` +
        `以下の内容で受け付けました。\n\n` +
        `${itemsText}\n\n` +
        `注文番号: ${input.orderNumber}\n` +
        `受け取り名: ${input.pickupNickname}\n` +
        `お会計: ${input.totalAmount.toLocaleString()}円\n\n` +
        `商品ができあがったら、LINEでお呼びします。`,
    },
  ]
}

export function buildOrderReadyLineMessages(input: {
  storeName: string
  orderNumber: string
  pickupNickname: string
}) {
  return [
    {
      type: 'text' as const,
      text:
        `お待たせしました!\n` +
        `${input.storeName}のご注文ができあがりました。\n` +
        `注文番号: ${input.orderNumber}\n` +
        `受け取り名: ${input.pickupNickname}\n\n` +
        `店頭で注文番号と受け取り名をお伝えください。`,
    },
  ]
}

export function buildOrderPreparingLineMessages(input: {
  storeName: string
  orderNumber: string
  pickupNickname: string
}) {
  return [
    {
      type: 'text' as const,
      text:
        `ただいま調理を始めました!\n` +
        `${input.storeName}で順番にご用意しています。\n` +
        `注文番号: ${input.orderNumber}\n` +
        `受け取り名: ${input.pickupNickname}\n\n` +
        `できあがったら、もう一度LINEでお知らせします。`,
    },
  ]
}
