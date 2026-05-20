// =====================================================
// IoTControlPanel.jsx
// =====================================================
// Drop into your React project and import in App.jsx:
// import IoTControlPanel from './IoTControlPanel'
//
// Usage:
// <IoTControlPanel sensors={sensors} onUpdate={setSensors} />
//
// Props:
//   sensors  — current sensor state object
//   onUpdate — callback(newSensors) when any value changes
// =====================================================

import { useState, useEffect, useRef } from "react"

// ─── Scenario presets ────────────────────────────────
// Each maps to realistic storage conditions that
// would affect freshness prediction in production

const SCENARIOS = [
  {
    id:          "ideal",
    label:       "Ideal storage",
    description: "Cool, low humidity — maximum shelf life",
    color:       "#4ade80",
    values:      { temperature: 18, humidity: 55, co2_ppm: 400, storage_hours: 4 },
  },
  {
    id:          "morning_market",
    label:       "Morning market",
    description: "Typical open-air mandi at 8 AM",
    color:       "#facc15",
    values:      { temperature: 26, humidity: 65, co2_ppm: 415, storage_hours: 8 },
  },
  {
    id:          "afternoon_heat",
    label:       "Afternoon heat",
    description: "Outdoor stall, peak summer afternoon",
    color:       "#fb923c",
    values:      { temperature: 36, humidity: 72, co2_ppm: 440, storage_hours: 18 },
  },
  {
    id:          "monsoon",
    label:       "Monsoon conditions",
    description: "High humidity — accelerated mould risk",
    color:       "#60a5fa",
    values:      { temperature: 29, humidity: 88, co2_ppm: 430, storage_hours: 12 },
  },
  {
    id:          "cold_storage",
    label:       "Cold storage",
    description: "Refrigerated warehouse — extended life",
    color:       "#a78bfa",
    values:      { temperature: 8, humidity: 60, co2_ppm: 390, storage_hours: 48 },
  },
  {
    id:          "spoilage_risk",
    label:       "Critical — near spoilage",
    description: "High temp, high CO2 — act immediately",
    color:       "#f87171",
    values:      { temperature: 38, humidity: 82, co2_ppm: 560, storage_hours: 30 },
  },
]

// ─── Sensor config ────────────────────────────────
const SENSOR_CONFIG = [
  {
    key:    "temperature",
    label:  "Temperature",
    unit:   "°C",
    min:    0,
    max:    50,
    step:   0.5,
    warn:   32,
    danger: 36,
    effect: "Above 34°C doubles banana ripening rate",
  },
  {
    key:    "humidity",
    label:  "Humidity",
    unit:   "%",
    min:    20,
    max:    100,
    step:   1,
    warn:   75,
    danger: 85,
    effect: "Above 80% enables mould growth within 24h",
  },
  {
    key:    "co2_ppm",
    label:  "CO₂ concentration",
    unit:   " ppm",
    min:    350,
    max:    700,
    step:   5,
    warn:   450,
    danger: 550,
    effect: "High CO₂ = active respiration = faster aging",
  },
  {
    key:    "storage_hours",
    label:  "Hours in storage",
    unit:   " h",
    min:    0,
    max:    72,
    step:   1,
    warn:   20,
    danger: 36,
    effect: "Combined with temperature determines real shelf life",
  },
]

// ─── Ambient light options ────────────────────────
const LIGHT_OPTIONS = ["dark storage", "low light", "moderate", "bright sunlight"]

// ─── Helpers ─────────────────────────────────────
function sensorColor(value, warn, danger) {
  if (value >= danger) return "var(--color-text-danger)"
  if (value >= warn)   return "var(--color-text-warning)"
  return "var(--color-text-success)"
}

function sensorBg(value, warn, danger) {
  if (value >= danger) return "var(--color-background-danger)"
  if (value >= warn)   return "var(--color-background-warning)"
  return "var(--color-background-success)"
}

