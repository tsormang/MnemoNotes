export function preparePrintClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))

  clone.querySelectorAll<HTMLElement>('*').forEach((element) => {
    if (element.style.height) element.style.height = 'auto'
    if (element.style.maxHeight) element.style.maxHeight = 'none'
    if (element.style.minHeight) element.style.minHeight = '0'
    if (element.style.overflow === 'hidden' || element.style.overflow === 'auto') {
      element.style.overflow = 'visible'
    }
    if (element.classList.contains('fc-scroller-liquid-absolute')) {
      element.style.position = 'static'
      element.style.inset = 'auto'
    }
  })

  return clone
}
