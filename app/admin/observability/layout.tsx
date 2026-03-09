import { Toaster } from 'sonner'

export default function AdminObservabilityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Toaster theme="dark" />
      {children}
    </div>
  )
}
