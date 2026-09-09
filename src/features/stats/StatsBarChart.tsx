import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ActiveElement,
  type ChartEvent,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

function formatHours(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

export type StatsBarOrientation = 'horizontal' | 'vertical'

export interface StatsBarLabelIcon {
  /** Resolved image URL when an avatar/icon exists. */
  imageUrl?: string | null
  /** Initials fallback for personnel without a custom avatar. */
  initials?: string | null
}

export interface StatsBarChartProps {
  labels: string[]
  values: number[]
  colorVar?: '--color-brand' | '--event-shift-border' | '--color-brand-bright'
  /** Per-bar fill colors (e.g. personnel/role palette borders). Overrides colorVar when provided. */
  barColors?: string[]
  orientation?: StatsBarOrientation
  ariaLabel: string
  labelIcons?: StatsBarLabelIcon[]
  onBarClick?: (index: number) => void
}

const ICON_SIZE = 22

function drawBarIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  image: HTMLImageElement | null,
  initials: string | null | undefined,
  colors: { surface: string; brandSoft: string; brand: string },
) {
  const iconX = centerX - ICON_SIZE / 2
  const iconY = centerY - ICON_SIZE / 2

  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, ICON_SIZE / 2 + 1.5, 0, Math.PI * 2)
  ctx.fillStyle = colors.surface
  ctx.fill()

  if (image) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, ICON_SIZE / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, iconX, iconY, ICON_SIZE, ICON_SIZE)
  } else if (initials) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, ICON_SIZE / 2, 0, Math.PI * 2)
    ctx.fillStyle = colors.brandSoft
    ctx.fill()
    ctx.fillStyle = colors.brand
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, centerX, centerY + 0.5)
  }
  ctx.restore()
}

export function StatsBarChart({
  labels,
  values,
  colorVar = '--color-brand',
  barColors,
  orientation = 'vertical',
  ariaLabel,
  labelIcons,
  onBarClick,
}: StatsBarChartProps) {
  const horizontal = orientation === 'horizontal'
  const showIcons = Boolean(horizontal && labelIcons && labelIcons.length > 0)
  const colorFallbacks: Record<NonNullable<StatsBarChartProps['colorVar']>, string> = {
    '--color-brand': '#5ead90',
    '--event-shift-border': '#3b82c4',
    '--color-brand-bright': '#7ec4ad',
  }

  const fallbackColor = readCssColor(colorVar, colorFallbacks[colorVar])
  const backgroundColor =
    barColors && barColors.length > 0
      ? labels.map((_, index) => barColors[index] ?? fallbackColor)
      : fallbackColor
  const textMuted = readCssColor('--color-text-muted', '#5c7369')
  const borderColor = readCssColor('--color-border', '#dde8e3')
  const brandSoft = readCssColor('--color-brand-soft', '#ecf6f2')
  const brand = readCssColor('--color-brand', '#5ead90')
  const surface = readCssColor('--color-surface', '#ffffff')

  const rowHeight = showIcons ? 40 : 28
  const height = horizontal ? Math.max(280, labels.length * rowHeight) : 320

  const [loadedImages, setLoadedImages] = useState<(HTMLImageElement | null)[]>([])

  useEffect(() => {
    if (!showIcons || !labelIcons) {
      setLoadedImages([])
      return
    }

    let cancelled = false
    const tasks = labelIcons.map(
      (icon) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          if (!icon.imageUrl) {
            resolve(null)
            return
          }
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => resolve(null)
          image.src = icon.imageUrl
        }),
    )

    void Promise.all(tasks).then((images) => {
      if (!cancelled) setLoadedImages(images)
    })

    return () => {
      cancelled = true
    }
  }, [labelIcons, showIcons])

  // afterDraw (not afterDatasetsDraw): Chart.js still clips to the plot area during dataset hooks.
  const barEdgeIconsPlugin = useMemo<Plugin<'bar'>>(
    () => ({
      id: 'statsBarEdgeIcons',
      afterDraw(chart) {
        if (!showIcons || !labelIcons) return

        const meta = chart.getDatasetMeta(0)
        if (!meta?.data?.length) return

        const ctx = chart.ctx
        const colors = { surface, brandSoft, brand }

        meta.data.forEach((element, index) => {
          const icon = labelIcons[index]
          if (!icon) return

          const image = loadedImages[index] ?? null
          const initials = icon.initials
          if (!image && !initials) return

          // BarElement geometry: for indexAxis 'y', x is the tip and y is the row center.
          const tipX = element.x
          const centerY = element.y
          const elementBase = (element as unknown as { base?: number }).base
          const baseX = typeof elementBase === 'number' ? elementBase : tipX
          const barLength = Math.abs(tipX - baseX)

          // Sit on the tip; for very short bars, nudge inward from the tip toward the base.
          const inset = Math.min(ICON_SIZE / 2 + 2, Math.max(0, barLength / 2))
          const iconCenterX = tipX - Math.sign(tipX - baseX || 1) * inset

          drawBarIcon(ctx, iconCenterX, centerY, image, initials, colors)
        })
      },
    }),
    [brand, brandSoft, labelIcons, loadedImages, showIcons, surface],
  )

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor,
          borderRadius: 4,
          maxBarThickness: horizontal ? 22 : 36,
        },
      ],
    }),
    [backgroundColor, horizontal, labels, values],
  )

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (!onBarClick || elements.length === 0) return
        const index = elements[0]?.index
        if (typeof index === 'number') onBarClick(index)
      },
      onHover: (event, elements) => {
        const target = event.native?.target
        if (!(target instanceof HTMLElement)) return
        target.style.cursor = onBarClick && elements.length > 0 ? 'pointer' : 'default'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${formatHours(Number(context.raw ?? 0))}h`,
          },
        },
      },
      scales: horizontal
        ? {
            x: {
              type: 'linear',
              beginAtZero: true,
              grid: { color: borderColor },
              ticks: {
                color: textMuted,
                callback: (value) => `${formatHours(Number(value))}h`,
              },
            },
            y: {
              type: 'category',
              grid: { color: 'transparent' },
              ticks: { color: textMuted },
            },
          }
        : {
            x: {
              type: 'category',
              grid: { color: borderColor },
              ticks: { color: textMuted },
            },
            y: {
              type: 'linear',
              beginAtZero: true,
              grid: { color: borderColor },
              ticks: {
                color: textMuted,
                callback: (value) => `${formatHours(Number(value))}h`,
              },
            },
          },
    }),
    [borderColor, horizontal, onBarClick, textMuted],
  )

  return (
    <div className="stats-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <Bar data={data} options={options} plugins={showIcons ? [barEdgeIconsPlugin] : []} />
    </div>
  )
}
