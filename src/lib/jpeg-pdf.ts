/** Assemble one or more JPEG pages into a single-page-per-image A4 PDF. */

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

export interface JpegPdfPage {
  jpeg: Uint8Array
  width: number
  height: number
}

function concatBytes(parts: Array<Uint8Array | string>): Uint8Array {
  const encoded = parts.map((part) => (typeof part === 'string' ? new TextEncoder().encode(part) : part))
  const total = encoded.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of encoded) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function padOffset(value: number): string {
  return value.toString().padStart(10, '0')
}

export function buildJpegPdf(pages: JpegPdfPage[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error('PDF needs at least one page')
  }

  const objects: Uint8Array[] = []
  const pageObjectNumbers: number[] = []
  let nextObject = 3

  for (const page of pages) {
    const pageObject = nextObject
    const contentObject = nextObject + 1
    const imageObject = nextObject + 2
    nextObject += 3
    pageObjectNumbers.push(pageObject)

    const content = `q ${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm /Im1 Do Q\n`

    objects[pageObject] = concatBytes([
      `${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im1 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj\n`,
    ])
    objects[contentObject] = concatBytes([
      `${contentObject} 0 obj\n<< /Length ${content.length} >>\nstream\n`,
      content,
      'endstream\nendobj\n',
    ])
    objects[imageObject] = concatBytes([
      `${imageObject} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream\nendobj\n',
    ])
  }

  const kids = pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')
  objects[1] = concatBytes(['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'])
  objects[2] = concatBytes([
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`,
  ])

  const header = new TextEncoder().encode('%PDF-1.4\n')
  const parts: Uint8Array[] = [header]
  const offsets = [0]
  let cursor = header.length

  for (let number = 1; number < nextObject; number += 1) {
    const body = objects[number]
    if (!body) throw new Error(`Missing PDF object ${number}`)
    offsets[number] = cursor
    parts.push(body)
    cursor += body.length
  }

  const xrefOffset = cursor
  let xref = `xref\n0 ${nextObject}\n0000000000 65535 f \n`
  for (let number = 1; number < nextObject; number += 1) {
    xref += `${padOffset(offsets[number] ?? 0)} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${nextObject} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  parts.push(new TextEncoder().encode(xref))
  return concatBytes(parts)
}

export const JPEG_PDF_PAGE_SIZE = { width: PAGE_WIDTH, height: PAGE_HEIGHT } as const
