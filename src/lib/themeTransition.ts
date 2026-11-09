import './themeTransition.css'

export interface ThemeTransitionOrigin { x: number; y: number }
interface ThemeTransitionOptions {
  dark: boolean
  origin?: ThemeTransitionOrigin
  update: () => void
}

let cancelActive: (() => void) | undefined
const duration = 2300
const random = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

// Electric dots and short connections travel with the reveal, then gently fade.
// A single live canvas keeps the effect inexpensive on mobile WebViews.
function makeElectricField(width: number, height: number, dark: boolean, center: ThemeTransitionOrigin, radius: number) {
  const canvas = document.createElement('canvas')
  canvas.className = 'theme-electric-field'
  canvas.setAttribute('aria-hidden', 'true')
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const context = canvas.getContext('2d')
  context?.scale(scale, scale)
  const spacing = Math.max(22, Math.sqrt(width * height / 950))
  const columns = Math.ceil(width / spacing) + 1
  const rows = Math.ceil(height / spacing) + 1
  const points = Array.from({ length: columns * rows }, (_, i) => {
    const x = (i % columns + random(i) * .9) * spacing
    const y = (Math.floor(i / columns) + random(i + 872) * .9) * spacing
    return { x, y, arrival: Math.hypot(x - center.x, y - center.y) / radius, seed: random(i + 94) }
  })
  let frame = 0
  let start = 0
  const draw = (now: number) => {
    if (!context) return
    if (!start) start = now
    const progress = Math.min(1, (now - start) / duration)
    context.clearRect(0, 0, width, height)
    for (const point of points) {
      const age = progress - point.arrival * .86
      // Dots ignite just ahead of the edge and leave a fading electric trail.
      const opacity = Math.max(0, Math.min(1, (age + .1) * 12, (.3 - age) * 5, (1 - progress) * 8))
      if (!opacity) continue
      const pulse = .65 + .35 * Math.sin(age * 40 + point.seed * 6)
      const size = 1 + point.seed * 1.6
      context.globalAlpha = opacity * pulse
      context.fillStyle = dark ? '#b4a2ff' : '#f5b83e'
      context.shadowColor = dark ? '#9474ff' : '#ffb21d'
      context.shadowBlur = 7
      context.beginPath()
      context.arc(point.x, point.y, size, 0, Math.PI * 2)
      context.fill()
      context.shadowBlur = 0
      if (point.seed > .38) {
        const angle = Math.atan2(point.y - center.y, point.x - center.x)
        const length = 9 + point.seed * 26
        context.strokeStyle = dark ? '#ae95ff' : '#eeb13b'
        context.lineWidth = .65
        context.globalAlpha *= .48
        context.beginPath()
        context.moveTo(point.x - Math.cos(angle) * length, point.y - Math.sin(angle) * length)
        context.lineTo(point.x - Math.cos(angle) * length * .45 + 4, point.y - Math.sin(angle) * length * .45 - 3)
        context.lineTo(point.x, point.y)
        context.stroke()
      }
    }
    context.globalAlpha = 1
    if (progress < 1) frame = requestAnimationFrame(draw)
  }
  return { canvas, start: () => { frame = requestAnimationFrame(draw) }, stop: () => cancelAnimationFrame(frame) }
}

// Rounded, broken edges and small early patches match the spreading ink-like
// color change in the reference without laying opaque triangles over the UI.
function revealPath(origin: ThemeTransitionOrigin, distance: number, islands: { x: number; y: number; arrival: number }[], progress: number) {
  const points = Array.from({ length: 96 }, (_, index) => {
    const angle = index / 96 * Math.PI * 2
    const edge = distance * (.91 + random(index + 13) * .12)
    return { x: origin.x + Math.cos(angle) * edge, y: origin.y + Math.sin(angle) * edge }
  })
  const number = (value: number) => value.toFixed(1)
  const midpoint = (a: typeof points[number], b: typeof points[number]) => `${number((a.x + b.x) / 2)} ${number((a.y + b.y) / 2)}`
  let path = `M${midpoint(points[95], points[0])}`
  points.forEach((point, index) => { path += `Q${number(point.x)} ${number(point.y)} ${midpoint(point, points[(index + 1) % points.length])}` })
  path += 'Z'
  for (const island of islands) {
    const size = Math.max(.1, Math.min(18, (progress - island.arrival + .055) * 240))
    const y = number(island.y), r = number(size)
    path += `M${number(island.x + size)} ${y}A${r} ${r} 0 1 1 ${number(island.x - size)} ${y}A${r} ${r} 0 1 1 ${number(island.x + size)} ${y}Z`
    // Keep subpaths nonzero even before ignition so all keyframes interpolate.
  }
  return path
}

export function runThemeTransition({ dark, origin, update }: ThemeTransitionOptions) {
  // Finish the prior transition before creating another; its cleanup must never
  // remove the next transition's styles or leave an old snapshot over the page.
  cancelActive?.()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) {
    update()
    return
  }

  const width = window.innerWidth, height = window.innerHeight
  const center = origin ?? { x: width - 50, y: 40 }
  const radius = Math.max(Math.hypot(center.x, center.y), Math.hypot(width - center.x, center.y), Math.hypot(center.x, height - center.y), Math.hypot(width - center.x, height - center.y)) / .9 + 80
  const root = document.documentElement
  const field = makeElectricField(width, height, dark, center, radius)
  const islands = Array.from({ length: 38 }, (_, index) => {
    const x = random(index + 104) * width, y = random(index + 309) * height
    return { x, y, arrival: Math.hypot(x - center.x, y - center.y) / radius * .88 }
  })
  let cancelled = false
  let updated = false
  const animations: Animation[] = []
  root.classList.add('theme-electric-transition')

  const apply = () => { if (!updated) { updated = true; update() } }
  const transition = document.startViewTransition(() => {
    if (cancelled) return
    apply()
    document.body.append(field.canvas)
  })
  const cleanup = () => {
    field.stop()
    field.canvas.remove()
    // A skipped transition can settle after the next transition has started.
    if (cancelActive !== cancel) return
    root.classList.remove('theme-electric-transition')
    cancelActive = undefined
  }
  const cancel = () => {
    cancelled = true
    apply()
    transition.skipTransition()
    animations.forEach(animation => animation.cancel())
    cleanup()
  }
  cancelActive = cancel

  void transition.ready.then(() => {
    if (cancelled) return
    const reveal: Keyframe[] = []
    for (let step = 0; step <= 48; step++) {
      const progress = step / 48
      const path = revealPath(center, radius * Math.min(1, progress / .88), islands, progress)
      reveal.push({ clipPath: `path("${path}")`, offset: progress })
    }
    // Both snapshots stay fully opaque. Only the mask reveals the new palette;
    // disabling the browser's default crossfade avoids full-page flashes.
    animations.push(root.animate(reveal, { duration, easing: 'linear', fill: 'both', pseudoElement: '::view-transition-new(root)' }))
    animations.push(root.animate([{ opacity: 1 }, { opacity: 1 }], { duration, fill: 'both', pseudoElement: '::view-transition-new(theme-electric)' }))
    field.start()
  }).catch(() => { apply() /* Unsupported snapshots still commit the chosen theme. */ })
  void transition.finished.then(cleanup, cleanup)
}
