import { useState, useRef, useCallback, useEffect } from "react"
import axios from "axios"

const API = "http://127.0.0.1:8000"

// ─── colour helpers ───────────────────────────────────────────────────
const freshColor = (f: number) =>
  f >= 85 ? "#4ade80" : f >= 65 ? "#facc15" : f >= 40 ? "#fb923c" : "#f87171"

const actionMeta: Record<string, { label: string; color: string; bg: string }> = {
  SELL_PREMIUM:   { label: "Sell Premium",  color: "#4ade80", bg: "#052e16" },
  SELL_STANDARD:  { label: "Sell Standard", color: "#86efac", bg: "#14532d" },
  DISCOUNT_FAST:  { label: "Discount Fast", color: "#facc15", bg: "#422006" },
  CLEARANCE_SALE: { label: "Clearance Sale", color: "#fb923c", bg: "#431407" },
  CLEARANCE:      { label: "Clearance",      color: "#fbbf24", bg: "#3d1906" },
  DISCARD:        { label: "Discard",        color: "#f87171", bg: "#3f0f0f" },
}

// ─── scenario presets ─────────────────────────────────────────────────
const SCENARIOS = [
  { id:"ideal",      label:"Ideal storage",       color:"#4ade80", values:{ temperature:18, humidity:55, co2_ppm:400, storage_hours:4  } },
  { id:"morning",      label:"Morning market",       color:"#facc15", values:{ temperature:26, humidity:65, co2_ppm:415, storage_hours:8  } },
  { id:"afternoon",    label:"Afternoon heat",       color:"#fb923c", values:{ temperature:36, humidity:72, co2_ppm:440, storage_hours:18 } },
  { id:"monsoon",      label:"Monsoon",              color:"#60a5fa", values:{ temperature:29, humidity:88, co2_ppm:430, storage_hours:12 } },
  { id:"cold_storage", label:"Cold storage",         color:"#a78bfa", values:{ temperature:8,  humidity:60, co2_ppm:390, storage_hours:48 } },
  { id:"critical",     label:"Critical — spoilage",  color:"#f87171", values:{ temperature:38, humidity:82, co2_ppm:560, storage_hours:30 } },
]

const SENSOR_CFG = [
  { key:"temperature",   label:"Temperature",  unit:"°C",  min:0,   max:50,  step:0.5, warn:32, danger:36 },
  { key:"humidity",      label:"Humidity",       unit:"%",   min:20,  max:100, step:1,   warn:75, danger:85 },
  { key:"co2_ppm",       label:"CO₂",            unit:" ppm",min:350, max:700, step:5,   warn:450,danger:550 },
  { key:"storage_hours", label:"Hrs in storage", unit:"h",   min:0,   max:72,  step:1,   warn:20, danger:36 },
]
const LIGHT_OPTS = ["dark storage","low light","moderate","bright sunlight"]

// ─── Gemini preset images (from zip) ─────────────────────────────────
const GEMINI_PRESETS = [
  {
    id: "fresh_apple",
    name: "Crisp Red Apple",
    imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80",
    itemName: "banana",
    storage: "countertop",
  },
  {
    id: "speckled_banana",
    name: "Speckled Banana",
    imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80",
    itemName: "banana",
    storage: "countertop",
  },
  {
    id: "ripe_tomato",
    name: "Heirloom Tomato",
    imageUrl: "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
    itemName: "tomato",
    storage: "pantry",
  },
  {
    id: "ripe_avocado",
    name: "Hass Avocado",
    imageUrl: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80",
    itemName: "banana",
    storage: "refrigerator",
  },
]

// ─── small components ─────────────────────────────────────────────────

function RadialGauge({ value, max=100, label, color, size=88 }: any) {
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

function ProbBar({ label, value }: any) {
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

function Pill({ text, color="#4ade80", bg="#052e16" }: any) {
  return (
    <span style={{
      display:"inline-block",padding:"2px 10px",borderRadius:999,
      fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
      color, background:bg, border:`1px solid ${color}33`
    }}>{text}</span>
  )
}

function Section({ title, children, accent="#4ade80" }: any) {
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

function Badge({ text, color="#4ade80", icon="" }: any) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 10px",borderRadius:6,
      fontSize:10,fontWeight:700,letterSpacing:0.8,
      color, background:`${color}18`, border:`1px solid ${color}40`
    }}>{icon && <span>{icon}</span>}{text}</span>
  )
}

