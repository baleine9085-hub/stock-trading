import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts"

const API_BASE = "https://stock-dashboard-production-19d7.up.railway.app"
const KST_OFFSET = 9 * 3600  // 프론트에서만 KST 변환

const TIMEFRAMES = [
  { label: "1분",   interval: "1m",  period: "1d"  },
  { label: "5분",   interval: "5m",  period: "5d"  },
  { label: "1시간", interval: "60m", period: "1mo" },
  { label: "일봉",  interval: "1d",  period: "1y"  },
]

const COMPARE_OPTIONS = [
  { label: "── 비교선 없음", ticker: null,    color: null      },
  { label: "나스닥",         ticker: "^IXIC", color: "#a78bfa" },
  { label: "코스피",         ticker: "^KS11", color: "#facc15" },
  { label: "S&P500",         ticker: "^GSPC", color: "#60a5fa" },
  { label: "VIX",            ticker: "^VIX",  color: "#f97316" },
]

function getSentimentColor(score) {
  if (score <= 30) return "#dc2626"
  if (score <= 60) return "#facc15"
  return "#22c55e"
}
function getSentimentBg(score) {
  if (score <= 30) return "#1a0000"
  if (score <= 60) return "#1a1a00"
  return "#001a00"
}
function getSentimentLabel(score) {
  if (score <= 30) return "극단적 공포 🚨"
  if (score <= 40) return "강한 부정 📉"
  if (score <= 60) return "관망 ⚠️"
  if (score <= 70) return "긍정 📈"
  return "극단적 탐욕 🤑"
}

