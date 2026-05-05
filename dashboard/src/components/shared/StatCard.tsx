import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label:       string
  value:       string | number
  sublabel?:   string
  trend?:      'up' | 'down' | 'neutral'
  trendValue?: string
  urgent?:     boolean
  icon?:       React.ReactNode
  href?:       string
}

export function StatCard({ label, value, sublabel, trend, trendValue, urgent, icon, href }: StatCardProps) {
  const trendStyles: Record<string, string> = {
    up:      'text-green-600 dark:text-green-400',
    down:    'text-red-500 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null

  const inner = (
    <Card className={cn(
      'rounded-xl shadow-sm transition-shadow hover:shadow-md',
      urgent && 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
      href && 'cursor-pointer',
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={cn(
              'text-3xl font-bold tracking-tight',
              urgent && 'text-red-600 dark:text-red-400',
            )}>
              {value}
            </p>
          </div>
          {icon && (
            <div className={cn(
              'rounded-lg p-2',
              urgent
                ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                : 'bg-muted text-muted-foreground',
            )}>
              {icon}
            </div>
          )}
        </div>
        {(trendValue ?? sublabel) && (
          <p className={cn('mt-2 flex items-center gap-1 text-xs', trendStyles[trend ?? 'neutral'])}>
            {trendIcon && <span>{trendIcon}</span>}
            <span>{trendValue ?? sublabel}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )

  return href ? <Link href={href} className="block">{inner}</Link> : inner
}
