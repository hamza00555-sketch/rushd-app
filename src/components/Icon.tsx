import type { ReactNode } from 'react'

type IconName = 'home' | 'wallet' | 'goal' | 'chart' | 'bell' | 'plus' | 'spark'

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    wallet: <><path d="M4 7.5h16v11H4z"/><path d="M6 7.5V5h11"/><path d="M15 12h5v3h-5a1.5 1.5 0 1 1 0-3Z"/></>,
    goal: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4V1M20 12h3"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/><path d="m3 14 7-6 6 3 6-6"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/><path d="M10 20h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    spark: <><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
