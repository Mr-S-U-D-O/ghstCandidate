import { Rocket, BarChart2, Users, Settings } from 'lucide-react'

interface AdminSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function AdminSidebar({ activeTab, setActiveTab }: AdminSidebarProps) {
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full border-r border-gray-800 shrink-0">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold font-sans tracking-tight">Ghost Admin</h2>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'fleet' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <Rocket className="w-5 h-5" />
          Apify Fleet Manager
        </button>

        <button
          disabled
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 opacity-50 cursor-not-allowed"
        >
          <BarChart2 className="w-5 h-5" />
          Analytics Overview <span className="ml-auto text-xs border border-gray-600 px-1.5 py-0.5 rounded">WIP</span>
        </button>

        <button
          disabled
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 opacity-50 cursor-not-allowed"
        >
          <Users className="w-5 h-5" />
          User Management <span className="ml-auto text-xs border border-gray-600 px-1.5 py-0.5 rounded">WIP</span>
        </button>

        <button
          disabled
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 opacity-50 cursor-not-allowed"
        >
          <Settings className="w-5 h-5" />
          Global Settings <span className="ml-auto text-xs border border-gray-600 px-1.5 py-0.5 rounded">WIP</span>
        </button>
      </nav>
    </div>
  )
}