// ── 마켓 배지 ─────────────────────────────────────────────────
function MarketBadge({ status }) {
  const config = {
    "정규":        { color: "#22c55e", bg: "#0d2d0d",  label: "정규"    },
    "호가접수":    { color: "#00e5ff", bg: "#002d33",  label: "호가접수" },
    "장전시간외":  { color: "#facc15", bg: "#2d2a0d",  label: "장전"    },
    "장후시간외":  { color: "#f97316", bg: "#2d1a0d",  label: "장후"    },
    "시간외단일가":{ color: "#ff3b3b", bg: "#2d0d0d",  label: "단일가"  },
    "장마감":      { color: "#aaa",    bg: "#1a1a2e",  label: "마감"    },
    "휴장":        { color: "#555",    bg: "#111",     label: "휴장"    },
    "장외":        { color: "#555",    bg: "#111",     label: "장외"    },
    "프리마켓":    { color: "#a78bfa", bg: "#1a0d2d",  label: "프리"    },
    "애프터마켓":  { color: "#f472b6", bg: "#2d0d1a",  label: "애프터"  },
  }
  const c = config[status] || config["휴장"]
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}`, fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>
      {c.label}
    </span>
  )
}

function NewsMarquee({ news }) {
  return (
    <div style={{ background: "#0a0a1a", borderBottom: "1px solid #ff3b3b44", padding: "8px 0", overflow: "hidden" }}>
      <motion.div animate={{ x: ["100%", "-100%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", gap: 60, whiteSpace: "nowrap" }}>
        {[...news, ...news].map((item, i) => (
          <span key={i} style={{ color: "#ffd700", fontSize: 14 }}>⚡ {item}</span>
        ))}
      </motion.div>
    </div>
  )
}

function FearGreedMeter({ score }) {
  const color = score >= 70 ? "#ff3b3b" : score >= 50 ? "#f97316" : score >= 30 ? "#facc15" : "#22c55e"
  const label = score >= 70 ? "극도의 공포 🚨" : score >= 50 ? "공포 ⚠️" : score >= 30 ? "중립 😐" : "탐욕 🤑"
  return (
    <div style={{ background: "#1a1a2e", border: `1px solid ${color}`, borderRadius: 12, padding: "12px 20px", textAlign: "center", minWidth: 160 }}>
      <div style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>CNN 공포지수</div>
      <div style={{ color, fontSize: 36, fontWeight: "bold" }}>{score}</div>
      <div style={{ color, fontSize: 13 }}>{label}</div>
    </div>
  )
}

function MacroCard({ data }) {
  if (!data) return null
  const isUp = data.change_pct >= 0
  return (
    <div style={{ background: "#1a1a2e", border: `1px solid ${isUp ? "#ff3b3b44" : "#3b82f644"}`, borderRadius: 10, padding: "10px 16px", minWidth: 140 }}>
      <div style={{ color: "#aaa", fontSize: 12 }}>{data.name}</div>
      <div style={{ color: "#fff", fontWeight: "bold", fontSize: 17 }}>{data.price?.toLocaleString()}</div>
      <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 13 }}>
        {isUp ? "▲" : "▼"} {Math.abs(data.change_pct)?.toFixed(2)}%
      </div>
    </div>
  )
}

function NewsSentimentGauge({ sentiment }) {
  if (!sentiment || sentiment.score === undefined) return null
  const { score, pos_ratio = 50, neg_ratio = 50, pos_keywords = [], neg_keywords = [], is_danger = false, decisive_reason = "", reddit_score, vix_penalty = 0 } = sentiment
  const color   = getSentimentColor(score)
  const bgColor = getSentimentBg(score)
  const label   = getSentimentLabel(score)
  const angleDeg = (score / 100) * 180
  const angleRad = (angleDeg - 90) * (Math.PI / 180)
  const needleX  = 60 + 36 * Math.cos(angleRad)
  const needleY  = 62 + 36 * Math.sin(angleRad)
  const isDanger = score <= 30 || is_danger
  const isBull   = score >= 70

  return (
    <motion.div
      animate={isDanger ? { boxShadow: ["0 0 0px #ff000000","0 0 20px #ff0000bb","0 0 0px #ff000000"] } : isBull ? { boxShadow: ["0 0 0px #22c55e00","0 0 14px #22c55e66","0 0 0px #22c55e00"] } : {}}
      transition={isDanger || isBull ? { duration: 0.9, repeat: Infinity } : {}}
      style={{ background: bgColor, border: `1px solid ${color}`, borderRadius: 10, padding: "12px 14px", marginTop: 10 }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <svg width={124} height={72} viewBox="0 0 124 72" style={{ flexShrink: 0 }}>
          <path d="M 8 66 A 56 56 0 0 1 116 66" fill="none" stroke="#1a1a2e" strokeWidth={12} />
          <path d="M 8 66 A 56 56 0 0 1 62 10" fill="none" stroke="#dc262666" strokeWidth={12} />
          <path d="M 50 12 A 56 56 0 0 1 74 12" fill="none" stroke="#facc1566" strokeWidth={12} />
          <path d="M 62 10 A 56 56 0 0 1 116 66" fill="none" stroke="#22c55e66" strokeWidth={12} />
          <line x1={62} y1={66} x2={needleX} y2={needleY} stroke={color} strokeWidth={3} strokeLinecap="round" />
          <circle cx={62} cy={66} r={5} fill={color} />
          <text x={62} y={54} textAnchor="middle" fill={color} fontSize={15} fontWeight="bold" fontFamily="monospace">{score}</text>
          <text x={10} y={72} fill="#dc2626" fontSize={8} fontFamily="monospace">공포</text>
          <text x={50} y={8}  fill="#facc15" fontSize={8} fontFamily="monospace">관망</text>
          <text x={96} y={72} fill="#22c55e" fontSize={8} fontFamily="monospace">탐욕</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ color: "#aaa", fontSize: 12 }}>🧠 AI 24H 뉴스 심리</span>
            <span style={{ color, fontSize: 13, fontWeight: "bold" }}>{label}</span>
          </div>
          <div style={{ display: "flex", borderRadius: 3, overflow: "hidden", height: 8, marginBottom: 4 }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pos_ratio}%` }} transition={{ duration: 1 }} style={{ background: "#22c55e" }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${neg_ratio}%` }} transition={{ duration: 1 }} style={{ background: "#dc2626" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: "#22c55e" }}>긍정 {pos_ratio}%</span>
            {reddit_score !== undefined && <span style={{ color: "#a78bfa", fontSize: 11 }}>WSB {reddit_score}</span>}
            {vix_penalty < 0 && <span style={{ color: "#f97316", fontSize: 11 }}>VIX{vix_penalty}</span>}
            <span style={{ color: "#dc2626" }}>부정 {neg_ratio}%</span>
          </div>
          {decisive_reason && (
            <div style={{ background: "#0d0d1a", border: `1px solid ${color}44`, borderRadius: 5, padding: "5px 8px", marginBottom: 6, fontSize: 12, color, lineHeight: 1.4 }}>
              💡 <span style={{ color: "#aaa" }}>결정적 근거: </span>{decisive_reason}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {pos_keywords.slice(0, 3).map(kw => (
              <span key={kw} style={{ background: "#001a00", color: "#22c55e", fontSize: 11, padding: "2px 6px", borderRadius: 3, border: "1px solid #22c55e33" }}>↑ {kw}</span>
            ))}
            {neg_keywords.slice(0, 3).map(kw => (
              <span key={kw} style={{ background: "#1a0000", color: "#ff6666", fontSize: 11, padding: "2px 6px", borderRadius: 3, border: "1px solid #ff3b3b33" }}>↓ {kw}</span>
            ))}
          </div>
          {isDanger && (
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
              style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: "bold" }}>
              🚨 극단적 공포 — 3차 지하벙커 타점 활성화
            </motion.div>
          )}
          {isBull && !isDanger && (
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ marginTop: 6, color: "#22c55e", fontSize: 12, fontWeight: "bold" }}>
              🤑 극단적 탐욕 — 추격 매수 주의, 눌림목 대기
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function SectorFlowTable({ sectorFlow }) {
  if (!sectorFlow || sectorFlow.length === 0) return null
  const krFlow = sectorFlow.filter(s => s.market === "KR")
  const usFlow = sectorFlow.filter(s => s.market === "US")
  const Table = ({ data, title, flag }) => (
    <div style={{ background: "#13132a", border: "1px solid #222", borderRadius: 10, padding: "10px 14px", minWidth: 210, flexShrink: 0 }}>
      <div style={{ color: "#ffd700", fontSize: 13, fontWeight: "bold", marginBottom: 8 }}>{flag} {title} 섹터 수급</div>
      {data.length === 0 ? <div style={{ color: "#444", fontSize: 12 }}>데이터 없음</div> : (
        data.slice(0, 6).map((s, i) => {
          const isUp = s.avg_change >= 0
          return (
            <div key={s.sector} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < 5 ? "1px solid #1a1a2e" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#333", fontSize: 11, minWidth: 16 }}>{i + 1}</span>
                <span style={{ color: "#ccc", fontSize: 13 }}>{s.sector}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: isUp ? "#22c55e" : "#ff3b3b", fontSize: 12, fontWeight: "bold" }}>
                  {isUp ? "▲" : "▼"} {Math.abs(s.avg_change).toFixed(2)}%
                </span>
                <span style={{ background: isUp ? "#0d2d0d" : "#2d0d0d", color: isUp ? "#22c55e" : "#ff3b3b", fontSize: 11, padding: "1px 5px", borderRadius: 3 }}>
                  {isUp ? "유입" : "유출"}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
  return (
    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
      <Table data={krFlow} title="국장" flag="🇰🇷" />
      <Table data={usFlow} title="미장" flag="🇺🇸" />
    </div>
  )
}

function CandleChart({ ticker, isKR = false, onTimeframeChange, livePrice, marketStatus = "" }) {
  const containerRef     = useRef(null)
  const chartRef         = useRef(null)
  const seriesRef        = useRef(null)
  const compareSeriesRef = useRef(null)
  const lastCandleRef    = useRef(null)
  const sessionRef       = useRef("")        // ★ 세션 전환 감지
  const fitTimerRef      = useRef(null)      // ★ fitContent 타이머
  const holdTimerRef     = useRef(null)      // ★ 횡보 캔들 타이머

  const [activeIdx, setActiveIdx]   = useState(1)
  const [compareIdx, setCompareIdx] = useState(0)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [syncing, setSyncing]       = useState(false)
  const tf = TIMEFRAMES[activeIdx]

  // ── 프리/애프터 세션 여부 ─────────────────────────────────────
  const isExtSession = ["프리마켓", "애프터마켓", "호가접수", "장전시간외", "시간외단일가"].includes(marketStatus)

  // ── 차트 초기화 ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 230,
      layout: { background: { color: "#0d0d1a" }, textColor: "#bbb" },
      grid:   { vertLines: { color: "#1a1a2e" }, horzLines: { color: "#1a1a2e" } },
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    10,
        barSpacing:     6,
        tickMarkFormatter: (ts) => {
  const d   = new Date(ts * 1000)
  const h   = String(d.getHours()).padStart(2, "0")
  const m   = String(d.getMinutes()).padStart(2, "0")
  const mo  = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  // ★ 자정(00:00)이거나 09:00이면 날짜 표시
  if (h === "00" && m === "00") return `${mo}/${day}`
  if (h === "09" && m === "00") return `${mo}/${day}`
  return `${h}:${m}`
},
      },
      rightPriceScale: { borderColor: "#1a1a2e" },
      leftPriceScale:  { visible: false, borderColor: "#2a2a3a" },
      crosshair: { mode: 1 },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#ff3b3b", downColor: "#3b82f6",
      borderUpColor: "#ff3b3b", borderDownColor: "#3b82f6",
      wickUpColor:   "#ff3b3b", wickDownColor:   "#3b82f6",
    })
    chartRef.current  = chart
    seriesRef.current = series
    lastCandleRef.current = null

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      compareSeriesRef.current = null
      lastCandleRef.current = null
      if (fitTimerRef.current)  clearInterval(fitTimerRef.current)
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    }
  }, [])

  // ── 데이터 로딩 ──────────────────────────────────────────────
  const loadData = useCallback(() => {
    if (!seriesRef.current) return
    setLoading(true); setError(null)
    fetch(`${API_BASE}/api/chart/${ticker}?interval=${tf.interval}&period=${tf.period}`)
      .then(r => r.json())
      .then(raw => {
        if (!seriesRef.current) return
        if (!Array.isArray(raw)) { setError("데이터 없음"); setLoading(false); return }
        const seen = new Set()
        const formatted = raw
          .map(d => ({ time: d.timestamp, open: d.open, high: d.high, low: d.low, close: d.close }))
          .filter(d => {
            if (!d.time || isNaN(d.time) || seen.has(d.time)) return false
            seen.add(d.time); return true
          })
          .sort((a, b) => a.time - b.time)

        seriesRef.current.setData(formatted)
        if (formatted.length > 0) {
          lastCandleRef.current = { ...formatted[formatted.length - 1] }
        }
        chartRef.current?.timeScale().fitContent()
        setLoading(false)
      })
      .catch(() => { setError("로딩 실패"); setLoading(false) })
  }, [ticker, activeIdx])

  useEffect(() => { loadData() }, [loadData])

  // ── ★ 세션 전환 감지 → 차트 리셋 후 재로드 ─────────────────
  useEffect(() => {
    if (!marketStatus) return
    const prev = sessionRef.current
    const curr = marketStatus

    // 세션이 바뀌었을 때만 리셋
    if (prev && prev !== curr) {
      const sessionGroup = (s) => {
        if (["정규"].includes(s)) return "regular"
        if (["프리마켓", "호가접수", "장전시간외"].includes(s)) return "pre"
        if (["애프터마켓", "시간외단일가", "장후시간외"].includes(s)) return "after"
        return "off"
      }
      if (sessionGroup(prev) !== sessionGroup(curr)) {
        console.log(`🔄 세션 전환: ${prev} → ${curr} → 차트 리셋`)
        if (seriesRef.current) {
          try { seriesRef.current.setData([]) } catch {}
          lastCandleRef.current = null
        }
        setTimeout(() => loadData(), 300)
      }
    }
    sessionRef.current = curr
  }, [marketStatus])

  // ── ★ 프리/애프터 세션: 5초마다 fitContent 자동 실행 ────────
  useEffect(() => {
    if (fitTimerRef.current) clearInterval(fitTimerRef.current)
    if (isExtSession && chartRef.current) {
      fitTimerRef.current = setInterval(() => {
        try { chartRef.current?.timeScale().scrollToRealTime() } catch {}
      }, 5000)
    }
    return () => { if (fitTimerRef.current) clearInterval(fitTimerRef.current) }
  }, [isExtSession])

  // ── ★ 24시간 횡보 캔들 — 마지막 체결 이후 시간축 유지 ───────
  useEffect(() => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    holdTimerRef.current = setInterval(() => {
      if (!seriesRef.current || !lastCandleRef.current) return
      if (tf.interval === "1d") return  // 일봉은 불필요

      const intervalSec = tf.interval === "1m" ? 60 : tf.interval === "5m" ? 300 : 3600
      const nowTs    = Math.floor(Date.now() / 1000)
      const candleTs = Math.floor(nowTs / intervalSec) * intervalSec
      const last     = lastCandleRef.current

      // 마지막 캔들이 현재 구간보다 오래됐으면 횡보 캔들 추가
      if (candleTs > last.time) {
        const holdCandle = {
          time:  candleTs,
          open:  last.close,
          high:  last.close,
          low:   last.close,
          close: last.close,
        }
        try {
          seriesRef.current.update(holdCandle)
          lastCandleRef.current = holdCandle
        } catch {}
      }
    }, 10000)  // 10초마다 체크

    return () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current) }
  }, [activeIdx])

  // ── ★ livePrice → Tick by Tick + 프리장 시간 보정 ───────────
  useEffect(() => {
    if (!seriesRef.current || !livePrice || tf.interval === "1d") return

    const intervalSec = tf.interval === "1m" ? 60 : tf.interval === "5m" ? 300 : 3600
    const nowTs       = Math.floor(Date.now() / 1000)
    const candleTs    = Math.floor(nowTs / intervalSec) * intervalSec
    const last        = lastCandleRef.current

    // ★ 프리/애프터: 서버 시간이 5분 이상 뒤쳐지면 현재 시각으로 강제 보정
    let targetTs = candleTs
    if (isExtSession && last) {
      const drift = Math.abs(nowTs - last.time)
      if (drift > 300) {
        targetTs = candleTs  // 현재 시스템 시각 기준 강제 사용
        console.log(`⚡ 프리장 시간 보정: drift=${drift}s → ${new Date(targetTs*1000).toLocaleTimeString()}`)
      }
    }

    if (!last || targetTs > last.time) {
      // 새 캔들 구간
      const newCandle = {
        time:  targetTs,
        open:  livePrice,
        high:  livePrice,
        low:   livePrice,
        close: livePrice,
      }
      try {
        seriesRef.current.update(newCandle)
        lastCandleRef.current = newCandle
        chartRef.current?.timeScale().scrollToRealTime()
      } catch {}
    } else {
      // 같은 캔들 구간: Tick by Tick 업데이트
      const updated = {
        time:  last.time,
        open:  last.open,
        high:  Math.max(last.high, livePrice),
        low:   Math.min(last.low,  livePrice),
        close: livePrice,
      }
      try {
        seriesRef.current.update(updated)
        lastCandleRef.current = updated
      } catch {}
    }
  }, [livePrice])

  // ── 비교선 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return
    if (compareSeriesRef.current) {
      try { chartRef.current.removeSeries(compareSeriesRef.current) } catch {}
      compareSeriesRef.current = null
    }
    chartRef.current.priceScale("left").applyOptions({ visible: false })
    const opt = COMPARE_OPTIONS[compareIdx]
    if (!opt.ticker) return
    fetch(`${API_BASE}/api/chart/${encodeURIComponent(opt.ticker)}?interval=${tf.interval}&period=${tf.period}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || !chartRef.current) return
        const seen = new Set()
        const pts = data
          .map(d => ({ time: d.timestamp, value: d.close }))
          .filter(d => { if (!d.time || isNaN(d.time) || seen.has(d.time)) return false; seen.add(d.time); return true })
          .sort((a, b) => a.time - b.time)
        if (!pts.length) return
        const base = pts[0].value
        const norm = pts.map(d => ({ time: d.time, value: parseFloat(((d.value / base - 1) * 100).toFixed(3)) }))
        const line = chartRef.current.addSeries(LineSeries, {
          color: opt.color, lineWidth: 1.5,
          priceScaleId: "left", lastValueVisible: true,
          priceLineVisible: false, title: opt.label,
        })
        chartRef.current.priceScale("left").applyOptions({ visible: true, borderColor: "#2a2a3a", scaleMargins: { top: 0.1, bottom: 0.1 } })
        line.setData(norm)
        compareSeriesRef.current = line
      }).catch(() => {})
  }, [compareIdx, activeIdx, ticker])

  // ── 동기화 버튼 ──────────────────────────────────────────────
  const handleSync = (e) => {
    e.stopPropagation()
    setSyncing(true)
    lastCandleRef.current = null
    if (seriesRef.current) { try { seriesRef.current.setData([]) } catch {} }
    loadData()
    setTimeout(() => setSyncing(false), 1500)
  }

  const handleTf = (e, idx) => {
    e.stopPropagation()
    setActiveIdx(idx)
    onTimeframeChange?.(TIMEFRAMES[idx].interval)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); setCompareIdx(parseInt(e.target.value)) }}
            value={compareIdx}
            style={{ background: "#0d0d1a", color: "#a78bfa", border: "1px solid #2a2a3a", borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", outline: "none" }}>
            {COMPARE_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
          <button onClick={handleSync} style={{
            background: syncing ? "#1a2d0d" : "#0d0d1a",
            color:      syncing ? "#22c55e" : "#555",
            border: `1px solid ${syncing ? "#22c55e" : "#2a2a3a"}`,
            borderRadius: 4, padding: "4px 8px", fontSize: 11,
            cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s",
          }}>
            {syncing ? "⏳ 동기화 중..." : "🔄 동기화"}
          </button>
          {/* ★ 프리/애프터 세션 표시 */}
          {isExtSession && (
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: 10, color: "#a78bfa", border: "1px solid #a78bfa44", borderRadius: 3, padding: "2px 6px" }}>
              ⚡ {marketStatus} 실시간
            </motion.span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TIMEFRAMES.map((t, i) => {
            const isActive = i === activeIdx
            return (
              <button key={t.label} onClick={e => handleTf(e, i)} style={{
                background: isActive ? "#6366f1" : "#0d0d1a",
                color:      isActive ? "#fff"    : "#555",
                border: `1px solid ${isActive ? "#6366f1" : "#2a2a3a"}`,
                borderRadius: 4, padding: "4px 12px", fontSize: 12,
                cursor: "pointer", fontFamily: "monospace",
                fontWeight: isActive ? "bold" : "normal",
                transition: "all 0.15s",
                boxShadow: isActive ? "0 0 8px rgba(99,102,241,0.5)" : "none",
              }}>{t.label}</button>
            )
          })}
        </div>
      </div>
      {compareIdx > 0 && (
        <div style={{ fontSize: 11, color: COMPARE_OPTIONS[compareIdx].color, marginBottom: 4, opacity: 0.8 }}>
          ── {COMPARE_OPTIONS[compareIdx].label} 비교선 (좌측 축: % 변화율)
        </div>
      )}
      <div style={{ position: "relative" }}>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,13,26,0.85)", borderRadius: 4, color: "#555", fontSize: 13, gap: 6 }}>
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block" }}>⏳</motion.span>
            {tf.label} 로딩 중...
          </motion.div>
        )}
        {error && !loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#ff3b3b", fontSize: 13 }}>⚠️ {error}</div>
        )}
        <div ref={containerRef} style={{ width: "100%" }} />
      </div>
    </div>
  )
}

