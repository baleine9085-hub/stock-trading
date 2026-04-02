import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import * as LightweightCharts from "lightweight-charts"

const { createChart } = LightweightCharts
const API_BASE = "https://stock-dashboard-production-19d7.up.railway.app"

function NewsMarquee({ news }) {
  return (
    <div style={{
      background: "#0a0a1a",
      borderBottom: "1px solid #ff3b3b44",
      padding: "8px 0",
      overflow: "hidden",
      position: "relative",
    }}>
      <motion.div
        animate={{ x: ["100%", "-100%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", gap: 60, whiteSpace: "nowrap" }}
      >
        {[...news, ...news].map((item, i) => (
          <span key={i} style={{ color: "#ffd700", fontSize: 13 }}>
            ⚡ {item}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

function FearGreedMeter({ score }) {
  const color = score >= 70 ? "#ff3b3b" : score >= 50 ? "#f97316" : score >= 30 ? "#facc15" : "#22c55e"
  const label = score >= 70 ? "극도의 공포 🚨" : score >= 50 ? "공포 ⚠️" : score >= 30 ? "중립 😐" : "탐욕 🤑"
  return (
    <div style={{
      background: "#1a1a2e",
      border: `1px solid ${color}`,
      borderRadius: 12,
      padding: "12px 20px",
      textAlign: "center",
      minWidth: 160,
    }}>
      <div style={{ color: "#aaa", fontSize: 11, marginBottom: 4 }}>CNN 공포지수</div>
      <div style={{ color, fontSize: 32, fontWeight: "bold" }}>{score}</div>
      <div style={{ color, fontSize: 12 }}>{label}</div>
    </div>
  )
}

function MacroCard({ data }) {
  if (!data) return null
  const isUp = data.change_pct >= 0
  return (
    <div style={{
      background: "#1a1a2e",
      border: `1px solid ${isUp ? "#ff3b3b44" : "#3b82f644"}`,
      borderRadius: 10,
      padding: "10px 16px",
      minWidth: 130,
    }}>
      <div style={{ color: "#aaa", fontSize: 11 }}>{data.name}</div>
      <div style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
        {data.price?.toLocaleString()}
      </div>
      <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 12 }}>
        {isUp ? "▲" : "▼"} {Math.abs(data.change_pct)?.toFixed(2)}%
      </div>
    </div>
  )
}

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

function SniperBox({ ticker, currency }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/api/recommend/${ticker}`)
      .then(r => r.json())
      .then(setData)
  }, [ticker])

  if (!data || data.error) return null

  // ✅ undefined 방지
  const fmt = (v) => {
    if (v === undefined || v === null || isNaN(v)) return "-"
    return currency === "KRW" ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(2)}`
  }

  return (
    <div style={{ marginTop: 12 }}>
      {data.is_bad_news && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{
            background: "#2d0d0d", border: "1px solid #ff3b3b",
            borderRadius: 8, padding: "8px 12px", marginBottom: 8,
            color: "#ff3b3b", fontSize: 13,
          }}
        >
          ⚠️ 보스, 악재 감지됨. 벙커 타점 하향 조정 완료.
        </motion.div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: "#0d2d0d", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 10 }}>1차 정찰대 (20%)</div>
          <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: 14 }}>{fmt(data.buy1)}</div>
          <div style={{ color: "#666", fontSize: 10 }}>-3%</div>
        </div>
        <div style={{ background: "#1a2d0d", border: "1px solid #84cc16", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 10 }}>2차 본대 (30%)</div>
          <div style={{ color: "#84cc16", fontWeight: "bold", fontSize: 14 }}>{fmt(data.buy2)}</div>
          <div style={{ color: "#666", fontSize: 10 }}>-7%</div>
        </div>
        <div style={{ background: "#2d1a0d", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 10 }}>3차 지하벙커 (50%)</div>
          <div style={{ color: "#f97316", fontWeight: "bold", fontSize: 14 }}>{fmt(data.buy3)}</div>
          <div style={{ color: "#666", fontSize: 10 }}>-12%</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div style={{ background: "#0d0d2d", border: "1px solid #6366f1", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 10 }}>매도 목표가</div>
          <div style={{ color: "#6366f1", fontWeight: "bold", fontSize: 14 }}>{fmt(data.sell)}</div>
          <div style={{ color: "#666", fontSize: 10 }}>+8%</div>
        </div>
        <div style={{ background: "#2d0d0d", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 10 }}>손절가</div>
          <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: 14 }}>{fmt(data.stop_loss)}</div>
          <div style={{ color: "#666", fontSize: 10 }}>-15%</div>
        </div>
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
    <motion.div
      layout
      style={{
        border: `1px solid ${flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : isUp ? "#ff3b3b44" : "#3b82f644"}`,
        borderRadius: 12, padding: "16px 20px",
        background: flash === "up" ? "rgba(255,59,59,0.15)" : flash === "down" ? "rgba(59,130,246,0.15)" : "#1a1a2e",
        marginBottom: 12, cursor: "pointer",
        transition: "background 0.5s, border 0.5s",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#666", fontSize: 12 }}>{stock.ticker}</span>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{stock.name}</span>
          {stock.source === "KIS실시간" && (
            <span style={{ background: "#ff3b3b", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}>
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }}
              />
              LIVE
            </span>
          )}
          <span style={{ color: "#555", fontSize: 11 }}>{expanded ? "▲ 접기" : "▼ 차트"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <motion.div
            key={stock.price}
            animate={{ color: flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : "#ffffff" }}
            style={{ fontSize: 22, fontWeight: "bold" }}
          >
            {stock.currency === "KRW" ? `₩${stock.price?.toLocaleString()}` : `$${stock.price?.toFixed(2)}`}
          </motion.div>
          <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 14 }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change_pct)?.toFixed(2)}%
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <CandleChart ticker={stock.ticker} />
            <SniperBox ticker={stock.ticker} currency={stock.currency} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function App() {
  const [krStocks, setKrStocks] = useState([])
  const [usStocks, setUsStocks] = useState([])
  const [macro, setMacro] = useState({})
  const [news, setNews] = useState(["시장 데이터 수집 중..."])
  const [fearGreed, setFearGreed] = useState(50)
  const [tab, setTab] = useState("kr")
  const [lastUpdated, setLastUpdated] = useState(null)
  const prevKr = useRef({})
  const prevUs = useRef({})
  const ws = useRef(null)

  const isExtremeFear = fearGreed >= 70

  useEffect(() => {
    fetch(`${API_BASE}/api/kr-stocks`).then(r => r.json()).then(setKrStocks)
    fetch(`${API_BASE}/api/us-stocks`).then(r => r.json()).then(setUsStocks)
    fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro)
    fetch(`${API_BASE}/api/news`).then(r => r.json()).then(setNews)
    fetch(`${API_BASE}/api/fear-greed`).then(r => r.json()).then(d => setFearGreed(d.score))

    const connect = () => {
      ws.current = new WebSocket("wss://stock-dashboard-production-19d7.up.railway.app/ws/stocks")
      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setKrStocks(prev => { prev.forEach(s => { prevKr.current[s.ticker] = s.price }); return data.kr })
        setUsStocks(prev => { prev.forEach(s => { prevUs.current[s.ticker] = s.price }); return data.us })
        // ✅ 빈 객체/배열로 덮어씌우는 버그 수정
        if (data.macro && Object.keys(data.macro).length > 0) setMacro(data.macro)
        if (data.news && data.news.length > 0) setNews(data.news)
        if (data.fear_greed !== undefined) setFearGreed(data.fear_greed)
        setLastUpdated(new Date().toLocaleTimeString())
      }
      ws.current.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => ws.current?.close()
  }, [])

  return (
    <div style={{
      background: isExtremeFear ? "#0d0000" : "#0d0d1a",
      minHeight: "100vh", color: "#fff", fontFamily: "sans-serif",
      boxShadow: isExtremeFear ? "inset 0 0 60px rgba(255,0,0,0.3)" : "none",
      transition: "all 0.5s",
    }}>
      {isExtremeFear && (
        <motion.div
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{
            position: "fixed", inset: 0,
            border: "4px solid #ff0000",
            pointerEvents: "none", zIndex: 999,
          }}
        />
      )}

      {news.length > 0 && <NewsMarquee news={news} />}

      <div style={{ background: "#13132a", padding: "12px 24px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: "bold" }}>⚡ AI STOCK TERMINAL</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <FearGreedMeter score={fearGreed} />
          <div style={{ fontSize: 12, color: "#aaa" }}>{lastUpdated ? `업데이트: ${lastUpdated}` : "연결 중..."}</div>
        </div>
      </div>

      <div style={{ padding: "12px 24px", borderBottom: "1px solid #222", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 12, minWidth: "max-content" }}>
          {Object.entries(macro).map(([ticker, data]) => (
            <MacroCard key={ticker} data={data} />
          ))}
        </div>
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