function getAlerts(sensors) {
  const alerts = []
  if (sensors.temperature >= 36)
    alerts.push({ level: "danger", msg: "Temperature critical — spoilage accelerated 2-3×" })
  else if (sensors.temperature >= 32)
    alerts.push({ level: "warning", msg: "Temperature elevated — monitor closely" })

  if (sensors.humidity >= 85)
    alerts.push({ level: "danger", msg: "Humidity critical — mould risk within hours" })
  else if (sensors.humidity >= 75)
    alerts.push({ level: "warning", msg: "High humidity — consider ventilation" })

  if (sensors.co2_ppm >= 550)
    alerts.push({ level: "danger", msg: "CO₂ high — active decomposition detected" })
  else if (sensors.co2_ppm >= 450)
    alerts.push({ level: "warning", msg: "CO₂ elevated — poor air circulation" })

  if (sensors.storage_hours >= 36)
    alerts.push({ level: "danger", msg: `Stored ${sensors.storage_hours}h — condition check required` })
  else if (sensors.storage_hours >= 20)
    alerts.push({ level: "warning", msg: `Stored ${sensors.storage_hours}h — approaching safe limit` })

  if (sensors.ambient_light === "bright sunlight")
    alerts.push({ level: "warning", msg: "Direct sunlight exposure — increases temperature locally" })

  return alerts
}

