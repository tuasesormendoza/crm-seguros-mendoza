import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      <Sidebar />
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="max-w-[1400px] mx-auto px-6 py-7 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>
    </div>
  )
}
