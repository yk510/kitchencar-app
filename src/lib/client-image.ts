export type CompressImageOptions = {
  maxWidth: number
  maxHeight: number
  quality?: number
  outputType?: 'image/jpeg' | 'image/webp'
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    image.src = src
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

export async function compressImageFile(file: File, options: CompressImageOptions) {
  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)

  const ratio = Math.min(
    options.maxWidth / image.width,
    options.maxHeight / image.height,
    1
  )

  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('画像処理の準備に失敗しました')
  }

  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL(options.outputType ?? 'image/jpeg', options.quality ?? 0.82)
}
