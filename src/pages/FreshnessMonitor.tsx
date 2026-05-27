import { useState, useRef, useCallback } from "react"
import axios from "axios"
import { createClient } from "@supabase/supabase-js"
import Navbar from "@/components/Navbar"

// ── config ────────────────────────────────────────────────────────────────────
const API = "http://127.0.0.1:8000"

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY"
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Match item keyword → inventory row UUID
const ITEM_ID_MAP: Record<string, string> = {
  banana: "00000001-aaaa-bbbb-cccc-000000000001",
  tomato: "00000003-aaaa-bbbb-cccc-000000000003",
}

// ── helpers ───────────────────────────────────────────────────────────────────
const freshColor = (f: number) =>
  f >= 85 ? "#4ade80" : f >= 65 ? "#facc15" : f >= 40 ? "#fb923c" : "#f87171"

const freshGrade = (f: number) =>
  f >= 85 ? "A" : f >= 65 ? "B" : f >= 40 ? "C" : "D"

const freshAction = (f: number) =>
  f >= 85 ? "Sell at premium" : f >= 65 ? "Monitor closely" : f >= 40 ? "Discount immediately" : "Discard"

const actionMeta: Record<string, { label: string; color: string; bg: string }> = {
  SELL_PREMIUM:   { label: "Sell Premium",   color: "#4ade80", bg: "#052e16" },
  SELL_STANDARD:  { label: "Sell Standard",  color: "#86efac", bg: "#14532d" },
  DISCOUNT_FAST:  { label: "Discount Fast",  color: "#facc15", bg: "#422006" },
  CLEARANCE_SALE: { label: "Clearance Sale", color: "#fb923c", bg: "#431407" },
  CLEARANCE:      { label: "Clearance",      color: "#fbbf24", bg: "#3d1906" },
  DISCARD:        { label: "Discard",        color: "#f87171", bg: "#3f0f0f" },
}

const SCENARIOS = [
  { id: "ideal",        label: "Ideal storage",      color: "#4ade80", values: { temperature: 18, humidity: 55, co2_ppm: 400, storage_hours: 4  } },
  { id: "morning",      label: "Morning market",      color: "#facc15", values: { temperature: 26, humidity: 65, co2_ppm: 415, storage_hours: 8  } },
  { id: "afternoon",    label: "Afternoon heat",      color: "#fb923c", values: { temperature: 36, humidity: 72, co2_ppm: 440, storage_hours: 18 } },
  { id: "monsoon",      label: "Monsoon",             color: "#60a5fa", values: { temperature: 29, humidity: 88, co2_ppm: 430, storage_hours: 12 } },
  { id: "cold_storage", label: "Cold storage",        color: "#a78bfa", values: { temperature: 8,  humidity: 60, co2_ppm: 390, storage_hours: 48 } },
  { id: "critical",     label: "Critical — spoilage", color: "#f87171", values: { temperature: 38, humidity: 82, co2_ppm: 560, storage_hours: 30 } },
]

const SENSOR_CFG = [
  { key: "temperature",   label: "Temperature",   unit: "°C",  min: 0,   max: 50,  step: 0.5, warn: 32, danger: 36 },
  { key: "humidity",      label: "Humidity",       unit: "%",   min: 20,  max: 100, step: 1,   warn: 75, danger: 85 },
  { key: "co2_ppm",       label: "CO₂",            unit: " ppm",min: 350, max: 700, step: 5,   warn: 450,danger: 550 },
  { key: "storage_hours", label: "Hrs in storage", unit: "h",   min: 0,   max: 72,  step: 1,   warn: 20, danger: 36 },
]
const LIGHT_OPTS = ["dark storage", "low light", "moderate", "bright sunlight"]

// ── shared UI components ──────────────────────────────────────────────────────
function RadialGauge({ value, max = 100, label, color, size = 88 }: any) {
  const r = size * 0.4, circ = 2 * Math.PI * r
  const dash = circ * Math.min(value / max, 1)
  const dv = typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2a1a" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={size/2} y={size/2+5} textAnchor="middle" fill={color}
          style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{dv}</text>
      </svg>
      <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>{label}</span>
    </div>
  )
}

