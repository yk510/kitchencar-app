import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import type { AppRole } from '@/lib/user-role'

type LandingMetadata = {
  role: AppRole
  eyebrow: string
  edition: string
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  imageAlt: string
}

export function getLandingMetadata(role: AppRole): LandingMetadata {
  if (role === 'organizer') {
    return {
      role,
      eyebrow: 'EVENT ORGANIZER WORKSPACE',
      edition: 'ORGANIZER EDITION',
      title: `${BRAND_NAME} ${BRAND_STAGE_LABEL} | イベント主催者向け`,
      description:
        '募集作成、応募管理、メッセージ、出店決定まで。イベント主催者のキッチンカー出店者管理を一元化する運営OSです。',
      ogTitle: `${BRAND_NAME} | 募集と応募対応を、ひとつに。`,
      ogDescription:
        'イベント主催者の募集作成、応募管理、メッセージ対応をクリダス!!で一元化。',
      imageAlt: `${BRAND_NAME} ${BRAND_STAGE_LABEL} イベント主催者向けLPのOGP画像`,
    }
  }

  return {
    role,
    eyebrow: 'FOOD TRUCK BUSINESS OS',
    edition: 'VENDOR EDITION',
    title: `${BRAND_NAME} ${BRAND_STAGE_LABEL} | キッチンカー事業者向け`,
    description:
      'AirレジCSV分析、売上予測、AI週報、出店先探しまで。キッチンカー事業者の営業改善を支える業務OSです。',
    ogTitle: `${BRAND_NAME} | 売上入力で終わらせない。`,
    ogDescription: `${BRAND_CONCEPT}。AirレジCSV分析、売上予測、AI週報、出店先探しをひとつに。`,
    imageAlt: `${BRAND_NAME} ${BRAND_STAGE_LABEL} キッチンカー事業者向けLPのOGP画像`,
  }
}
