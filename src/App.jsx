import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createChart, CandlestickSeries } from "lightweight-charts"

const API_BASE = "https://stock-dashboard-production-19d7.up.railway.app"

function MarketBadge({ status }) {
  const config = {
    "정규": { color: "#22c55e", bg: "#0d2d0d", label: "정규" },
    "장전시간외": { color: "#facc15", bg: "#2d2a0d", label: "장전" },
    "장후시간외": { color: "#f97316", bg: "#2d1a0d", label: "장후" },
    "시간외단일가": { color: "#ff3b3b", bg: "#2d0d0d", label: "단일가" },
    "장마감": { color: "#aaa", bg: "#1a1a2e", label: "마감" },
    "휴장": { color: "#555", bg: "#111", label: "휴장" },
    "장외": { color: "#555", bg: "#111", label: "장외" },
    "프리마켓": { color: "#a78bfa", bg: "#1a0d2d", label: "프리" },
    "애프터마켓": { color: "#f472b6", bg: "#2d0d1a", label: "애프터" },
  }
  const c = config[status] || config["휴장"]
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.color}`,
      fontSize: 9, padding: "2px 5px", borderRadius: 4, fontWeight: "bold"
    }}>
      {c.label}
    </span>
  )
}

function NewsMarquee({ news }) {
  return (
    <div style={{
      background: "#0a0a1a",
      borderBottom: "1px solid #ff3b3b44",
      padding: "8px 0",
      overflow: "hidden",
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
      background: "#1a1a2e", border: `1px solid ${color}`,
      borderRadius: 12, padding: "12px 20px", textAlign: "center", minWidth: 160,
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
      borderRadius: 10, padding: "10px 16px", minWidth: 130,
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
    const series = chart.addSeries(CandlestickSeries, {
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

function SniperBox({ ticker, currency, cachedRec, isGlobalEmergency }) {
  const [data, setData] = useState(cachedRec || null)
  const [loading, setLoading] = useState(!cachedRec)

  useEffect(() => {
    if (cachedRec) {
      setData(cachedRec)
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`${API_BASE}/api/recommend/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker, cachedRec])

  const fmt = (v) => {
    if (v === undefined || v === null || isNaN(Number(v))) return "-"
    return currency === "KRW"
      ? `₩${Number(v).toLocaleString()}`
      : `$${Number(v).toFixed(2)}`
  }

  const getTimestamp = () => {
    if (!data?.updated_at) return null
    const diff = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / 60000)
    if (data.is_emergency) return "🚨 긴급 업데이트됨"
    if (diff < 1) return "방금 전략 수립됨"
    if (diff < 60) return `최근 전략 수립: ${diff}분 전`
    return `최근 전략 수립: ${Math.floor(diff / 60)}시간 전`
  }

  if (loading) {
    return (
      <motion.div
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          marginTop: 12, background: "#0d0d1a",
          border: "1px solid #333", borderRadius: 8,
          padding: "20px", textAlign: "center",
          color: "#555", fontSize: 14,
        }}
      >
        ⚙️ 전략 수정 중...
      </motion.div>
    )
  }

  if (!data || data.error) return null

  const isEmergency = data.is_emergency || isGlobalEmergency

  return (
    <div style={{ marginTop: 12 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: isEmergency ? "#1a0000" : data.is_bad_news ? "#1a0505" : "#05101a",
          border: `1px solid ${isEmergency ? "#ff0000" : data.is_bad_news ? "#ff3b3b" : "#3b82f6"}`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 10,
          fontSize: 15, color: isEmergency ? "#ff6666" : data.is_bad_news ? "#ff9999" : "#93c5fd",
        }}
      >
        🎯 {data.scenario}
        {data.is_bad_news && data.discount_pct > 0 && (
          <span style={{ color: "#ff3b3b", marginLeft: 8, fontWeight: "bold" }}>
            [{data.discount_pct}% 벙커 하향 적용됨]
          </span>
        )}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: "#0d2d0d", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 11 }}>🔍 1차 정찰대 (20%)</div>
          <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: 15 }}>{fmt(data.buy1)}</div>
          <div style={{ color: "#666", fontSize: 11 }}>현재가 -3%~</div>
        </div>
        <div style={{ background: "#1a2d0d", border: "1px solid #84cc16", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 11 }}>⚔️ 2차 본대 (30%)</div>
          <div style={{ color: "#84cc16", fontWeight: "bold", fontSize: 15 }}>{fmt(data.buy2)}</div>
          <div style={{ color: "#666", fontSize: 11 }}>현재가 -7%~</div>
        </div>
        <div style={{ background: "#2d1a0d", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 11 }}>🏴 3차 지하벙커 (50%)</div>
          <div style={{ color: "#f97316", fontWeight: "bold", fontSize: 15 }}>{fmt(data.buy3)}</div>
          <div style={{ color: "#666", fontSize: 11 }}>현재가 -12%~</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div style={{ background: "#0d0d2d", border: "1px solid #6366f1", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 11 }}>🚀 매도 목표가</div>
          <div style={{ color: "#6366f1", fontWeight: "bold", fontSize: 15 }}>{fmt(data.sell)}</div>
          <div style={{ color: "#666", fontSize: 11 }}>+8%</div>
        </div>
        <div style={{ background: "#2d0d0d", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ color: "#aaa", fontSize: 11 }}>💀 손절가</div>
          <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: 15 }}>{fmt(data.stop_loss)}</div>
          <div style={{ color: "#666", fontSize: 11 }}>-15%</div>
        </div>
      </div>
      {getTimestamp() && (
        <div style={{
          marginTop: 6, textAlign: "right", fontSize: 11,
          color: data.is_emergency ? "#ff3b3b" : "#555"
        }}>
          {getTimestamp()}
        </div>
      )}
    </div>
  )
}

