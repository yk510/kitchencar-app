import { buildEscPosReceiptBytes } from '@/lib/receipt-printing/escpos'
import type { ReceiptPrintPayload } from '@/types/api-payloads'

type BluetoothWriteCharacteristic = {
  writeValue(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
}

type BluetoothService = {
  getCharacteristic(characteristicUuid: string): Promise<BluetoothWriteCharacteristic>
}

type BluetoothGattServer = {
  connected: boolean
  connect(): Promise<BluetoothGattServer>
  disconnect(): void
  getPrimaryService(serviceUuid: string): Promise<BluetoothService>
}

type BluetoothDeviceLike = {
  name?: string
  gatt?: BluetoothGattServer
}

export type WebBluetoothPrinterProfile = {
  serviceUuid: string
  characteristicUuid: string
  chunkSize?: number
}

export type WebBluetoothPrintResult = {
  deviceName: string | null
  chunkCount: number
  byteLength: number
}

export class WebBluetoothPrintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebBluetoothPrintError'
  }
}

function chunkBytes(bytes: Uint8Array, size: number) {
  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size))
  }
  return chunks
}

function toBufferSource(chunk: Uint8Array) {
  const buffer = new ArrayBuffer(chunk.byteLength)
  new Uint8Array(buffer).set(chunk)
  return buffer
}

async function writeChunk(characteristic: BluetoothWriteCharacteristic, chunk: Uint8Array) {
  if (typeof characteristic.writeValueWithoutResponse === 'function') {
    await characteristic.writeValueWithoutResponse(toBufferSource(chunk))
    return
  }

  await characteristic.writeValue(toBufferSource(chunk))
}

export async function sendWebBluetoothReceiptPrint(args: {
  device: BluetoothDeviceLike
  payload: ReceiptPrintPayload
  profile: WebBluetoothPrinterProfile
}) {
  if (!args.device.gatt) {
    throw new WebBluetoothPrintError('このプリンターは GATT 接続情報を持っていません。補助アプリ方式が必要な可能性があります。')
  }

  const server = args.device.gatt.connected ? args.device.gatt : await args.device.gatt.connect()
  const service = await server.getPrimaryService(args.profile.serviceUuid)
  const characteristic = await service.getCharacteristic(args.profile.characteristicUuid)
  const bytes = buildEscPosReceiptBytes(args.payload)
  const chunks = chunkBytes(bytes, args.profile.chunkSize ?? 180)

  for (const chunk of chunks) {
    await writeChunk(characteristic, chunk)
  }

  return {
    deviceName: args.device.name ?? null,
    chunkCount: chunks.length,
    byteLength: bytes.length,
  } satisfies WebBluetoothPrintResult
}