function ProbBar({ label, value }: any) {
  const pct = (value * 100).toFixed(1)
  const color = label.toLowerCase().includes("ripe") && !label.toLowerCase().includes("over")
    ? "#4ade80" : label.toLowerCase().includes("unripe") ? "#facc15"
    : label.toLowerCase().includes("over") ? "#fb923c" : "#f87171"
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "capitalize" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: "#1e2a1a", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
    </div>
  )
}

function Pill({ text, color = "#4ade80", bg = "#052e16" }: any) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color, background: bg, border: `1px solid ${color}33` }}>
      {text}
    </span>
  )
}

function Section({ title, children, accent = "#4ade80" }: any) {
  return (
    <div style={{ background: "#0d1a0e", border: "1px solid #1e2a1a", borderRadius: 12, padding: "18px 22px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 3, height: 15, background: accent, borderRadius: 2 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#6b7280", textTransform: "uppercase" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Badge({ text, color = "#4ade80", icon = "" }: any) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color, background: `${color}18`, border: `1px solid ${color}40` }}>
      {icon && <span>{icon}</span>}{text}
    </span>
  )
}

function ShelfLifeClock({ hours, shelfDays }: any) {
  const pct = Math.min(hours / 72, 1)
  const urgency = hours <= 12 ? "#f87171" : hours <= 24 ? "#fb923c" : hours <= 48 ? "#facc15" : "#4ade80"
  const r = 28, circ = 2 * Math.PI * r, dash = circ * pct
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#0a130a", borderRadius: 10, border: `1px solid ${urgency}30` }}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={r} fill="none" stroke="#1e2a1a" strokeWidth={6} />
        <circle cx={35} cy={35} r={r} fill="none" stroke={urgency} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 35 35)" style={{ transition: "all 0.6s" }} />
        <text x={35} y={33} textAnchor="middle" fill={urgency}
          style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{hours}h</text>
        <text x={35} y={46} textAnchor="middle" fill="#6b7280" style={{ fontSize: 8 }}>left</text>
      </svg>
      <div>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1, marginBottom: 4 }}>TIME PRESSURE</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: urgency }}>
          {hours <= 12 ? "⚠ Act immediately" : hours <= 24 ? "Sell today" : hours <= 48 ? "Sell within 2 days" : "Good window"}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
          {shelfDays} day{shelfDays !== 1 ? "s" : ""} · ~{hours}h before spoilage
        </div>
      </div>
    </div>
  )
}

