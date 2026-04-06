import { AlertTriangle, ExternalLink } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            Supabase Configuration Required
          </h3>
          <div className="mt-2 text-sm text-amber-700 space-y-2">
            <p>To use this expense tracker, you need to set up Supabase:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                Create a project at{' '}
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
                Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to{' '}
                <code className="bg-amber-100 px-1 rounded">.env</code>
              </li>
              <li>Add your Supabase URL and anon key to the <code className="bg-amber-100 px-1 rounded">.env</code> file</li>
              <li>Restart the development server</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
