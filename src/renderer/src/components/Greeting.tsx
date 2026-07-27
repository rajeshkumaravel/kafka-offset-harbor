import { useEffect, useState } from 'react'

/**
 * A greeting derived purely from the local system clock.
 * No geolocation, no network call, no IP — just `new Date()`.
 */
type Phase = 'morning' | 'afternoon' | 'evening' | 'night'

function phaseFor(hour: number): Phase {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const LABEL: Record<Phase, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night'
}

function SunIcon({ rising }: { rising: boolean }): React.JSX.Element {
  return (
    <svg className="greet-icon" viewBox="0 0 48 48" aria-hidden="true">
      <g className="greet-rays">
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1="24"
            y1="4.5"
            x2="24"
            y2="9.5"
            transform={`rotate(${i * 45} 24 24)`}
          />
        ))}
      </g>
      <circle className="greet-core" cx="24" cy="24" r="8.5" />
      {rising && <line className="greet-horizon" x1="8" y1="38" x2="40" y2="38" />}
    </svg>
  )
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg className="greet-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="greet-core greet-moon"
        d="M30 6a18 18 0 1 0 12 30A14 14 0 0 1 30 6Z"
      />
      <g className="greet-stars">
        <circle cx="12" cy="12" r="1.8" style={{ animationDelay: '0s' }} />
        <circle cx="38" cy="14" r="1.3" style={{ animationDelay: '0.7s' }} />
        <circle cx="16" cy="34" r="1.2" style={{ animationDelay: '1.4s' }} />
      </g>
    </svg>
  )
}

export default function Greeting(): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>(() => phaseFor(new Date().getHours()))

  // keep it honest if the app is left open across a boundary
  useEffect(() => {
    const id = setInterval(() => setPhase(phaseFor(new Date().getHours())), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`greeting greeting-${phase}`}>
      {phase === 'night' ? <MoonIcon /> : <SunIcon rising={phase !== 'afternoon'} />}
      <span>{LABEL[phase]}</span>
    </div>
  )
}
