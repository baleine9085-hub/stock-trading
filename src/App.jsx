import { useState, useEffect, useRef } from "react"
import * as LightweightCharts from "lightweight-charts"

const { createChart } = LightweightCharts
const API_BASE = "http://localhost:8000"

function CandleChart({ ticker }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 200,
      layout: { background: { color: "#0d0d1a" }, textColor: "#aaa" },
      grid: { vertLines: { color: "#1a1a2e" }, horzLines: { color: "#1a1a2e" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    })
    const series = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: "#ff3b3b", downColor: "#3b82f6",
      borderUpColor: "#ff3b3b", borderDownColor: "#3b82f6",
      wickUpColor: "#ff3b3b", wickDownColor: "#3b82f6",
    })

    fetch(`${API_BASE}/api/chart/${ticker}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const today = new Date().toISOString().split('T')[0]
        const formatted = data.map((d) => {
          const [h, m] = d.time.split(':')
          const date = new Date(`${today}T${h}:${m}:00+09:00`)
          return {
            time: Math.floor(date.getTime() / 1000),
            open: d.open, high: d.high, low: d.low, close: d.close
          }
        }).filter(d => !isNaN(d.time))
        series.setData(formatted)
        chart.timeScale().fitContent()
      })

    return () => chart.remove()
  }, [ticker])

  return <div ref={chartRef} style={{ width: "100%", marginTop: 12 }} />
}

function RecommendBox({ ticker }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/recommend/${ticker}`)
      .then(r => r.json())
      .then(setData)
  }, [ticker])

  if (!data || data.error) return null

  const isKr = ticker.length === 6

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
      <div style={{ background: "#0d2d0d", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ color: "#aaa", fontSize: 11 }}>매수 추천가</div>
        <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: 15 }}>
          {isKr ? `₩${data.buy?.toLocaleString()}` : `$${data.buy}`}
        </div>
        <div style={{ color: "#666", fontSize: 10 }}>현재가 -3%</div>
      </div>
      <div style={{ background: "#2d1a0d", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ color: "#aaa", fontSize: 11 }}>매도 목표가</div>
        <div style={{ color: "#f97316", fontWeight: "bold", fontSize: 15 }}>
          {isKr ? `₩${data.sell?.toLocaleString()}` : `$${data.sell}`}
        </div>
        <div style={{ color: "#666", fontSize: 10 }}>현재가 +5%</div>
      </div>
      <div style={{ background: "#2d0d0d", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ color: "#aaa", fontSize: 11 }}>손절가</div>
        <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: 15 }}>
          {isKr ? `₩${data.stop_loss?.toLocaleString()}` : `$${data.stop_loss}`}
        </div>
        <div style={{ color: "#666", fontSize: 10 }}>현재가 -7%</div>
      </div>
    </div>
  )
}

function StockCard({ stock, prevPrice }) {
  const [flash, setFlash] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!prevPrice || prevPrice === stock.price) return
    setFlash(stock.price > prevPrice ? "up" : "down")
    const timer = setTimeout(() => setFlash(null), 800)
    return () => clearTimeout(timer)
  }, [stock.price])

  const isUp = stock.change_pct >= 0

  return (
    <div style={{
      border: `1px solid ${flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : isUp ? "#ff3b3b44" : "#3b82f644"}`,
      borderRadius: 12, padding: "16px 20px",
      background: flash === "up" ? "rgba(255,59,59,0.15)" : flash === "down" ? "rgba(59,130,246,0.15)" : "#1a1a2e",
      marginBottom: 12, cursor: "pointer",
      transition: "background 0.5s, border 0.5s",
    }} onClick={() => setExpanded(!expanded)}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ color: "#666", fontSize: 12 }}>{stock.ticker}</span>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 16, marginLeft: 8 }}>{stock.name}</span>
          {stock.source === "KIS실시간" && (
            <span style={{ marginLeft: 8, background: "#ff3b3b", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>● LIVE</span>
          )}
          <span style={{ marginLeft: 8, color: "#555", fontSize: 11 }}>{expanded ? "▲ 접기" : "▼ 차트"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>
            {stock.currency === "KRW" ? `₩${stock.price?.toLocaleString()}` : `$${stock.price?.toFixed(2)}`}
          </div>
          <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 14 }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change_pct)?.toFixed(2)}%
            <span style={{ color: "#555", fontSize: 11, marginLeft: 6 }}>
              {stock.currency === "KRW"
                ? `${stock.change > 0 ? "+" : ""}${stock.change?.toLocaleString()}`
                : `${stock.change > 0 ? "+" : ""}${stock.change?.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div onClick={e => e.stopPropagation()}>
          <CandleChart ticker={stock.ticker} />
          <RecommendBox ticker={stock.ticker} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [krStocks, setKrStocks] = useState([])
  const [usStocks, setUsStocks] = useState([])
  const [tab, setTab] = useState("kr")
  const [lastUpdated, setLastUpdated] = useState(null)
  const prevKr = useRef({})
  const prevUs = useRef({})
  const ws = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/kr-stocks`).then(r => r.json()).then(setKrStocks)
    fetch(`${API_BASE}/api/us-stocks`).then(r => r.json()).then(setUsStocks)

    const connect = () => {
      ws.current = new WebSocket("ws://localhost:8000/ws/stocks")
      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setKrStocks(prev => {
          prev.forEach(s => { prevKr.current[s.ticker] = s.price })
          return data.kr
        })
        setUsStocks(prev => {
          prev.forEach(s => { prevUs.current[s.ticker] = s.price })
          return data.us
        })
        setLastUpdated(new Date().toLocaleTimeString())
      }
      ws.current.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => ws.current?.close()
  }, [])

  return (
    <div style={{ background: "#0d0d1a", minHeight: "100vh", color: "#fff", fontFamily: "sans-serif" }}>
      <div style={{ background: "#13132a", padding: "16px 24px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: "bold" }}>⚡ AI STOCK TERMINAL</div>
        <div style={{ fontSize: 12, color: "#aaa" }}>{lastUpdated ? `업데이트: ${lastUpdated}` : "연결 중..."}</div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #222", paddingLeft: 24 }}>
        {[["kr", "🇰🇷 국내"], ["us", "🇺🇸 해외"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "12px 24px", background: "none", border: "none",
            color: tab === key ? "#fff" : "#666",
            borderBottom: tab === key ? "2px solid #ff3b3b" : "2px solid transparent",
            cursor: "pointer", fontSize: 14, fontWeight: tab === key ? "bold" : "normal"
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        {tab === "kr" && krStocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock} prevPrice={prevKr.current[stock.ticker]} />
        ))}
        {tab === "us" && usStocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock} prevPrice={prevUs.current[stock.ticker]} />
        ))}
      </div>
    </div>
  )
}