import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, startOfDay, subDays } from 'date-fns'
import { BarChart3, CalendarDays, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import type { GoldPrice } from '../types'
import { isPriceStale } from '../lib/gold'
import GoldPot from './GoldPot'
import { GOLD_RETAIL_SOURCE } from '../lib/goldRetail'

const ranges = [{ label: '1D', days: 1 }, { label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '1Y', days: 365 }]
interface Props {
  price: GoldPrice | null
  history: { timestamp: number; price: number }[]
  loading: boolean
  refreshing: boolean
  error: string | null
  onRefresh: () => unknown
}

export default function GoldPriceCard({ price, history, loading, refreshing, error, onRefresh }: Props) {
  const [range, setRange] = useState(30)
  const gradient = `gold-chart-${useId().replace(/:/g, '')}`
  const visible = useMemo(() => {
    const since = startOfDay(subDays(new Date(), range - 1)).getTime()
    return history.filter(point => point.timestamp >= since).sort((a, b) => a.timestamp - b.timestamp)
  }, [history, range])
  const change = visible.length > 1 ? visible[visible.length - 1].price - visible[0].price : null
  const percent = change === null ? null : change / visible[0].price * 100
  const DownOrUp = change !== null && change < 0 ? TrendingDown : TrendingUp
  return <section className="gold-market-card" aria-label="Gold retail price in Jordanian dinars">
    <div className="gold-market-header">
      <span className="gold-karat-pill"><BarChart3 size={17} />21K GOLD</span>
      <button type="button" className="gold-market-refresh" aria-label="Refresh gold price" title="Refresh gold price" onClick={() => void onRefresh()} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
    </div>
    <div className="gold-market-overview">
      <div className="gold-market-copy">
        {price ? <>
          <strong className="gold-market-price">JOD {Number(price.price_21k).toFixed(2)}<small>/g</small></strong>
          <a className="gold-market-source" href={GOLD_RETAIL_SOURCE} target="_blank" rel="noreferrer">You pay · Roya retail</a>
          <span className={`gold-market-change ${change !== null && change < 0 ? 'is-down' : ''}`}>
            {change === null ? 'First daily quote' : <><DownOrUp size={15}/>{percent! >= 0 ? '+' : ''}{percent!.toFixed(2)}% <small>(JOD {change >= 0 ? '+' : ''}{change.toFixed(2)})</small></>}
          </span>
          <span className="gold-market-note">before workmanship · 24k: {Number(price.price_24k).toFixed(2)} JOD/g</span>
          {error && <span className="gold-market-stale" role="status">Could not refresh · showing saved price</span>}
          {isPriceStale(price) && <span className="gold-market-stale">Saved price may be out of date</span>}
        </> : <p role={error ? 'alert' : 'status'}>{loading ? 'Loading retail price…' : error ? `Could not load price: ${error}` : 'Open to load retail prices.'}</p>}
      </div>
      <GoldPot />
    </div>
    <div className="gold-market-chart" role="img" aria-label={visible.length ? `Daily 21k retail prices, ${visible.length} saved ${visible.length === 1 ? 'quote' : 'quotes'}` : 'No saved daily retail quotes yet'}>
      {visible.length > 1 ? <ResponsiveContainer width="100%" height={132}>
        <AreaChart data={visible} margin={{ left: 0, top: 8, right: 0, bottom: 0 }}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffbc26" stopOpacity={.65}/><stop offset="100%" stopColor="#ffbc26" stopOpacity={.04}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--gold-grid)" strokeDasharray="3 3"/>
          <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => format(new Date(value), 'MMM d')} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--gold-muted)' }} minTickGap={40}/>
          <YAxis orientation="right" domain={['auto', 'auto']} width={43} tickFormatter={value => Number(value).toFixed(2)} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--gold-muted)' }}/>
          <Tooltip labelFormatter={value => format(new Date(Number(value)), 'MMM d, yyyy')} formatter={value => [`${Number(value).toFixed(2)} JOD/g`, '21k retail']} contentStyle={{ background: 'var(--gold-tooltip)', border: '1px solid var(--gold-grid)', borderRadius: 12, fontSize: 12, color: 'var(--gold-ink)' }}/>
          <Area type="monotone" dataKey="price" stroke="#efa000" strokeWidth={2.5} fill={`url(#${gradient})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#ffb41f', stroke: '#fff', strokeWidth: 2 }}/>
        </AreaChart>
      </ResponsiveContainer> : <div className="gold-market-chart-empty"><span className="gold-market-single-dot"/>{range === 1 ? 'Today’s saved quote · daily prices, no intraday feed' : 'Daily chart builds as quotes are saved on different days'}</div>}
    </div>
    <div className="gold-market-ranges" role="group" aria-label="Gold chart period">{ranges.map(item => <button key={item.days} type="button" aria-pressed={item.days === range} onClick={() => setRange(item.days)}>{item.label}</button>)}</div>
    <footer className="gold-market-footer"><CalendarDays size={15}/><span>{price ? `Checked ${format(new Date(price.fetched_at), 'MMM d, h:mm a')}` : 'Retail quote unavailable'}</span><small>{visible.length} saved {visible.length === 1 ? 'day' : 'days'}</small></footer>
  </section>
}
