import TopBar from '@/components/app/TopBar'

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      {children}
    </div>
  )
}
