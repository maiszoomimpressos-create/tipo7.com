'use client'

// Tipo7 — Biblioteca de Componentes UI v2
// Uso: import { Card, Button, Badge, Input, ... } from '@/components/ui'

import { cn } from '@/lib/utils'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

// ════════════════════════════════════════════════════════════════
// CARD
// ════════════════════════════════════════════════════════════════

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  dark?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function Card({ children, className, hover = false, dark = false, padding = 'md', onClick }: CardProps) {
  const p = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding]
  return (
    <div
      onClick={onClick}
      className={cn(
        dark ? 't7-card-dk' : 't7-card',
        hover && 't7-card-hover',
        onClick && 'cursor-pointer',
        p,
        className,
      )}
    >
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// BUTTON
// ════════════════════════════════════════════════════════════════

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  const v = {
    primary:   't7-btn-primary',
    secondary: 't7-btn-secondary',
    ghost:     't7-btn-ghost',
    danger:    't7-btn-danger',
  }[variant]

  const s = {
    sm: 'text-xs !px-3 !py-2',
    md: '',
    lg: 'text-base !px-6 !py-3.5',
  }[size]

  return (
    <button
      disabled={disabled || loading}
      className={cn(v, s, (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
        </svg>
      )}
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// BADGE
// ════════════════════════════════════════════════════════════════

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'gold' | 'neutral' | 'dk'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  dot?: boolean
  className?: string
}

const DOT_COLORS: Record<BadgeVariant, string> = {
  success: '#16A34A',
  error:   '#DC2626',
  warning: '#D97706',
  info:    '#2563EB',
  gold:    '#C9973A',
  neutral: '#A8A29D',
  dk:      '#8892A4',
}

export function Badge({ variant = 'neutral', children, dot, className }: BadgeProps) {
  return (
    <span className={cn('t7-badge', `t7-badge-${variant}`, className)}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: DOT_COLORS[variant] }}
        />
      )}
      {children}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
// INPUT
// ════════════════════════════════════════════════════════════════

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

