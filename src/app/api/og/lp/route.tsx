import { ImageResponse } from 'next/og'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import { getLandingMetadata } from '@/lib/lp-metadata'
import type { AppRole } from '@/lib/user-role'

export const runtime = 'edge'

const size = {
  width: 1200,
  height: 630,
}

function normalizeRole(value: string | null): AppRole {
  return value === 'organizer' ? 'organizer' : 'vendor'
}

export function GET(request: Request) {
  const url = new URL(request.url)
  const role = normalizeRole(url.searchParams.get('role'))
  const meta = getLandingMetadata(role)
  const isVendor = role === 'vendor'
  const accent = isVendor ? '#c46726' : '#4240c4'
  const accentSoft = isVendor ? '#fdf0e4' : '#edeffe'
  const title = isVendor ? '売上入力で終わらせない。' : '募集と応募対応を、ひとつに。'
  const points = isVendor
    ? ['AirレジCSV分析', '売上予測', 'AI週報', '出店先探し']
    : ['募集作成', '応募管理', 'メッセージ', '出店決定']

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background:
            'radial-gradient(circle at 88% 12%, rgba(225,239,255,0.95), transparent 34%), radial-gradient(circle at 10% 90%, rgba(255,237,215,0.9), transparent 30%), linear-gradient(135deg, #fbfaf7 0%, #eef3f8 100%)',
          color: '#1d2b3a',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                borderRadius: 999,
                padding: '10px 20px',
                background: '#e6effe',
                color: '#1a57b5',
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {BRAND_NAME}
            </div>
            <div
              style={{
                display: 'flex',
                borderRadius: 999,
                padding: '10px 18px',
                background: '#fff',
                color: accent,
                fontSize: 20,
                fontWeight: 800,
                border: '1px solid #e1e7ef',
              }}
            >
              {BRAND_STAGE_LABEL}
            </div>
          </div>
          <div style={{ color: accent, fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>
            {meta.eyebrow}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 690 }}>
            <div style={{ color: accent, fontSize: 28, fontWeight: 900, marginBottom: 18 }}>
              {meta.edition}
            </div>
            <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2 }}>
              {title}
            </div>
            <div style={{ marginTop: 28, fontSize: 32, fontWeight: 800, color: '#1a57b5' }}>
              {BRAND_CONCEPT}
            </div>
            <div style={{ marginTop: 22, fontSize: 25, lineHeight: 1.55, color: '#5a6a7e' }}>
              {meta.ogDescription}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              width: 330,
              padding: 28,
              borderRadius: 32,
              background: 'rgba(255,255,255,0.86)',
              border: '1px solid #e1e7ef',
              boxShadow: '0 20px 60px rgba(16,32,58,0.08)',
            }}
          >
            {points.map((point, index) => (
              <div
                key={point}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 22,
                  background: index % 2 === 0 ? accentSoft : '#f8fafc',
                  color: '#1d2b3a',
                  fontSize: 26,
                  fontWeight: 800,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: accent,
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 900,
                  }}
                >
                  {index + 1}
                </div>
                {point}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 24, color: '#5a6a7e', fontWeight: 700 }}>
            kuridas-os.jp
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: 999, background: '#1a57b5' }} />
            <div style={{ width: 18, height: 18, borderRadius: 999, background: '#39895a' }} />
            <div style={{ width: 18, height: 18, borderRadius: 999, background: accent }} />
          </div>
        </div>
      </div>
    ),
    size
  )
}
