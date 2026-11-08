import './themeTransition.css'

export interface ThemeTransitionOrigin { x: number; y: number }
interface ThemeTransitionOptions {
  dark: boolean
  origin?: ThemeTransitionOrigin
  update: () => void
}

let cancelActive: (() => void) | undefined
const duration = 1450
const random = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

// One SVG snapshot carries the mesh, rather than hundreds of animated DOM nodes.
function makeMesh(width: number, height: number, dark: boolean) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('theme-shard-mesh')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('aria-hidden', 'true')
  const spacing = Math.max(42, Math.sqrt(width * height / 800))
  const columns = Math.ceil(width / spacing) + 2
  const rows = Math.ceil(height / spacing) + 2
  const color = dark ? '#a596ff' : '#efb644'
  const surface = dark ? '#191a25' : '#faf7ec'
  const points = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => ({
    x: (x - .5 + (random(y * columns + x) - .5) * .8) * spacing,
    y: (y - .5 + (random(y * columns + x + 872) - .5) * .8) * spacing,
  })))
  const markup: string[] = [`<defs><filter id="theme-shard-glow"><feGaussianBlur stdDeviation="2"/></filter></defs>`]
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const a = points[y][x], b = points[y][x + 1], c = points[y + 1][x], d = points[y + 1][x + 1]
      const seed = y * columns + x
      const opacity = .15 + random(seed + 44) * .5
      if (random(seed + 20) > .58) markup.push(`<path d="M${a.x},${a.y}L${b.x},${b.y}L${c.x},${c.y}Z" fill="${surface}" fill-opacity=".95"/>`)
      if (random(seed + 33) > .72) markup.push(`<path d="M${b.x},${b.y}L${d.x},${d.y}L${c.x},${c.y}Z" fill="${surface}" fill-opacity=".8"/>`)
      markup.push(`<path d="M${a.x},${a.y}L${b.x},${b.y}L${c.x},${c.y}Z" stroke="${color}" stroke-width=".8" stroke-opacity="${opacity}" fill="none"/>`)
      if (random(seed + 12) > .25) {
        markup.push(`<circle cx="${a.x}" cy="${a.y}" r="4" fill="${color}" filter="url(#theme-shard-glow)"/><circle cx="${a.x}" cy="${a.y}" r="1.4" fill="${dark ? '#ded8ff' : '#fff4c2'}"/>`)
      }
      if (random(seed + 6) > .68) markup.push(`<path d="M${a.x - 4},${a.y}h8M${a.x},${a.y - 4}v8" stroke="${color}" stroke-width=".7"/>`)
    }
  }
  svg.innerHTML = markup.join('')
  return svg
}

function outline(origin: ThemeTransitionOrigin, radius: number) {
  return Array.from({ length: 64 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2
    const edge = radius * (.86 + random(index + 13) * .24)
    return `${(origin.x + Math.cos(angle) * edge).toFixed(1)} ${(origin.y + Math.sin(angle) * edge).toFixed(1)}`
  })
}

export function runThemeTransition({ dark, origin, update }: ThemeTransitionOptions) {
  // Rapid changes finish immediately, so an old snapshot cannot overwrite a newer choice.
  if (cancelActive) {
    cancelActive()
    update()
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) {
    update()
    return
  }

  const width = window.innerWidth, height = window.innerHeight
  const center = origin ?? { x: width - 50, y: 40 }
  const radius = Math.max(Math.hypot(center.x, center.y), Math.hypot(width - center.x, center.y), Math.hypot(center.x, height - center.y), Math.hypot(width - center.x, height - center.y)) / .82 + 100
  const root = document.documentElement
  const mesh = makeMesh(width, height, dark)
  let cancelled = false
  const animations: Animation[] = []
  root.classList.add('theme-shard-transition')

  const transition = document.startViewTransition(() => {
    if (cancelled) return
    update()
    document.body.append(mesh)
  })
  const cleanup = () => {
    mesh.remove()
    root.classList.remove('theme-shard-transition')
    if (cancelActive === cancel) cancelActive = undefined
  }
  const cancel = () => {
    cancelled = true
    animations.forEach(animation => animation.cancel())
    transition.skipTransition()
    cleanup()
  }
  cancelActive = cancel

  void transition.ready.then(() => {
    if (cancelled) return
    const reveal: Keyframe[] = []
    const particles: Keyframe[] = []
    for (let step = 0; step <= 36; step++) {
      const progress = step / 36
      const distance = radius * progress
      const edge = outline(center, distance)
      const outer = outline(center, distance + 75)
      const inner = outline(center, Math.max(0, distance - 70)).reverse()
      reveal.push({ clipPath: `polygon(${edge.map(point => point.replace(' ', 'px ') + 'px').join(',')})`, offset: progress })
      particles.push({ clipPath: `path(evenodd, "M${outer.join('L')}Z M${inner.join('L')}Z")`, opacity: Math.min(1, progress * 10, (1 - progress) * 8), offset: progress })
    }
    animations.push(root.animate(reveal, { duration, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'both', pseudoElement: '::view-transition-new(root)' }))
    animations.push(root.animate(particles, { duration, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'both', pseudoElement: '::view-transition-new(theme-shards)' }))
  }).catch(() => { /* The theme still updates if snapshots are unavailable. */ })
  void transition.finished.then(cleanup, cleanup)
}
