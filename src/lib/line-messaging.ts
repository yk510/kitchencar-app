type LineTextMessage = {
  type: 'text'
  text: string
}

type SendLinePushMessageInput = {
  to: string
  messages: LineTextMessage[]
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

export function buildOrderCompletedLineMessages(input: {
  storeName: string
  orderNumber: string
  pickupNickname: string
  totalAmount: number
}) {
  return [
    {
      type: 'text' as const,
      text:
        `${input.storeName}でのご注文を受け付けました。\n` +
        `注文番号: ${input.orderNumber}\n` +
        `ニックネーム: ${input.pickupNickname}\n` +
        `合計: ${input.totalAmount.toLocaleString()}円\n` +
        `商品が完成したらLINEでお知らせします。`,
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
        `${input.storeName}のご注文ができあがりました。\n` +
        `注文番号: ${input.orderNumber}\n` +
        `ニックネーム: ${input.pickupNickname}\n` +
        `店頭で注文番号とニックネームをお伝えください。`,
    },
  ]
}
