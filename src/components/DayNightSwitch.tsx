import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import './DayNightSwitch.css'

type Point = { x: number; y: number }

// Pixel silhouettes keep the tiny sun and crescent crisp at the switch's size.
function makePixels(moon: boolean): Point[] {
  const points: Point[] = []
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      const radius = x * x + y * y
      const disc = radius <= (moon ? 49 : 13)
      const cutout = (x - 3) ** 2 + (y + 3) ** 2 < 43
      const rays = (x === 0 && Math.abs(y) >= 6 && Math.abs(y) <= 8)
        || (y === 0 && Math.abs(x) >= 6 && Math.abs(x) <= 8)
        || (Math.abs(x) === Math.abs(y) && Math.abs(x) >= 5 && Math.abs(x) <= 6)
      if (moon ? disc && !cutout : disc || rays) points.push({ x: x + 12, y: y + 12 })
    }
  }
  if (moon) points.push({ x: 15, y: 5 }, { x: 19, y: 9 }, { x: 18, y: 3 })
  return points
}

const sunPixels = makePixels(false)
const moonPixels = makePixels(true)
const pixelCount = Math.max(sunPixels.length, moonPixels.length)
const travel = 44
const clampPosition = (position: number) => Math.max(0, Math.min(travel, position))

interface DragGesture {
  pointerId: number
  startX: number
  startY: number
  startPosition: number
  scale: number
  moved: boolean
}

export interface DayNightSwitchProps {
  dark: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

export default function DayNightSwitch({ dark, onToggle, className = '' }: DayNightSwitchProps) {
  const [clicks, setClicks] = useState(0)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const gesture = useRef<DragGesture | null>(null)
  const suppressClick = useRef(false)
  const current = dark ? moonPixels : sunPixels
  const previous = dark ? sunPixels : moonPixels

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return
    suppressClick.current = gesture.current.moved
    gesture.current = null
    setDragPosition(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked={dark}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className={`day-night-switch ${dark ? 'is-dark' : 'is-light'} ${dragPosition !== null ? 'is-dragging' : ''} ${className}`}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return
        const track = event.currentTarget.querySelector('.day-night-switch__track')!.getBoundingClientRect()
        const thumb = event.currentTarget.querySelector('.day-night-switch__thumb')!.getBoundingClientRect()
        const scale = track.width / 88
        suppressClick.current = false
        gesture.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startPosition: clampPosition((thumb.left - track.left) / scale - 2),
          scale,
          moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        const drag = gesture.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (!drag.moved) {
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
            cancelDrag(event)
            return
          }
          if (Math.abs(dx) < 4) return
          drag.moved = true
        }
        event.preventDefault()
        event.stopPropagation()
        setDragPosition(clampPosition(drag.startPosition + dx / drag.scale))
      }}
      onPointerUp={event => {
        const drag = gesture.current
        if (!drag || drag.pointerId !== event.pointerId) return
        gesture.current = null
        setDragPosition(null)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (!drag.moved) return
        suppressClick.current = true
        const position = clampPosition(drag.startPosition + (event.clientX - drag.startX) / drag.scale)
        if ((position < travel / 2) !== dark) {
          setClicks(value => value + 1)
          onToggle(event)
        }
      }}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onClick={event => {
        if (suppressClick.current && event.detail !== 0) {
          suppressClick.current = false
          return
        }
        suppressClick.current = false
        setClicks(value => value + 1)
        onToggle(event)
      }}
    >
      <span className="day-night-switch__track" aria-hidden="true">
        <span className="day-night-switch__thumb" style={dragPosition === null ? undefined : { transform: `translateX(${dragPosition}px)` }}>
          <svg className="day-night-switch__rim" viewBox="0 0 44 44" fill="none">
            <rect className="day-night-switch__halo" x="1" y="1" width="42" height="42" rx="12" pathLength="100" />
            <rect className="day-night-switch__spark" x="1" y="1" width="42" height="42" rx="12" pathLength="100" />
          </svg>
          <svg className="day-night-switch__icon" viewBox="0 0 25 25" fill="currentColor">
            <g key={`${dark}-${clicks}`} className={clicks ? 'day-night-switch__pixels is-morphing' : 'day-night-switch__pixels'}>
              {Array.from({ length: pixelCount }, (_, index) => {
                const target = current[index % current.length]
                const origin = previous[index % previous.length]
                const angle = index * 2.39996
                const radius = 4 + index % 7
                const style = {
                  '--pixel-from-x': `${origin.x}px`,
                  '--pixel-from-y': `${origin.y}px`,
                  '--pixel-x': `${target.x}px`,
                  '--pixel-y': `${target.y}px`,
                  '--pixel-scatter-x': `${12 + Math.cos(angle) * radius}px`,
                  '--pixel-scatter-y': `${12 + Math.sin(angle) * radius}px`,
                  '--pixel-opacity': index < current.length ? 1 : 0,
                  '--pixel-from-opacity': index < previous.length ? 1 : 0,
                  animationDelay: `${index % 9 * 9}ms`,
                } as CSSProperties
                return <rect key={index} width="0.78" height="0.78" rx="0.08" style={style} />
              })}
            </g>
          </svg>
        </span>
      </span>
    </button>
  )
}
