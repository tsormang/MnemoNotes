import { JPEG_PDF_PAGE_SIZE, buildJpegPdf } from '../../lib/jpeg-pdf'
import type { CalendarItemKind } from '../../types/domain'
import type { SchedulePrintDay, SchedulePrintEvent, SchedulePrintModel } from './calendar-print'

const PAGE_WIDTH = JPEG_PDF_PAGE_SIZE.width
const PAGE_HEIGHT = JPEG_PDF_PAGE_SIZE.height
const SCALE = 2
const MARGIN = 36
const KIND_COLORS: Record<CalendarItemKind, string> = {
  shift: '#3b82c4',
  note: '#d4a017',
  task: '#d45a4a',
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  const pushLongToken = (token: string) => {
    let chunk = ''
    for (const character of token) {
      const trial = chunk + character
      if (ctx.measureText(trial).width <= maxWidth) {
        chunk = trial
        continue
      }
      if (chunk) lines.push(chunk)
      chunk = character
    }
    current = chunk
  }

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (ctx.measureText(word).width > maxWidth) {
      pushLongToken(word)
    } else {
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Could not encode PDF page'))
          return
        }
        resolve({
          jpeg: new Uint8Array(await blob.arrayBuffer()),
          width: canvas.width,
          height: canvas.height,
        })
      },
      'image/jpeg',
      0.92,
    )
  })
}

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PAGE_WIDTH * SCALE)
  canvas.height = Math.round(PAGE_HEIGHT * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create PDF canvas')
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  ctx.textBaseline = 'top'
  return { canvas, ctx }
}

function drawHeader(ctx: CanvasRenderingContext2D, model: SchedulePrintModel): number {
  const contentWidth = PAGE_WIDTH - MARGIN * 2
  ctx.fillStyle = '#1c2a26'
  ctx.font = '700 16px "Segoe UI", "Noto Sans", sans-serif'
  ctx.fillText(model.brandName, MARGIN, MARGIN)

  ctx.font = '600 12px "Segoe UI", "Noto Sans", sans-serif'
  ctx.fillText(model.organizationName, MARGIN, MARGIN + 22)

  ctx.fillStyle = '#5c7369'
  ctx.font = '500 11px "Segoe UI", "Noto Sans", sans-serif'
  ctx.fillText(`${model.viewLabel} · ${model.rangeLabel}`, MARGIN, MARGIN + 40)

  ctx.strokeStyle = '#dde8e3'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN, MARGIN + 56)
  ctx.lineTo(MARGIN + contentWidth, MARGIN + 56)
  ctx.stroke()

  return MARGIN + 68
}

function eventHeight(ctx: CanvasRenderingContext2D, event: SchedulePrintEvent, titleWidth: number): number {
  ctx.font = '400 10px "Segoe UI", "Noto Sans", sans-serif'
  const lines = wrapText(ctx, event.title, titleWidth)
  return Math.max(16, lines.length * 13) + 4
}

function dayHeadingHeight(): number {
  return 22
}

function drawEvent(
  ctx: CanvasRenderingContext2D,
  event: SchedulePrintEvent,
  y: number,
  titleWidth: number,
): number {
  const timeX = MARGIN
  const kindX = MARGIN + 78
  const titleX = MARGIN + 128

  ctx.fillStyle = KIND_COLORS[event.kind]
  ctx.beginPath()
  ctx.arc(titleX - 10, y + 6, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#5c7369'
  ctx.font = '500 9px "Segoe UI", "Noto Sans", sans-serif'
  ctx.fillText(event.timeLabel, timeX, y + 1)

  ctx.fillStyle = KIND_COLORS[event.kind]
  ctx.fillText(event.kindLabel, kindX, y + 1)

  ctx.fillStyle = '#1c2a26'
  ctx.font = '400 10px "Segoe UI", "Noto Sans", sans-serif'
  const lines = wrapText(ctx, event.title, titleWidth)
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, titleX, y + index * 13)
  }

  return Math.max(16, lines.length * 13) + 4
}

function drawDayHeading(ctx: CanvasRenderingContext2D, day: SchedulePrintDay, y: number) {
  ctx.fillStyle = '#1c2a26'
  ctx.font = '700 12px "Segoe UI", "Noto Sans", sans-serif'
  ctx.fillText(day.heading, MARGIN, y)

  ctx.strokeStyle = '#ecf6f2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN, y + 16)
  ctx.lineTo(PAGE_WIDTH - MARGIN, y + 16)
  ctx.stroke()
}

export async function renderSchedulePdf(model: SchedulePrintModel): Promise<Uint8Array> {
  const titleWidth = PAGE_WIDTH - MARGIN * 2 - 128
  const pages: Array<{ jpeg: Uint8Array; width: number; height: number }> = []
  let { canvas, ctx } = createPageCanvas()
  let y = drawHeader(ctx, model)
  const bottom = PAGE_HEIGHT - MARGIN

  const flushPage = async () => {
    pages.push(await canvasToJpeg(canvas))
  }

  const startNewPage = async () => {
    await flushPage()
    ;({ canvas, ctx } = createPageCanvas())
    y = drawHeader(ctx, model)
  }

  const ensureSpace = async (needed: number) => {
    if (y + needed <= bottom) return
    await startNewPage()
  }

  for (const day of model.days) {
    await ensureSpace(dayHeadingHeight() + 16)

    drawDayHeading(ctx, day, y)
    y += dayHeadingHeight()

    if (day.events.length === 0) {
      await ensureSpace(16)
      ctx.fillStyle = '#5c7369'
      ctx.font = '400 10px "Segoe UI", "Noto Sans", sans-serif'
      ctx.fillText(model.emptyDay, MARGIN, y)
      y += 20
      continue
    }

    for (const event of day.events) {
      const height = eventHeight(ctx, event, titleWidth)
      await ensureSpace(height)
      y += drawEvent(ctx, event, y, titleWidth)
    }

    y += 8
  }

  await flushPage()
  return buildJpegPdf(pages)
}