function SniperBox({ ticker, currency, cachedRec, isGlobalEmergency, timeframe = "5m" }) {
  const [selectedAI, setSelectedAI]     = useState("gemini")
  const [geminiData, setGeminiData]     = useState(cachedRec || null)
  const [gptData, setGptData]           = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(!cachedRec)
  const [gptLoading, setGptLoading]     = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)  // ★ 전환 중 스피너
  const [visible, setVisible]           = useState(true)

  const isMinute = timeframe === "1m" || timeframe === "5m"
  const isHourly = timeframe === "60m"
  const isDaily  = timeframe === "1d"

  // Gemini 로딩
  useEffect(() => {
    if (cachedRec) { setGeminiData(cachedRec); setGeminiLoading(false); return }
    setGeminiLoading(true)
    fetch(`${API_BASE}/api/recommend/${ticker}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setGeminiData(d); setGeminiLoading(false) })
      .catch(() => setGeminiLoading(false))
  }, [ticker, cachedRec])

  // GPT 로딩
  useEffect(() => {
    setGptLoading(true)
    fetch(`${API_BASE}/api/recommend-tech/${ticker}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setGptData(d); setGptLoading(false) })
      .catch(() => setGptLoading(false))
  }, [ticker])

  // ★ Keep-Previous: 전환 시 기존 데이터 유지하며 스피너만 표시
  const switchAI = (model) => {
    if (model === selectedAI) return
    const targetData = model === "gemini" ? geminiData : gptData
    const targetLoading = model === "gemini" ? geminiLoading : gptLoading

    setSelectedAI(model)
    setVisible(false)
    setTimeout(() => setVisible(true), 150)

    // 타겟 데이터가 없으면 즉시 로딩
    if (!targetData && !targetLoading) {
      setSwitchLoading(true)
      const url = model === "gemini"
        ? `${API_BASE}/api/recommend/${ticker}`
        : `${API_BASE}/api/recommend-tech/${ticker}`
      fetch(url).then(r => r.json()).then(d => {
        if (!d.error) {
          if (model === "gemini") setGeminiData(d)
          else setGptData(d)
        }
        setSwitchLoading(false)
      }).catch(() => setSwitchLoading(false))
    }
  }

  const isGemini = selectedAI === "gemini"
  // ★ Keep-Previous: 새 데이터 없으면 이전 모델 데이터 임시 표시
  const data = isGemini
    ? (geminiData || gptData)
    : (gptData || geminiData)
  const isLoadingCurrent = isGemini ? geminiLoading : gptLoading

  const fmt = (v) => {
    if (v === undefined || v === null || isNaN(Number(v))) return "-"
    return currency === "KRW" ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(2)}`
  }

  // ★ AI 합의 여부
  const isConsensus = geminiData && gptData && !geminiData.error && !gptData.error &&
    Math.abs((geminiData.buy1 - gptData.buy1) / geminiData.buy1) < 0.02

  const getTimestamp = () => {
    if (!data?.updated_at) return null
    const diff = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / 60000)
    if (data.is_emergency) return "🚨 긴급 업데이트됨"
    if (diff < 1) return "방금 전략 수립됨"
    if (diff < 60) return `최근 전략 수립: ${diff}분 전`
    return `최근 전략 수립: ${Math.floor(diff / 60)}시간 전`
  }

  if (geminiLoading && !geminiData) return (
    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
      style={{ marginTop: 12, background: "#0d0d1a", border: "1px solid #333", borderRadius: 8, padding: "20px", textAlign: "center", color: "#555", fontSize: 15 }}>
      ⚙️ 전략 수립 중...
    </motion.div>
  )
  if (!data || data.error) return null

  const isEmergency = data.is_emergency || isGlobalEmergency
  const modelColor = isGemini ? "#4285f4" : "#10a37f"
  const modelGlow  = isGemini
    ? "0 0 16px rgba(66,133,244,0.35)"
    : "0 0 16px rgba(16,163,127,0.35)"

  const buy1Highlight = isMinute ? { boxShadow: "0 0 14px rgba(34,197,94,0.55)", border: "1px solid #22c55e", transform: "scale(1.03)" } : {}
  const buy3Highlight = isDaily  ? { boxShadow: "0 0 14px rgba(249,115,22,0.6)",  border: "1px solid #f97316", transform: "scale(1.03)" } : {}
  const buy1Label = isMinute ? "🔍 1차 정찰대 ★단기" : isHourly ? "🔍 1차 정찰대 (중기)" : "🔍 1차 정찰대 (20%)"
  const buy3Label = isDaily  ? "🏴 3차 지하벙커 ★장기" : isHourly ? "🏴 3차 지하벙커 (중기)" : "🏴 3차 지하벙커 (50%)"
  const tfHint    = isMinute ? "단기 정찰대 타점 강조 (분봉)" : isHourly ? "중기 균형 분할 매수 (1시간봉)" : isDaily ? "장기 지하벙커 타점 강조 (일봉)" : ""

  return (
    <div style={{ marginTop: 12 }}>
      {/* ★ AI 모델 토글 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: "#555", fontSize: 11 }}>참모 선택:</span>

        <button onClick={() => switchAI("gemini")} style={{
          background: isGemini ? "#0d1a2d" : "#0d0d1a",
          color: isGemini ? "#4285f4" : "#555",
          border: `1px solid ${isGemini ? "#4285f4" : "#2a2a3a"}`,
          borderRadius: 6, padding: "4px 12px", fontSize: 12,
          cursor: "pointer", fontFamily: "monospace",
          fontWeight: isGemini ? "bold" : "normal",
          boxShadow: isGemini ? "0 0 10px rgba(66,133,244,0.4)" : "none",
          transition: "all 0.2s",
        }}>🔵 Gemini</button>

        <button onClick={() => switchAI("gpt")} style={{
          background: !isGemini ? "#0d1a14" : "#0d0d1a",
          color: !isGemini ? "#10a37f" : "#555",
          border: `1px solid ${!isGemini ? "#10a37f" : "#2a2a3a"}`,
          borderRadius: 6, padding: "4px 12px", fontSize: 12,
          cursor: "pointer", fontFamily: "monospace",
          fontWeight: !isGemini ? "bold" : "normal",
          boxShadow: !isGemini ? "0 0 10px rgba(16,163,127,0.4)" : "none",
          transition: "all 0.2s",
        }}>🟢 GPT-4o</button>

        {isConsensus && (
          <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: "#1a1a0d", color: "#ffd700", border: "1px solid #ffd70066", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: "bold" }}>
            ✨ AI 합의 완료
          </motion.span>
        )}

        {/* ★ 전환 중 스피너 */}
        {(switchLoading || (isLoadingCurrent && !data)) && (
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
            style={{ color: modelColor, fontSize: 10 }}>⚙️ 분석 중...</motion.span>
        )}

        {/* ★ GPT 데이터 없을 때 경고 */}
        {!isGemini && !gptData && !gptLoading && (
          <span style={{ color: "#facc15", fontSize: 10 }}>⏳ 데이터 수신 대기 중</span>
        )}

        <span style={{ marginLeft: "auto", color: modelColor, fontSize: 10, opacity: 0.7 }}>
          {isGemini ? "시황 중심" : "기술적 지표 중심"}
          {/* ★ 이전 모델 데이터 임시 표시 중 안내 */}
          {isGemini && !geminiData && gptData && <span style={{ color: "#facc15" }}> (이전 데이터)</span>}
          {!isGemini && !gptData && geminiData && <span style={{ color: "#facc15" }}> (이전 데이터)</span>}
        </span>
      </div>

      {tfHint && <div style={{ fontSize: 12, color: "#6366f1", marginBottom: 6, textAlign: "right", opacity: 0.8 }}>📐 {tfHint}</div>}

      {/* ★ 페이드 래퍼 */}
      <motion.div
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        style={{
          border: `1px solid ${isEmergency ? "#ff0000" : `${modelColor}44`}`,
          borderRadius: 10,
          boxShadow: isEmergency ? "0 0 20px rgba(255,0,0,0.3)" : modelGlow,
          padding: "10px",
          transition: "box-shadow 0.3s, border 0.3s",
          position: "relative",
        }}>

        {/* ★ 전환 중 오버레이 스피너 */}
        {switchLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(13,13,26,0.7)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ fontSize: 24 }}>⚙️</motion.div>
          </div>
        )}

        {/* 시나리오 */}
        <div style={{ background: isEmergency ? "#1a0000" : data.is_bad_news ? "#1a0505" : "#05101a", border: `1px solid ${isEmergency ? "#ff0000" : data.is_bad_news ? "#ff3b3b" : `${modelColor}66`}`, borderRadius: 8, padding: "12px 16px", marginBottom: 10, fontSize: 15, color: isEmergency ? "#ff6666" : data.is_bad_news ? "#ff9999" : "#93c5fd" }}>
          🎯 {data.scenario}
          {data.is_bad_news && data.discount_pct > 0 && (
            <span style={{ color: "#ff3b3b", marginLeft: 8, fontWeight: "bold" }}>[{data.discount_pct}% 벙커 하향 적용됨]</span>
          )}
        </div>

        {/* GPT 기술적 지표 */}
        {!isGemini && data.indicators && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {[
              { label: "RSI", value: data.indicators.rsi },
              { label: "MA20", value: data.indicators.ma20?.toLocaleString() },
              { label: "MA60", value: data.indicators.ma60?.toLocaleString() },
              { label: "BB상단", value: data.indicators.bb_upper?.toLocaleString() },
              { label: "BB하단", value: data.indicators.bb_lower?.toLocaleString() },
            ].map(({ label, value }) => (
              <span key={label} style={{ background: "#0d1a14", border: "1px solid #10a37f33", color: "#10a37f", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>
                {label}: {value}
              </span>
            ))}
          </div>
        )}

        {/* 타점 박스 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: "#0d2d0d", borderRadius: 8, padding: "10px 14px", textAlign: "center", transition: "all 0.3s", ...buy1Highlight, border: buy1Highlight.border || "1px solid #22c55e" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{buy1Label}</div>
            <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: 18 }}>{fmt(data.buy1)}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{isGemini ? "현재가 -3%~" : "MA/볼밴 지지"}</div>
            {isMinute && <div style={{ color: "#22c55e", fontSize: 11, marginTop: 2 }}>▶ 분봉 주목</div>}
          </div>
          <div style={{ background: "#1a2d0d", border: "1px solid #84cc16", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>⚔️ 2차 본대 (30%)</div>
            <div style={{ color: "#84cc16", fontWeight: "bold", fontSize: 18 }}>{fmt(data.buy2)}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{isGemini ? "현재가 -7%~" : "MA60 지지"}</div>
          </div>
          <div style={{ background: "#2d1a0d", borderRadius: 8, padding: "10px 14px", textAlign: "center", transition: "all 0.3s", ...buy3Highlight, border: buy3Highlight.border || "1px solid #f97316" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{buy3Label}</div>
            <div style={{ color: "#f97316", fontWeight: "bold", fontSize: 18 }}>{fmt(data.buy3)}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{isGemini ? "현재가 -12%~" : "60일 저점"}</div>
            {isDaily && <div style={{ color: "#f97316", fontSize: 11, marginTop: 2 }}>▶ 일봉 주목</div>}
          </div>
        </div>

        {/* 매도/손절 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div style={{ background: "#0d0d2d", border: `1px solid ${modelColor}88`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>🚀 매도 목표가</div>
            <div style={{ color: modelColor, fontWeight: "bold", fontSize: 18 }}>{fmt(data.sell)}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{isGemini ? "+8%" : "볼밴 상단"}</div>
          </div>
          <div style={{ background: "#2d0d0d", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>💀 손절가</div>
            <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: 18 }}>{fmt(data.stop_loss)}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{isGemini ? "-15%" : "볼밴 하단-3%"}</div>
          </div>
        </div>

        {getTimestamp() && (
          <div style={{ marginTop: 6, textAlign: "right", fontSize: 11, color: data.is_emergency ? "#ff3b3b" : modelColor, opacity: 0.6 }}>
            {isGemini ? "🔵 Gemini" : "🟢 GPT-4o"} · {getTimestamp()}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function ScoreBar({ score }) {
  const color = score >= 85 ? "#22c55e" : score >= 70 ? "#84cc16" : score >= 55 ? "#facc15" : "#f97316"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#111", borderRadius: 4, height: 7, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ color, fontWeight: "bold", fontSize: 14, minWidth: 30 }}>{score}</span>
    </div>
  )
}

function GradeBadge({ grade }) {
  const config = { "적극 매수": { color: "#fff", bg: "#dc2626" }, "매수": { color: "#fff", bg: "#16a34a" }, "관망": { color: "#fff", bg: "#d97706" }, "주의": { color: "#fff", bg: "#6b7280" } }
  const c = config[grade] || config["관망"]
  return <span style={{ background: c.bg, color: c.color, fontSize: 12, padding: "3px 8px", borderRadius: 4, fontWeight: "bold" }}>{grade}</span>
}

function SmartMoneyPicks({ picks }) {
  const [selectedAnalysis, setSelectedAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading]   = useState(false)
  const [analysisText, setAnalysisText]         = useState("")
  const [analysisRec, setAnalysisRec]           = useState(null)

  const handleRowClick = async (ticker, currency) => {
    if (selectedAnalysis === ticker) { setSelectedAnalysis(null); setAnalysisText(""); setAnalysisRec(null); return }
    setSelectedAnalysis(ticker); setAnalysisLoading(true)
    try {
      const [aRes, rRes] = await Promise.all([fetch(`${API_BASE}/api/stock-analysis/${ticker}`), fetch(`${API_BASE}/api/recommend/${ticker}`)])
      const aData = await aRes.json(); const rData = await rRes.json()
      setAnalysisText(aData.analysis || "분석 생성 실패"); setAnalysisRec({ ...rData, currency })
    } catch { setAnalysisText("분석 생성 중 오류가 발생했습니다.") }
    setAnalysisLoading(false)
  }

  if (!picks || picks.length === 0) return (
    <div style={{ background: "#13132a", borderRadius: 12, padding: 24, border: "1px solid #222", marginBottom: 24, textAlign: "center", color: "#555", fontSize: 15 }}>
      ⚙️ Smart Money Picks 계산 중... (첫 로드 시 수분 소요)
    </div>
  )
  const fmtPrice = (v, currency) => {
    if (v === undefined || v === null || isNaN(Number(v))) return "-"
    return currency === "KRW" ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(2)}`
  }
  return (
    <div style={{ background: "#13132a", borderRadius: 12, padding: 24, border: "1px solid #222", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: "bold", color: "#ffd700" }}>🏆 Final Top 10 — Smart Money Picks</div>
        <div style={{ fontSize: 12, color: "#555" }}>{picks[0] && `최근 분석: ${new Date().toLocaleDateString('ko-KR')}`}</div>
      </div>
      <AnimatePresence>
        {selectedAnalysis && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ background: "#05101a", border: "1px solid #3b82f6", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ color: "#3b82f6", fontSize: 13, marginBottom: 8, fontWeight: "bold" }}>🤖 AI 투자 분석 + 스나이퍼 타점 — {selectedAnalysis}</div>
            {analysisLoading ? (
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ color: "#555", fontSize: 14 }}>⚙️ AI 분석 생성 중...</motion.div>
            ) : (
              <>
                <div style={{ color: "#93c5fd", fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>{analysisText}</div>
                {analysisRec && !analysisRec.error && (
                  <div>
                    <div style={{ background: analysisRec.is_bad_news ? "#1a0505" : "#05101a", border: `1px solid ${analysisRec.is_bad_news ? "#ff3b3b" : "#3b82f644"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, color: analysisRec.is_bad_news ? "#ff9999" : "#93c5fd", fontSize: 14 }}>
                      🎯 {analysisRec.scenario}
                      {analysisRec.is_bad_news && analysisRec.discount_pct > 0 && <span style={{ color: "#ff3b3b", marginLeft: 8, fontWeight: "bold" }}>[{analysisRec.discount_pct}% 벙커 하향 적용됨]</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
                      {[
                        { label: "🔍 1차 (20%)", value: analysisRec.buy1,      color: "#22c55e", bg: "#0d2d0d", border: "#22c55e" },
                        { label: "⚔️ 2차 (30%)", value: analysisRec.buy2,      color: "#84cc16", bg: "#1a2d0d", border: "#84cc16" },
                        { label: "🏴 3차 (50%)", value: analysisRec.buy3,      color: "#f97316", bg: "#2d1a0d", border: "#f97316" },
                        { label: "🚀 매도",       value: analysisRec.sell,      color: "#6366f1", bg: "#0d0d2d", border: "#6366f1" },
                        { label: "💀 손절",       value: analysisRec.stop_loss, color: "#ef4444", bg: "#2d0d0d", border: "#ef4444" },
                      ].map(({ label, value, color, bg, border }) => (
                        <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: 10, textAlign: "center" }}>
                          <div style={{ color: "#aaa", fontSize: 11 }}>{label}</div>
                          <div style={{ color, fontWeight: "bold", fontSize: 14 }}>{fmtPrice(value, analysisRec.currency)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              {["#","티커","종목","섹터","AI 점수","등급","현재가","업사이드"].map(h => (
                <th key={h} style={{ padding: "9px 12px", color: "#666", textAlign: "left", fontWeight: "normal" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {picks.map((pick, i) => {
              const isSelected = selectedAnalysis === pick.ticker
              const fmt = (v) => pick.currency === "KRW" ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(2)}`
              return (
                <motion.tr key={pick.ticker} onClick={() => handleRowClick(pick.ticker, pick.currency)}
                  whileHover={{ background: "rgba(255,255,255,0.03)" }}
                  style={{ borderBottom: "1px solid #1a1a2e", cursor: "pointer", background: isSelected ? "rgba(59,130,246,0.1)" : "transparent" }}>
                  <td style={{ padding: "11px 12px", color: "#555" }}>{i + 1}</td>
                  <td style={{ padding: "11px 12px", color: "#ffd700", fontWeight: "bold" }}>{pick.ticker}</td>
                  <td style={{ padding: "11px 12px", color: "#fff" }}>{pick.name}</td>
                  <td style={{ padding: "11px 12px", color: "#aaa" }}>{pick.sector}</td>
                  <td style={{ padding: "11px 12px", minWidth: 130 }}><ScoreBar score={pick.score} /></td>
                  <td style={{ padding: "11px 12px" }}><GradeBadge grade={pick.grade} /></td>
                  <td style={{ padding: "11px 12px", color: "#fff" }}>{fmt(pick.current_price)}</td>
                  <td style={{ padding: "11px 12px", color: pick.upside >= 0 ? "#22c55e" : "#ef4444", fontWeight: "bold" }}>
                    {pick.upside >= 0 ? "+" : ""}{pick.upside?.toFixed(1)}%
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#333", marginTop: 12 }}>* RSI, 모멘텀, MA50, 거래량 트렌드 4개 팩터 기반 AI 점수 | 클릭 시 AI 분석 + 스나이퍼 타점 보기</div>
    </div>
  )
}

function MacroReport({ report }) {
  const [expanded, setExpanded] = useState(false)
  if (!report || !report.summary) return null
  return (
    <div style={{ background: "#13132a", borderRadius: 12, padding: 24, border: "1px solid #222", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: expanded ? 20 : 0 }} onClick={() => setExpanded(!expanded)}>
        <div style={{ fontSize: 17, fontWeight: "bold", color: "#a78bfa" }}>🌐 글로벌 매크로 시장 분석 및 투자 전략</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ background: "#2d1a4d", color: "#a78bfa", fontSize: 12, padding: "3px 10px", borderRadius: 4, fontWeight: "bold" }}>{report.market_phase}</span>
          <span style={{ color: "#555", fontSize: 13 }}>{expanded ? "▲ 접기" : "▼ 펼치기"}</span>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#ffd700", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>1. 현재 상황 요약</div>
              <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.8, background: "#0d0d1a", borderRadius: 8, padding: 16 }}>{report.summary}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#ffd700", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>2. 유사 과거 패턴 — <span style={{ color: "#a78bfa" }}>{report.pattern}</span></div>
              <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.8, background: "#0d0d1a", borderRadius: 8, padding: 16 }}>{report.pattern_desc}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ color: "#22c55e", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>3. 🎯 기회 알림</div>
                {report.opportunities?.map((opp, i) => (
                  <div key={i} style={{ background: "#0d2d0d", border: "1px solid #22c55e33", borderRadius: 8, padding: "10px 14px", marginBottom: 8, color: "#86efac", fontSize: 14, lineHeight: 1.6 }}>✅ {opp}</div>
                ))}
              </div>
              <div>
                <div style={{ color: "#ef4444", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>4. ⚠️ 경고 알림</div>
                {report.risks?.map((risk, i) => (
                  <div key={i} style={{ background: "#2d0d0d", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", marginBottom: 8, color: "#fca5a5", fontSize: 14, lineHeight: 1.6 }}>⚠️ {risk}</div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#333", marginTop: 12 }}>* VIX {report.vix?.toFixed(1)} | CNN 공포지수 {report.fear_greed} | 자동 생성됨</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SearchResultCard({ result, onClose, isEmergency, newsSentiment }) {
  const [activeTimeframe, setActiveTimeframe] = useState("5m")
  if (!result) return null
  const isUp = result.change_pct >= 0
  const isKR = /^\d{6}$/.test(result.ticker)
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      style={{ border: `1px solid ${isUp ? "#ff3b3b44" : "#3b82f644"}`, borderRadius: 12, padding: "16px 20px", background: "#1a1a2e", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#666", fontSize: 13 }}>{result.ticker}</span>
          <span style={{ color: "#ffd700", fontWeight: "bold", fontSize: 18 }}>🔍 검색 결과</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: "bold" }}>{result.currency === "KRW" ? `₩${result.price?.toLocaleString()}` : `$${result.price?.toFixed(2)}`}</div>
            <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 16 }}>{isUp ? "▲" : "▼"} {Math.abs(result.change_pct)?.toFixed(2)}%</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #555", color: "#aaa", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 13 }}>✕ 닫기</button>
        </div>
      </div>
      <CandleChart ticker={result.ticker} isKR={isKR} onTimeframeChange={setActiveTimeframe} livePrice={result.price} marketStatus={result.market_status} />
      <NewsSentimentGauge sentiment={newsSentiment} />
      <SniperBox ticker={result.ticker} currency={result.currency} cachedRec={result.recommendation} isGlobalEmergency={isEmergency} timeframe={activeTimeframe} />
    </motion.div>
  )
}

function StockCard({ stock, prevPrice, cachedRec, isEmergency, newsSentiment }) {
  const [flash, setFlash]                     = useState(null)
  const [expanded, setExpanded]               = useState(false)
  const [activeTimeframe, setActiveTimeframe] = useState("5m")
  const isKR = /^\d{6}$/.test(stock.ticker)

  useEffect(() => {
    if (!prevPrice || prevPrice === stock.price) return
    setFlash(stock.price > prevPrice ? "up" : "down")
    const timer = setTimeout(() => setFlash(null), 800)
    return () => clearTimeout(timer)
  }, [stock.price])

  const isUp = stock.change_pct >= 0

  return (
    <motion.div layout
      style={{ border: `1px solid ${flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : isUp ? "#ff3b3b44" : "#3b82f644"}`, borderRadius: 12, padding: "16px 20px", background: flash === "up" ? "rgba(255,59,59,0.15)" : flash === "down" ? "rgba(59,130,246,0.15)" : "#1a1a2e", marginBottom: 12, cursor: "pointer", transition: "background 0.5s, border 0.5s" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "#666", fontSize: 13 }}>{stock.ticker}</span>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 19 }}>{stock.name}</span>
          {stock.source === "KIS실시간" && (
            <span style={{ background: "#ff3b3b", color: "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}>
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
              LIVE
            </span>
          )}
          {stock.market_status && <MarketBadge status={stock.market_status} />}
          {isEmergency && (
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
              style={{ background: "#ff0000", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>🚨 긴급</motion.span>
          )}
          <span style={{ color: "#555", fontSize: 13 }}>{expanded ? "▲ 접기" : "▼ 차트"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <motion.div key={stock.price} animate={{ color: flash === "up" ? "#ff3b3b" : flash === "down" ? "#3b82f6" : "#ffffff" }}
            style={{ fontSize: 28, fontWeight: "bold" }}>
            {stock.currency === "KRW" ? `₩${stock.price?.toLocaleString()}` : `$${stock.price?.toFixed(2)}`}
          </motion.div>
          <div style={{ color: isUp ? "#ff3b3b" : "#3b82f6", fontSize: 16 }}>{isUp ? "▲" : "▼"} {Math.abs(stock.change_pct)?.toFixed(2)}%</div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            onClick={e => e.stopPropagation()}>
            <CandleChart ticker={stock.ticker} isKR={isKR} onTimeframeChange={setActiveTimeframe} livePrice={stock.price} marketStatus={stock.market_status} />
            <NewsSentimentGauge sentiment={newsSentiment} />
            <SniperBox ticker={stock.ticker} currency={stock.currency} cachedRec={cachedRec} isGlobalEmergency={isEmergency} timeframe={activeTimeframe} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── 🚀 App 루트 — WebSocket 헬스체크 + REST 폴링 폴백 ────────
export default function App() {
  const [krStocks, setKrStocks]               = useState([])
  const [usStocks, setUsStocks]               = useState([])
  const [macro, setMacro]                     = useState({})
  const [news, setNews]                       = useState(["시장 데이터 수집 중..."])
  const [fearGreed, setFearGreed]             = useState(50)
  const [marketStatus, setMarketStatus]       = useState("정규")
  const [tab, setTab]                         = useState("kr")
  const [lastUpdated, setLastUpdated]         = useState(null)
  const [recommendations, setRecommendations] = useState({})
  const [isEmergency, setIsEmergency]         = useState(false)
  const [emergencyReason, setEmergencyReason] = useState(null)
  const [searchQuery, setSearchQuery]         = useState("")
  const [searchResult, setSearchResult]       = useState(null)
  const [searchLoading, setSearchLoading]     = useState(false)
  const [smartPicks, setSmartPicks]           = useState([])
  const [macroReport, setMacroReport]         = useState({})
  const [newsSentiment, setNewsSentiment]     = useState({})
  const [sectorFlow, setSectorFlow]           = useState([])
  const [wsStatus, setWsStatus]               = useState("연결 중...")  // ★ WS 상태 표시

  const prevKr         = useRef({})
  const prevUs         = useRef({})
  const ws             = useRef(null)
  const lastMsgTime    = useRef(Date.now())
  const morningWakeRef = useRef(null)
  const pollingRef     = useRef(null)   // ★ REST 폴링 타이머
  const healthRef      = useRef(null)   // ★ 헬스체크 타이머

  const isExtremeFear     = fearGreed >= 70
  const isSentimentDanger = newsSentiment?.is_danger || newsSentiment?.score <= 30
  const showRedAlert      = isExtremeFear || isEmergency || isSentimentDanger

  // ── REST 폴링 (WS 연결 실패 시 폴백) ─────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    console.log("📡 REST 폴링 모드 전환")
    setWsStatus("REST 폴링")
    pollingRef.current = setInterval(async () => {
      try {
        const [kr, us, macro, news, fg, ms, ns, sf] = await Promise.all([
          fetch(`${API_BASE}/api/kr-stocks`).then(r => r.json()),
          fetch(`${API_BASE}/api/us-stocks`).then(r => r.json()),
          fetch(`${API_BASE}/api/macro`).then(r => r.json()),
          fetch(`${API_BASE}/api/news`).then(r => r.json()),
          fetch(`${API_BASE}/api/fear-greed`).then(r => r.json()),
          fetch(`${API_BASE}/api/market-status`).then(r => r.json()),
          fetch(`${API_BASE}/api/news-sentiment`).then(r => r.json()),
          fetch(`${API_BASE}/api/sector-flow`).then(r => r.json()),
        ])
        setKrStocks(prev => { prev.forEach(s => { prevKr.current[s.ticker] = s.price }); return kr })
        setUsStocks(prev => { prev.forEach(s => { prevUs.current[s.ticker] = s.price }); return us })
        if (Object.keys(macro).length > 0) setMacro(macro)
        if (news.length > 0) setNews(news)
        setFearGreed(fg.score)
        setMarketStatus(ms.status)
        if (ns) setNewsSentiment(ns)
        if (sf?.length > 0) setSectorFlow(sf)
        setLastUpdated(new Date().toLocaleTimeString())
      } catch (e) { console.error("폴링 오류:", e) }
    }, 5000)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  // ── WebSocket 연결 ────────────────────────────────────────────
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    ws.current = new WebSocket("wss://stock-dashboard-production-19d7.up.railway.app/ws/stocks")

    ws.current.onopen = () => {
      setWsStatus("🟢 실시간")
      lastMsgTime.current = Date.now()
      stopPolling()   // WS 연결 성공 → 폴링 중단
      console.log("✅ WebSocket 연결됨")
    }
    ws.current.onmessage = (e) => {
      lastMsgTime.current = Date.now()
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
      if (data.smart_picks?.length > 0) setSmartPicks(data.smart_picks)
      if (data.macro_report?.summary) setMacroReport(data.macro_report)
      if (data.news_sentiment) setNewsSentiment(data.news_sentiment)
      if (data.sector_flow?.length > 0) setSectorFlow(data.sector_flow)
      setLastUpdated(new Date().toLocaleTimeString())
    }
    ws.current.onclose = () => {
      setWsStatus("🔴 재연결 중...")
      console.log("WebSocket 끊김 → 3초 후 재연결")
      setTimeout(connect, 3000)
    }
    ws.current.onerror = () => ws.current?.close()
  }, [stopPolling])

  // ── 초기 로딩 + 헬스체크 타이머 ─────────────────────────────
  useEffect(() => {
    // 초기 REST 데이터
    Promise.all([
      fetch(`${API_BASE}/api/kr-stocks`).then(r => r.json()).then(setKrStocks),
      fetch(`${API_BASE}/api/us-stocks`).then(r => r.json()).then(setUsStocks),
      fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro),
      fetch(`${API_BASE}/api/news`).then(r => r.json()).then(setNews),
      fetch(`${API_BASE}/api/fear-greed`).then(r => r.json()).then(d => setFearGreed(d.score)),
      fetch(`${API_BASE}/api/market-status`).then(r => r.json()).then(d => setMarketStatus(d.status)),
      fetch(`${API_BASE}/api/smart-picks`).then(r => r.json()).then(setSmartPicks),
      fetch(`${API_BASE}/api/macro-report`).then(r => r.json()).then(setMacroReport),
      fetch(`${API_BASE}/api/news-sentiment`).then(r => r.json()).then(setNewsSentiment),
      fetch(`${API_BASE}/api/sector-flow`).then(r => r.json()).then(setSectorFlow),
    ]).catch(console.error)

    connect()

    // ★ 헬스체크: 10초 이상 메시지 없으면 폴링 전환 + 재연결
    healthRef.current = setInterval(() => {
      const gap = Date.now() - lastMsgTime.current

      if (gap > 10000 && ws.current?.readyState !== WebSocket.CONNECTING) {
        console.warn(`⚠️ WS ${Math.floor(gap/1000)}초 무응답 → 재연결 + 폴링 전환`)
        startPolling()
        if (ws.current) ws.current.close()
      }

      // 아침 8시 KST 강제 재연결
      const now = new Date()
      const kstH = (now.getUTCHours() + 9) % 24
      const kstM = now.getUTCMinutes()
      const today = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`
      const isWeekday = now.getUTCDay() !== 0 && now.getUTCDay() !== 6
      if (isWeekday && kstH === 8 && kstM === 0 && morningWakeRef.current !== today) {
        morningWakeRef.current = today
        console.log("🌅 08:00 KST 강제 재연결")
        if (ws.current) ws.current.close()
      }
    }, 5000)

    return () => {
      clearInterval(healthRef.current)
      stopPolling()
      ws.current?.close()
    }
  }, [connect, startPolling, stopPolling])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true); setSearchResult(null)
    try {
      const res  = await fetch(`${API_BASE}/api/search/${searchQuery.trim()}`)
      const data = await res.json()
      if (data.error) alert(`검색 실패: ${data.error}`)
      else setSearchResult(data)
    } catch { alert("검색 중 오류가 발생했습니다.") }
    setSearchLoading(false)
  }

  return (
    <div style={{ background: showRedAlert ? "#0d0000" : "#0d0d1a", minHeight: "100vh", color: "#fff", fontFamily: "monospace", boxShadow: showRedAlert ? "inset 0 0 60px rgba(255,0,0,0.3)" : "none", transition: "all 0.5s" }}>
      {showRedAlert && (
        <motion.div animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 0.8, repeat: Infinity }}
          style={{ position: "fixed", inset: 0, border: "4px solid #ff0000", pointerEvents: "none", zIndex: 999 }} />
      )}

      {news.length > 0 && <NewsMarquee news={news} />}

      <AnimatePresence>
        {isSentimentDanger && !isEmergency && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ background: "#1a0000", borderBottom: "1px solid #ff000044", padding: "6px 24px", color: "#ff6666", fontSize: 13, fontWeight: "bold", textAlign: "center" }}>
            🧠 AI 감성 경보: 부정 {newsSentiment?.neg_ratio}% — {newsSentiment?.decisive_reason}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEmergency && emergencyReason && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ background: "#2d0000", borderBottom: "2px solid #ff0000", padding: "8px 24px", color: "#ff6666", fontSize: 15, fontWeight: "bold", textAlign: "center" }}>
            🚨 긴급 알림: {emergencyReason} — 타점 즉시 재계산 완료
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <div style={{ background: "#13132a", padding: "12px 24px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: "bold" }}>⚡ AI STOCK TERMINAL</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
            국장: <MarketBadge status={marketStatus} />
            <span style={{ marginLeft: 8 }}>{lastUpdated ? `업데이트: ${lastUpdated}` : "연결 중..."}</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: wsStatus.includes("🟢") ? "#22c55e" : wsStatus.includes("REST") ? "#facc15" : "#ff3b3b" }}>{wsStatus}</span>
            {newsSentiment?.score !== undefined && (
              <span style={{ marginLeft: 12, color: getSentimentColor(newsSentiment.score), fontSize: 13 }}>
                🧠 심리 {newsSentiment.score} ({getSentimentLabel(newsSentiment.score)})
              </span>
            )}
          </div>
        </div>
        <FearGreedMeter score={fearGreed} />
      </div>

      {/* 매크로 + 섹터 수급 */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #1a1a2e", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
            {Object.entries(macro).map(([ticker, data]) => <MacroCard key={ticker} data={data} />)}
          </div>
          <SectorFlowTable sectorFlow={sectorFlow} />
        </div>
      </div>

      {/* 검색 */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #1a1a2e", display: "flex", gap: 8 }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="🔍 티커로 검색 (예: AAPL, 005930, 272210)"
          style={{ flex: 1, background: "#0d0d2a", border: "1px solid #333", borderRadius: 8, padding: "9px 16px", color: "#fff", fontSize: 15, fontFamily: "monospace", outline: "none" }} />
        <button onClick={handleSearch} disabled={searchLoading}
          style={{ background: "#ff3b3b", border: "none", borderRadius: 8, padding: "9px 22px", color: "#fff", fontWeight: "bold", cursor: "pointer", fontSize: 15, fontFamily: "monospace" }}>
          {searchLoading ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "1px solid #222", paddingLeft: 24 }}>
        {[["kr","🇰🇷 국내"],["us","🇺🇸 해외"],["picks","🏆 Smart Picks"],["macro","🌐 매크로 분석"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "13px 26px", background: "none", border: "none", color: tab === key ? "#fff" : "#666", borderBottom: tab === key ? "2px solid #ff3b3b" : "2px solid transparent", cursor: "pointer", fontSize: 15, fontWeight: tab === key ? "bold" : "normal", fontFamily: "monospace" }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <AnimatePresence>
          {searchResult && (
            <SearchResultCard result={searchResult} onClose={() => { setSearchResult(null); setSearchQuery("") }} isEmergency={isEmergency} newsSentiment={newsSentiment} />
          )}
        </AnimatePresence>
        {tab === "kr" && krStocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock} prevPrice={prevKr.current[stock.ticker]} cachedRec={recommendations[stock.ticker]} isEmergency={isEmergency} newsSentiment={newsSentiment} />
        ))}
        {tab === "us" && usStocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock} prevPrice={prevUs.current[stock.ticker]} cachedRec={recommendations[stock.ticker]} isEmergency={isEmergency} newsSentiment={newsSentiment} />
        ))}
        {tab === "picks" && <SmartMoneyPicks picks={smartPicks} />}
        {tab === "macro" && <MacroReport report={macroReport} />}
      </div>
    </div>
  )
}