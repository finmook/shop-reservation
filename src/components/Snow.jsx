import { useMemo } from 'react'

// Decorative falling snow. Pure CSS animation, ignores clicks, hidden for reduced motion.
export default function Snow({ count = 28 }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        size: 8 + Math.random() * 14,
        duration: 9 + Math.random() * 12,
        delay: -Math.random() * 20,
        drift: (Math.random() - 0.5) * 80,
        char: i % 3 === 0 ? '❄' : '•',
      })),
    [count]
  )
  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        >
          {f.char}
        </span>
      ))}
    </div>
  )
}