function ShelfLifeClock({ hours, shelfDays }: any) {
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
        <text x={35} y={46} textAnchor="middle" fill="#6b7280" style={{ fontSize:8 }}>left</text>
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

function ConfidenceBanner({ isReliable, reason, priceSource }: any) {
  if (isReliable) return null
  const isFlat = reason?.includes("flat_distribution")
  return (
    <div style={{ padding:"14px 18px",borderRadius:10,marginBottom:14,background:"#1a0a00",border:"1px solid #fb923c60" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
        <span style={{ fontSize:18 }}>⚠️</span>
        <span style={{ fontSize:13,fontWeight:700,color:"#fb923c" }}>
          {isFlat ? "Multi-item or background scene detected" : "Low vision confidence — scan overridden"}
        </span>
      </div>
      <div style={{ fontSize:12,color:"#d97706",lineHeight:1.7,marginBottom:8 }}>
        {isFlat
          ? "The camera saw multiple fruit types or a cluttered background. YOLO could not isolate a single item reliably."
          : `Vision model confidence is below the safe threshold (${reason?.split(":")[1] || "?"}). Pricing based on this result would be unreliable.`
        }
      </div>
      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
        <Badge text="YOLO BYPASSED" color="#fb923c" icon="🚫"/>
        <Badge text={`PRICE SOURCE: ${priceSource?.replace("_"," ").toUpperCase()}`} color="#facc15" icon="🌡"/>
        <Badge text="LLM OVERRIDE ACTIVE" color="#a78bfa" icon="🤖"/>
      </div>
    </div>
  )
}

// ─── IoT Control Panel ────────────────────────────────────────────────
function IoTPanel({ sensors, onUpdate }: any) {
  const [activePreset, setPreset] = useState<string|null>(null)

  const applyPreset = (s: any) => {
    setPreset(s.id)
    onUpdate((prev: any) => ({ ...prev, ...s.values }))
  }

  const updateSensor = (key: string, val: any) => {
    setPreset(null)
    onUpdate((prev: any) => ({ ...prev, [key]: val }))
  }

  const getAlerts = () => {
    const a: any[] = []
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

      {SENSOR_CFG.map(cfg => {
        const val = sensors[cfg.key] ?? cfg.min
        const color = val >= cfg.danger ? "#f87171" : val >= cfg.warn ? "#facc15" : "#4ade80"
        return (
          <div key={cfg.key} style={{ marginBottom:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
              <span style={{ fontSize:12,color:"#d1d5db" }}>{cfg.label}</span>
              <span style={{ fontSize:12,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color,background:`${color}18`,padding:"1px 8px",borderRadius:4 }}>
                {typeof val==="number"?(Number.isInteger(val)?val:val.toFixed(1)):val}{cfg.unit}
              </span>
            </div>
            <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={val}
              onChange={e => updateSensor(cfg.key, +e.target.value)}
              style={{ width:"100%", accentColor: color }}/>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:9,color:"#4b5563",marginTop:2 }}>
              <span>{cfg.min}{cfg.unit}</span>
              <span style={{color:"#facc1560"}}>warn {cfg.warn}</span>
              <span style={{color:"#f8717160"}}>crit {cfg.danger}</span>
              <span>{cfg.max}{cfg.unit}</span>
            </div>
          </div>
        )
      })}

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:12,color:"#d1d5db",marginBottom:8 }}>Ambient light</div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {LIGHT_OPTS.map(opt => (
            <button key={opt} onClick={() => updateSensor("ambient_light", opt)} style={{
              padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:11,
              border:`1px solid ${sensors.ambient_light===opt?"#4ade80":"#2d4a2e"}`,
              background:sensors.ambient_light===opt?"#1e2a1a":"transparent",
              color:sensors.ambient_light===opt?"#4ade80":"#6b7280",
              fontWeight:sensors.ambient_light===opt?600:400,
            }}>{opt}</button>
          ))}
        </div>
      </div>

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
    </div>
  )
}

// ─── Gemini item card ─────────────────────────────────────────────────
function GeminiItemCard({ item }: any) {
  const fc = item.freshness_score >= 80 ? "#4ade80"
    : item.freshness_score >= 60 ? "#facc15"
    : item.freshness_score >= 40 ? "#fb923c" : "#f87171"
  const am = actionMeta[item.action] || actionMeta.CLEARANCE
  const fpct = Math.min(100, Math.max(0, item.freshness_score))

  return (
    <div style={{ background:"#0a130a",border:`1px solid ${am.color}30`,borderRadius:10,padding:"14px 16px",marginBottom:10 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:700,color:"#e5e7eb",marginBottom:4 }}>
            {item.emoji||"🌿"} {item.name}
            {item.count>1&&<span style={{ fontSize:11,color:"#6b7280",marginLeft:6 }}>×{item.count}</span>}
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            <span style={{ display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:1,color:am.color,background:am.bg,border:`1px solid ${am.color}33` }}>{am.label}</span>
            <span style={{ display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:10,color:"#6b7280",border:"1px solid #2d4a2e" }}>{item.ripeness_stage}</span>
          </div>
        </div>
        <div style={{ textAlign:"right",flexShrink:0,marginLeft:12 }}>
          <div style={{ fontSize:10,color:"#6b7280",marginBottom:2 }}>RECOMMENDED</div>
          <div style={{ fontSize:28,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:am.color }}>Rs.{item.recommended_price}</div>
          {item.discount_pct>0&&<div style={{ fontSize:12,color:"#facc15",fontWeight:700 }}>-{item.discount_pct}% off</div>}
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
          <span style={{ color:"#6b7280" }}>Freshness</span>
          <span style={{ color:fc,fontWeight:700 }}>{item.freshness_score}%</span>
        </div>
        <div style={{ height:5,background:"#1e2a1a",borderRadius:3,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${fpct}%`,background:fc,borderRadius:3,transition:"width 0.8s ease" }}/>
        </div>
      </div>
      <div style={{ background:"#0d1a0e",borderRadius:7,padding:"8px 10px",marginBottom:8,border:"1px solid #1e2a1a" }}>
        <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>VENDOR INSTRUCTION</div>
        <div style={{ fontSize:12,color:"#d1fae5",lineHeight:1.6 }}>{item.vendor_instruction}</div>
      </div>
      <div style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7,fontStyle:"italic",borderLeft:"2px solid #60a5fa30",paddingLeft:10 }}>
        {item.rationale}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// GEMINI MULTI-SCAN SECTION — ENHANCED WITH ZIP FEATURES
// Features added from zip:
//   • Webcam live capture (start/stop/capture)
//   • Camera device selector (multi-camera)
//   • Preset produce images (load from URL → base64)
//   • Rich result display: biochemical diagnostics, storage strategy,
//     shelf life countdown, spoilage indicators, preservation tips,
//     botanical trivia, rescue recipe idea
//   • Storage location selector
//   • Drag-and-drop zone with visual feedback
//   • Camera error handling
// ═══════════════════════════════════════════════════════════════════════
function GeminiMultiScan({ sensors, itemName, setItemName }: {
  sensors: any
  itemName: string
  setItemName: (v: string) => void
}) {
  const [file, setFile]               = useState<File|null>(null)
  const [preview, setPreview]         = useState<string|null>(null)
  const [previewB64, setPreviewB64]   = useState<string|null>(null)
  const [previewMime, setPreviewMime] = useState<string>("image/jpeg")
  const [basePrice, setBasePrice]     = useState(40)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<any>(null)
  const [error, setError]             = useState<string|null>(null)
  const [scanTime, setScanTime]       = useState<string|null>(null)
  const [keyStatus, setKeyStatus]     = useState<"ok"|"missing"|null>(null)
  const [dragActive, setDragActive]   = useState(false)
  const [loadingPreset, setLoadingPreset] = useState<string|null>(null)
  const [currentStorage, setCurrentStorage] = useState("countertop")

  // ── Camera states ──
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError]       = useState<string|null>(null)
  const [devices, setDevices]               = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState("")

  const fileRef   = useRef<HTMLInputElement>(null)
  const videoRef  = useRef<HTMLVideoElement|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const streamRef = useRef<MediaStream|null>(null)

  useEffect(() => {
    fetch(`${API}/gemini-key-status`)
      .then(r => r.json())
      .then(d => setKeyStatus(d.configured ? "ok" : "missing"))
      .catch(() => setKeyStatus(null))
  }, [])

  // Camera device list when camera activates
  useEffect(() => {
    if (isCameraActive) {
      navigator.mediaDevices.enumerateDevices()
        .then(list => {
          const vids = list.filter(d => d.kind === "videoinput")
          setDevices(vids)
          if (vids.length > 0 && !selectedDeviceId) setSelectedDeviceId(vids[0].deviceId)
        })
        .catch(() => {})
    }
  }, [isCameraActive])

  // Restart camera stream when device changes
  useEffect(() => {
    if (isCameraActive && selectedDeviceId) startCamera(selectedDeviceId)
  }, [selectedDeviceId])

  // Clear preview when no image
  useEffect(() => {
    if (!preview) stopCamera()
  }, [preview])

  // ── Camera helpers ──
  const startCamera = async (deviceId?: string) => {
    stopCamera()
    setCameraError(null)
    setIsCameraActive(true)
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
      audio: false,
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access or upload an image instead.")
      } else {
        setCameraError("Unable to access camera. Please use manual upload or presets instead.")
      }
      setIsCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsCameraActive(false)
  }

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/jpeg")
        const b64 = dataUrl.split(",")[1]
        setPreview(dataUrl)
        setPreviewB64(b64)
        setPreviewMime("image/jpeg")
        setFile(null)
        setResult(null)
        setError(null)
        stopCamera()
      }
    }
  }

  // ── Drag helpers ──
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else setDragActive(false)
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith("image/")) return
    await processFile(f)
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) await processFile(f)
  }

  const processFile = async (f: File) => {
    const b64 = await fileToBase64(f)
    setPreview(URL.createObjectURL(f))
    setPreviewB64(b64)
    setPreviewMime(f.type || "image/jpeg")
    setFile(f)
    setResult(null)
    setError(null)
    stopCamera()
  }

  // ── Preset loader (from zip: urlToBase64) ──
  const loadPreset = async (preset: typeof GEMINI_PRESETS[0]) => {
    setLoadingPreset(preset.id)
    stopCamera()
    try {
      const b64 = await urlToBase64(preset.imageUrl)
      setPreview(preset.imageUrl)
      setPreviewB64(b64)
      setPreviewMime("image/jpeg")
      setFile(null)
      setResult(null)
      setError(null)
      setItemName(preset.itemName)
      setCurrentStorage(preset.storage)
    } catch {
      setError("Failed to load preset image.")
    } finally {
      setLoadingPreset(null)
    }
  }

  const clearAll = () => {
    setPreview(null); setPreviewB64(null); setFile(null)
    setResult(null); setError(null)
    stopCamera()
  }

  // ── base64 helpers ──
  function fileToBase64(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(",")[1])
      r.onerror = () => rej(new Error("File read failed"))
      r.readAsDataURL(f)
    })
  }

  async function urlToBase64(url: string): Promise<string> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.statusText}`)
    const blob = await resp.blob()
    return fileToBase64(new File([blob], "preset.jpg", { type: blob.type }))
  }

  // ── Analyze ──
  const handleAnalyze = async () => {
    if (!previewB64) { setError("Upload, capture, or load a preset image first."); return }
    if (!itemName.trim()) { setError("Select a product type first."); return }
    setError(null); setLoading(true); setResult(null)
    const t0 = performance.now()
    try {
      const payload = {
        item_name:     itemName,
        image_b64:     previewB64,
        mime_type:     previewMime,
        base_price:    basePrice,
        temperature:   sensors.temperature,
        humidity:      sensors.humidity,
        co2_ppm:       sensors.co2_ppm,
        storage_hours: sensors.storage_hours,
        ambient_light: sensors.ambient_light,
      }
      const resp = await fetch(`${API}/gemini-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        let detail = `Server error ${resp.status}`
        try { const eb = await resp.json(); detail = eb.detail || JSON.stringify(eb) } catch { detail = await resp.text() }
        throw new Error(detail)
      }
      const data = await resp.json()
      if (data.fallback) { setError(data.error + (data.hint ? `\n\n💡 ${data.hint}` : "")); return }
      setScanTime(((performance.now() - t0) / 1000).toFixed(2))
      setResult(data)
    } catch (err: any) {
      setError(err.message?.includes("fetch")
        ? "Cannot reach FastAPI server on port 8000 — is it running?"
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Biochemical diagnostics (from zip FreshnessDisplay) ──
  const getBiochem = (freshness: number) => {
    const vitC       = Math.max(5,  Math.min(100, Math.round(freshness * 1.05)))
    const browning   = Math.max(0,  Math.min(100, Math.round((100 - freshness) * 0.95)))
    const turgor     = Math.max(8,  Math.min(100, Math.round(freshness * 0.98 + 2)))
    const respiration= Math.round(Math.pow(1.06, (100 - freshness) / 5) * 10) / 10
    return { vitC, browning, turgor, respiration }
  }

  const KeyBanner = () => {
    if (keyStatus === "ok") return (
      <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#052e16",borderRadius:8,marginBottom:14,border:"1px solid #4ade8030",fontSize:11 }}>
        <span>✅</span>
        <span style={{ color:"#4ade80" }}>Gemini API key configured in backend <code style={{ fontSize:10,color:"#86efac" }}>.env</code></span>
      </div>
    )
    if (keyStatus === "missing") return (
      <div style={{ padding:"12px 16px",background:"#1a0e00",border:"1px solid #fb923c60",borderRadius:8,marginBottom:14 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
          <span>⚠️</span>
          <span style={{ fontSize:13,fontWeight:700,color:"#fb923c" }}>GEMINI_API_KEY not set in backend .env</span>
        </div>
        <div style={{ background:"#0a0500",borderRadius:6,padding:"8px 12px",marginTop:8,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#4ade80",border:"1px solid #4ade8020" }}>
          GEMINI_API_KEY=AIzaSy...
        </div>
      </div>
    )
    return null
  }

  // ── Rich result renderer (merges zip FreshnessDisplay + original pipeline display) ──
  const renderResult = () => {
    if (!result) return null
    const freshness   = result.signals?.freshness ?? 0
    const fc          = freshColor(freshness)
    const am          = actionMeta[result.decision?.action] || actionMeta.CLEARANCE
    const explText    = typeof result.explanation === "string"
      ? result.explanation
      : result.explanation?.explanation || ""
    const biochem     = getBiochem(freshness)
    const spoilHours  = result.market_context?.spoilage_hours ?? 48
    const shelfDays   = result.signals?.shelf_life ?? 0

    // Derive storage guidance from signals for zip-style display
    const locationText = currentStorage.toLowerCase()
    const isChilled = locationText.includes("refrigerator") || locationText.includes("refriger")
    const isPantry  = locationText.includes("pantry")

    return (
      <div>
        {/* ── Summary banner ── */}
        <div style={{ background:"#0d1a0e",border:"1px solid #2d4a2e",borderRadius:12,padding:"16px 20px",marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:4 }}>
                GEMINI 2.0 FLASH · {result.item_name?.toUpperCase()} · BACKEND SCAN
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                <Badge text={result.decision?.action?.replace(/_/g," ")||"—"} color={am.color} icon="📊"/>
                <Badge
                  text={result.price_source?.includes("xgboost")?"XGBOOST ML":"IOT FALLBACK"}
                  color={result.price_source?.includes("xgboost")?"#4ade80":"#fb923c"}
                  icon={result.price_source?.includes("xgboost")?"🤖":"🌡"}
                />
                {result.signals?.iot_adjusted && <Badge text="IoT ADJUSTED" color="#4ade80" icon="📡"/>}
                {!result.is_reliable && <Badge text="LOW CONFIDENCE" color="#fb923c" icon="⚠"/>}
              </div>
            </div>
            <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
              <div style={{ fontSize:10,color:"#6b7280",marginBottom:2 }}>RECOMMENDED PRICE</div>
              <div style={{ fontSize:32,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:am.color }}>
                Rs.{result.recommended_price}
              </div>
              {result.decision?.suggested_discount_pct > 0 && (
                <div style={{ fontSize:13,color:"#facc15",fontWeight:700 }}>-{result.decision.suggested_discount_pct}% off</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Freshness gauges ── */}
        <Section title="Freshness Intelligence" accent="#4ade80">
          <div style={{ display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:10,marginBottom:14 }}>
            <RadialGauge value={freshness} max={100} label="Freshness %" color={fc}/>
            <RadialGauge value={+((result.signals?.risk??0)*100).toFixed(0)} max={100} label="Risk %" color="#f87171"/>
            <RadialGauge value={shelfDays} max={7} label="Shelf days" color="#facc15"/>
            <RadialGauge value={result.signals?.dominant_conf??0} max={100} label="Confidence %" color={result.is_reliable?"#60a5fa":"#fb923c"}/>
          </div>
          <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
            <Pill text={result.market_context?.freshness_grade||"—"} color={fc} bg={`${fc}15`}/>
            <Pill text={result.signals?.quality||"—"} color="#60a5fa" bg="#0c1a2e"/>
            <Pill text={result.signals?.urgency||"—"} color="#fb923c" bg="#1a0e00"/>
            <Pill text={result.market_context?.season||"—"} color="#a78bfa" bg="#150d2e"/>
          </div>
        </Section>

        {/* ── Vision probabilities ── */}
        <Section title="Vision AI — Class Probabilities (via Gemini)" accent="#60a5fa">
          {Object.entries(result.yolo_prediction||{})
            .sort((a:any,b:any) => b[1]-a[1])
            .map(([cls,prob]:any) => (
              <ProbBar key={cls} label={cls} value={prob}/>
            ))}
        </Section>

        {/* ── Shelf life clock ── */}
        <div style={{ marginBottom:14 }}>
          <ShelfLifeClock hours={spoilHours} shelfDays={shelfDays}/>
        </div>

        {/* ── Storage strategy card (from zip) ── */}
        <div style={{ background:"#166534",borderRadius:12,padding:"18px 22px",marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:"#86efac",textTransform:"uppercase" }}>Storage Strategy</span>
            <span style={{ fontSize:16 }}>🧭</span>
          </div>
          <div style={{ fontSize:20,fontWeight:700,color:"#fff",marginBottom:8 }}>
            {isChilled ? "Refrigerator — Crisper Unit" : isPantry ? "Pantry / Cool Dry Space" : "Countertop — Open Air"}
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
            {isChilled ? (
              <>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>REFRIGERATE</span>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>CRISPER UNIT</span>
              </>
            ) : isPantry ? (
              <>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>PANTRY</span>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>DARK & DRY</span>
              </>
            ) : (
              <>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>ROOM TEMP</span>
                <span style={{ background:"#15803d",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"1px solid #16a34a80",letterSpacing:1 }}>COUNTERTOP</span>
              </>
            )}
          </div>
          <div style={{ fontSize:11,color:"#86efac",borderTop:"1px solid #16a34a60",paddingTop:8 }}>
            <span style={{ fontWeight:700,letterSpacing:1,fontSize:9,color:"#4ade80",display:"block",marginBottom:3 }}>CORE DIRECTIVE:</span>
            {freshness >= 70
              ? "Store in optimal conditions and sell at full price — freshness window is excellent."
              : freshness >= 40
              ? "Move quickly. Sell within 24–48h or refrigerate immediately to slow deterioration."
              : "Critical stage — discard or rescue immediately. Do not stock for resale."}
          </div>
        </div>

        {/* ── Biochemical diagnostics (from zip FreshnessDisplay) ── */}
        <Section title="Advanced Biochemical & Nutritional Diagnostics" accent="#f472b6">
          <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10 }}>
            {[
              { label:"Vitamin C Index", val:biochem.vitC, unit:"%", color:"#4ade80", desc:"Ascorbic acid bio-availability in tissues." },
              { label:"Browning Factor",  val:biochem.browning, unit:"%", color:"#facc15", desc:"Polyphenol oxidase enzymatic level." },
              { label:"Cellular Turgor",  val:biochem.turgor, unit:"%", color:"#60a5fa", desc:"Flesh water molecule density index." },
              { label:"Respiration Q10",  val:biochem.respiration, unit:"x", color:"#f87171", desc:"Internal substrate cell oxidation speed.", pct: Math.min(100, biochem.respiration * 25) },
            ].map(b => (
              <div key={b.label} style={{ background:"#0a130a",border:"1px solid #1e2a1a",borderRadius:9,padding:"12px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6 }}>
                  <span style={{ color:"#d1d5db",fontWeight:600 }}>{b.label}</span>
                  <span style={{ color:b.color,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace" }}>{b.val}{b.unit}</span>
                </div>
                <div style={{ height:4,background:"#1e2a1a",borderRadius:2,overflow:"hidden",marginBottom:6 }}>
                  <div style={{ height:"100%",width:`${"pct" in b ? b.pct : b.val}%`,background:b.color,borderRadius:2,transition:"width 0.8s ease" }}/>
                </div>
                <div style={{ fontSize:9,color:"#6b7280",lineHeight:1.4 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Spoilage warning (from zip) ── */}
        <div style={{ background:"#1a0505",border:"1px solid #f8717140",borderRadius:12,padding:"16px 20px",marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ fontSize:16 }}>⚠</span>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:"#f87171",textTransform:"uppercase" }}>Critical Spoilage Warning</span>
          </div>
          <div style={{ fontSize:12,color:"#9ca3af",marginBottom:8 }}>
            Discard or isolate produce immediately if you observe these decomposition indicators:
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
            {(result.item_name?.toLowerCase() === "banana"
              ? ["Black/brown peel patches", "Liquid seeping from stem", "Fermented sweet odor", "Extreme mushiness"]
              : ["Soft sunken spots", "Fuzzy white/grey mold", "Fermented sour odor", "Wrinkled leathery skin"]
            ).map((s: string, i: number) => (
              <div key={i} style={{ fontSize:11,color:"#f87171",padding:"5px 9px",background:"#1f0505",borderRadius:6,border:"1px solid #f8717120" }}>
                • {s}
              </div>
            ))}
          </div>
        </div>

        {/* ── Preservation tips / rescue idea (from zip) ── */}
        <div style={{ background:"#1a0e00",border:"1px solid #fb923c40",borderRadius:12,padding:"16px 20px",marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ fontSize:16 }}>🍽</span>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:"#fb923c",textTransform:"uppercase" }}>Culinary Zero-Waste Action</span>
          </div>
          <div style={{ background:"#0a0600",borderRadius:8,padding:"10px 12px",marginBottom:10,border:"1px solid #fb923c20" }}>
            <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:4 }}>RESCUE FORMULA IDEA</div>
            <div style={{ fontSize:12,color:"#fed7aa",lineHeight:1.7 }}>
              {result.item_name?.toLowerCase() === "banana"
                ? freshness >= 60
                  ? "Slice and freeze for future smoothies or banana bread. At this stage, bananas are perfect for baking — the natural sugars are concentrated."
                  : "Immediately blend into a smoothie or mash for banana bread batter. Freeze in portions if not using today."
                : freshness >= 60
                  ? "Roast whole with olive oil and herbs for a rich sauce base. Store-ready tomatoes at this stage have peak umami for sauces."
                  : "Sun-dry or oven-roast at low heat (90°C) for 4h to concentrate flavour. Freeze the result in cubes."
              }
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:4 }}>IMMEDIATE ACTION</div>
              <div style={{ fontSize:11,color:"#fed7aa",lineHeight:1.6 }}>
                {freshness >= 70 ? "Stock at full price. Optimal selling window open." : freshness >= 40 ? "Apply discount and move to front-of-shelf display." : "Remove from display. Rescue or compost."}
              </div>
            </div>
            <div style={{ borderLeft:"1px solid #fb923c20",paddingLeft:10 }}>
              <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:4 }}>LONG-TERM BACKUP</div>
              <div style={{ fontSize:11,color:"#fed7aa",lineHeight:1.6 }}>
                {result.item_name?.toLowerCase() === "banana"
                  ? "Peel and freeze in zip-lock bags. Keeps 3 months frozen."
                  : "Blanch and freeze whole or diced. Preserves up to 12 months."}
              </div>
            </div>
          </div>
        </div>

        {/* ── Decision engine ── */}
        <Section title="Decision Engine" accent={am.color}>
          <div style={{ background:"#0a130a",borderRadius:7,padding:10,marginBottom:10 }}>
            <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>VENDOR INSTRUCTION</div>
            <div style={{ fontSize:12,color:"#d1fae5",lineHeight:1.7 }}>{result.decision?.inventory_action}</div>
          </div>
          <div style={{ background:"#0a130a",borderRadius:7,padding:10 }}>
            <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:3 }}>RATIONALE</div>
            <div style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7 }}>{result.decision?.rationale}</div>
          </div>
        </Section>

        {/* ── RAG + LLM explanation ── */}
        <Section title="RAG + LLM Explanation" accent="#f472b6">
          <p style={{ fontSize:13,lineHeight:1.9,color:"#d1d5db",fontStyle:"italic" }}>"{explText}"</p>
        </Section>

        {/* ── Botanical trivia (from zip) ── */}
        <div style={{ background:"#0d1a0e",border:"1px solid #1e2a1a",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"flex-start" }}>
          <span style={{ fontSize:18 }}>ℹ</span>
          <div>
            <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginBottom:4,textTransform:"uppercase" }}>Botanical & Historical Trivia</div>
            <div style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7,fontStyle:"italic" }}>
              {result.item_name?.toLowerCase() === "banana"
                ? '"Bananas are technically berries in botanical terms, while strawberries are not. The Cavendish variety now dominates global trade after the Gros Michel was wiped out by Panama disease in the 1950s."'
                : '"Tomatoes were declared a vegetable by the U.S. Supreme Court in 1893 for tariff purposes, though botanically they are a fruit. The word \'tomato\' comes from Nahuatl \'tomatl\' meaning \'the swelling fruit\'."'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Left panel: image input area ──
  const renderImagePanel = () => {
    if (isCameraActive) {
      return (
        <div style={{ position:"relative",borderRadius:12,overflow:"hidden",background:"#000",aspectRatio:"16/9",border:"1px solid #2d4a2e",marginBottom:10 }}>
          <canvas ref={canvasRef} style={{ display:"none" }}/>
          <video ref={videoRef} style={{ width:"100%",height:"100%",objectFit:"cover" }} playsInline muted/>
          {/* Visual crop guide */}
          <div style={{ position:"absolute",inset:0,border:"20px solid rgba(0,0,0,0.4)",pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:"80%",height:"80%",border:"2px dashed rgba(255,255,255,0.6)",borderRadius:10 }}/>
          </div>
          {/* Top bar */}
          <div style={{ position:"absolute",top:0,left:0,right:0,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
            <span style={{ fontSize:10,fontWeight:700,color:"#fff",background:"#4ade80",padding:"3px 10px",borderRadius:99,letterSpacing:1,display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ width:7,height:7,background:"#fff",borderRadius:"50%",display:"inline-block",animation:"shimmer 1s infinite" }}/>
              LIVE FEED
            </span>
            {devices.length > 1 && (
              <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} style={{ fontSize:10,background:"rgba(0,0,0,0.8)",color:"#fff",border:"1px solid #3d5c3e",borderRadius:6,padding:"3px 6px" }}>
                {devices.map((d,i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>)}
              </select>
            )}
          </div>
          {/* Bottom bar */}
          <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"12px",display:"flex",justifyContent:"center",gap:10,background:"linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
            <button onClick={stopCamera} style={{ padding:"7px 16px",borderRadius:8,border:"1px solid #3d5c3e",background:"rgba(0,0,0,0.7)",color:"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer" }}>Cancel</button>
            <button onClick={handleCapture} style={{ padding:"8px 20px",borderRadius:8,border:"none",background:"#166534",color:"#4ade80",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
              📷 Capture Photo
            </button>
          </div>
        </div>
      )
    }

    if (preview) {
      return (
        <div style={{ position:"relative",borderRadius:12,overflow:"hidden",background:"#000",border:"2px solid #4ade8040",marginBottom:10,aspectRatio:"16/9" }}>
          <img src={preview} alt="" referrerPolicy="no-referrer" style={{ width:"100%",height:"100%",objectFit:"contain" }}/>
          <button onClick={clearAll} style={{ position:"absolute",bottom:10,right:10,padding:"6px 12px",borderRadius:7,border:"1px solid #f8717140",background:"#1a0505",color:"#f87171",fontSize:10,fontWeight:700,cursor:"pointer" }}>
            🗑 Remove
          </button>
        </div>
      )
    }

    return (
      <div
        onClick={() => fileRef.current?.click()}
        onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
        style={{
          border:`2px dashed ${dragActive?"#4ade80":"#2d4a2e"}`,borderRadius:12,
          aspectRatio:"16/9",display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",cursor:"pointer",background:dragActive?"#0d1f0d":"#0a130a",
          marginBottom:10,transition:"all 0.15s",padding:20,textAlign:"center"
        }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:"none" }}/>
        <div style={{ fontSize:28,marginBottom:8 }}>📷</div>
        <div style={{ fontSize:11,color:"#6b7280",letterSpacing:1 }}>TAP OR DROP IMAGE</div>
        <div style={{ fontSize:9,color:"#3d5c3e",marginTop:4 }}>JPEG · PNG · WEBP</div>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:14,width:"100%",maxWidth:200 }}>
          <div style={{ flex:1,height:1,background:"#2d4a2e" }}/><span style={{ fontSize:9,color:"#4b5563",letterSpacing:1 }}>or</span><div style={{ flex:1,height:1,background:"#2d4a2e" }}/>
        </div>
        <button
          onClick={e => { e.stopPropagation(); startCamera() }}
          style={{ marginTop:12,padding:"7px 16px",borderRadius:8,border:"1px solid #2d4a2e",background:"#0d1a0e",color:"#6b7280",fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
          📹 Scan with Webcam
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* ── Explainer banner ── */}
      <div style={{ background:"#0a130a",border:"1px solid #4ade8030",borderRadius:10,padding:"14px 18px",marginBottom:18 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
          <span style={{ fontSize:20 }}>🤖</span>
          <span style={{ fontSize:13,fontWeight:700,color:"#4ade80" }}>Gemini Vision Scanner</span>
          <span style={{ fontSize:10,color:"#4ade8060",letterSpacing:2 }}>BACKEND PROXIED · NO BROWSER KEY</span>
        </div>
        <div style={{ fontSize:12,color:"#6b7280",lineHeight:1.8 }}>
          Uses <strong style={{ color:"#4ade80" }}>Google Gemini 2.0 Flash Vision</strong> as a drop-in replacement for YOLO (Layer 1).
          The full XGBoost + RAG + LLM pipeline still runs on Gemini's output.
          Supports <strong style={{ color:"#60a5fa" }}>webcam capture</strong>, <strong style={{ color:"#a78bfa" }}>preset images</strong>, and drag-and-drop upload.
          The API key lives in your backend <code style={{ fontSize:11,color:"#86efac" }}>.env</code> — never in the browser.
        </div>
      </div>

      <KeyBanner/>

      {/* ── Preset grid (from zip ImageSelector) ── */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:10,color:"#6b7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>Quick-load preset produce samples</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {GEMINI_PRESETS.map(p => (
            <button key={p.id} onClick={() => loadPreset(p)} disabled={loading || loadingPreset !== null} style={{
              padding:"8px 6px",borderRadius:10,cursor:"pointer",textAlign:"center",
              border:`1px solid ${loadingPreset===p.id?"#4ade80":preview===p.imageUrl?"#4ade80":"#2d4a2e"}`,
              background:preview===p.imageUrl?"#1e2a1a":"#0a130a",
              color:preview===p.imageUrl?"#4ade80":"#6b7280",
              fontSize:10,transition:"all 0.15s",opacity:loadingPreset && loadingPreset!==p.id ? 0.5 : 1
            }}>
              <img src={p.imageUrl} alt={p.name} referrerPolicy="no-referrer" style={{ width:42,height:42,borderRadius:"50%",objectFit:"cover",border:"1px solid #2d4a2e",marginBottom:4,display:"block",margin:"0 auto 5px" }}/>
              <div style={{ fontWeight:preview===p.imageUrl?700:400,lineHeight:1.3 }}>{p.name}</div>
              {loadingPreset===p.id && <div style={{ fontSize:9,color:"#4ade80",marginTop:2,animation:"shimmer 1s infinite" }}>Loading…</div>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"360px 1fr",gap:18,alignItems:"start" }}>

        {/* ── LEFT column ── */}
        <div>
          <Section title="Product Image" accent="#4ade80">
            {renderImagePanel()}
            {/* Camera error */}
            {cameraError && (
              <div style={{ padding:"10px 12px",background:"#1a0e00",border:"1px solid #fb923c40",borderRadius:8,fontSize:11,color:"#fb923c",marginBottom:10,lineHeight:1.6 }}>
                ⚠ {cameraError}
              </div>
            )}
          </Section>

          {/* ── Product Settings ── */}
          <Section title="Product Settings" accent="#a78bfa">
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
              <div>
                <label style={{ fontSize:9,color:"#6b7280",letterSpacing:1,display:"block",marginBottom:5 }}>PRODUCT ← required</label>
                <select value={itemName} onChange={e => setItemName(e.target.value)} style={{ width:"100%",padding:"8px 10px",background:"#0a130a",border:"1px solid #4ade8060",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none" }}>
                  <option value="banana">🍌 Banana</option>
                  <option value="tomato">🍅 Tomato</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:9,color:"#6b7280",letterSpacing:1,display:"block",marginBottom:5 }}>BASE PRICE (Rs./kg)</label>
                <input type="number" value={basePrice} onChange={e => setBasePrice(+e.target.value)} style={{ width:"100%",padding:"8px 10px",background:"#0a130a",border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none" }}/>
              </div>
            </div>

            {/* Storage location selector (from zip) */}
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:9,color:"#6b7280",letterSpacing:1,display:"block",marginBottom:5 }}>CURRENT STORAGE SETUP</label>
              <select value={currentStorage} onChange={e => setCurrentStorage(e.target.value)} style={{ width:"100%",padding:"8px 10px",background:"#0a130a",border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none" }}>
                <option value="refrigerator">Refrigerator (Chilled Storage)</option>
                <option value="countertop">Countertop (Open Air Room Temp)</option>
                <option value="pantry">Pantry / Cabinet (Cool & Dry)</option>
                <option value="unknown">Unspecified / Just bought</option>
              </select>
            </div>

            <div style={{ fontSize:10,color:"#4b5563",lineHeight:1.7,padding:"8px 10px",background:"#0a130a",borderRadius:7,border:"1px solid #1e2a1a" }}>
              💡 <strong style={{color:"#4ade8060"}}>item_name</strong> tells Gemini which class labels to use (Banana: Unripe/Ripe/Overripe/Spoiled · Tomato: Unripe/Ripe/Overripe/Damaged).
            </div>
          </Section>

          {/* ── IoT read-only summary ── */}
          <div style={{ background:"#0a130a",border:"1px solid #1e2a1a",borderRadius:8,padding:"9px 12px",marginBottom:14 }}>
            <div style={{ fontSize:9,color:"#4ade80",letterSpacing:1,marginBottom:6,display:"flex",justifyContent:"space-between" }}>
              <span>📡 IoT CONTEXT — SHARED WITH MAIN SCANNER</span>
              <span style={{ color:"#6b7280" }}>edit in IoT Sensors tab ↑</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4 }}>
              {[
                ["Temp",     `${sensors.temperature}°C`,  sensors.temperature>=36?"#f87171":sensors.temperature>=32?"#facc15":"#4ade80"],
                ["Humidity", `${sensors.humidity}%`,       sensors.humidity>=85?"#f87171":sensors.humidity>=75?"#facc15":"#4ade80"],
                ["CO₂",      `${sensors.co2_ppm}ppm`,     sensors.co2_ppm>=550?"#f87171":sensors.co2_ppm>=450?"#facc15":"#4ade80"],
                ["Stored",   `${sensors.storage_hours}h`, sensors.storage_hours>=36?"#f87171":sensors.storage_hours>=20?"#facc15":"#4ade80"],
              ].map(([k,v,c]) => (
                <div key={k} style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace" }}>
                  <span style={{ color:"#6b7280" }}>{k}: </span>
                  <span style={{ color:c,fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding:"10px 12px",background:"#1a0505",border:"1px solid #f8717140",borderRadius:7,fontSize:11,color:"#f87171",marginBottom:12,whiteSpace:"pre-line",lineHeight:1.7 }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={handleAnalyze} disabled={loading} style={{
            width:"100%",padding:"13px",borderRadius:9,border:"none",
            background:loading?"#1e2a1a":keyStatus==="missing"?"#2a1500":"#166534",
            color:loading?"#6b7280":keyStatus==="missing"?"#fb923c":"#4ade80",
            fontSize:12,fontWeight:700,letterSpacing:2,cursor:loading?"default":"pointer",transition:"all 0.2s"
          }}>
            {loading ? "🤖 GEMINI ANALYZING..."
              : keyStatus==="missing" ? "⚠ SET GEMINI KEY IN .ENV FIRST"
              : "▶ RUN GEMINI SCAN"}
          </button>

          {scanTime && !loading && (
            <div style={{ textAlign:"center",fontSize:9,color:"#4ade8060",marginTop:7,fontFamily:"'IBM Plex Mono',monospace" }}>
              Scanned in {scanTime}s
            </div>
          )}
        </div>

        {/* ── RIGHT column — results ── */}
        <div>
          {!result && !error && (
            <div style={{ height:500,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"#2d4a2e",border:"1px dashed #1e2a1a",borderRadius:12 }}>
              <div style={{ fontSize:44 }}>🤖</div>
              <div style={{ fontSize:11,letterSpacing:2 }}>GEMINI AWAITING SCAN</div>
              <div style={{ fontSize:10,color:"#1e2a1a",maxWidth:280,textAlign:"center",lineHeight:1.7 }}>
                Choose a preset · capture with webcam · or drop an image → then run scan
              </div>
            </div>
          )}
          {result && renderResult()}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — UNCHANGED
// ═══════════════════════════════════════════════════════════════════════
export default function FreshnessMonitor() {
  const [file, setFile]           = useState<File|null>(null)
  const [preview, setPreview]     = useState<string|null>(null)
  const [itemName, setItemName]   = useState("banana")
  const [basePrice, setBasePrice] = useState(40)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [tab, setTab]             = useState("analysis")
  const [scanTime, setScanTime]   = useState<string|null>(null)
  const [error, setError]         = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [sensors, setSensors] = useState({
    temperature:   26,
    humidity:      65,
    co2_ppm:       415,
    storage_hours: 8,
    ambient_light: "moderate",
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
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

      const params = new URLSearchParams({
        item_name:     itemName,
        base_price:    String(basePrice),
        temperature:   String(sensors.temperature),
        humidity:      String(sensors.humidity),
        co2_ppm:       String(sensors.co2_ppm),
        storage_hours: String(sensors.storage_hours),
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
    } catch(err: any) {
      setError(
        err.response?.data?.detail ||
        "Analysis failed — is the FastAPI server running on port 8000?"
      )
    } finally {
      setLoading(false)
    }
  }

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
  const explText     = typeof explanation==="string" ? explanation : explanation?.explanation||""
  const cacheHit     = explanation?.cache_hit
  const llmCalled    = explanation?.llm_called
  const overrideMode = explanation?.override_mode
  const iotNotes     = result?.signals?.iot_notes||[]
  const spoilHours   = result?.market_context?.spoilage_hours??48
  const shelfDays    = result?.signals?.shelf_life??0

  return (
    <div style={{ minHeight:"100vh",background:"#070e07",color:"#e5e7eb",fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",paddingBottom:60 }}>
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

      {/* HEADER */}
      <div style={{ background:"#0d1a0e",borderBottom:"1px solid #1e2a1a",padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:28,height:28,background:"#4ade80",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🌿</div>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:16,letterSpacing:-0.3 }}>Smart Vendor AI</span>
          <span style={{ fontSize:10,color:"#4ade8080",letterSpacing:2,marginLeft:4 }}>v3.0</span>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          {result && (
            <>
              {cacheHit&&<Badge text="CACHE HIT" color="#a78bfa" icon="⚡"/>}
              {!cacheHit&&llmCalled&&<Badge text="LLM CALLED" color="#f472b6" icon="🤖"/>}
              {overrideMode&&<Badge text="OVERRIDE MODE" color="#fb923c" icon="⚠"/>}
              {result?.signals?.iot_adjusted&&<Badge text="IoT ADJUSTED" color="#4ade80" icon="📡"/>}
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1140,margin:"0 auto",padding:"28px 20px" }}>

        {/* TABS */}
        <div style={{ display:"flex",gap:2,marginBottom:22,background:"#0d1a0e",borderRadius:10,padding:4,width:"fit-content" }}>
          {[
            ["analysis","📊 Analysis"],
            ["iot","📡 IoT Sensors"],
            ["gemini","🤖 Gemini Scan"],
            ["pipeline","🔁 Pipeline"],
          ].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding:"8px 18px",borderRadius:7,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:600,letterSpacing:0.5,
              background:tab===key?"#1e2a1a":"transparent",
              color:tab===key?(key==="gemini"?"#60a5fa":"#4ade80"):"#6b7280",
              transition:"all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* ANALYSIS TAB */}
        <div style={{ display: tab === "analysis" ? "grid" : "none", gridTemplateColumns:"370px 1fr", gap:18, alignItems:"start" }}>
          <div>
            <Section title="Product Scan" accent="#4ade80">
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{ border:`2px dashed ${preview?"#4ade8060":"#2d4a2e"}`,borderRadius:10,height:190,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",background:preview?"#000":"#0a130a",marginBottom:14 }}>
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
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:9,letterSpacing:1,color:"#6b7280",display:"block",marginBottom:5 }}>PRODUCT</label>
                  <select value={itemName} onChange={e => setItemName(e.target.value)} style={{ width:"100%",padding:"9px 10px",background:"#0a130a",border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none" }}>
                    <option value="banana">🍌 Banana</option>
                    <option value="tomato">🍅 Tomato</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:9,letterSpacing:1,color:"#6b7280",display:"block",marginBottom:5 }}>BASE PRICE (Rs.)</label>
                  <input type="number" value={basePrice} onChange={e => setBasePrice(+e.target.value)} style={{ width:"100%",padding:"9px 10px",background:"#0a130a",border:"1px solid #2d4a2e",borderRadius:7,color:"#e5e7eb",fontSize:12,outline:"none" }}/>
                </div>
              </div>
              <div style={{ background:"#0a130a",border:"1px solid #1e2a1a",borderRadius:8,padding:"9px 12px",marginBottom:14 }}>
                <div style={{ fontSize:9,color:"#4ade80",letterSpacing:1,marginBottom:6,display:"flex",justifyContent:"space-between" }}>
                  <span>📡 LIVE IOT CONTEXT</span>
                  <span style={{ color:"#6b7280" }}>edit in IoT Sensors tab →</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4 }}>
                  {[
                    ["Temp",`${sensors.temperature}°C`,sensors.temperature>=36?"#f87171":sensors.temperature>=32?"#facc15":"#4ade80"],
                    ["Humidity",`${sensors.humidity}%`,sensors.humidity>=85?"#f87171":sensors.humidity>=75?"#facc15":"#4ade80"],
                    ["CO2",`${sensors.co2_ppm}ppm`,sensors.co2_ppm>=550?"#f87171":sensors.co2_ppm>=450?"#facc15":"#4ade80"],
                    ["Stored",`${sensors.storage_hours}h`,sensors.storage_hours>=36?"#f87171":sensors.storage_hours>=20?"#facc15":"#4ade80"],
                  ].map(([k,v,c]) => (
                    <div key={k} style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace" }}>
                      <span style={{ color:"#6b7280" }}>{k}: </span>
                      <span style={{ color:c,fontWeight:700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {error && <div style={{ padding:"8px 12px",background:"#1a0505",border:"1px solid #f8717140",borderRadius:7,fontSize:11,color:"#f87171",marginBottom:12 }}>{error}</div>}
              <button onClick={handleAnalyze} disabled={loading} style={{ width:"100%",padding:"13px",borderRadius:9,border:"none",background:loading?"#1e2a1a":"#166534",color:loading?"#6b7280":"#4ade80",fontSize:12,fontWeight:700,letterSpacing:2,cursor:loading?"default":"pointer",transition:"all 0.2s" }}>
                {loading ? <span className="shimmer">ANALYZING...</span> : "▶ RUN ANALYSIS"}
              </button>
              {scanTime && !loading && (
                <div style={{ textAlign:"center",fontSize:9,color:"#4ade8060",marginTop:7,fontFamily:"'IBM Plex Mono',monospace" }}>
                  Scan completed in {scanTime}s
                </div>
              )}
            </Section>
          </div>

          <div>
            {!result && (
              <div style={{ height:400,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"#2d4a2e",border:"1px dashed #1e2a1a",borderRadius:12 }}>
                <div style={{ fontSize:44 }}>🧪</div>
                <div style={{ fontSize:11,letterSpacing:2 }}>AWAITING SCAN</div>
              </div>
            )}
            {result && (
              <div className="result-in">
                <ConfidenceBanner isReliable={isReliable} reason={confReason} priceSource={priceSource}/>
                <div style={{ background:actionStyle?.bg||"#0d1a0e",border:`1px solid ${actionStyle?.color||"#4ade80"}30`,borderRadius:12,padding:"20px 24px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:9,color:"#6b7280",letterSpacing:2,marginBottom:5 }}>RECOMMENDED PRICE</div>
                    <div style={{ fontSize:52,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",color:actionStyle?.color||"#4ade80",lineHeight:1,opacity:isReliable?1:0.7 }}>
                      Rs.{result.recommended_price}
                      {!isReliable&&<span style={{ fontSize:12,marginLeft:8,color:"#fb923c" }}>⚠ estimate</span>}
                    </div>
                    <div style={{ fontSize:10,color:"#6b7280",marginTop:5,fontFamily:"'IBM Plex Mono',monospace" }}>
                      Base Rs.{result.base_price} → {isReliable?`ML Rs.${result.ml_price_raw}`:"IoT estimate"} → Final Rs.{result.recommended_price}
                    </div>
                    {priceSource&&<div style={{ marginTop:6 }}><Badge text={priceSource==="xgboost_ml"?"XGBoost ML":"IoT Fallback"} color={priceSource==="xgboost_ml"?"#4ade80":"#fb923c"} icon={priceSource==="xgboost_ml"?"🤖":"🌡"}/></div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:16,fontWeight:700,color:actionStyle?.color,letterSpacing:0.5,padding:"9px 18px",border:`1px solid ${actionStyle?.color}40`,borderRadius:9,background:`${actionStyle?.color}10` }}>{actionStyle?.label}</div>
                    {decision.suggested_discount_pct>0&&<div style={{ fontSize:22,fontWeight:700,color:"#facc15",marginTop:7 }}>-{decision.suggested_discount_pct}% OFF</div>}
                  </div>
                </div>
                <div style={{ marginBottom:14 }}><ShelfLifeClock hours={spoilHours} shelfDays={shelfDays}/></div>
                <Section title="Freshness Intelligence" accent="#4ade80">
                  <div style={{ display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:10,marginBottom:14 }}>
                    <RadialGauge value={result.signals.freshness} max={100} label="Freshness %" color={freshColor(result.signals.freshness)}/>
                    <RadialGauge value={+(result.signals.risk*100).toFixed(0)} max={100} label="Spoilage Risk %" color="#f87171"/>
                    <RadialGauge value={result.signals.shelf_life} max={7} label="Shelf Life days" color="#facc15"/>
                    <RadialGauge value={result.signals.dominant_conf||0} max={100} label="Model Conf %" color={isReliable?"#60a5fa":"#fb923c"}/>
                  </div>
                  <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginBottom:10 }}>
                    <Pill text={result.market_context.freshness_grade} color={freshColor(result.signals.freshness)} bg={`${freshColor(result.signals.freshness)}15`}/>
                    <Pill text={result.signals.quality} color="#60a5fa" bg="#0c1a2e"/>
                    <Pill text={result.signals.urgency} color="#fb923c" bg="#1a0e00"/>
                    <Pill text={result.market_context.season} color="#a78bfa" bg="#150d2e"/>
                    {result.market_context.is_weekend&&<Pill text="weekend" color="#34d399" bg="#021f14"/>}
                    {result.signals.iot_adjusted&&<Pill text="IoT adjusted" color="#4ade80" bg="#052e16"/>}
                  </div>
                  {iotNotes.length>0&&(
                    <div style={{ marginBottom:10 }}>
                      {iotNotes.map((note:string,i:number) => (
                        <div key={i} style={{ fontSize:10,color:"#4ade80",padding:"4px 10px",borderLeft:"2px solid #4ade8040",marginBottom:4,background:"#0a130a",borderRadius:"0 6px 6px 0" }}>📡 {note}</div>
                      ))}
                    </div>
                  )}
                </Section>
                <Section title="Vision AI — Class Probabilities" accent={isReliable?"#60a5fa":"#fb923c"}>
                  {Object.entries(result.yolo_prediction).sort((a:any,b:any)=>b[1]-a[1]).map(([cls,prob]:any) => (
                    <ProbBar key={cls} label={cls} value={prob}/>
                  ))}
                </Section>
                <Section title="Market Context" accent="#a78bfa">
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10 }}>
                    {[["Demand",result.market_context.demand_score],["Stock",result.market_context.stock],["Noise",result.market_context.market_noise]].map(([k,v]) => (
                      <div key={k} style={{ background:"#0a130a",borderRadius:7,padding:10,textAlign:"center" }}>
                        <div style={{ fontSize:18,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:"#a78bfa" }}>{v}</div>
                        <div style={{ fontSize:9,color:"#6b7280",letterSpacing:1,marginTop:3 }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  {result.market_context.alerts?.map((a:string,i:number) => (
                    <div key={i} style={{ marginTop:6,padding:"6px 10px",borderRadius:6,background:"#1a0e00",border:"1px solid #fb923c40",fontSize:11,color:"#fb923c" }}>{a}</div>
                  ))}
                </Section>
                <Section title="Decision Engine" accent={actionStyle?.color||"#4ade80"}>
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
                  <button onClick={handleConfirm} style={{ width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${actionStyle?.color}40`,background:`${actionStyle?.color}10`,color:actionStyle?.color,fontSize:11,fontWeight:700,letterSpacing:1,cursor:"pointer" }}>
                    ✅ CONFIRM I FOLLOWED THIS RECOMMENDATION
                  </button>
                </Section>
                <Section title={overrideMode?"LLM Override Explanation":"RAG + LLM Explanation"} accent={overrideMode?"#fb923c":"#f472b6"}>
                  <div style={{ fontSize:10,color:"#6b7280",marginBottom:8,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
                    <span>Groq LLaMA 3.3 70B · FAISS</span>
                    {cacheHit&&<Badge text="CACHE HIT — LLM SKIPPED" color="#a78bfa" icon="⚡"/>}
                    {overrideMode&&<Badge text="OVERRIDE MODE" color="#fb923c" icon="⚠"/>}
                  </div>
                  <p style={{ fontSize:13,lineHeight:1.9,color:"#d1d5db",fontStyle:"italic" }}>"{explText}"</p>
                  {explanation?.retrieved_docs?.length>0&&(
                    <details style={{ marginTop:10 }}>
                      <summary style={{ fontSize:10,color:"#6b7280",cursor:"pointer",letterSpacing:1 }}>
                        RETRIEVED KNOWLEDGE ({explanation.retrieved_docs.length} docs)
                      </summary>
                      <div style={{ marginTop:7 }}>
                        {explanation.retrieved_docs.map((doc:string,i:number) => (
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

        {/* IOT TAB */}
        <div style={{ display: tab === "iot" ? "block" : "none", maxWidth: 680 }}>
          <Section title="IoT Sensor Control — Environmental Intelligence" accent="#4ade80">
            <IoTPanel sensors={sensors} onUpdate={setSensors}/>
          </Section>
        </div>

        {/* GEMINI TAB */}
        <div style={{ display: tab === "gemini" ? "block" : "none" }}>
          <GeminiMultiScan
            sensors={sensors}
            itemName={itemName}
            setItemName={setItemName}
          />
        </div>

        {/* PIPELINE TAB */}
        <div style={{ display: tab === "pipeline" ? "block" : "none", maxWidth: 760 }}>
          <Section title="System Architecture — 7-Layer Intelligence Pipeline (v3)" accent="#60a5fa">
            {[
              { n:"01", name:"Vision AI",         tech:"YOLOv8s · Confidence Guard",        color:"#60a5fa", desc:"YOLO runs on image. If top-1 confidence < 55% OR distribution is flat, result is flagged unreliable — ML pricing bypassed, LLM override fires." },
              { n:"02", name:"Signal Engine + IoT", tech:"Q10 rule · Mould threshold",         color:"#4ade80", desc:"Converts YOLO probs to freshness/risk/shelf_life. IoT modifiers apply Q10 halving, mould risk, CO2 respiration, storage-hour decay." },
              { n:"03", name:"Market Context",      tech:"Deterministic demand · Season",      color:"#a78bfa", desc:"Time-aware market context. Demand = f(time, season, weekend). Spoilage hours surfaced as headline time-pressure signal." },
              { n:"04", name:"ML Pricing",          tech:"XGBoost · IoT-adjusted input",       color:"#f472b6", desc:"XGBoost predicts price from 10 features. Freshness input is IoT-adjusted. Skipped if YOLO unreliable — IoT fallback used instead." },
              { n:"05", name:"Decision Engine",     tech:"Rule-based · Discount % · Log",      color:"#facc15", desc:"Converts price to vendor instruction: action, discount %, rationale. Logs to decision_log.jsonl." },
              { n:"06", name:"Memory Cache",        tech:"FAISS score ≥ 0.92 → skip LLM",     color:"#34d399", desc:"Checks explanation_cache.jsonl before calling Groq. Same item+action+freshness-bucket+IoT-hash → returns cached explanation." },
              { n:"07", name:"RAG + LLM",           tech:"FAISS · Shelf-life prompt · Override",color:"#fb923c", desc:"Normal: shelf-life-led prompt to Groq LLaMA 3.3 70B. Override: IoT-only reasoning when YOLO unreliable." },
              { n:"🤖", name:"Gemini Scan",         tech:"gemini-2.0-flash · Free tier",       color:"#60a5fa", desc:"Gemini Vision replaces YOLO (Layer 1). Same pipeline runs on its output. Backend-proxied — key never leaves server." },
            ].map((step,i,arr) => (
              <div key={i} style={{ display:"flex",gap:14,marginBottom:18,position:"relative" }}>
                {i<arr.length-1&&<div style={{ position:"absolute",left:17,top:40,width:2,height:"calc(100% + 4px)",background:"#1e2a1a" }}/>}
                <div style={{ width:36,height:36,borderRadius:9,background:`${step.color}15`,border:`1px solid ${step.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <span style={{ fontSize:9,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:step.color }}>{step.n}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700,fontSize:13,color:step.color }}>{step.name}</span>
                    <span style={{ fontSize:9,color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace" }}>{step.tech}</span>
                  </div>
                  <p style={{ fontSize:11,color:"#9ca3af",lineHeight:1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </Section>
        </div>

      </div>
    </div>
  )
}