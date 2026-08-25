import Sidebar from '@/components/Sidebar'
import AssistantChat from '@/components/AssistantChat'
import AutoCron from '@/components/AutoCron'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      <Sidebar />
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        {/* pt-16 on mobile = clears the fixed 56px top bar + breathing room */}
        <div className="max-w-[1400px] mx-auto px-4 pt-16 pb-6 lg:px-6 lg:pt-7 lg:pb-7 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>
      {/* Asistente virtual — vive en el layout para conservar la conversación al navegar */}
      <AssistantChat />
      {/* Tareas periódicas disparadas por el uso (Netlify no las corre) */}
      <AutoCron />
    </div>
  )
}
