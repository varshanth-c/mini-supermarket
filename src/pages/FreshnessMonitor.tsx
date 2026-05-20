import { useState, useRef, useCallback } from "react"
import axios from "axios"

const API = "http://127.0.0.1:8000"

// ─── colour helpers ──────────────────────────────────────────────────
const freshColor = f =>
  f >= 85 ? "#4ade80" : f >= 65 ? "#facc15" : f >= 40 ? "#fb923c" : "#f87171"

const actionMeta = {
  SELL_PREMIUM:   { label: "Sell Premium",   color: "#4ade80", bg: "#052e16" },
  SELL_STANDARD:  { label: "Sell Standard",  color: "#86efac", bg: "#14532d" },
  DISCOUNT_FAST:  { label: "Discount Fast",  color: "#facc15", bg: "#422006" },
  CLEARANCE_SALE: { label: "Clearance Sale", color: "#fb923c", bg: "#431407" },
  CLEARANCE:      { label: "Clearance",      color: "#fbbf24", bg: "#3d1906" },
  DISCARD:        { label: "Discard",        color: "#f87171", bg: "#3f0f0f" },
}

// ─── scenario presets (mirrors backend IoTControlPanel) ──────────────
const SCENARIOS = [
  { id:"ideal",         label:"Ideal storage",      color:"#4ade80", values:{ temperature:18, humidity:55, co2_ppm:400, storage_hours:4  } },
  { id:"morning",       label:"Morning market",      color:"#facc15", values:{ temperature:26, humidity:65, co2_ppm:415, storage_hours:8  } },
  { id:"afternoon",     label:"Afternoon heat",      color:"#fb923c", values:{ temperature:36, humidity:72, co2_ppm:440, storage_hours:18 } },
  { id:"monsoon",       label:"Monsoon",             color:"#60a5fa", values:{ temperature:29, humidity:88, co2_ppm:430, storage_hours:12 } },
  { id:"cold_storage",  label:"Cold storage",        color:"#a78bfa", values:{ temperature:8,  humidity:60, co2_ppm:390, storage_hours:48 } },
  { id:"critical",      label:"Critical — spoilage", color:"#f87171", values:{ temperature:38, humidity:82, co2_ppm:560, storage_hours:30 } },
]

const SENSOR_CFG = [
  { key:"temperature",   label:"Temperature",     unit:"°C",  min:0,   max:50,  step:0.5, warn:32, danger:36 },
  { key:"humidity",      label:"Humidity",         unit:"%",   min:20,  max:100, step:1,   warn:75, danger:85 },
  { key:"co2_ppm",       label:"CO₂",              unit:" ppm",min:350, max:700, step:5,   warn:450,danger:550 },
  { key:"storage_hours", label:"Hrs in storage",   unit:"h",   min:0,   max:72,  step:1,   warn:20, danger:36 },
]
const LIGHT_OPTS = ["dark storage","low light","moderate","bright sunlight"]

// ─── small components ────────────────────────────────────────────────

function RadialGauge({ value, max=100, label, color, size=88 }) {
  const r    = size*0.4
  const circ = 2*Math.PI*r
  const dash = circ * Math.min(value/max, 1)
  const displayVal = typeof value==="number"
    ? (Number.isInteger(value) ? value : value.toFixed(1))
    : value
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2a1a" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:"stroke-dasharray 0.6s ease" }}/>
        <text x={size/2} y={size/2+5} textAnchor="middle" fill={color}
          style={{ fontSize:12,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700 }}>
          {displayVal}
        </text>
      </svg>
      <span style={{ fontSize:9,color:"#6b7280",letterSpacing:1,textTransform:"uppercase",textAlign:"center" }}>{label}</span>
    </div>
  )
}

function ProbBar({ label, value }) {
  const pct = (value*100).toFixed(1)
  const color = label.toLowerCase().includes("ripe") && !label.toLowerCase().includes("over")
    ? "#4ade80" : label.toLowerCase().includes("unripe") ? "#facc15"
    : label.toLowerCase().includes("over") ? "#fb923c" : "#f87171"
  return (
    <div style={{ marginBottom:7 }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
        <span style={{ fontSize:11,color:"#9ca3af",textTransform:"capitalize" }}>{label}</span>
        <span style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color }}>{pct}%</span>
      </div>
      <div style={{ height:5,background:"#1e2a1a",borderRadius:3,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.8s ease" }}/>
      </div>
    </div>
  )
}

function Pill({ text, color="#4ade80", bg="#052e16" }) {
  return (
    <span style={{
      display:"inline-block",padding:"2px 10px",borderRadius:999,
      fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
      color, background:bg, border:`1px solid ${color}33`
    }}>{text}</span>
  )
}

function Section({ title, children, accent="#4ade80" }) {
  return (
    <div style={{
      background:"#0d1a0e",border:"1px solid #1e2a1a",
      borderRadius:12,padding:"18px 22px",marginBottom:14
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
        <div style={{ width:3,height:15,background:accent,borderRadius:2 }}/>
        <span style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:"#6b7280",textTransform:"uppercase" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Badge({ text, color="#4ade80", icon="" }) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 10px",borderRadius:6,
      fontSize:10,fontWeight:700,letterSpacing:0.8,
      color, background:`${color}18`, border:`1px solid ${color}40`
    }}>{icon && <span>{icon}</span>}{text}</span>
  )
}

// ─── Shelf life clock ─────────────────────────────────────────────────
function ShelfLifeClock({ hours, shelfDays }) {
  const maxHours = 72
  const pct = Math.min(hours / maxHours, 1)
  const urgency = hours <= 12 ? "#f87171" : hours <= 24 ? "#fb923c" : hours <= 48 ? "#facc15" : "#4ade80"
  const r = 28, circ = 2*Math.PI*r
  const dash = circ * pct
  return (
    <div style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#0a130a",borderRadius:10,border:`1px solid ${urgency}30` }}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={r} fill="none" stroke="#1e2a1a" strokeWidth={6}/>
        <circle cx={35} cy={35} r={r} fill="none" stroke={urgency} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 35 35)" style={{ transition:"all 0.6s" }}/>
        <text x={35} y={33} textAnchor="middle" fill={urgency}
          style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700 }}>{hours}h</text>
        <text x={35} y={46} textAnchor="middle" fill="#6b7280"
          style={{ fontSize:8 }}>left</text>
      </svg>
      <div>
        <div style={{ fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:4 }}>TIME PRESSURE</div>
        <div style={{ fontSize:13,fontWeight:700,color:urgency }}>
          {hours <= 12 ? "⚠ Act immediately" : hours <= 24 ? "Sell today" : hours <= 48 ? "Sell within 2 days" : "Good window"}
        </div>
        <div style={{ fontSize:11,color:"#6b7280",marginTop:3 }}>
          {shelfDays} day{shelfDays !== 1 ? "s" : ""} · ~{hours}h before spoilage
        </div>
      </div>
    </div>
  )
}

