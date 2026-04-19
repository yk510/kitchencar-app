import type { MarketplaceMessage } from '@/types/marketplace'

export const ACCEPTED_STATUS_MESSAGE = '出店が決定しました。詳細のやり取りをメッセージで実施してください。'
export const REJECTED_STATUS_MESSAGE = '今回は見送りとなりました。ご応募ありがとうございました。別の機会がありましたら、ぜひよろしくお願いいたします。'
export const CONTACT_RELEASE_MESSAGE_PREFIX = '主催者の連絡先情報が公開されました。主催者からの指示のもと、必要に応じて、電話やメールにてご対応ください。'

export function statusUpdateMessage(status: 'accepted' | 'rejected') {
  return status === 'accepted' ? ACCEPTED_STATUS_MESSAGE : REJECTED_STATUS_MESSAGE
}

export function isStatusUpdateMessage(message: string) {
  return (
    message === ACCEPTED_STATUS_MESSAGE ||
    message === REJECTED_STATUS_MESSAGE ||
    message.startsWith(CONTACT_RELEASE_MESSAGE_PREFIX)
  )
}

export function contactReleaseMessage(input: {
  contactName: string | null
  contactEmail: string | null
  phone: string | null
}) {
  return [
    CONTACT_RELEASE_MESSAGE_PREFIX,
    input.contactName ? `担当者名: ${input.contactName}` : null,
    input.contactEmail ? `メール: ${input.contactEmail}` : null,
    input.phone ? `電話番号: ${input.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function isInitialApplicationMessage(
  message: MarketplaceMessage,
  initialMessage: string | null
) {
  return message.sender_role === 'vendor' && !!initialMessage && message.message === initialMessage
}

export function getApplicationMessageLabel(
  message: MarketplaceMessage,
  initialMessage: string | null
) {
  if (isStatusUpdateMessage(message.message)) {
    return '運営からのお知らせ'
  }

  if (message.sender_role === 'organizer') {
    return '主催者からの返信'
  }

  if (isInitialApplicationMessage(message, initialMessage)) {
    return '応募時メッセージ'
  }

  return '追加メッセージ'
}

export function getApplicationMessagePresentation(input: {
  message: MarketplaceMessage
  initialMessage: string | null
  currentRole: 'vendor' | 'organizer'
}) {
  const { message, initialMessage, currentRole } = input
  const notice = isStatusUpdateMessage(message.message)
  const mine = message.sender_role === currentRole

  return {
    label: getApplicationMessageLabel(message, initialMessage),
    align: notice ? 'center' : mine ? 'right' : 'left',
    tone: notice ? 'notice' : mine ? 'mine' : 'normal',
    highlighted: isInitialApplicationMessage(message, initialMessage),
  } as const
}