// ─── Component ───────────────────────────────────
export default function IoTControlPanel({ sensors, onUpdate }) {
  const [liveMode, setLiveMode]     = useState(false)
  const [activePreset, setPreset]   = useState(null)
  const [expanded, setExpanded]     = useState({})
  const intervalRef = useRef(null)

  // Live simulation drift
  useEffect(() => {
    if (!liveMode) {
      clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      onUpdate(prev => {
        const min = prev.minute || 0
        return {
          ...prev,
          temperature:   +(prev.temperature + (Math.random() - 0.48) * 0.3).toFixed(1),
          humidity:      Math.min(95, Math.max(20, +(prev.humidity   + (Math.random() - 0.5) * 1.2).toFixed(1))),
          co2_ppm:       Math.round(Math.min(700, Math.max(350, prev.co2_ppm + (Math.random() - 0.5) * 8))),
          storage_hours: +(prev.storage_hours + 0.02).toFixed(2),
          minute:        min + 1,
        }
      })
      setPreset(null) // clear preset when drifting
    }, 2000)
    return () => clearInterval(intervalRef.current)
  }, [liveMode, onUpdate])

  const applyPreset = (scenario) => {
    setPreset(scenario.id)
    setLiveMode(false)
    onUpdate(prev => ({ ...prev, ...scenario.values }))
  }

  const updateSensor = (key, value) => {
    setPreset(null)
    onUpdate(prev => ({ ...prev, [key]: value }))
  }

  const alerts = getAlerts(sensors)

  return (
    <div style={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>

      {/* ── Section: Scenario presets ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
          Storage scenario presets
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => applyPreset(s)}
              style={{
                padding:       "10px 8px",
                borderRadius:  "var(--border-radius-md)",
                border:        `1px solid ${activePreset === s.id ? s.color : "var(--color-border-tertiary)"}`,
                background:    activePreset === s.id ? `${s.color}15` : "var(--color-background-secondary)",
                color:         activePreset === s.id ? s.color : "var(--color-text-secondary)",
                cursor:        "pointer",
                fontSize:      11,
                fontWeight:    activePreset === s.id ? 500 : 400,
                textAlign:     "left",
                transition:    "all 0.15s",
                lineHeight:    1.4,
              }}
            >
              <div style={{ marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", fontWeight: 400 }}>{s.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section: Manual sliders ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", letterSpacing: 1, textTransform: "uppercase" }}>
            Manual sensor control
          </span>
          <button
            onClick={() => setLiveMode(v => !v)}
            style={{
              padding:      "4px 12px",
              borderRadius: "var(--border-radius-md)",
              border:       `1px solid ${liveMode ? "var(--color-border-success)" : "var(--color-border-tertiary)"}`,
              background:   liveMode ? "var(--color-background-success)" : "transparent",
              color:        liveMode ? "var(--color-text-success)" : "var(--color-text-secondary)",
              cursor:       "pointer",
              fontSize:     11,
              fontWeight:   500,
            }}
          >
            {liveMode ? "⏹ Stop live" : "▶ Live drift"}
          </button>
        </div>

        {SENSOR_CONFIG.map(cfg => {
          const val   = sensors[cfg.key] ?? cfg.min
          const color = sensorColor(val, cfg.warn, cfg.danger)
          const bg    = sensorBg(val, cfg.warn, cfg.danger)
          const pct   = ((val - cfg.min) / (cfg.max - cfg.min)) * 100
          const isExp = expanded[cfg.key]

          return (
            <div key={cfg.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{cfg.label}</span>
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [cfg.key]: !e[cfg.key] }))}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--color-text-tertiary)", padding: 0 }}
                    title="Why this matters"
                  >
                    {isExp ? "▲" : "▼ why?"}
                  </button>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 500, color,
                  background: bg, padding: "2px 8px", borderRadius: 4
                }}>
                  {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}{cfg.unit}
                </span>
              </div>

              {isExp && (
                <div style={{
                  fontSize: 11, color: "var(--color-text-secondary)",
                  background: "var(--color-background-secondary)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "6px 10px", marginBottom: 6
                }}>
                  {cfg.effect}
                </div>
              )}

              {/* Track with threshold markers */}
              <div style={{ position: "relative", marginBottom: 4 }}>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={val}
                  onChange={e => updateSensor(cfg.key, +e.target.value)}
                  style={{ width: "100%" }}
                />
                {/* Warn + danger threshold markers */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none", height: "100%", display: "flex", alignItems: "center" }}>
                  {[{ v: cfg.warn, c: "#facc15" }, { v: cfg.danger, c: "#f87171" }].map(m => (
                    <div key={m.v} style={{
                      position: "absolute",
                      left: `${((m.v - cfg.min) / (cfg.max - cfg.min)) * 100}%`,
                      width: 2, height: 12, background: m.c, opacity: 0.6, borderRadius: 1,
                      transform: "translateX(-50%) translateY(2px)"
                    }}/>
                  ))}
                </div>
              </div>

              {/* Min / warn / danger / max labels */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--color-text-tertiary)" }}>
                <span>{cfg.min}{cfg.unit}</span>
                <span style={{ color: "#facc1590" }}>warn {cfg.warn}</span>
                <span style={{ color: "#f8717190" }}>critical {cfg.danger}</span>
                <span>{cfg.max}{cfg.unit}</span>
              </div>
            </div>
          )
        })}

        {/* Ambient light — option list */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginBottom: 8 }}>Ambient light</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LIGHT_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => updateSensor("ambient_light", opt)}
                style={{
                  padding:      "5px 12px",
                  borderRadius: 20,
                  border:       `1px solid ${sensors.ambient_light === opt ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
                  background:   sensors.ambient_light === opt ? "var(--color-background-secondary)" : "transparent",
                  color:        sensors.ambient_light === opt ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  cursor:       "pointer",
                  fontSize:     12,
                  fontWeight:   sensors.ambient_light === opt ? 500 : 400,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Smart risk alerts
          </div>
          {alerts.map((a, i) => (
            <div key={i} style={{
              padding:      "8px 12px",
              borderRadius: "var(--border-radius-md)",
              border:       `0.5px solid var(--color-border-${a.level})`,
              background:   `var(--color-background-${a.level})`,
              color:        `var(--color-text-${a.level})`,
              fontSize:     12,
              marginBottom: 6,
            }}>
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── Production note ── */}
      <div style={{
        marginTop: 20, padding: "10px 14px",
        borderRadius: "var(--border-radius-md)",
        border: "0.5px dashed var(--color-border-tertiary)",
        fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.7
      }}>
        In production: Raspberry Pi + DHT22 (temp/humidity) + MQ-135 (CO₂) → MQTT broker
        → FastAPI /sensor endpoint → merged with YOLO freshness score → adjusted pricing.
        <br/>
        Market demand: Agmarknet API (free, daily mandi arrival + price data for all commodities).
      </div>
    </div>
  )
}