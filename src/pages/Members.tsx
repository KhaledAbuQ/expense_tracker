import { useState } from 'react'
import { Users, Copy, RefreshCw, Pencil, UserMinus, Check, X, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import ResetPasswordModal from '../components/ResetPasswordModal'

export default function MembersPage() {
  const { member } = useAuth()
  const { members, inviteCode, loading, renameMember, removeMember, rotateInviteCode } = useMembers()
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)


  const isAdmin = member?.role === 'admin'

  const handleCopy = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      toast.success('Invite code copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access is denied outside secure contexts.
      toast.error('Could not copy. Select the code and copy it manually.')
    }
  }

  const handleRotate = async () => {
    if (!window.confirm('Rotate the invite code? Anyone holding the current code will no longer be able to join.')) {
      return
    }
    setRotating(true)
    try {
      await rotateInviteCode()
    } catch {
      // Already surfaced by the hook.
    } finally {
      setRotating(false)
    }
  }

  const startEditing = (id: string, name: string) => {
    setEditingId(id)
    setDraftName(name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDraftName('')
  }

  const saveName = async (id: string) => {
    try {
      await renameMember(id, draftName)
      cancelEditing()
    } catch {
      // Already surfaced by the hook.
    }
  }

  const handleRemove = async (id: string, name: string) => {
    const isSelf = member?.id === id
    const message = isSelf
      ? 'Leave this household? All of your expenses, income, and transfers will be permanently deleted.'
      : `Remove ${name}? All of their expenses, income, and transfers will be permanently deleted.`

    if (!window.confirm(message)) return

    try {
      await removeMember(id)
    } catch {
      // Already surfaced by the hook.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Members</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Invite members and share household expenses.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Invite code</p>
            <p className="font-semibold text-gray-900 dark:text-white font-mono tracking-widest text-lg">
              {loading ? '...' : inviteCode || 'Unavailable'}
            </p>
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

          {isAdmin && (
            <button
              type="button"
              onClick={handleRotate}
              disabled={!inviteCode || rotating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              {rotating ? 'Rotating...' : 'Rotate code'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Share this code with new members so they can join.
          {isAdmin && ' Rotate it if it has been shared too widely.'}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No members found.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {members.map((memberItem) => {
              const isSelf = member?.id === memberItem.id
              const canEdit = isSelf || isAdmin
              const isEditing = editingId === memberItem.id

              return (
                <div key={memberItem.id} className="p-4 flex items-center justify-between gap-4">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName(memberItem.id)
                          if (e.key === 'Escape') cancelEditing()
                        }}
                        autoFocus
                        className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => saveName(memberItem.id)}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {memberItem.name}
                          {isSelf && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{memberItem.role}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => startEditing(memberItem.id, memberItem.name)}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isSelf && (
                          <button
                            type="button"
                            onClick={() => setShowChangePassword(true)}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                            title="Change password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemove(memberItem.id, memberItem.name)}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title={isSelf ? 'Leave household' : 'Remove member'}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showChangePassword && (
        <ResetPasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          isVoluntary={true}
        />
      )}
    </div>
  )
}
