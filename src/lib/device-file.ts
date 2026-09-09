import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from './capacitor'

function triggerBrowserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

function isShareCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel/i.test(message)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer as ArrayBuffer
}

/** Save a PDF on web (browser download) or native (Documents + share sheet). */
export async function savePdfToDevice(filename: string, bytes: Uint8Array): Promise<void> {
  const blob = new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' })

  if (!isNativeApp()) {
    triggerBrowserDownload(filename, blob)
    return
  }

  const data = await blobToBase64(blob)
  let directory = Directory.Documents
  try {
    await Filesystem.writeFile({ path: filename, data, directory })
  } catch {
    directory = Directory.Cache
    await Filesystem.writeFile({ path: filename, data, directory })
  }

  const { uri } = await Filesystem.getUri({ path: filename, directory })
  const canShare = await Share.canShare()
  if (!canShare.value) return

  try {
    await Share.share({
      title: filename,
      dialogTitle: filename,
      files: [uri],
    })
  } catch (error) {
    if (isShareCancellation(error)) return
    throw error
  }
}
