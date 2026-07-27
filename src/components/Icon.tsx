import type { ReactNode } from 'react'

export type IconName =
  | 'home'
  | 'month'
  | 'heart'
  | 'cart'
  | 'wallet'
  | 'target'
  | 'chart'
  | 'users'
  | 'trend'
  | 'grid'
  | 'receipt'
  | 'shield'
  | 'lock'
  | 'calendar'
  | 'clock'
  | 'logout'
  | 'plus'
  | 'minus'
  | 'close'
  | 'arrowLeft'
  | 'spark'
  | 'check'
  | 'alert'

type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
}

export function Icon({ name, size = 22, strokeWidth = 1.8, className }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3.5 10.7 8.5-7 8.5 7" />
        <path d="M5.5 9.8V20h13V9.8M9.2 20v-6.2h5.6V20" />
      </>
    ),
    month: (
      <>
        <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
        <path d="M7.5 2.5v4M16.5 2.5v4M3.5 9h17M8 13h2M14 13h2M8 17h2" />
      </>
    ),
    heart: <path d="M20.5 8.8c0 5.2-8.5 10.1-8.5 10.1S3.5 14 3.5 8.8A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 8.5 1.1Z" />,
    cart: (
      <>
        <path d="M3 4h2.3l1.9 10.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.5L20.5 8H6" />
        <circle cx="9" cy="19.5" r="1.2" />
        <circle cx="17.5" cy="19.5" r="1.2" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6.5" width="18" height="13" rx="3" />
        <path d="M5.5 6.5V5.2A2.2 2.2 0 0 1 7.7 3h9.8M15.5 11H21v4h-5.5a2 2 0 0 1 0-4Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="m12 12 7-7M16.5 5H19v2.5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
        <path d="m3 14 7-6 6 3 6-6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19v-1.4A4.6 4.6 0 0 1 8.1 13h1.8a4.6 4.6 0 0 1 4.6 4.6V19" />
        <path d="M15 5.3a3 3 0 0 1 0 5.4M17 13.4a4.2 4.2 0 0 1 3.5 4.2V19" />
      </>
    ),
    trend: (
      <>
        <path d="M4 17 9 12l3.4 3.4L20 7.8" />
        <path d="M14.5 7.8H20v5.5" />
      </>
    ),
    grid: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8Z" />
        <path d="M9 8h6M9 12h6M9 16h3.5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5.4c0 4.7-3.2 8.2-8 9.6-4.8-1.4-8-4.9-8-9.6V6Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    lock: (
      <>
        <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
        <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14.2v2.2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M7.5 2.5v5M16.5 2.5v5M3.5 9.5h17" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
        <path d="M14 8l4 4-4 4M9 12h9" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
    spark: (
      <>
        <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5Z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" />
      </>
    ),
    check: <path d="m5 12.5 4.2 4L19 7" />,
    alert: (
      <>
        <path d="M12 3 2.8 20h18.4Z" />
        <path d="M12 9v4.5M12 17h.01" />
      </>
    ),
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