// 검색 결과 카드
function SearchResultCard({ result, onClose, recommendations, isEmergency }) {
  if (!result) return null
  const isUp = result.change_pct >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        border: `1px solid ${isUp ? "#ff3b3b44" : "#3b82f644"}`,
        borderRadius: 12, padding: "16px 20px",
        background: "#1a1a2e", marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#666", fontSize: 12 }}>{result.ticker}</span>
          <span style={{ color: "#ffd700", fontWeight: "bold", fontSize: 16 }}>
            🔍 검색 결과
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: "bold" }}>
              {result.currency === "KRW"
                ? `₩${result.price?.toLocaleString()}`
                : `$${result.price?.toFixed(2)}`}
            </div>
            <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 14 }}>
              {isUp ? "▲" : "▼"} {Math.abs(result.change_pct)?.toFixed(2)}%
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #555",
            color: "#aaa", borderRadius: 6, padding: "4px 10px",
            cursor: "pointer", fontSize: 12
          }}>✕ 닫기</button>
        </div>
      </div>
      <CandleChart ticker={result.ticker} />
      <SniperBox
        ticker={result.ticker}
        currency={result.currency}
        cachedRec={result.recommendation}
        isGlobalEmergency={isEmergency}
      />
    </motion.div>
  )
}

function StockCard({ stock, prevPrice, cachedRec, isEmergency }) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "#666", fontSize: 12 }}>{stock.ticker}</span>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{stock.name}</span>
          {stock.source === "KIS실시간" && (
            <span style={{
              background: "#ff3b3b", color: "#fff", fontSize: 10,
              padding: "2px 6px", borderRadius: 4, fontWeight: "bold",
              display: "flex", alignItems: "center", gap: 4
            }}>
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }}
              />
              LIVE
            </span>
          )}
          {stock.market_status && <MarketBadge status={stock.market_status} />}
          {isEmergency && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{
                background: "#ff0000", color: "#fff", fontSize: 9,
                padding: "2px 5px", borderRadius: 4, fontWeight: "bold"
              }}
            >
              🚨 긴급
            </motion.span>
          )}
          <span style={{ color: "#555", fontSize: 11 }}>{expanded ? "▲ 접기" : "▼ 차트"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <motion.div
            key={stock.price}
            animate={{ color: flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : "#ffffff" }}
            style={{ fontSize: 22, fontWeight: "bold" }}
          >
            {stock.currency === "KRW"
              ? `₩${stock.price?.toLocaleString()}`
              : `$${stock.price?.toFixed(2)}`}
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
            <SniperBox
              ticker={stock.ticker}
              currency={stock.currency}
              cachedRec={cachedRec}
              isGlobalEmergency={isEmergency}
            />
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
  const [marketStatus, setMarketStatus] = useState("정규")
  const [tab, setTab] = useState("kr")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [recommendations, setRecommendations] = useState({})
  const [isEmergency, setIsEmergency] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const prevKr = useRef({})
  const prevUs = useRef({})
  const ws = useRef(null)

  const isExtremeFear = fearGreed >= 70

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/search/${searchQuery.trim()}`)
      const data = await res.json()
      if (data.error) {
        alert(`검색 실패: ${data.error}`)
      } else {
        setSearchResult(data)
      }
    } catch (e) {
      alert("검색 중 오류가 발생했습니다.")
    }
    setSearchLoading(false)
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/kr-stocks`).then(r => r.json()).then(setKrStocks)
    fetch(`${API_BASE}/api/us-stocks`).then(r => r.json()).then(setUsStocks)
    fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro)
    fetch(`${API_BASE}/api/news`).then(r => r.json()).then(setNews)
    fetch(`${API_BASE}/api/fear-greed`).then(r => r.json()).then(d => setFearGreed(d.score))
    fetch(`${API_BASE}/api/market-status`).then(r => r.json()).then(d => setMarketStatus(d.status))

    const connect = () => {
      ws.current = new WebSocket("wss://stock-dashboard-production-19d7.up.railway.app/ws/stocks")
      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setKrStocks(prev => { prev.forEach(s => { prevKr.current[s.ticker] = s.price }); return data.kr })
        setUsStocks(prev => { prev.forEach(s => { prevUs.current[s.ticker] = s.price }); return data.us })
        if (data.macro && Object.keys(data.macro).length > 0) setMacro(data.macro)
        if (data.news && data.news.length > 0) setNews(data.news)
        if (data.fear_greed !== undefined) setFearGreed(data.fear_greed)
        if (data.market_status) setMarketStatus(data.market_status)
        if (data.recommendations) setRecommendations(data.recommendations)
        if (data.is_emergency !== undefined) setIsEmergency(data.is_emergency)
        if (data.emergency_reason !== undefined) setEmergencyReason(data.emergency_reason)
        setLastUpdated(new Date().toLocaleTimeString())
      }
      ws.current.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => ws.current?.close()
  }, [])

  return (
    <div style={{
      background: isExtremeFear || isEmergency ? "#0d0000" : "#0d0d1a",
      minHeight: "100vh", color: "#fff", fontFamily: "monospace",
      boxShadow: isExtremeFear || isEmergency ? "inset 0 0 60px rgba(255,0,0,0.3)" : "none",
      transition: "all 0.5s",
    }}>
      {(isExtremeFear || isEmergency) && (
        <motion.div
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            position: "fixed", inset: 0,
            border: "4px solid #ff0000",
            pointerEvents: "none", zIndex: 999,
          }}
        />
      )}

      {news.length > 0 && <NewsMarquee news={news} />}

      {/* 긴급 알림 배너 */}
      <AnimatePresence>
        {isEmergency && emergencyReason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: "#2d0000", borderBottom: "2px solid #ff0000",
              padding: "8px 24px", color: "#ff6666",
              fontSize: 14, fontWeight: "bold", textAlign: "center",
            }}
          >
            🚨 긴급 알림: {emergencyReason} — 타점 즉시 재계산 완료
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        background: "#13132a", padding: "12px 24px",
        borderBottom: "1px solid #222",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>⚡ AI STOCK TERMINAL</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            국장: <MarketBadge status={marketStatus} />
            <span style={{ marginLeft: 8 }}>{lastUpdated ? `업데이트: ${lastUpdated}` : "연결 중..."}</span>
          </div>
        </div>
        <FearGreedMeter score={fearGreed} />
      </div>

      <div style={{ padding: "12px 24px", borderBottom: "1px solid #1a1a2e", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 10, minWidth: "max-content" }}>
          {Object.entries(macro).map(([ticker, data]) => (
            <MacroCard key={ticker} data={data} />
          ))}
        </div>
      </div>

      {/* 검색창 */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #1a1a2e", display: "flex", gap: 8 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="🔍 종목 검색 (예: AAPL, 005930, Tesla)"
          style={{
            flex: 1, background: "#0d0d2a", border: "1px solid #333",
            borderRadius: 8, padding: "8px 14px", color: "#fff",
            fontSize: 14, fontFamily: "monospace", outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={searchLoading}
          style={{
            background: "#ff3b3b", border: "none", borderRadius: 8,
            padding: "8px 20px", color: "#fff", fontWeight: "bold",
            cursor: "pointer", fontSize: 14, fontFamily: "monospace",
          }}
        >
          {searchLoading ? "검색 중..." : "검색"}
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #222", paddingLeft: 24 }}>
        {[["kr", "🇰🇷 국내"], ["us", "🇺🇸 해외"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "12px 24px", background: "none", border: "none",
            color: tab === key ? "#fff" : "#666",
            borderBottom: tab === key ? "2px solid #ff3b3b" : "2px solid transparent",
            cursor: "pointer", fontSize: 14, fontWeight: tab === key ? "bold" : "normal",
            fontFamily: "monospace",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        {/* 검색 결과 */}
        <AnimatePresence>
          {searchResult && (
            <SearchResultCard
              result={searchResult}
              onClose={() => { setSearchResult(null); setSearchQuery("") }}
              recommendations={recommendations}
              isEmergency={isEmergency}
            />
          )}
        </AnimatePresence>

        {tab === "kr" && krStocks.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            prevPrice={prevKr.current[stock.ticker]}
            cachedRec={recommendations[stock.ticker]}
            isEmergency={isEmergency}
          />
        ))}
        {tab === "us" && usStocks.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            prevPrice={prevUs.current[stock.ticker]}
            cachedRec={recommendations[stock.ticker]}
            isEmergency={isEmergency}
          />
        ))}
      </div>
    </div>
  )
}