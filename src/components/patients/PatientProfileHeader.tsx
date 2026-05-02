import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  fullName: string
  tcMasked: string    // pre-masked '•••••••••XX' from API
  slug: string
  patientId: string
}

// Derive initials: "Ayşe Kaya" → "AK", "Ali" → "A"
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(part => part[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}

export default function PatientProfileHeader({ fullName, tcMasked, slug, patientId }: Props) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        {/* Initials avatar: 40×40px circle */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-base font-semibold text-foreground select-none"
          aria-hidden="true"
        >
          {getInitials(fullName)}
        </div>

        {/* Name + masked TC */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-semibold truncate">{fullName}</p>
          <p className="text-sm text-muted-foreground">
            TC:{' '}
            <span className="font-mono">{tcMasked}</span>
          </p>
        </div>

        {/* CTA — disabled stub until Phase 3 */}
        <Button
          className="min-h-[44px] flex-shrink-0"
          disabled
          title="Yakında kullanıma açılacak"
        >
          Yeni Seans Başlat
        </Button>
      </CardContent>
    </Card>
  )
}