function ConfidenceBanner({ isReliable, reason, priceSource }: any) {
  if (isReliable) return null
  return (
    <div style={{ padding: "14px 18px", borderRadius: 10, marginBottom: 14, background: "#1a0a00", border: "1px solid #fb923c60" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fb923c" }}>
          {reason?.includes("flat_distribution") ? "Multi-item or background scene detected" : "Low vision confidence — scan overridden"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#d97706", lineHeight: 1.7, marginBottom: 8 }}>
        {reason?.includes("flat_distribution")
          ? "The camera saw multiple fruit types or a cluttered background."
          : `Vision model confidence is below the safe threshold (${reason?.split(":")[1] || "?"}). Pricing unreliable.`}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge text="YOLO BYPASSED" color="#fb923c" icon="🚫" />
        <Badge text={`PRICE SOURCE: ${priceSource?.replace("_", " ").toUpperCase()}`} color="#facc15" icon="🌡" />
        <Badge text="LLM OVERRIDE ACTIVE" color="#a78bfa" icon="🤖" />
      </div>
    </div>
  )
}

// ── IoT Panel ─────────────────────────────────────────────────────────────────
function IoTPanel({ sensors, onUpdate }: any) {
  const [activePreset, setPreset] = useState<string | null>(null)
  const applyPreset = (s: any) => { setPreset(s.id); onUpdate((p: any) => ({ ...p, ...s.values })) }
  const updateSensor = (key: string, val: any) => { setPreset(null); onUpdate((p: any) => ({ ...p, [key]: val })) }
  const getAlerts = () => {
    const a: any[] = []
    if (sensors.temperature >= 36) a.push({ level: "danger",  msg: `${sensors.temperature}°C critical — spoilage 2–3× faster` })
    else if (sensors.temperature >= 32) a.push({ level: "warning", msg: `${sensors.temperature}°C elevated — monitor closely` })
    if (sensors.humidity >= 85) a.push({ level: "danger",  msg: `${sensors.humidity}% humidity — mould risk within hours` })
    else if (sensors.humidity >= 75) a.push({ level: "warning", msg: `${sensors.humidity}% humidity — consider ventilation` })
    if (sensors.co2_ppm >= 550) a.push({ level: "danger",  msg: `CO2 ${sensors.co2_ppm}ppm — active decomposition` })
    else if (sensors.co2_ppm >= 450) a.push({ level: "warning", msg: `CO2 ${sensors.co2_ppm}ppm — poor air circulation` })
    if (sensors.storage_hours >= 36) a.push({ level: "danger",  msg: `Stored ${sensors.storage_hours}h — condition check required` })
    else if (sensors.storage_hours >= 20) a.push({ level: "warning", msg: `Stored ${sensors.storage_hours}h — approaching safe limit` })
    if (sensors.ambient_light === "bright sunlight") a.push({ level: "warning", msg: "Direct sunlight — UV stress and local heat" })
    return a
  }
  const alerts = getAlerts()
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Storage scenario presets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => applyPreset(s)} style={{
              padding: "9px 8px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${activePreset === s.id ? s.color : "#2d4a2e"}`,
              background: activePreset === s.id ? `${s.color}15` : "#0a130a",
              color: activePreset === s.id ? s.color : "#9ca3af",
              fontSize: 10, fontWeight: activePreset === s.id ? 700 : 400,
              textAlign: "left", lineHeight: 1.4, transition: "all 0.15s"
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      {SENSOR_CFG.map(cfg => {
        const val = sensors[cfg.key] ?? cfg.min
        const color = val >= cfg.danger ? "#f87171" : val >= cfg.warn ? "#facc15" : "#4ade80"
        return (
          <div key={cfg.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#d1d5db" }}>{cfg.label}</span>
              <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color, background: `${color}18`, padding: "1px 8px", borderRadius: 4 }}>
                {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}{cfg.unit}
              </span>
            </div>
            <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={val}
              onChange={e => updateSensor(cfg.key, +e.target.value)} style={{ width: "100%", accentColor: color }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4b5563", marginTop: 2 }}>
              <span>{cfg.min}{cfg.unit}</span>
              <span style={{ color: "#facc1560" }}>warn {cfg.warn}</span>
              <span style={{ color: "#f8717160" }}>crit {cfg.danger}</span>
              <span>{cfg.max}{cfg.unit}</span>
            </div>
          </div>
        )
      })}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 8 }}>Ambient light</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LIGHT_OPTS.map(opt => (
            <button key={opt} onClick={() => updateSensor("ambient_light", opt)} style={{
              padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
              border: `1px solid ${sensors.ambient_light === opt ? "#4ade80" : "#2d4a2e"}`,
              background: sensors.ambient_light === opt ? "#1e2a1a" : "transparent",
              color: sensors.ambient_light === opt ? "#4ade80" : "#6b7280",
              fontWeight: sensors.ambient_light === opt ? 600 : 400,
            }}>{opt}</button>
          ))}
        </div>
      </div>
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1, marginBottom: 8 }}>SMART RISK ALERTS</div>
          {alerts.map((a, i) => (
            <div key={i} style={{
              padding: "7px 12px", borderRadius: 7, fontSize: 11, marginBottom: 6,
              border: `1px solid ${a.level === "danger" ? "#f87171" : "#facc15"}40`,
              background: a.level === "danger" ? "#1a0505" : "#1a1200",
              color: a.level === "danger" ? "#f87171" : "#facc15"
            }}>{a.msg}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
export default function FreshnessMonitor() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [itemName, setItemName] = useState("banana")
  const [basePrice, setBasePrice] = useState(40)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState("analysis")
  const [scanTime, setScanTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dbStatus, setDbStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const fileRef = useRef<HTMLInputElement>(null)

  const [sensors, setSensors] = useState({
    temperature: 26,
    humidity: 65,
    co2_ppm: 415,
    storage_hours: 8,
    ambient_light: "moderate",
  })

  // ── Supabase: update unit_price + freshness columns for matched item ─────────
  const updateInventoryPrice = async (data: any) => {
    // Match first word of item_name, e.g. "banana" or "tomato"
    const key = (data.item_name as string)?.toLowerCase().split(" ")[0]
    const id  = ITEM_ID_MAP[key]
    if (!id) {
      console.warn(`updateInventoryPrice: no ID mapped for "${key}" — skipping`)
      return
    }

    setDbStatus("saving")

    const aiPrice   = Number(data.recommended_price)            || 0
    const freshness = Number(data.signals?.freshness)           || 0
    const grade     = data.market_context?.freshness_grade      ?? freshGrade(freshness)
    const action    = freshAction(freshness)
    const discount  = Number(data.decision?.suggested_discount_pct) || 0
    const spoilage  = Number(data.market_context?.spoilage_hours)   || 48

    const { error: dbErr } = await supabase
      .from("inventory")
      .update({
        unit_price:           aiPrice,   // ← live price column updated to AI price
        ai_recommended_price: aiPrice,
        freshness_score:      freshness,
        freshness_grade:      grade,
        freshness_action:     action,
        discount_percent:     discount,
        spoilage_hours:       spoilage,
        last_scanned_at:      new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      })
      .eq("id", id)

    if (dbErr) {
      console.error("Supabase update error:", dbErr.message)
      setDbStatus("failed")
    } else {
      console.log(`✅ unit_price → Rs.${aiPrice} for ${key} (${id})`)
      setDbStatus("saved")
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); setDbStatus("idle")
  }
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith("image/")) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); setDbStatus("idle")
  }, [])

  const handleAnalyze = async () => {
    if (!file) { setError("Upload an image first"); return }
    setError(null); setDbStatus("idle")
    try {
      setLoading(true)
      const t0 = performance.now()
      const formData = new FormData()
      formData.append("file", file)
      const params = new URLSearchParams({
        item_name: itemName,
        base_price: String(basePrice),
        temperature: String(sensors.temperature),
        humidity: String(sensors.humidity),
        co2_ppm: String(sensors.co2_ppm),
        storage_hours: String(sensors.storage_hours),
        ambient_light: sensors.ambient_light,
      })
      const res = await axios.post(
        `${API}/analyze?${params.toString()}`, formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      setScanTime(((performance.now() - t0) / 1000).toFixed(2))
      setResult(res.data)
      setTab("analysis")

      // ── Push AI price directly into inventory.unit_price ──
      await updateInventoryPrice(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || "Analysis failed — is the FastAPI server running on port 8000?")
    } finally { setLoading(false) }
  }

  const handleConfirm = async () => {
    if (!result) return
    try {
      await axios.post(`${API}/confirm`, {
        item_name: result.item_name, action: result.decision.action,
        freshness: result.signals.freshness, price: result.recommended_price,
        base_price: result.base_price, season: result.market_context.season,
        time_of_day: result.market_context.time_of_day,
      })
      alert("✅ Action confirmed — market observation saved to RAG memory!")
    } catch { alert("Could not reach /confirm endpoint.") }
  }

  const decision     = result?.decision
  const actionStyle  = decision ? (actionMeta[decision.action] || actionMeta.CLEARANCE) : null
  const isReliable   = result?.is_reliable ?? true
  const confReason   = result?.confidence_reason
  const priceSource  = result?.price_source
  const explanation  = result?.explanation
  const explText     = typeof explanation === "string" ? explanation : explanation?.explanation || ""
  const cacheHit     = explanation?.cache_hit
  const llmCalled    = explanation?.llm_called
  const overrideMode = explanation?.override_mode
  const iotNotes     = result?.signals?.iot_notes || []
  const spoilHours   = result?.market_context?.spoilage_hours ?? 48
  const shelfDays    = result?.signals?.shelf_life ?? 0

  // DB status pill config
  const dbPill = {
    saving: { text: "SAVING TO DB...", color: "#facc15", icon: "⏳" },
    saved:  { text: "INVENTORY UPDATED",color: "#4ade80", icon: "✅" },
    failed: { text: "DB UPDATE FAILED", color: "#f87171", icon: "❌" },
  }[dbStatus] ?? null

  return (
    <div style={{ minHeight: "100vh", background: "#070e07", color: "#e5e7eb", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@300;400;600;700&family=Space+Grotesk:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d1a0e}::-webkit-scrollbar-thumb{background:#2d4a2e;border-radius:4px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{opacity:0.4}50%{opacity:1}100%{opacity:0.4}}
        .result-in{animation:fadeIn 0.4s ease forwards}
        .shimmer{animation:shimmer 2s infinite}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;background:#1e2a1a;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#4ade80;cursor:pointer}
      `}</style>

      {/* ── YOUR SHARED NAVBAR ── */}
      <Navbar />

      {/* ── SCAN STATUS BAR (only when there's a result) ── */}
      {result && (
        <div style={{ background: "#0a130a", borderBottom: "1px solid #1e2a1a", padding: "6px 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginRight: 4 }}>SCAN STATUS</span>
          {cacheHit     && <Badge text="CACHE HIT"     color="#a78bfa" icon="⚡" />}
          {!cacheHit && llmCalled && <Badge text="LLM CALLED" color="#f472b6" icon="🤖" />}
          {overrideMode && <Badge text="OVERRIDE MODE" color="#fb923c" icon="⚠"  />}
          {result?.signals?.iot_adjusted && <Badge text="IoT ADJUSTED" color="#4ade80" icon="📡" />}
          {dbPill       && <Badge text={dbPill.text}   color={dbPill.color} icon={dbPill.icon} />}
          {scanTime && (
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#4ade8060", fontFamily: "'IBM Plex Mono',monospace" }}>
              Completed in {scanTime}s
            </span>
          )}
        </div>
      )}

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 20px" }}>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 2, marginBottom: 22, background: "#0d1a0e", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[
            ["analysis", "📊 Analysis"],
            ["iot",      "📡 IoT Sensors"],
            ["pipeline", "🔁 Pipeline"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              background: tab === key ? "#1e2a1a" : "transparent",
              color:      tab === key ? "#4ade80" : "#6b7280",
              transition: "all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            ANALYSIS TAB
        ══════════════════════════════════════════ */}
        <div style={{ display: tab === "analysis" ? "grid" : "none", gridTemplateColumns: "370px 1fr", gap: 18, alignItems: "start" }}>

          {/* LEFT — scan controls */}
          <div>
            <Section title="Product Scan" accent="#4ade80">
              {/* Image drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{ border: `2px dashed ${preview ? "#4ade8060" : "#2d4a2e"}`, borderRadius: 10, height: 190, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", background: preview ? "#000" : "#0a130a", marginBottom: 14 }}
              >
                {preview
                  ? <img src={preview} alt="" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                  : <div style={{ textAlign: "center", color: "#3d5c3e" }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: 11, letterSpacing: 1 }}>TAP OR DROP IMAGE</div>
                      <div style={{ fontSize: 9, color: "#2d4a2e", marginTop: 4 }}>Single fruit on plain background = best results</div>
                    </div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              </div>

              {/* Product + price */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 9, letterSpacing: 1, color: "#6b7280", display: "block", marginBottom: 5 }}>PRODUCT</label>
                  <select value={itemName} onChange={e => setItemName(e.target.value)} style={{ width: "100%", padding: "9px 10px", background: "#0a130a", border: "1px solid #2d4a2e", borderRadius: 7, color: "#e5e7eb", fontSize: 12, outline: "none" }}>
                    <option value="banana">🍌 Banana</option>
                    <option value="tomato">🍅 Tomato</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, letterSpacing: 1, color: "#6b7280", display: "block", marginBottom: 5 }}>BASE PRICE (Rs.)</label>
                  <input type="number" value={basePrice} onChange={e => setBasePrice(+e.target.value)} style={{ width: "100%", padding: "9px 10px", background: "#0a130a", border: "1px solid #2d4a2e", borderRadius: 7, color: "#e5e7eb", fontSize: 12, outline: "none" }} />
                </div>
              </div>

              {/* Live IoT context summary */}
              <div style={{ background: "#0a130a", border: "1px solid #1e2a1a", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: 1, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>📡 LIVE IOT CONTEXT</span>
                  <span style={{ color: "#6b7280" }}>edit in IoT Sensors tab →</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {[
                    ["Temp",    `${sensors.temperature}°C`, sensors.temperature >= 36 ? "#f87171" : sensors.temperature >= 32 ? "#facc15" : "#4ade80"],
                    ["Humidity",`${sensors.humidity}%`,      sensors.humidity >= 85 ? "#f87171" : sensors.humidity >= 75 ? "#facc15" : "#4ade80"],
                    ["CO2",     `${sensors.co2_ppm}ppm`,     sensors.co2_ppm >= 550 ? "#f87171" : sensors.co2_ppm >= 450 ? "#facc15" : "#4ade80"],
                    ["Stored",  `${sensors.storage_hours}h`, sensors.storage_hours >= 36 ? "#f87171" : sensors.storage_hours >= 20 ? "#facc15" : "#4ade80"],
                  ].map(([k, v, c]) => (
                    <div key={k} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <span style={{ color: "#6b7280" }}>{k}: </span>
                      <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: "8px 12px", background: "#1a0505", border: "1px solid #f8717140", borderRadius: 7, fontSize: 11, color: "#f87171", marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button onClick={handleAnalyze} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 9, border: "none", background: loading ? "#1e2a1a" : "#166534", color: loading ? "#6b7280" : "#4ade80", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading ? "default" : "pointer", transition: "all 0.2s" }}>
                {loading ? <span className="shimmer">ANALYZING...</span> : "▶ RUN ANALYSIS"}
              </button>

              {/* DB status feedback under button */}
              {dbPill && (
                <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 7, background: `${dbPill.color}10`, border: `1px solid ${dbPill.color}30`, fontSize: 10, color: dbPill.color, textAlign: "center", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>
                  {dbPill.icon} {dbPill.text} — inventory.unit_price updated
                </div>
              )}
              {scanTime && !loading && dbStatus === "idle" && (
                <div style={{ textAlign: "center", fontSize: 9, color: "#4ade8060", marginTop: 7, fontFamily: "'IBM Plex Mono',monospace" }}>
                  Scan completed in {scanTime}s
                </div>
              )}
            </Section>
          </div>

          {/* RIGHT — results */}
          <div>
            {!result && (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#2d4a2e", border: "1px dashed #1e2a1a", borderRadius: 12 }}>
                <div style={{ fontSize: 44 }}>🧪</div>
                <div style={{ fontSize: 11, letterSpacing: 2 }}>AWAITING SCAN</div>
              </div>
            )}

            {result && (
              <div className="result-in">
                <ConfidenceBanner isReliable={isReliable} reason={confReason} priceSource={priceSource} />

                {/* Price hero */}
                <div style={{ background: actionStyle?.bg || "#0d1a0e", border: `1px solid ${actionStyle?.color || "#4ade80"}30`, borderRadius: 12, padding: "20px 24px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, marginBottom: 5 }}>RECOMMENDED PRICE → SAVED TO INVENTORY</div>
                    <div style={{ fontSize: 52, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: actionStyle?.color || "#4ade80", lineHeight: 1, opacity: isReliable ? 1 : 0.7 }}>
                      Rs.{result.recommended_price}
                      {!isReliable && <span style={{ fontSize: 12, marginLeft: 8, color: "#fb923c" }}>⚠ estimate</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 5, fontFamily: "'IBM Plex Mono',monospace" }}>
                      Base Rs.{result.base_price} → {isReliable ? `ML Rs.${result.ml_price_raw}` : "IoT estimate"} → Final Rs.{result.recommended_price}
                    </div>
                    {priceSource && (
                      <div style={{ marginTop: 6 }}>
                        <Badge text={priceSource === "xgboost_ml" ? "XGBoost ML" : "IoT Fallback"} color={priceSource === "xgboost_ml" ? "#4ade80" : "#fb923c"} icon={priceSource === "xgboost_ml" ? "🤖" : "🌡"} />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: actionStyle?.color, letterSpacing: 0.5, padding: "9px 18px", border: `1px solid ${actionStyle?.color}40`, borderRadius: 9, background: `${actionStyle?.color}10` }}>
                      {actionStyle?.label}
                    </div>
                    {decision.suggested_discount_pct > 0 && (
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#facc15", marginTop: 7 }}>
                        -{decision.suggested_discount_pct}% OFF
                      </div>
                    )}
                  </div>
                </div>

                {/* Shelf life clock */}
                <div style={{ marginBottom: 14 }}>
                  <ShelfLifeClock hours={spoilHours} shelfDays={shelfDays} />
                </div>

                {/* Freshness gauges */}
                <Section title="Freshness Intelligence" accent="#4ade80">
                  <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                    <RadialGauge value={result.signals.freshness} max={100} label="Freshness %" color={freshColor(result.signals.freshness)} />
                    <RadialGauge value={+(result.signals.risk * 100).toFixed(0)} max={100} label="Spoilage Risk %" color="#f87171" />
                    <RadialGauge value={result.signals.shelf_life} max={7} label="Shelf Life days" color="#facc15" />
                    <RadialGauge value={result.signals.dominant_conf || 0} max={100} label="Model Conf %" color={isReliable ? "#60a5fa" : "#fb923c"} />
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
                    <Pill text={result.market_context.freshness_grade} color={freshColor(result.signals.freshness)} bg={`${freshColor(result.signals.freshness)}15`} />
                    <Pill text={result.signals.quality}  color="#60a5fa" bg="#0c1a2e" />
                    <Pill text={result.signals.urgency}  color="#fb923c" bg="#1a0e00" />
                    <Pill text={result.market_context.season} color="#a78bfa" bg="#150d2e" />
                    {result.market_context.is_weekend   && <Pill text="weekend"     color="#34d399" bg="#021f14" />}
                    {result.signals.iot_adjusted        && <Pill text="IoT adjusted" color="#4ade80" bg="#052e16" />}
                  </div>
                  {iotNotes.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {iotNotes.map((note: string, i: number) => (
                        <div key={i} style={{ fontSize: 10, color: "#4ade80", padding: "4px 10px", borderLeft: "2px solid #4ade8040", marginBottom: 4, background: "#0a130a", borderRadius: "0 6px 6px 0" }}>
                          📡 {note}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Vision probabilities */}
                <Section title="Vision AI — Class Probabilities" accent={isReliable ? "#60a5fa" : "#fb923c"}>
                  {Object.entries(result.yolo_prediction).sort((a: any, b: any) => b[1] - a[1]).map(([cls, prob]: any) => (
                    <ProbBar key={cls} label={cls} value={prob} />
                  ))}
                </Section>

                {/* Market context */}
                <Section title="Market Context" accent="#a78bfa">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
                    {[
                      ["Demand", result.market_context.demand_score],
                      ["Stock",  result.market_context.stock],
                      ["Noise",  result.market_context.market_noise],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: "#0a130a", borderRadius: 7, padding: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#a78bfa" }}>{v}</div>
                        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, marginTop: 3 }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  {result.market_context.alerts?.map((a: string, i: number) => (
                    <div key={i} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "#1a0e00", border: "1px solid #fb923c40", fontSize: 11, color: "#fb923c" }}>{a}</div>
                  ))}
                </Section>

                {/* Decision engine */}
                <Section title="Decision Engine" accent={actionStyle?.color || "#4ade80"}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: "#0a130a", borderRadius: 7, padding: 10 }}>
                      <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, marginBottom: 3 }}>ACTION</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: actionStyle?.color }}>{decision.action}</div>
                    </div>
                    <div style={{ background: "#0a130a", borderRadius: 7, padding: 10 }}>
                      <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, marginBottom: 3 }}>PRIORITY</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", textTransform: "uppercase" }}>{decision.priority}</div>
                    </div>
                  </div>
                  <div style={{ background: "#0a130a", borderRadius: 7, padding: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, marginBottom: 3 }}>VENDOR INSTRUCTION</div>
                    <div style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.7 }}>{decision.inventory_action}</div>
                  </div>
                  <div style={{ background: "#0a130a", borderRadius: 7, padding: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, marginBottom: 3 }}>RATIONALE</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{decision.rationale}</div>
                  </div>
                  <button onClick={handleConfirm} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${actionStyle?.color}40`, background: `${actionStyle?.color}10`, color: actionStyle?.color, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
                    ✅ CONFIRM I FOLLOWED THIS RECOMMENDATION
                  </button>
                </Section>

                {/* RAG / LLM explanation */}
                <Section title={overrideMode ? "LLM Override Explanation" : "RAG + LLM Explanation"} accent={overrideMode ? "#fb923c" : "#f472b6"}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span>Groq LLaMA 3.3 70B · FAISS</span>
                    {cacheHit     && <Badge text="CACHE HIT — LLM SKIPPED" color="#a78bfa" icon="⚡" />}
                    {overrideMode && <Badge text="OVERRIDE MODE"           color="#fb923c" icon="⚠" />}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.9, color: "#d1d5db", fontStyle: "italic" }}>"{explText}"</p>
                  {explanation?.retrieved_docs?.length > 0 && (
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ fontSize: 10, color: "#6b7280", cursor: "pointer", letterSpacing: 1 }}>
                        RETRIEVED KNOWLEDGE ({explanation.retrieved_docs.length} docs)
                      </summary>
                      <div style={{ marginTop: 7 }}>
                        {explanation.retrieved_docs.map((doc: string, i: number) => (
                          <div key={i} style={{ fontSize: 10, color: "#6b7280", padding: "4px 8px", borderLeft: "2px solid #f472b640", marginBottom: 3 }}>{doc}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </Section>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            IOT TAB
        ══════════════════════════════════════════ */}
        <div style={{ display: tab === "iot" ? "block" : "none", maxWidth: 680 }}>
          <Section title="IoT Sensor Control — Environmental Intelligence" accent="#4ade80">
            <IoTPanel sensors={sensors} onUpdate={setSensors} />
          </Section>
        </div>

        {/* ══════════════════════════════════════════
            PIPELINE TAB
        ══════════════════════════════════════════ */}
        <div style={{ display: tab === "pipeline" ? "block" : "none", maxWidth: 760 }}>
          <Section title="System Architecture — Intelligence Pipeline (v3)" accent="#60a5fa">
            {[
              { n: "01", name: "Vision AI",           tech: "YOLOv8s · Confidence Guard",         color: "#60a5fa", desc: "YOLO runs on image. If top-1 confidence < 55% OR distribution is flat, result is flagged unreliable — ML pricing bypassed, LLM override fires." },
              { n: "02", name: "Signal Engine + IoT", tech: "Q10 rule · Mould threshold",          color: "#4ade80", desc: "Converts YOLO probs to freshness/risk/shelf_life. IoT modifiers apply Q10 halving, mould risk, CO2 respiration, storage-hour decay." },
              { n: "03", name: "Market Context",      tech: "Deterministic demand · Season",       color: "#a78bfa", desc: "Time-aware market context. Demand = f(time, season, weekend). Spoilage hours surfaced as headline time-pressure signal." },
              { n: "04", name: "ML Pricing",          tech: "XGBoost · IoT-adjusted input",        color: "#f472b6", desc: "XGBoost predicts price from 10 features. Freshness input is IoT-adjusted. Skipped if YOLO unreliable — IoT fallback used instead." },
              { n: "05", name: "Decision Engine",     tech: "Rule-based · Discount % · Log",       color: "#facc15", desc: "Converts price to vendor instruction: action, discount %, rationale. Logs to decision_log.jsonl." },
              { n: "06", name: "Memory Cache",        tech: "FAISS score ≥ 0.92 → skip LLM",       color: "#34d399", desc: "Checks explanation_cache.jsonl before calling Groq. Same item+action+freshness-bucket+IoT-hash → returns cached explanation." },
              { n: "07", name: "RAG + LLM",           tech: "FAISS · Shelf-life prompt · Override", color: "#fb923c", desc: "Normal: shelf-life-led prompt to Groq LLaMA 3.3 70B. Override: IoT-only reasoning when YOLO unreliable." },
              { n: "08", name: "Supabase Price Sync", tech: "inventory.unit_price ← AI price",      color: "#4ade80", desc: "After every scan, unit_price is overwritten with the AI-recommended price. Also writes freshness_score, freshness_grade, freshness_action, discount_percent, spoilage_hours, and last_scanned_at." },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 18, position: "relative" }}>
                {i < arr.length - 1 && (
                  <div style={{ position: "absolute", left: 17, top: 40, width: 2, height: "calc(100% + 4px)", background: "#1e2a1a" }} />
                )}
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${step.color}15`, border: `1px solid ${step.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: step.color }}>{step.n}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: step.color }}>{step.name}</span>
                    <span style={{ fontSize: 9, color: "#6b7280", fontFamily: "'IBM Plex Mono',monospace" }}>{step.tech}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </Section>
        </div>

      </div>
    </div>
  )
}