// ─── Confidence warning banner ────────────────────────────────────────
function ConfidenceBanner({ isReliable, reason, priceSource }) {
  if (isReliable) return null
  const isFlat = reason?.includes("flat_distribution")
  return (
    <div style={{
      padding:"14px 18px",borderRadius:10,marginBottom:14,
      background:"#1a0a00",border:"1px solid #fb923c60",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
        <span style={{ fontSize:18 }}>⚠️</span>
        <span style={{ fontSize:13,fontWeight:700,color:"#fb923c" }}>
          {isFlat ? "Multi-item or background scene detected" : "Low vision confidence — scan overridden"}
        </span>
      </div>
      <div style={{ fontSize:12,color:"#d97706",lineHeight:1.7,marginBottom:8 }}>
        {isFlat
          ? "The camera saw multiple fruit types or a cluttered background. YOLO could not isolate a single item reliably — probabilities are nearly equal across all classes."
          : `Vision model confidence is below the safe threshold (${reason?.split(":")[1] || "?"}). Pricing based on this result would be unreliable.`
        }
      </div>
      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
        <Badge text="YOLO BYPASSED" color="#fb923c" icon="🚫"/>
        <Badge text={`PRICE SOURCE: ${priceSource?.replace("_"," ").toUpperCase()}`} color="#facc15" icon="🌡"/>
        <Badge text="LLM OVERRIDE ACTIVE" color="#a78bfa" icon="🤖"/>
      </div>
      <div style={{ fontSize:11,color:"#6b7280",marginTop:10,lineHeight:1.6 }}>
        <strong style={{color:"#fb923c80"}}>Fix:</strong> Re-scan with a single fruit on a plain surface in good light. Avoid busy backgrounds, bunches of mixed items, or dark/overexposed shots.
      </div>
    </div>
  )
}

// ─── IoT Control Panel ────────────────────────────────────────────────
function IoTPanel({ sensors, onUpdate }) {
  const [activePreset, setPreset] = useState(null)

  const applyPreset = s => {
    setPreset(s.id)
    onUpdate(prev => ({ ...prev, ...s.values }))
  }

  const updateSensor = (key, val) => {
    setPreset(null)
    onUpdate(prev => ({ ...prev, [key]: val }))
  }

  const getAlerts = () => {
    const a = []
    if (sensors.temperature >= 36) a.push({ level:"danger", msg:`${sensors.temperature}°C critical — spoilage 2–3× faster` })
    else if (sensors.temperature >= 32) a.push({ level:"warning", msg:`${sensors.temperature}°C elevated — monitor closely` })
    if (sensors.humidity >= 85) a.push({ level:"danger", msg:`${sensors.humidity}% humidity — mould risk within hours` })
    else if (sensors.humidity >= 75) a.push({ level:"warning", msg:`${sensors.humidity}% humidity — consider ventilation` })
    if (sensors.co2_ppm >= 550) a.push({ level:"danger", msg:`CO2 ${sensors.co2_ppm}ppm — active decomposition` })
    else if (sensors.co2_ppm >= 450) a.push({ level:"warning", msg:`CO2 ${sensors.co2_ppm}ppm — poor air circulation` })
    if (sensors.storage_hours >= 36) a.push({ level:"danger", msg:`Stored ${sensors.storage_hours}h — condition check required` })
    else if (sensors.storage_hours >= 20) a.push({ level:"warning", msg:`Stored ${sensors.storage_hours}h — approaching safe limit` })
    if (sensors.ambient_light === "bright sunlight") a.push({ level:"warning", msg:"Direct sunlight — UV stress and local heat" })
    return a
  }

  const alerts = getAlerts()

  return (
    <div>
      {/* Presets */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10,color:"#6b7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>Storage scenario presets</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7 }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => applyPreset(s)} style={{
              padding:"9px 8px",borderRadius:8,cursor:"pointer",
              border:`1px solid ${activePreset===s.id ? s.color : "#2d4a2e"}`,
              background:activePreset===s.id ? `${s.color}15` : "#0a130a",
              color:activePreset===s.id ? s.color : "#9ca3af",
              fontSize:10,fontWeight:activePreset===s.id ? 700 : 400,
              textAlign:"left",lineHeight:1.4,transition:"all 0.15s"
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      {SENSOR_CFG.map(cfg => {
        const val = sensors[cfg.key] ?? cfg.min
        const color = val >= cfg.danger ? "#f87171" : val >= cfg.warn ? "#facc15" : "#4ade80"
        return (
          <div key={cfg.key} style={{ marginBottom:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
              <span style={{ fontSize:12,color:"#d1d5db" }}>{cfg.label}</span>
              <span style={{
                fontSize:12,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,
                color, background:`${color}18`, padding:"1px 8px",borderRadius:4
              }}>{typeof val==="number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}{cfg.unit}</span>
            </div>
            <div style={{ position:"relative" }}>
              <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={val}
                onChange={e => updateSensor(cfg.key, +e.target.value)}
                style={{ width:"100%", accentColor: color }}/>
              {/* threshold markers */}
              <div style={{ position:"absolute",top:0,left:0,right:0,height:"100%",display:"flex",alignItems:"center",pointerEvents:"none" }}>
                {[{v:cfg.warn,c:"#facc15"},{v:cfg.danger,c:"#f87171"}].map(m => (
                  <div key={m.v} style={{
                    position:"absolute",
                    left:`${((m.v-cfg.min)/(cfg.max-cfg.min))*100}%`,
                    width:2,height:10,background:m.c,opacity:0.5,borderRadius:1,
                    transform:"translateX(-50%) translateY(3px)"
                  }}/>
                ))}
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:9,color:"#4b5563",marginTop:2 }}>
              <span>{cfg.min}{cfg.unit}</span>
              <span style={{color:"#facc1560"}}>warn {cfg.warn}</span>
              <span style={{color:"#f8717160"}}>crit {cfg.danger}</span>
              <span>{cfg.max}{cfg.unit}</span>
            </div>
          </div>
        )
      })}

      {/* Ambient light */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:12,color:"#d1d5db",marginBottom:8 }}>Ambient light</div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {LIGHT_OPTS.map(opt => (
            <button key={opt} onClick={() => updateSensor("ambient_light", opt)} style={{
              padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:11,
              border:`1px solid ${sensors.ambient_light===opt ? "#4ade80" : "#2d4a2e"}`,
              background:sensors.ambient_light===opt ? "#1e2a1a" : "transparent",
              color:sensors.ambient_light===opt ? "#4ade80" : "#6b7280",
              fontWeight:sensors.ambient_light===opt ? 600 : 400,
            }}>{opt}</button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:8 }}>SMART RISK ALERTS</div>
          {alerts.map((a,i) => (
            <div key={i} style={{
              padding:"7px 12px",borderRadius:7,fontSize:11,marginBottom:6,
              border:`1px solid ${a.level==="danger"?"#f87171":"#facc15"}40`,
              background:a.level==="danger"?"#1a0505":"#1a1200",
              color:a.level==="danger"?"#f87171":"#facc15"
            }}>{a.msg}</div>
          ))}
        </div>
      )}

      <div style={{
        marginTop:16,padding:"10px 14px",borderRadius:8,
        border:"1px dashed #1e2a1a",fontSize:10,color:"#4b5563",lineHeight:1.7
      }}>
        ✅ These values are sent to the backend with every scan — they modify freshness, shelf life and risk through the IoT layer before pricing runs.
        <br/>In production: Raspberry Pi + DHT22 + MQ-135 → MQTT → FastAPI /sensor.
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
export default function FreshnessMonitor() {
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState(null)
  const [itemName, setItemName] = useState("banana")
  const [basePrice, setBasePrice] = useState(40)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [tab, setTab]           = useState("analysis")
  const [scanTime, setScanTime] = useState(null)
  const [error, setError]       = useState(null)
  const fileRef = useRef()

  const [sensors, setSensors] = useState({
    temperature:   26,
    humidity:      65,
    co2_ppm:       415,
    storage_hours: 8,
    ambient_light: "moderate",
  })

  const handleFile = e => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  const handleDrop = useCallback(e => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith("image/")) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }, [])

  const handleAnalyze = async () => {
    if (!file) { setError("Upload an image first"); return }
    setError(null)
    try {
      setLoading(true)
      const t0 = performance.now()
      const formData = new FormData()
      formData.append("file", file)

      // Build query params — IoT sensors sent alongside image
      const params = new URLSearchParams({
        item_name:     itemName,
        base_price:    basePrice,
        temperature:   sensors.temperature,
        humidity:      sensors.humidity,
        co2_ppm:       sensors.co2_ppm,
        storage_hours: sensors.storage_hours,
        ambient_light: sensors.ambient_light,
      })

      const res = await axios.post(
        `${API}/analyze?${params.toString()}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      setScanTime(((performance.now()-t0)/1000).toFixed(2))
      setResult(res.data)
      setTab("analysis")
    } catch(err) {
      console.error(err)
      setError(
        err.response?.data?.detail ||
        "Analysis failed — is the FastAPI server running on port 8000?"
      )
    } finally {
      setLoading(false)
    }
  }

  // Confirm vendor action → grows RAG memory
  const handleConfirm = async () => {
    if (!result) return
    try {
      await axios.post(`${API}/confirm`, {
        item_name:   result.item_name,
        action:      result.decision.action,
        freshness:   result.signals.freshness,
        price:       result.recommended_price,
        base_price:  result.base_price,
        season:      result.market_context.season,
        time_of_day: result.market_context.time_of_day,
      })
      alert("✅ Action confirmed — market observation saved to RAG memory!")
    } catch {
      alert("Could not reach /confirm endpoint.")
    }
  }

  const decision     = result?.decision
  const actionStyle  = decision ? (actionMeta[decision.action] || actionMeta.CLEARANCE) : null
  const isReliable   = result?.is_reliable ?? true
  const confReason   = result?.confidence_reason
  const priceSource  = result?.price_source
  const explanation  = result?.explanation
  const explText     = typeof explanation === "string"
    ? explanation
    : explanation?.explanation || ""
  const cacheHit     = explanation?.cache_hit
  const llmCalled    = explanation?.llm_called
  const overrideMode = explanation?.override_mode
  const iotNotes     = result?.signals?.iot_notes || []
  const spoilHours   = result?.market_context?.spoilage_hours ?? 48
  const shelfDays    = result?.signals?.shelf_life ?? 0

  return (
    <div style={{
      minHeight:"100vh", background:"#070e07", color:"#e5e7eb",
      fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", paddingBottom:60,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@300;400;600;700&family=Space+Grotesk:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d1a0e}::-webkit-scrollbar-thumb{background:#2d4a2e;border-radius:4px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes shimmer{0%{opacity:0.4}50%{opacity:1}100%{opacity:0.4}}
        .result-in{animation:fadeIn 0.4s ease forwards}
        .blink{animation:pulse 1.5s infinite}
        .shimmer{animation:shimmer 2s infinite}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;background:#1e2a1a;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#4ade80;cursor:pointer}
      `}</style>

      {/* ─── HEADER ──────────────────────────────────────── */}
      <div style={{
        background:"#0d1a0e",borderBottom:"1px solid #1e2a1a",
        padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:28,height:28,background:"#4ade80",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🌿</div>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:16,letterSpacing:-0.3 }}>Smart Vendor AI</span>
          <span style={{ fontSize:10,color:"#4ade8080",letterSpacing:2,marginLeft:4 }}>v3.0</span>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          {result && (
            <>
              {cacheHit && <Badge text="CACHE HIT" color="#a78bfa" icon="⚡"/>}
              {!cacheHit && llmCalled && <Badge text="LLM CALLED" color="#f472b6" icon="🤖"/>}
              {overrideMode && <Badge text="OVERRIDE MODE" color="#fb923c" icon="⚠"/>}
              {result?.signals?.iot_adjusted && <Badge text="IoT ADJUSTED" color="#4ade80" icon="📡"/>}
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1140,margin:"0 auto",padding:"28px 20px" }}>

        {/* ─── TABS ──────────────────────────────────────── */}
        <div style={{ display:"flex",gap:2,marginBottom:22,background:"#0d1a0e",borderRadius:10,padding:4,width:"fit-content" }}>
          {[["analysis","📊 Analysis"],["iot","📡 IoT Sensors"],["pipeline","🔁 Pipeline"]].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding:"8px 18px",borderRadius:7,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:600,letterSpacing:0.5,
              background:tab===key ? "#1e2a1a" : "transparent",
              color:tab===key ? "#4ade80" : "#6b7280",
              transition:"all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════
            ANALYSIS TAB
        ══════════════════════════════════════════════════ */}
        {tab==="analysis" && (
          <div style={{ display:"grid",gridTemplateColumns:"370px 1fr",gap:18,alignItems:"start" }}>

            {/* LEFT COLUMN */}
            <div>
              <Section title="Product Scan" accent="#4ade80">

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  style={{
                    border:`2px dashed ${preview ? "#4ade8060" : "#2d4a2e"}`,
                    borderRadius:10,height:190,display:"flex",alignItems:"center",
                    justifyContent:"center",cursor:"pointer",overflow:"hidden",
                    background:preview ? "#000" : "#0a130a",marginBottom:14
                  }}>
                  {preview
                    ? <img src={preview} alt="" style={{ maxHeight:"100%",maxWidth:"100%",objectFit:"contain" }}/>
                    : <div style={{ textAlign:"center",color:"#3d5c3e" }}>
                        <div style={{ fontSize:28,marginBottom:6 }}>📷</div>
                        <div style={{ fontSize:11,letterSpacing:1 }}>TAP OR DROP IMAGE</div>
                        <div style={{ fontSize:9,color:"#2d4a2e",marginTop:4 }}>Single fruit on plain background = best results</div>
                      </div>
                  }
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }}/>
                </div>

                {/* Product + price */}
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                  <div>
                    <label style={{ fontSize:9,letterSpacing:1,color:"#6b7280",display:"block",marginBottom:5 }}>PRODUCT</label>
                    <select value={itemName} onChange={e => setItemName(e.target.value)} style={{
                      width:"100%",padding:"9px 10px",background:"#0a130a",
                      border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none"
                    }}>
                      <option value="banana">🍌 Banana</option>
                      <option value="tomato">🍅 Tomato</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:9,letterSpacing:1,color:"#6b7280",display:"block",marginBottom:5 }}>BASE PRICE (Rs.)</label>
                    <input type="number" value={basePrice} onChange={e => setBasePrice(+e.target.value)} style={{
                      width:"100%",padding:"9px 10px",background:"#0a130a",
                      border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none"
                    }}/>
                  </div>
                </div>

                {/* IoT preview — shows current sensor state */}
                <div style={{ background:"#0a130a",border:"1px solid #1e2a1a",borderRadius:8,padding:"9px 12px",marginBottom:14 }}>
                  <div style={{ fontSize:9,color:"#4ade80",letterSpacing:1,marginBottom:6,display:"flex",justifyContent:"space-between" }}>
                    <span>📡 LIVE IOT CONTEXT — SENT WITH SCAN</span>
                    <span style={{ color:"#6b7280" }}>edit in IoT Sensors tab →</span>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4 }}>
                    {[
                      ["Temp",     `${sensors.temperature}°C`,   sensors.temperature >= 36 ? "#f87171" : sensors.temperature >= 32 ? "#facc15" : "#4ade80"],
                      ["Humidity", `${sensors.humidity}%`,        sensors.humidity >= 85 ? "#f87171" : sensors.humidity >= 75 ? "#facc15" : "#4ade80"],
                      ["CO2",      `${sensors.co2_ppm}ppm`,       sensors.co2_ppm >= 550 ? "#f87171" : sensors.co2_ppm >= 450 ? "#facc15" : "#4ade80"],
                      ["Stored",   `${typeof sensors.storage_hours==="number" ? sensors.storage_hours.toFixed(1) : sensors.storage_hours}h`,
                                   sensors.storage_hours >= 36 ? "#f87171" : sensors.storage_hours >= 20 ? "#facc15" : "#4ade80"],
                    ].map(([k,v,c]) => (
                      <div key={k} style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace" }}>
                        <span style={{ color:"#6b7280" }}>{k}: </span>
                        <span style={{ color:c, fontWeight:700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:10,color:"#6b7280",marginTop:5 }}>
                    💡 These modify freshness &amp; shelf life before ML pricing
                  </div>
                </div>

                {error && (
                  <div style={{ padding:"8px 12px",background:"#1a0505",border:"1px solid #f8717140",borderRadius:7,fontSize:11,color:"#f87171",marginBottom:12 }}>
                    {error}
                  </div>
                )}

                <button onClick={handleAnalyze} disabled={loading} style={{
                  width:"100%",padding:"13px",borderRadius:9,border:"none",
                  background:loading ? "#1e2a1a" : "#166534",
                  color:loading ? "#6b7280" : "#4ade80",
                  fontSize:12,fontWeight:700,letterSpacing:2,
                  cursor:loading ? "default" : "pointer",transition:"all 0.2s"
                }}>
                  {loading ? <span className="shimmer">ANALYZING...</span> : "▶ RUN ANALYSIS"}
                </button>

                {scanTime && !loading && (
                  <div style={{ textAlign:"center",fontSize:9,color:"#4ade8060",marginTop:7,fontFamily:"'IBM Plex Mono',monospace" }}>
                    Scan completed in {scanTime}s
                  </div>
                )}
              </Section>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {!result && (
                <div style={{
                  height:400,display:"flex",alignItems:"center",justifyContent:"center",
                  flexDirection:"column",gap:12,color:"#2d4a2e",
                  border:"1px dashed #1e2a1a",borderRadius:12
                }}>
                  <div style={{ fontSize:44 }}>🧪</div>
                  <div style={{ fontSize:11,letterSpacing:2 }}>AWAITING SCAN</div>
                  <div style={{ fontSize:10,color:"#1e2a1a",maxWidth:280,textAlign:"center",lineHeight:1.7 }}>
                    Upload a fruit image → set IoT sensors → run analysis
                  </div>
                </div>
              )}

              {result && (
                <div className="result-in">

                  {/* ── Confidence warning ── */}
                  <ConfidenceBanner
                    isReliable={isReliable}
                    reason={confReason}
                    priceSource={priceSource}
                  />

                  {/* ── Price hero ── */}
                  <div style={{
                    background:actionStyle?.bg || "#0d1a0e",
                    border:`1px solid ${actionStyle?.color || "#4ade80"}30`,
                    borderRadius:12,padding:"20px 24px",marginBottom:14,
                    display:"flex",alignItems:"center",justifyContent:"space-between"
                  }}>
                    <div>
                      <div style={{ fontSize:9,color:"#6b7280",letterSpacing:2,marginBottom:5 }}>RECOMMENDED PRICE</div>
                      <div style={{
                        fontSize:52,fontWeight:700,
                        fontFamily:"'Space Grotesk',sans-serif",
                        color:actionStyle?.color || "#4ade80",lineHeight:1,
                        opacity: isReliable ? 1 : 0.7
                      }}>
                        Rs.{result.recommended_price}
                        {!isReliable && <span style={{ fontSize:12,marginLeft:8,color:"#fb923c" }}>⚠ estimate</span>}
                      </div>
                      <div style={{ fontSize:10,color:"#6b7280",marginTop:5,fontFamily:"'IBM Plex Mono',monospace" }}>
                        Base Rs.{result.base_price}
                        {isReliable ? ` → ML Rs.${result.ml_price_raw}` : " → IoT estimate"}
                        {` → Final Rs.${result.recommended_price}`}
                      </div>
                      {priceSource && (
                        <div style={{ marginTop:6 }}>
                          <Badge
                            text={priceSource==="xgboost_ml" ? "XGBoost ML" : "IoT Fallback"}
                            color={priceSource==="xgboost_ml" ? "#4ade80" : "#fb923c"}
                            icon={priceSource==="xgboost_ml" ? "🤖" : "🌡"}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{
                        fontSize:16,fontWeight:700,color:actionStyle?.color,letterSpacing:0.5,
                        padding:"9px 18px",border:`1px solid ${actionStyle?.color}40`,
                        borderRadius:9,background:`${actionStyle?.color}10`
                      }}>{actionStyle?.label}</div>
                      {decision.suggested_discount_pct > 0 && (
                        <div style={{ fontSize:22,fontWeight:700,color:"#facc15",marginTop:7 }}>
                          -{decision.suggested_discount_pct}% OFF
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Shelf life clock ── */}
                  <div style={{ marginBottom:14 }}>
                    <ShelfLifeClock hours={spoilHours} shelfDays={shelfDays}/>
                  </div>

                  {/* ── Freshness gauges ── */}
                  <Section title="Freshness Intelligence" accent="#4ade80">
                    <div style={{ display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:10,marginBottom:14 }}>
                      <RadialGauge value={result.signals.freshness} max={100} label="Freshness %" color={freshColor(result.signals.freshness)}/>
                      <RadialGauge value={+(result.signals.risk*100).toFixed(0)} max={100} label="Spoilage Risk %" color="#f87171"/>
                      <RadialGauge value={result.signals.shelf_life} max={7} label="Shelf Life days" color="#facc15"/>
                      <RadialGauge value={result.signals.dominant_conf || 0} max={100}
                        label="Model Conf %"
                        color={isReliable ? "#60a5fa" : "#fb923c"}/>
                    </div>
                    <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginBottom:10 }}>
                      <Pill text={result.market_context.freshness_grade} color={freshColor(result.signals.freshness)} bg={`${freshColor(result.signals.freshness)}15`}/>
                      <Pill text={result.signals.quality} color="#60a5fa" bg="#0c1a2e"/>
                      <Pill text={result.signals.urgency} color="#fb923c" bg="#1a0e00"/>
                      <Pill text={result.market_context.season} color="#a78bfa" bg="#150d2e"/>
                      {result.market_context.is_weekend && <Pill text="weekend" color="#34d399" bg="#021f14"/>}
                      {result.signals.iot_adjusted && <Pill text="IoT adjusted" color="#4ade80" bg="#052e16"/>}
                    </div>

                    {/* IoT adjustment notes */}
                    {iotNotes.length > 0 && (
                      <div style={{ marginBottom:10 }}>
                        {iotNotes.map((note,i) => (
                          <div key={i} style={{
                            fontSize:10,color:"#4ade80",padding:"4px 10px",
                            borderLeft:"2px solid #4ade8040",marginBottom:4,
                            background:"#0a130a",borderRadius:"0 6px 6px 0"
                          }}>📡 {note}</div>
                        ))}
                      </div>
                    )}

                    {result.signals.is_borderline && (
                      <div style={{ padding:"7px 12px",borderRadius:7,background:"#1c1400",border:"1px solid #facc1540",fontSize:11,color:"#facc15",marginBottom:10 }}>
                        Between stages: {result.signals.borderline_note}
                      </div>
                    )}
                    <div style={{ fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:"#6b7280",display:"flex",gap:14 }}>
                      <span>Spoils in ~{result.market_context.spoilage_hours}h</span>
                      <span>Time decay: x{result.signals.time_decay}</span>
                    </div>
                  </Section>

                  {/* ── YOLO ── */}
                  <Section title="Vision AI — Class Probabilities" accent={isReliable ? "#60a5fa" : "#fb923c"}>
                    <div style={{ fontSize:10,color:"#6b7280",marginBottom:10,display:"flex",alignItems:"center",gap:8 }}>
                      <span>YOLOv8s · {itemName} · {result.signals.dominant_class}</span>
                      {!isReliable && (
                        <Badge text="UNRELIABLE" color="#fb923c" icon="⚠"/>
                      )}
                    </div>
                    {!isReliable && (
                      <div style={{ fontSize:11,color:"#d97706",padding:"7px 10px",background:"#1a0a00",borderRadius:7,marginBottom:10,lineHeight:1.6 }}>
                        {confReason?.includes("flat_distribution")
                          ? "Probability distribution is nearly flat — model sees no clear single item. Check image: remove background clutter, scan one fruit at a time."
                          : `Top confidence is ${confReason?.split(":")[1] || "low"}. Below the 55% reliability threshold. Probabilities shown but NOT used for pricing.`}
                      </div>
                    )}
                    {Object.entries(result.yolo_prediction).sort((a,b)=>b[1]-a[1]).map(([cls,prob]) => (
                      <ProbBar key={cls} label={cls} value={prob}/>
                    ))}
                  </Section>

                  {/* ── Market context ── */}
                  <Section title="Market Context" accent="#a78bfa">
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10 }}>
                      {[["Demand",result.market_context.demand_score],["Stock",result.market_context.stock],["Noise",result.market_context.market_noise]].map(([k,v]) => (
                        <div key={k} style={{ background:"#0a130a",borderRadius:7,padding:10,textAlign:"center" }}>
                          <div style={{ fontSize:18,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:"#a78bfa" }}>{v}</div>
                          <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginTop:3 }}>{k}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:10,color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace",marginBottom:8 }}>
                      {result.market_context.time_of_day} · {result.market_context.season}{result.market_context.is_weekend ? " · weekend" : ""}
                    </div>
                    {result.market_context.alerts?.map((a,i) => (
                      <div key={i} style={{ marginTop:6,padding:"6px 10px",borderRadius:6,background:"#1a0e00",border:"1px solid #fb923c40",fontSize:11,color:"#fb923c" }}>{a}</div>
                    ))}
                  </Section>

                  {/* ── Decision engine ── */}
                  <Section title="Decision Engine" accent={actionStyle?.color || "#4ade80"}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                      <div style={{ background:"#0a130a",borderRadius:7,padding:10 }}>
                        <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>ACTION</div>
                        <div style={{ fontSize:13,fontWeight:700,color:actionStyle?.color }}>{decision.action}</div>
                      </div>
                      <div style={{ background:"#0a130a",borderRadius:7,padding:10 }}>
                        <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>PRIORITY</div>
                        <div style={{ fontSize:13,fontWeight:700,color:"#e5e7eb",textTransform:"uppercase" }}>{decision.priority}</div>
                      </div>
                    </div>
                    <div style={{ background:"#0a130a",borderRadius:7,padding:10,marginBottom:10 }}>
                      <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>VENDOR INSTRUCTION</div>
                      <div style={{ fontSize:12,color:"#d1fae5",lineHeight:1.7 }}>{decision.inventory_action}</div>
                    </div>
                    <div style={{ background:"#0a130a",borderRadius:7,padding:10,marginBottom:12 }}>
                      <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>RATIONALE</div>
                      <div style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7 }}>{decision.rationale}</div>
                    </div>

                    {/* Confirm action button → grows RAG memory */}
                    <button onClick={handleConfirm} style={{
                      width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${actionStyle?.color}40`,
                      background:`${actionStyle?.color}10`,color:actionStyle?.color,
                      fontSize:11,fontWeight:700,letterSpacing:1,cursor:"pointer",
                    }}>
                      ✅ CONFIRM I FOLLOWED THIS RECOMMENDATION
                    </button>
                    <div style={{ fontSize:9,color:"#4b5563",textAlign:"center",marginTop:5 }}>
                      Confirming saves a market observation → RAG memory grows
                    </div>
                  </Section>

                  {/* ── RAG + LLM ── */}
                  <Section title={overrideMode ? "LLM Override Explanation" : "RAG + LLM Explanation"} accent={overrideMode ? "#fb923c" : "#f472b6"}>
                    <div style={{ fontSize:10,color:"#6b7280",marginBottom:8,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
                      <span>Groq LLaMA 3.3 70B · FAISS</span>
                      {cacheHit && <Badge text="CACHE HIT — LLM SKIPPED" color="#a78bfa" icon="⚡"/>}
                      {overrideMode && <Badge text="OVERRIDE MODE" color="#fb923c" icon="⚠"/>}
                      {explanation?.avg_retrieval_score && (
                        <span style={{ color:"#4ade8060" }}>
                          retrieval score: {explanation.avg_retrieval_score}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize:13,lineHeight:1.9,color:"#d1d5db",fontStyle:"italic" }}>
                      "{explText}"
                    </p>
                    {explanation?.retrieved_docs?.length > 0 && (
                      <details style={{ marginTop:10 }}>
                        <summary style={{ fontSize:10,color:"#6b7280",cursor:"pointer",letterSpacing:1 }}>
                          RETRIEVED KNOWLEDGE ({explanation.retrieved_docs.length} docs)
                        </summary>
                        <div style={{ marginTop:7 }}>
                          {explanation.retrieved_docs.map((doc,i) => (
                            <div key={i} style={{ fontSize:10,color:"#6b7280",padding:"4px 8px",borderLeft:"2px solid #f472b640",marginBottom:3 }}>{doc}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </Section>

                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            IOT TAB
        ══════════════════════════════════════════════════ */}
        {tab==="iot" && (
          <div style={{ maxWidth:680 }}>
            <Section title="IoT Sensor Control — Environmental Intelligence" accent="#4ade80">
              <div style={{ fontSize:12,color:"#6b7280",marginBottom:18,lineHeight:1.8 }}>
                These sensor values are <strong style={{color:"#4ade80"}}>sent directly to the backend</strong> with every scan.
                The signal engine uses Q10 biology rules, mould thresholds and CO2 respiration rates
                to adjust freshness score, shelf life and risk before pricing runs.
                Changes here affect the price — try switching from <em>Ideal storage</em> to <em>Critical</em> and re-scan.
              </div>
              <IoTPanel sensors={sensors} onUpdate={setSensors}/>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PIPELINE TAB
        ══════════════════════════════════════════════════ */}
        {tab==="pipeline" && (
          <div style={{ maxWidth:760 }}>
            <Section title="System Architecture — 7-Layer Intelligence Pipeline (v3)" accent="#60a5fa">
              <div style={{ fontSize:12,color:"#6b7280",marginBottom:18 }}>
                v3 adds confidence guard, IoT modifier layer, memory cache and LLM override mode between the existing 6 layers.
              </div>
              {[
                { n:"01", name:"Vision AI",              tech:"YOLOv8s · 320px · Confidence Guard", color:"#60a5fa",
                  desc:"YOLO runs on the image. NEW: if top-1 confidence < 55% OR probability distribution is flat (background/multi-fruit scene), the YOLO result is flagged as unreliable. ML pricing is bypassed. LLM override fires instead.",
                  improvement:"Confidence guard · flat-distribution check · multi-fruit warning" },
                { n:"02", name:"Signal Engine + IoT",    tech:"Fruit-agnostic · Q10 rule · Mould threshold", color:"#4ade80",
                  desc:"Converts YOLO probabilities to freshness/risk/shelf_life. NEW: apply_iot_modifiers() adjusts these values using real sensor readings — Q10 halving for temperature, mould risk for humidity >80%, CO2 respiration, storage-hour decay, UV stress.",
                  improvement:"IoT modifier layer · Q10 biology · storage-hour decay" },
                { n:"03", name:"Market Context",          tech:"Deterministic demand · Season · Weekend", color:"#a78bfa",
                  desc:"Generates time-aware market context. Unchanged — already deterministic with no random.uniform(). Spoilage hours now surfaced prominently in UI as the headline time-pressure signal.",
                  improvement:"Spoilage hours → shelf life clock UI" },
                { n:"04", name:"ML Pricing",              tech:"XGBoost · IoT-adjusted freshness input", color:"#f472b6",
                  desc:"XGBoost predicts price from 10 features. NEW: freshness input is now the IoT-adjusted value, not raw YOLO freshness. If YOLO is unreliable, XGBoost is skipped — IoT-only fallback pricing used instead to prevent fake prices.",
                  improvement:"IoT freshness as input · Skip if YOLO unreliable · IoT fallback price" },
                { n:"05", name:"Decision Engine",         tech:"Rule-based · Discount % · Waste log", color:"#facc15",
                  desc:"Converts price to vendor instruction with discount %, action text, rationale. Unchanged but now receives IoT-adjusted signals so decisions reflect real storage conditions, not just visual freshness.",
                  improvement:"IoT-adjusted signals → more accurate decisions" },
                { n:"06", name:"Memory Cache",            tech:"FAISS score ≥ 0.92 → skip LLM", color:"#34d399",
                  desc:"NEW layer. Before calling Groq LLaMA, checks if FAISS retrieval avg_score > 0.92 for the same item+action+freshness-bucket+IoT-hash. If a very similar situation has been explained before, returns the cached explanation. Dramatically reduces API usage.",
                  improvement:"explanation_cache.jsonl · hit count tracking · /cache-stats endpoint" },
                { n:"07", name:"RAG + LLM",               tech:"FAISS · Shelf-life-led prompt · Override mode", color:"#fb923c",
                  desc:"NEW: two modes. Normal mode — shelf life (hours) is now the headline of the LLM prompt, not freshness %. Override mode — when YOLO is unreliable, LLM is given only IoT data and asked to reason honestly, advise re-scan, and give a conservative interim price. No fake pricing.",
                  improvement:"Override mode · shelf-life-led prompt · IoT in LLM context · /confirm → RAG memory grows" },
              ].map((step,i,arr) => (
                <div key={i} style={{ display:"flex",gap:14,marginBottom:18,position:"relative" }}>
                  {i < arr.length-1 && <div style={{ position:"absolute",left:17,top:40,width:2,height:"calc(100% + 4px)",background:"#1e2a1a" }}/>}
                  <div style={{ width:36,height:36,borderRadius:9,background:`${step.color}15`,border:`1px solid ${step.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <span style={{ fontSize:9,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:step.color }}>{step.n}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700,fontSize:13,color:step.color }}>{step.name}</span>
                      <span style={{ fontSize:9,color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace" }}>{step.tech}</span>
                    </div>
                    <p style={{ fontSize:11,color:"#9ca3af",lineHeight:1.7,marginBottom:6 }}>{step.desc}</p>
                    <div style={{ fontSize:9,color:step.color,background:`${step.color}10`,padding:"3px 9px",borderRadius:5,display:"inline-block" }}>
                      {step.improvement}
                    </div>
                  </div>
                </div>
              ))}
            </Section>

            <Section title="What Changed: Problem → Fix" accent="#f87171">
              {[
                ["Fake pricing on bad YOLO output", "Confidence guard bypasses XGBoost; IoT-only fallback price used; LLM told to be honest"],
                ["IoT sensors ignored in backend",  "Sensor values now sent as query params in every /analyze call; signal_engine.apply_iot_modifiers() adjusts freshness+risk"],
                ["LLM called every time",           "Memory cache (FAISS score ≥ 0.92) returns cached explanation; /cache-stats shows LLM calls saved"],
                ["Shelf life not used by LLM",      "Shelf life in hours is now the headline variable in the LLM prompt — forces time-pressure reasoning"],
                ["Multi-fruit / background scene",  "Flat probability distribution check flags scene as ambiguous; confidence banner shown; override mode fires"],
                ["No memory of past decisions",     "/confirm endpoint logs market observations → RAG knowledge base grows; future similar items skip LLM"],
              ].map(([prob,fix],i) => (
                <div key={i} style={{ display:"flex",gap:12,marginBottom:10,padding:"10px 12px",background:"#0a130a",borderRadius:8 }}>
                  <div style={{ flex:"0 0 200px" }}>
                    <span style={{ fontSize:11,color:"#f87171" }}>❌ {prob}</span>
                  </div>
                  <div style={{ fontSize:11,color:"#4ade80",lineHeight:1.6 }}>✅ {fix}</div>
                </div>
              ))}
            </Section>
          </div>
        )}

      </div>
    </div>
  )
}