export type WebBluetoothProbeResult = {
  supported: boolean
  browser_label: string
  device_name: string | null
  device_id: string | null
  gatt_available: boolean
  connected: boolean
  error_message: string | null
}

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice(options: {
      filters: Array<{ namePrefix: string }>
      optionalServices?: string[]
    }): Promise<{
      id: string
      name?: string
      gatt?: {
        connect(): Promise<{ connected: boolean; disconnect(): void }>
      }
    }>
  }
}

function getNavigatorBluetooth() {
  if (typeof navigator === 'undefined') return null
  const candidate = navigator as NavigatorWithBluetooth
  return candidate.bluetooth ?? null
}

function getUserAgent() {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent || ''
}

export function getWebBluetoothEnvironmentSummary() {
  const userAgent = getUserAgent()
  const isAndroid = /Android/i.test(userAgent)
  const isChrome = /Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)
  const bluetooth = getNavigatorBluetooth()

  return {
    supported: Boolean(bluetooth),
    is_android: isAndroid,
    is_chrome: isChrome,
    browser_label: isAndroid && isChrome ? 'Android Chrome' : '非推奨ブラウザまたは未対応端末',
  }
}

function normalizeBluetoothError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (/User cancelled|cancelled the chooser|NotFoundError/i.test(message)) {
    return 'プリンター選択がキャンセルされました。MP-B20 の電源を入れて、再度お試しください。'
  }

  if (/Bluetooth adapter not available|not available/i.test(message)) {
    return 'Bluetooth が利用できません。端末側の Bluetooth 設定を確認してください。'
  }

  if (/GATT/i.test(message)) {
    return 'MP-B20 を選択できましたが、Web Bluetooth からの GATT 接続に失敗しました。補助アプリ方式が必要な可能性があります。'
  }

  return `Web Bluetooth の確認に失敗しました。詳細: ${message}`
}

export async function runMpB20WebBluetoothProbe(): Promise<WebBluetoothProbeResult> {
  const env = getWebBluetoothEnvironmentSummary()

  if (!env.supported) {
    return {
      supported: false,
      browser_label: env.browser_label,
      device_name: null,
      device_id: null,
      gatt_available: false,
      connected: false,
      error_message: 'この端末・ブラウザでは Web Bluetooth を利用できません。Android Chrome で再確認してください。',
    }
  }

  try {
    const bluetooth = getNavigatorBluetooth()
    if (!bluetooth) {
      return {
        supported: false,
        browser_label: env.browser_label,
        device_name: null,
        device_id: null,
        gatt_available: false,
        connected: false,
        error_message: 'この端末・ブラウザでは Web Bluetooth を利用できません。Android Chrome で再確認してください。',
      }
    }

    const device = await bluetooth.requestDevice({
      filters: [{ namePrefix: 'MP-B20' }],
      optionalServices: [],
    })

    let connected = false
    let gattAvailable = Boolean(device.gatt)
    let errorMessage: string | null = null

    if (device.gatt) {
      try {
        const server = await device.gatt.connect()
        connected = server.connected
        if (server.connected) {
          server.disconnect()
        }
      } catch (error) {
        errorMessage = normalizeBluetoothError(error)
      }
    } else {
      errorMessage = 'MP-B20 を選択できましたが、GATT 接続情報が取得できませんでした。補助アプリ方式が必要な可能性があります。'
    }

    return {
      supported: true,
      browser_label: env.browser_label,
      device_name: device.name ?? null,
      device_id: device.id || null,
      gatt_available: gattAvailable,
      connected,
      error_message: errorMessage,
    }
  } catch (error) {
    return {
      supported: true,
      browser_label: env.browser_label,
      device_name: null,
      device_id: null,
      gatt_available: false,
      connected: false,
      error_message: normalizeBluetoothError(error),
    }
  }
}
