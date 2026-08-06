import { useState, useEffect, useRef } from 'react'
import { useUser } from '../../context/UserContext'

interface FleetConfig {
  id: string
  niche_name: string
  api_key: string
  search_queries: string[]
  max_items_per_actor: number
  is_active: boolean
  last_run_at: string | null
}

export default function FleetManager() {
  const { session } = useUser()
  const [configs, setConfigs] = useState<FleetConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTriggering, setIsTriggering] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  const terminalRef = useRef<HTMLDivElement>(null)

  // Form state
  const [newNiche, setNewNiche] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [newQueries, setNewQueries] = useState('')

  const fetchConfigs = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/admin/fleet', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (data.success) {
        setConfigs(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch configs', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      fetchConfigs()
    }
  }, [session])

  // Setup SSE Connection
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3001/api/admin/fleet-logs-stream')

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        setLogs(prev => [...prev, message])
      } catch (e) {
        setLogs(prev => [...prev, event.data])
      }
    }

    eventSource.onerror = () => {
      console.error("SSE connection error")
      // Browser will auto-reconnect EventSource, but we can log a warning.
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const queriesArray = newQueries.split(',').map(q => q.trim()).filter(Boolean)
      const res = await fetch('http://localhost:3001/api/admin/fleet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          niche_name: newNiche,
          api_key: newApiKey,
          search_queries: queriesArray,
          max_items_per_actor: 200
        })
      })
      if (res.ok) {
        setNewNiche('')
        setNewApiKey('')
        setNewQueries('')
        fetchConfigs()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fleet config?')) return
    try {
      await fetch(`http://localhost:3001/api/admin/fleet/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      fetchConfigs()
    } catch (e) {
      console.error(e)
    }
  }

  const triggerFleet = async () => {
    setIsTriggering(true)
    // Local pre-flight logs, server logs will handle the rest via SSE
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [Admin] Sending trigger signal to backend...`])
    try {
      const res = await fetch('http://localhost:3001/api/admin/trigger-harvester', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (!data.success) {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [Backend] ❌ Failed: ${data.message || 'Unknown error'}`])
      }
    } catch (e: any) {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [Admin] ❌ Error triggering fleet: ${e.message}`])
    } finally {
      setIsTriggering(false)
      setTimeout(fetchConfigs, 5000) // refresh config to show last_run_at after some time
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 10) return '***'
    return `${key.slice(0, 6)}...${key.slice(-4)}`
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-sans text-gray-900 tracking-tight">Apify Fleet Manager</h1>
        <p className="text-gray-500 mt-2">Manage the distributed key architecture and monitor the ATS global harvester.</p>
      </div>

      {/* Fleet Configuration Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Fleet Configuration</h2>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-medium text-gray-600">Niche</th>
                <th className="p-4 font-medium text-gray-600">API Key</th>
                <th className="p-4 font-medium text-gray-600">Queries</th>
                <th className="p-4 font-medium text-gray-600">Status</th>
                <th className="p-4 font-medium text-gray-600">Last Run</th>
                <th className="p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Loading fleet configs...</td></tr>
              ) : configs.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">No fleet configurations found. Add one below.</td></tr>
              ) : (
                configs.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium">{c.niche_name}</td>
                    <td className="p-4 text-gray-500 font-mono text-xs">{maskKey(c.api_key)}</td>
                    <td className="p-4 text-gray-500 max-w-xs truncate" title={c.search_queries.join(', ')}>
                      {c.search_queries.join(', ')}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">
                      {c.last_run_at ? new Date(c.last_run_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Form */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <h3 className="text-sm font-semibold mb-4 text-gray-700">Add New Fleet Key</h3>
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Niche Name (e.g. Frontend)</label>
              <input required value={newNiche} onChange={e => setNewNiche(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Frontend" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Apify API Key</label>
              <input required value={newApiKey} onChange={e => setNewApiKey(e.target.value)} type="password" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="apify_api_..." />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Queries (comma separated)</label>
              <input required value={newQueries} onChange={e => setNewQueries(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="React Developer, Vue Developer..." />
            </div>
            <button type="submit" className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors text-sm h-[38px]">
              Add Key
            </button>
          </form>
        </div>
      </div>

      {/* Command Center */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Command Center</h2>
            <p className="text-sm text-gray-500 mt-1">Manually trigger the background Harvester across all active fleet keys.</p>
          </div>
          <button 
            onClick={triggerFleet}
            disabled={isTriggering || configs.length === 0}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isTriggering ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Deploying...
              </>
            ) : 'Deploy Fleet'}
          </button>
        </div>
        
        {/* Terminal Log */}
        <div ref={terminalRef} className="bg-gray-900 p-4 overflow-y-auto font-mono text-sm text-gray-300 flex-1">
          {logs.length === 0 ? (
            <div className="text-gray-600">Waiting for deployment command...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
