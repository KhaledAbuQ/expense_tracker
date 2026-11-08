import { useId } from 'react'

export default function GoldPot() {
  const id = useId().replace(/:/g, '')
  return <svg className="gold-pot" viewBox="0 0 160 160" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-pot`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#05ce70"/><stop offset=".55" stopColor="#009f4f"/><stop offset="1" stopColor="#005e39"/></linearGradient>
      <linearGradient id={`${id}-coin`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffdf35"/><stop offset="1" stopColor="#f5a000"/></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#a96f25" stopOpacity=".3"/><stop offset="1" stopColor="#a96f25" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="80" cy="146" rx="54" ry="10" fill={`url(#${id}-shadow)`}/>
    <g className="gold-pot-body">
      <path d="M47 124l-10 15q-4 9 6 6l16-11m54-10 10 15q4 9-6 6l-16-11" fill="#007e43"/>
      <g className="gold-pot-coins" fill={`url(#${id}-coin)`} stroke="#f3b000" strokeWidth=".8">
        {[[52,53,34],[77,53,35],[43,45,37],[70,45,36],[92,45,27],[50,37,35],[80,37,34],[63,29,39],[70,21,29]].map(([x,y,width],i)=><g key={i}><rect x={x} y={y} width={width} height="9" rx="4.5"/><path d={`M${x+7} ${y+2}v5m6-5v5m6-5v5`} stroke="#fff17a" strokeOpacity=".7"/></g>)}
      </g>
      <rect x="20" y="87" width="10" height="24" rx="5" fill={`url(#${id}-coin)`}/><rect x="130" y="87" width="10" height="24" rx="5" fill={`url(#${id}-coin)`}/>
      <path d="M33 72Q21 91 37 120Q49 143 80 143Q111 143 123 120Q139 91 127 72Z" fill={`url(#${id}-pot)`}/>
      <ellipse cx="62" cy="96" rx="24" ry="19" fill="#2be586" opacity=".18"/>
      <rect x="24" y="64" width="112" height="17" rx="8.5" fill="#007d42"/><rect x="31" y="65" width="85" height="6" rx="3" fill="#13db72"/>
      <g fill="#20dc75" stroke="#008f49" strokeWidth="2.2"><path d="M80 105C61 104 60 87 70 88Q77 87 80 96Q83 87 90 88C101 89 99 105 80 105Z"/><path d="M80 105C78 86 61 88 63 99Q62 106 72 108Q62 111 65 118C68 129 82 124 80 105Z"/><path d="M80 105C99 104 100 121 89 122Q82 124 80 114Q77 124 70 122C59 120 62 104 80 105Z"/><path d="M80 105C82 86 99 89 97 99Q98 106 88 108Q98 111 95 118C92 129 78 124 80 105Z"/></g>
      <path d="M80 110q1 13 9 17" stroke="#007e43" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </g>
    <g className="gold-pot-sparkles" fill="#ffc20a"><path d="M22 24l4 10 9 4-9 4-4 10-4-10-9-4 9-4z"/><path d="M129 12l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M146 47l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></g>
  </svg>
}
