import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export function AuthCard({ title, subtitle, children, className }: AuthCardProps) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl text-xl font-bold shadow">
            TF
          </div>
          <span className="text-foreground text-lg font-semibold tracking-tight">TriFuel</span>
        </div>

        <Card className={cn('shadow-lg', className)}>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            {subtitle && <CardDescription className="text-sm">{subtitle}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