export function Input({ label, error, hint, required, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={inputId} className="t7-label">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={cn('t7-input', error && 't7-input-error', className)}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
        {...props}
      />
      {error  && <p className="t7-error-msg">{error}</p>}
      {hint && !error && <p className="t7-hint">{hint}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// TEXTAREA
// ════════════════════════════════════════════════════════════════

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col">
      {label && <label htmlFor={inputId} className="t7-label">{label}</label>}
      <textarea
        id={inputId}
        className={cn('t7-input resize-none', error && 't7-input-error', className)}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
        {...props}
      />
      {error  && <p className="t7-error-msg">{error}</p>}
      {hint && !error && <p className="t7-hint">{hint}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SELECT
// ════════════════════════════════════════════════════════════════

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Select({ label, error, hint, children, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col">
      {label && <label htmlFor={inputId} className="t7-label">{label}</label>}
      <select
        id={inputId}
        className={cn('t7-select', error && 't7-input-error', className)}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
        {...props}
      >
        {children}
      </select>
      {error  && <p className="t7-error-msg">{error}</p>}
      {hint && !error && <p className="t7-hint">{hint}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PAGE HEADER
// ════════════════════════════════════════════════════════════════

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  dark?: boolean
}

export function PageHeader({ title, subtitle, action, className, dark = false }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-8', className)}>
      <div className="min-w-0">
        <h1
          className="text-2xl font-semibold leading-snug truncate"
          style={{
            fontFamily: 'var(--font-outfit)',
            color: dark ? 'var(--dk-text)' : 'var(--text-1)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-sm mt-1 leading-relaxed"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              color: dark ? 'var(--dk-text-2)' : 'var(--text-2)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STAT CARD
// ════════════════════════════════════════════════════════════════

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; positive: boolean }
  dark?: boolean
  className?: string
}

export function StatCard({ label, value, subtitle, icon, trend, dark = false, className }: StatCardProps) {
  return (
    <div className={cn(dark ? 't7-card-dk' : 't7-card', 'p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{
            fontFamily: 'var(--font-dm-sans)',
            color: dark ? 'var(--dk-text-3)' : 'var(--text-3)',
          }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--gold-muted)' }}
          >
            <span style={{ color: 'var(--gold)' }}>{icon}</span>
          </div>
        )}
      </div>
      <p
        className="text-[2rem] font-bold leading-none tracking-tight"
        style={{
          fontFamily: 'var(--font-syne)',
          color: dark ? 'var(--dk-text)' : 'var(--text-1)',
        }}
      >
        {value}
      </p>
      <div className="flex items-center gap-3 mt-2">
        {subtitle && (
          <p
            className="text-xs"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              color: dark ? 'var(--dk-text-3)' : 'var(--text-3)',
            }}
          >
            {subtitle}
          </p>
        )}
        {trend && (
          <span
            className="text-xs font-medium"
            style={{ color: trend.positive ? 'var(--success)' : 'var(--error)' }}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// TABLE WRAPPER
// ════════════════════════════════════════════════════════════════

interface TableWrapperProps {
  children: ReactNode
  className?: string
  dark?: boolean
}

export function TableWrapper({ children, className, dark = false }: TableWrapperProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        dark
          ? 'border border-[var(--dk-border)] bg-[var(--dk-surface)]'
          : 't7-card',
        className,
      )}
    >
      <table className={cn('t7-table', dark && 't7-table-dk')}>
        {children}
      </table>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ALERT
// ════════════════════════════════════════════════════════════════

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  className?: string
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  return (
    <div className={cn('t7-alert', `t7-alert-${variant}`, className)} role="alert">
      {title && (
        <p className="font-semibold mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {title}
        </p>
      )}
      <p style={{ fontFamily: 'var(--font-dm-sans)' }}>{children}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  dark?: boolean
  className?: string
}

export function EmptyState({ icon, title, description, action, dark = false, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-4', className)}>
      {icon && (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: dark ? 'var(--dk-surface-2)' : 'var(--bg-raised)' }}
        >
          <span style={{ color: dark ? 'var(--dk-text-3)' : 'var(--text-3)' }}>{icon}</span>
        </div>
      )}
      <p
        className="text-base font-medium mb-1.5"
        style={{
          fontFamily: 'var(--font-dm-sans)',
          color: dark ? 'var(--dk-text)' : 'var(--text-1)',
        }}
      >
        {title}
      </p>
      {description && (
        <p
          className="text-sm mb-6 max-w-xs"
          style={{
            fontFamily: 'var(--font-dm-sans)',
            color: dark ? 'var(--dk-text-2)' : 'var(--text-2)',
          }}
        >
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// DIVIDER
// ════════════════════════════════════════════════════════════════

export function Divider({ className, dark }: { className?: string; dark?: boolean }) {
  return <div className={cn(dark ? 't7-divider-dk' : 't7-divider', className)} />
}

// ════════════════════════════════════════════════════════════════
// SECTION TITLE (rótulo de seção uppercase)
// ════════════════════════════════════════════════════════════════

interface SectionTitleProps {
  children: ReactNode
  className?: string
  dark?: boolean
}

export function SectionTitle({ children, className, dark = false }: SectionTitleProps) {
  return (
    <p
      className={cn('text-[11px] font-semibold uppercase tracking-[0.07em] mb-3', className)}
      style={{
        fontFamily: 'var(--font-dm-sans)',
        color: dark ? 'var(--dk-text-3)' : 'var(--text-3)',
      }}
    >
      {children}
    </p>
  )
}

// ════════════════════════════════════════════════════════════════
// SKELETON (loading placeholder)
// ════════════════════════════════════════════════════════════════

interface SkeletonProps {
  className?: string
  dark?: boolean
}

export function Skeleton({ className, dark = false }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-xl', className)}
      style={{ background: dark ? 'var(--dk-surface-2)' : 'var(--bg-raised)' }}
    />
  )
}
