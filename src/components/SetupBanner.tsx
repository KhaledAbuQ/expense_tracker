import { useState } from 'react'
import { AlertTriangle, ExternalLink, Settings } from 'lucide-react'
import ServerConfigForm from './ServerConfigForm'
import Modal from './Modal'

export default function SetupBanner() {
  const [showConfigModal, setShowConfigModal] = useState(false)

  return (
    <>
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-medium text-amber-800">
                Supabase Configuration Required
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition w-fit"
              >
                <Settings className="w-3.5 h-3.5" />
                Connect Supabase in Browser
              </button>
            </div>
            <div className="mt-2 text-sm text-amber-700 space-y-2">
              <p>To use this expense tracker, connect a Supabase project:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                <li>
                  Create a free project at{' '}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-800 underline hover:text-amber-900 inline-flex items-center gap-1"
                  >
                    supabase.com
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Run the SQL schema from <code className="bg-amber-100 px-1 rounded">supabase/schema.sql</code>
                </li>
                <li>
                  Click the <strong>Connect Supabase in Browser</strong> button above to enter your URL and anon key (or set them in <code className="bg-amber-100 px-1 rounded">.env</code>).
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <Modal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title="Connect Database"
        >
          <ServerConfigForm onCancel={() => setShowConfigModal(false)} />
        </Modal>
      )}
    </>
  )
}

