import { useMemo, useState } from 'react'
import { Users, Copy, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'

export default function MembersPage() {
  const { householdId } = useAuth()
  const { members, loading } = useMembers()
  const [copied, setCopied] = useState(false)

  const inviteCode = useMemo(() => householdId ?? '', [householdId])

  const handleCopy = async () => {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    toast.success('Invite code copied')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Household Members</h1>
          <p className="text-gray-500 mt-1">Invite members and share household expenses.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Invite code</p>
            <p className="font-semibold text-gray-900">{inviteCode || 'Unavailable'}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!inviteCode}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied' : 'Copy invite code'}
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Plus className="w-4 h-4" />
            Share this code with new members to join.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Members</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No members found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((memberItem) => (
              <div key={memberItem.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{memberItem.name}</p>
                  <p className="text-xs text-gray-500">{memberItem.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
