import { Wallet, BarChart3, HandCoins } from 'lucide-react'

export default function MobileWelcome({ onContinue }: { onContinue: (mode: 'sign-in' | 'sign-up') => void }) {
  return <main className="mobile-client monetra-welcome">
    <div className="monetra-welcome-top"><span><i /><i /><i /></span><button type="button" onClick={() => onContinue('sign-in')}>Skip</button></div>
    <div className="monetra-phone-preview" aria-hidden="true">
      <div className="monetra-preview-notice"><span><Wallet size={13} /> Pocket Expenses</span><p>Your finances, always within reach.</p><div><span>Open app</span><span>Close</span></div></div>
      <div className="monetra-preview-chart">{[32, 56, 78, 91, 70, 40].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      <div className="monetra-preview-report"><BarChart3 size={12} /> Your financial overview</div>
      <div className="monetra-preview-accounts"><Wallet size={12} /> Checking <HandCoins size={12} /> Savings</div>
    </div>
    <section className="monetra-welcome-sheet"><h1>All your finances<br />in one place</h1><p>Stay on top of your spending and<br />savings effortlessly.</p><button type="button" className="monetra-create-account" onClick={() => onContinue('sign-up')}>Create an account</button><button type="button" className="monetra-welcome-login" onClick={() => onContinue('sign-in')}>Have an account? Log in</button></section>
  </main>
}
