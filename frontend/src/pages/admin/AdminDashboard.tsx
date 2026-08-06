import { useState } from 'react'
import AdminSidebar from '../../components/admin/AdminSidebar'
import FleetManager from '../../components/admin/FleetManager'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('fleet')

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 h-full overflow-y-auto">
        {activeTab === 'fleet' && <FleetManager />}
        {/* Additional tabs can be added here in the future */}
      </main>
    </div>
  )
}
