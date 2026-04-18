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
