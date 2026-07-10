'use client'

import { useState, useEffect, useRef } from 'react'
import { CalendarCheck, Users, Zap } from 'lucide-react'

// ─── Animação de contagem ─────────────────────────────────────────────────────

function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let start: number | null = null
    let raf: number

    const step = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      // Easing out: desacelera no final
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(ease * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

// ─── Formata número para exibição ─────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0)    return '—'
  if (n >= 10000) return `${Math.floor(n / 1000)}k`
  if (n >= 1000)  return `${(n / 1000).toFixed(1).replace('.', ',')}k`
  return String(n)
}

// ─── Item de stat individual ──────────────────────────────────────────────────

function StatItem({
  icon: Icon,
  value,
  suffix,
  label,
  color,
}: {
  icon:   React.ElementType
  value:  number
  suffix: string
  label:  string
  color:  string
}) {
  const count = useCounter(value)

  return (
    <div className="flex flex-col items-center gap-1.5 px-6 md:px-10">
      <Icon size={16} style={{ color }} className="mb-0.5 opacity-70" />
      <span
        className="text-3xl md:text-4xl font-bold tabular-nums"
        style={{ color: 'var(--text-1)', fontFamily: 'var(--font-syne)' }}>
        {fmt(count)}{value > 0 ? suffix : ''}
      </span>
      <span
        className="text-xs tracking-wide text-center leading-snug"
        style={{ color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Divisor vertical ─────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-12 w-px hidden sm:block" style={{ background: 'var(--border)' }} />
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Stats {
  ativos:     number
  realizados: number
  usuarios:   number
}

export function StatsBar() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Busca os números
  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {/* silently ignore */})
  }, [])

  // Dispara a animação somente quando o bloco entra na viewport
  useEffect(() => {
    if (!ref.current || !stats) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [stats])

  if (!stats) return null

  return (
    <div
      ref={ref}
      className="w-full py-10"
      style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}
    >
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-center flex-wrap gap-y-8">

        <StatItem
          icon={Zap}
          value={visible ? stats.ativos : 0}
          suffix="+"
          label={"Eventos ativos\nagora"}
          color="#E8B84B"
        />

        <Divider />

        <StatItem
          icon={CalendarCheck}
          value={visible ? stats.realizados : 0}
          suffix="+"
          label={"Eventos já\nrealizados"}
          color="#a855f7"
        />

        <Divider />

        <StatItem
          icon={Users}
          value={visible ? stats.usuarios : 0}
          suffix="+"
          label={"Usuários\ncadastrados"}
          color="#22c55e"
        />

      </div>
    </div>
  )
}
