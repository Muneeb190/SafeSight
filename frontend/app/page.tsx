'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileImage,
  FileVideo,
  HardHat,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react'
import LandingPage from '@/components/LandingPage'
import {
  api,
  type HealthResponse,
  type ImageDetectionResponse,
  type Inspection,
  type SafetyAssessment,
  type Detection,
} from '@/src/api'

/* ─── Types ─── */
type View = 'landing' | 'overview' | 'image' | 'video' | 'webcam' | 'history' | 'models'

/* ─── Helpers ─── */
function confClass(conf: number) {
  if (conf >= 0.8) return 'high'
  if (conf >= 0.5) return 'mid'
  return 'low'
}

function isViolation(className: string) {
  const name = className.toLowerCase().replace(/_/g, ' ')
  return (
    /\b(no|without|missing)\s+(hat|helmet|hard\s*hat|vest|boot|boots|glove|gloves|glass|glasses)\b/.test(name) ||
    /\b(hat|helmet|vest|boot|boots|glove|gloves)[_\s-]*missing\b/.test(name)
  )
}

function getAssessmentInfo(a?: SafetyAssessment | string, detectionsCount: number = 0): {
  level: 'safe' | 'violation' | 'warning' | 'neutral' | 'unknown'
  title: string
  detail: string
} {
  if (!a) return { level: 'unknown', title: 'No assessment', detail: 'Run detection to get a safety assessment.' }
  if (typeof a === 'string') return { level: 'unknown', title: a, detail: '' }
  if (a.status === 'potential_violation') {
    const v = a.violations?.join(', ') || 'Missing PPE detected'
    return { level: 'violation', title: 'Potential violation detected', detail: v }
  }
  if (a.status === 'no_supported_violation_detected') {
    if (detectionsCount === 0) {
      return {
        level: 'neutral',
        title: 'No personnel detected',
        detail: 'Zero worker or PPE detections in frame. Safety compliance unverified.',
      }
    }
    return { level: 'safe', title: 'No violations detected', detail: 'Worker appears compliant. Human review recommended.' }
  }
  if (a.status === 'unsupported') {
    return { level: 'warning', title: 'Model lacks PPE rules', detail: 'Positive detections only — cannot confirm compliance.' }
  }
  return { level: 'unknown', title: 'Assessment unavailable', detail: '' }
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

/* ─── Object icon by class name ─── */
function ObjectIcon({ className }: { className: string }) {
  const name = className.toLowerCase()
  if (name.includes('human') || name.includes('person')) return <Shield size={12} />
  if (name.includes('hat') || name.includes('helmet')) return <HardHat size={12} />
  if (name.includes('vest')) return <ShieldCheck size={12} />
  if (name.includes('boot')) return <Zap size={12} />
  if (name.includes('glove')) return <Activity size={12} />
  if (name.includes('glass')) return <Eye size={12} />
  return <ShieldAlert size={12} />
}

/* ─── Sidebar ─── */
const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'landing', label: 'Home / About', icon: Sparkles },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'image', label: 'Image analysis', icon: ImageIcon },
  { id: 'video', label: 'Video analysis', icon: FileVideo },
  { id: 'webcam', label: 'Live webcam', icon: Camera },
  { id: 'history', label: 'Analysis history', icon: Clock },
  { id: 'models', label: 'Models', icon: Zap },
]

function Sidebar({
  view,
  setView,
  health,
}: {
  view: View
  setView: (v: View) => void
  health: HealthResponse | null
}) {
  const modelOk = health?.model_loaded
  return (
    <aside className="sidebar">
      {/* Logo */}
      <button
        type="button"
        className="sidebar-logo"
        onClick={() => setView('landing')}
        title="Return to Home / About"
        aria-label="Return to SafeSight Home"
        style={{ width: '100%', textAlign: 'left', background: 'transparent' }}
      >
        <img
          src="/logo.png"
          alt="SafeSight Logo"
          className="logo-icon-img"
        />
        <span className="logo-name">
          SafeSight <span>AI</span>
        </span>
      </button>

      {/* Navigation section */}
      <div className="sidebar-section">
        <div className="sidebar-label">Workspace</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >
            <item.icon size={15} className="item-icon" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom Status & Info */}
      <div className="sidebar-bottom">
        <div className="usage-block">
          <div className="usage-label">
            <span>Backend status</span>
          </div>
          <div className="usage-sub">
            {!health
              ? 'Offline — start FastAPI server'
              : modelOk
                ? 'Model loaded · Ready'
                : 'Connected · Model weights missing'}
          </div>
          <div className="usage-bar-wrap">
            <div
              className="usage-bar"
              style={{
                width: !health ? '0%' : modelOk ? '100%' : '50%',
                background: !health ? 'var(--red)' : modelOk ? undefined : 'var(--amber)',
              }}
            />
          </div>
        </div>

        <button
          className="sidebar-item"
          style={{ marginTop: 4 }}
          onClick={() => setView('landing')}
        >
          <HelpCircle size={15} className="item-icon" />
          Safety workspace guide
        </button>

        <div className="user-row">
          <div className="user-avatar">SS</div>
          <div>
            <div className="user-name">Safety Officer</div>
            <div className="user-plan">SafeSight Production</div>
          </div>
          <MoreHorizontal size={14} className="ml-auto" />
        </div>
      </div>
    </aside>
  )
}

/* ─── Overview View ─── */
function OverviewView({
  health,
  inspections,
  setView,
}: {
  health: HealthResponse | null
  inspections: Inspection[]
  setView: (v: View) => void
}) {
  const modelOk = health?.model_loaded
  const totalInspections = inspections.length
  const totalViolations = inspections.reduce((acc, curr) => {
    if (typeof curr.safety_assessment === 'object' && curr.safety_assessment?.violations?.length) {
      return acc + curr.safety_assessment.violations.length
    }
    return acc + (curr.potential_violations ?? 0)
  }, 0)

  const clearInspections = inspections.filter((item) => {
    if (typeof item.safety_assessment === 'object' && item.safety_assessment?.violations?.length) {
      return false
    }
    return (item.potential_violations ?? 0) === 0
  }).length

  const complianceRate = totalInspections > 0 ? Math.round((clearInspections / totalInspections) * 100) : 100

  return (
    <div className="overview-dashboard">
      {/* Page Header */}
      <div className="page-header" style={{ padding: '0 0 16px', background: 'transparent', borderBottom: 'none' }}>
        <div className="page-title-group">
          <div className="page-title">
            <h1>Workspace Overview</h1>
          </div>
          <div className="page-subtitle">
            Real-time workplace safety posture, inspection history, and PPE detection status.
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setView('image')}>
            <Plus size={14} /> New Inspection
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span>Total Inspections</span>
            <div className="kpi-icon">
              <Clock size={14} />
            </div>
          </div>
          <div className="kpi-value">{totalInspections}</div>
          <div className="kpi-sub">Images, videos &amp; live frames</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Compliance Rate</span>
            <div className="kpi-icon">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="kpi-value">{complianceRate}%</div>
          <div className={`kpi-sub ${complianceRate >= 90 ? 'green' : 'red'}`}>
            {clearInspections} of {totalInspections || 0} clear
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Violations Detected</span>
            <div className="kpi-icon">
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: totalViolations > 0 ? 'var(--red)' : 'var(--text)' }}>
            {totalViolations}
          </div>
          <div className="kpi-sub">Missing PPE flagged</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Active Model</span>
            <div className="kpi-icon">
              <Zap size={14} />
            </div>
          </div>
          <div className="kpi-value" style={{ fontSize: 18, paddingTop: 4 }}>
            {modelOk ? 'YOLOv8 PPE' : 'Model Offline'}
          </div>
          <div className={`kpi-sub ${modelOk ? 'green' : 'red'}`}>
            {modelOk ? 'Ready for inference' : 'Weights missing'}
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="quick-actions-grid">
        <button
          type="button"
          className="action-card"
          onClick={() => setView('image')}
          aria-label="Open image analysis"
        >
          <div className="action-card-icon">
            <ImageIcon size={20} />
          </div>
          <div>
            <span className="action-card-title">Image Analysis</span>
            <span className="action-card-desc">Inspect site photos with annotated PPE bounding boxes</span>
          </div>
          <ArrowRight size={16} className="action-card-arrow" />
        </button>

        <button
          type="button"
          className="action-card"
          onClick={() => setView('video')}
          aria-label="Open video analysis"
        >
          <div className="action-card-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
            <FileVideo size={20} />
          </div>
          <div>
            <span className="action-card-title">Video Analysis</span>
            <span className="action-card-desc">Process CCTV and bodycam footage frame-by-frame</span>
          </div>
          <ArrowRight size={16} className="action-card-arrow" />
        </button>

        <button
          type="button"
          className="action-card"
          onClick={() => setView('webcam')}
          aria-label="Open live webcam inspection"
        >
          <div className="action-card-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber-dark)' }}>
            <Camera size={20} />
          </div>
          <div>
            <span className="action-card-title">Live Webcam</span>
            <span className="action-card-desc">Stream live camera feed with real-time PPE check</span>
          </div>
          <ArrowRight size={16} className="action-card-arrow" />
        </button>
      </div>

      {/* Two-column Detail Cards */}
      <div className="overview-columns">
        {/* Recent Inspections */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title">Recent Inspections</span>
            <button
              type="button"
              className="panel-card-link"
              onClick={() => setView('history')}
              aria-label="View all inspection history"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div style={{ flex: 1, overflowX: 'auto' }}>
            {inspections.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>
                <Clock size={28} strokeWidth={1} style={{ margin: '0 auto 8px', color: 'var(--icon-muted)' }} />
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No inspections recorded yet.</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                  Run an image or video inspection to view results here.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Source</th>
                    <th>Objects</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.slice(0, 6).map((item, i) => {
                    const objCount = item.detections?.length ?? item.detected_objects ?? 0
                    const info = getAssessmentInfo(item.safety_assessment, objCount)
                    const tagClass = info.level === 'violation' ? 'tag-red' : info.level === 'neutral' ? 'tag-gray' : 'tag-green'
                    return (
                      <tr
                        key={item.inspection_id ?? i}
                        className="clickable-row"
                        role="button"
                        tabIndex={0}
                        aria-label="View history"
                        onClick={() => setView('history')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setView('history')
                          }
                        }}
                      >
                        <td>{item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'Recent'}</td>
                        <td>
                          <span className="tag tag-gray">{item.source || 'image'}</span>
                        </td>
                        <td>{objCount}</td>
                        <td>
                          <span className={`tag ${tagClass}`}>
                            {info.level === 'violation' ? 'Violation' : info.level === 'neutral' ? 'Unverified' : 'Clear'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* PPE Rules & Detection Overview */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title">Site PPE Policy Benchmarks</span>
            <span className="tag tag-gray">OSHA / ANSI</span>
          </div>
          <div className="compliance-list">
            <div className="compliance-item">
              <div className="compliance-item-header">
                <span>Hard Hat / Helmet</span>
                <span className="tag tag-green">100% Mandatory</span>
              </div>
              <div className="compliance-bar-bg">
                <div className="compliance-bar-fill" style={{ width: '100%', background: 'var(--green)' }} />
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-header">
                <span>High-Visibility Safety Vest</span>
                <span className="tag tag-green">100% Mandatory</span>
              </div>
              <div className="compliance-bar-bg">
                <div className="compliance-bar-fill" style={{ width: '100%', background: 'var(--green)' }} />
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-header">
                <span>Steel-Toe Safety Boots</span>
                <span className="tag tag-gray">Active Zones</span>
              </div>
              <div className="compliance-bar-bg">
                <div className="compliance-bar-fill" style={{ width: '85%', background: 'var(--green)' }} />
              </div>
            </div>

            <div className="compliance-item">
              <div className="compliance-item-header">
                <span>Eye &amp; Face Protection</span>
                <span className="tag tag-gray">Hazard Dependent</span>
              </div>
              <div className="compliance-bar-bg">
                <div className="compliance-bar-fill" style={{ width: '70%', background: 'var(--green)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Image Analysis View (Direct Results, No Settings Tab) ─── */
function ImageAnalysisView({ health }: { health: HealthResponse | null }) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [confidence, setConfidence] = useState(0.5)
  const [result, setResult] = useState<ImageDetectionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [showBoxes, setShowBoxes] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [drag, setDrag] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectFile = (f: File) => {
    setFile(f)
    setResult(null)
    setSelectedIdx(null)
    setHoveredIdx(null)
    setImageDimensions({ width: 0, height: 0 })
    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const runDetection = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    setSelectedIdx(null)
    setHoveredIdx(null)
    try {
      const res = await api.detectImage(file, confidence, true)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed.')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    const url = result ? api.annotatedImageUrl(result) : previewUrl
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `safesight-detection-${Date.now()}.jpg`
    a.click()
  }

  const detections: Detection[] = result?.detections || []
  const assessment = getAssessmentInfo(result?.safety_assessment, detections.length)
  const pct = Math.round(confidence * 100)
  const modelOk = health?.model_loaded
  const selected = selectedIdx !== null ? detections[selectedIdx] : null

  return (
    <>
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title">
            <h1>Image analysis</h1>
            <span className="beta-badge">AI Vision</span>
          </div>
          <div className="page-subtitle">
            Upload an image to detect workers, safety gear, and flagged PPE violations.
          </div>
        </div>
        <div className="page-actions">
          {previewUrl && (
            <button className="btn btn-secondary" onClick={download}>
              <Download size={13} />
              Export
            </button>
          )}
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
            {file ? 'Replace image' : 'Upload image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
          />
        </div>
      </div>

      {/* Main Workspace */}
      <div className="workspace-area">
        {/* Left / Center: Image Stage */}
        <div className="image-stage">
          {file && (
            <div className="image-toolbar">
              <div className="file-info">
                <FileImage size={13} />
                <span className="file-name">{file.name}</span>
                <span className="file-meta">{formatBytes(file.size)}</span>
              </div>
              <div className="toolbar-sep" />
              <div className="toggle-wrap">
                <span>Boxes</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    aria-label="Toggle bounding boxes visibility"
                    checked={showBoxes}
                    onChange={(e) => setShowBoxes(e.target.checked)}
                  />
                  <div className="toggle-track" />
                  <div className="toggle-thumb" />
                </label>
              </div>
              <div className="toolbar-right">
                <button
                  className="btn btn-secondary btn-icon"
                  title="Fit view"
                  onClick={() => setZoom(100)}
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Choose a different image"
                >
                  <Upload size={12} />
                  Replace
                </button>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="image-canvas">
            {previewUrl ? (
              <div
                className="canvas-img-wrap"
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={result && showBoxes ? api.annotatedImageUrl(result) : previewUrl}
                  alt="Inspection target"
                  onLoad={(e) => {
                    const img = e.currentTarget
                    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
                  }}
                />
                {imageDimensions.width > 0 && showBoxes && detections.length > 0 && (
                  <svg
                    viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    {detections.map((det, idx) => {
                      const [x1, y1, x2, y2] = det.box || [0, 0, 0, 0]
                      const isSelected = selectedIdx === idx
                      const isHovered = hoveredIdx === idx
                      const violation = isViolation(det.class_name)
                      if (x2 <= x1 || y2 <= y1) return null

                      return (
                        <g
                          key={idx}
                          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                          onClick={() => setSelectedIdx(isSelected ? null : idx)}
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        >
                          {(isSelected || isHovered) && (
                            <>
                              <rect
                                x={x1 - 3}
                                y={y1 - 3}
                                width={x2 - x1 + 6}
                                height={y2 - y1 + 6}
                                fill={violation ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
                                stroke={isSelected ? '#38bdf8' : violation ? '#ef4444' : '#10b981'}
                                strokeWidth={isSelected ? 4 : 2}
                                strokeDasharray={isSelected ? '6,3' : undefined}
                                rx={4}
                              />
                              <rect
                                x={x1}
                                y={Math.max(0, y1 - 24)}
                                width={Math.max(80, (det.class_name.length + 6) * 9)}
                                height={22}
                                fill={isSelected ? '#0284c7' : violation ? '#dc2626' : '#059669'}
                                rx={3}
                              />
                              <text
                                x={x1 + 6}
                                y={Math.max(0, y1 - 24) + 15}
                                fill="#ffffff"
                                fontSize={12}
                                fontWeight={600}
                                fontFamily="system-ui, sans-serif"
                              >
                                {det.class_name} {Math.round(det.confidence * 100)}%
                              </text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>
            ) : (
              <div
                className={`drop-zone-panel ${drag ? 'drag-over' : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Drop an image here, or browse your files"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDrag(true)
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDrag(false)
                  const f = e.dataTransfer.files[0]
                  if (f) selectFile(f)
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{ margin: 24, alignSelf: 'center', width: 'calc(100% - 48px)' }}
              >
                <div className="drop-icon-circle">
                  <Upload size={17} />
                </div>
                <div className="drop-text">
                  <strong>Drop an image here, or browse your files</strong>
                  <p>JPG, PNG or WebP · Up to 10 MB</p>
                </div>
                <div className="drop-browse">
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <FileImage size={13} />
                    Browse files
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="processing-overlay">
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <p>Analyzing workplace safety…</p>
              </div>
            )}

            {previewUrl && (
              <div className="zoom-bar">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(z - 15, 40))}
                >
                  −
                </button>
                <span>{zoom}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(z + 15, 200))}
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Status bar */}
          {result && (
            <div className="status-bar">
              <span className="status-ok">
                <span className="dot" />
                Analysis complete
              </span>
              <span>·</span>
              <span>{detections.length} objects detected</span>
              {result.model_version && (
                <>
                  <span>·</span>
                  <span>{result.model_version.slice(0, 12)}</span>
                </>
              )}
              <div className="status-bar-right">{file && `${file.name}`}</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-err" style={{ margin: '10px 14px' }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* Model missing warning */}
          {health && !modelOk && (
            <div className="alert alert-warn" style={{ margin: '10px 14px' }}>
              <AlertTriangle size={14} />
              <div>
                <strong>Model weights needed.</strong> Place <code>best.pt</code> at{' '}
                <code>backend/models/best.pt</code> then restart the backend.
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Results Directly (No Settings Tab) ── */}
        <div className="results-panel">
          <div className="results-header">
            <span className="results-panel-title">
              <ShieldCheck size={14} />
              Results
            </span>
            {result && (
              <span className="tab-count">{detections.length} objects</span>
            )}
          </div>

          <div className="results-body">
            {/* Always visible: Confidence Threshold Slider */}
            <div className="confidence-section">
              <div className="conf-label">
                <span>Confidence threshold</span>
                <span className="conf-val">{pct}%</span>
              </div>
              <input
                type="range"
                className="conf-slider"
                aria-label="Detection confidence threshold"
                aria-valuemin={5}
                aria-valuemax={95}
                aria-valuenow={pct}
                aria-valuetext={`${pct}% confidence`}
                min={0.05}
                max={0.95}
                step={0.05}
                value={confidence}
                style={{ '--pct': `${((confidence - 0.05) / 0.9) * 100}%` } as React.CSSProperties}
                onChange={(e) => setConfidence(Number(e.target.value))}
              />
            </div>

            {/* Run Button if image loaded */}
            {file && !result && (
              <div style={{ padding: '12px 14px 6px' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={loading || !modelOk}
                  onClick={runDetection}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 14, height: 14 }} />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      Run analysis
                    </>
                  )}
                </button>
              </div>
            )}

            {result ? (
              <>
                {/* Overview stats */}
                <div className="overview-section">
                  <div className="overview-row">
                    <div className="overview-stat">
                      <div className="overview-label">Objects detected</div>
                      <div className="overview-value">
                        {detections.length}
                        <br />
                        <small>
                          {new Set(detections.map((d) => d.class_name)).size} classes
                        </small>
                      </div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-label">Avg. confidence</div>
                      <div className="overview-value">
                        {detections.length
                          ? `${Math.round(
                            (detections.reduce((s, d) => s + d.confidence, 0) /
                              detections.length) *
                            100
                          )}`
                          : '—'}
                        <small>%</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model info */}
                <div className="model-row">
                  <div className="model-icon">
                    <Zap size={12} />
                  </div>
                  <span className="model-name">YOLOv8 · SafeSight</span>
                  <div className="model-action">
                    {modelOk ? 'Loaded' : 'Missing'}
                  </div>
                </div>

                {/* Assessment banner */}
                <div className={`assessment-banner ${assessment.level}`}>
                  <div>
                    {assessment.level === 'violation' ? (
                      <ShieldAlert size={14} />
                    ) : assessment.level === 'safe' ? (
                      <ShieldCheck size={14} />
                    ) : assessment.level === 'neutral' ? (
                      <HelpCircle size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                  </div>
                  <div>
                    <span className="banner-title">{assessment.title}</span>
                    {assessment.detail && (
                      <span className="banner-detail">{assessment.detail}</span>
                    )}
                  </div>
                </div>

                {/* Detected objects list */}
                <div className="objects-header">
                  <span className="objects-title">
                    Detected objects ({detections.length})
                  </span>
                  <span className="objects-sort">
                    Confidence <ChevronDown size={11} />
                  </span>
                </div>

                {detections.length === 0 ? (
                  <div className="empty-results">
                    <ShieldCheck size={28} strokeWidth={1} />
                    <p>No objects were detected above the threshold.</p>
                  </div>
                ) : (
                  [...detections]
                    .sort((a, b) => b.confidence - a.confidence)
                    .map((det, i) => {
                      const origIdx = detections.indexOf(det)
                      const violation = isViolation(det.class_name)
                      return (
                        <div
                          key={i}
                          role="button"
                          tabIndex={0}
                          aria-label={`Detection: ${det.class_name}, ${Math.round(det.confidence * 100)}% confidence`}
                          className={`object-item ${violation ? 'violation' : ''} ${selectedIdx === origIdx ? 'selected' : ''} ${hoveredIdx === origIdx ? 'hovered' : ''}`}
                          onClick={() => setSelectedIdx(selectedIdx === origIdx ? null : origIdx)}
                          onMouseEnter={() => setHoveredIdx(origIdx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedIdx(selectedIdx === origIdx ? null : origIdx)
                            }
                          }}
                        >
                          <div className="object-icon">
                            <ObjectIcon className={det.class_name} />
                          </div>
                          <span className="object-label">{det.class_name}</span>
                          <span className={`object-conf ${confClass(det.confidence)}`}>
                            {Math.round(det.confidence * 100)}%
                          </span>
                          <button
                            className="eye-btn btn"
                            style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0 }}
                            aria-label={`Inspect ${det.class_name} detection`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      )
                    })
                )}

                {/* Bounding box detail for selected */}
                {selected && (
                  <div className="bbox-section">
                    <div className="bbox-title">
                      <span>{selected.class_name}</span>
                      <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>
                        OBJECT #{selectedIdx! + 1}
                      </span>
                    </div>
                    <div className="bbox-grid">
                      <div className="bbox-cell">
                        <span className="bbox-axis">X</span>
                        <span className="bbox-num">{Math.round(selected.box?.[0] ?? 0)}</span>
                      </div>
                      <div className="bbox-cell">
                        <span className="bbox-axis">Y</span>
                        <span className="bbox-num">{Math.round(selected.box?.[1] ?? 0)}</span>
                      </div>
                      <div className="bbox-cell">
                        <span className="bbox-axis">W</span>
                        <span className="bbox-num">
                          {Math.round((selected.box?.[2] ?? 0) - (selected.box?.[0] ?? 0))}
                        </span>
                      </div>
                      <div className="bbox-cell">
                        <span className="bbox-axis">H</span>
                        <span className="bbox-num">
                          {Math.round((selected.box?.[3] ?? 0) - (selected.box?.[1] ?? 0))}
                        </span>
                      </div>
                    </div>
                    <p className="bbox-note">Bounding box coordinates in original image pixels.</p>
                  </div>
                )}

                {/* Re-run Button */}
                <div style={{ padding: '10px 14px 14px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={loading}
                    onClick={runDetection}
                  >
                    {loading ? (
                      <>
                        <div className="spinner" style={{ width: 13, height: 13 }} />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        Re-run analysis
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Empty state before running analysis */
              <>
                <div className="model-row">
                  <div className="model-icon">
                    <Zap size={12} />
                  </div>
                  <span className="model-name">YOLOv8 · SafeSight</span>
                  <div className="model-action">
                    {modelOk ? 'Loaded' : <span style={{ color: 'var(--red)' }}>Missing</span>}
                  </div>
                </div>
                <div className="empty-results">
                  <ZoomIn size={28} strokeWidth={1} style={{ color: 'var(--border-2)' }} />
                  <p>Upload an image and run analysis to inspect detected PPE objects here.</p>
                </div>
              </>
            )}

            <div className="privacy-note">
              <Shield size={11} />
              Your images stay private. Always.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Video Analysis View (Direct Results, No Settings Tab) ─── */
function VideoAnalysisView({ health }: { health: HealthResponse | null }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const modelOk = health?.model_loaded

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Abort any in-flight video polling when the view unmounts
      abortRef.current?.abort()
    }
  }, [])

  const selectFile = (f: File) => {
    setFile(f)
    setVideoUrl('')
    setError('')
  }

  const run = async () => {
    if (!file) return
    // Cancel previous run if still polling
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    setLoading(true)
    setProgress(0)
    setError('')
    setStatusText('Uploading…')
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    try {
      const blob = await api.detectVideo(file, (job) => {
        if (signal.aborted || !mountedRef.current) return
        setProgress(Math.round(job.progress))
        if (job.status === 'processing') setStatusText(`Processing: ${job.frames_processed}/${job.total_frames || '?'} frames`)
        else if (job.status === 'queued') setStatusText('Queued…')
        else if (job.status === 'completed') setStatusText('Finalizing…')
      })
      if (!signal.aborted && mountedRef.current) {
        setVideoUrl(URL.createObjectURL(blob))
      }
    } catch (e) {
      if (!signal.aborted && mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Video processing failed.')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setStatusText('')
      }
    }
  }

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title">
            <h1>Video analysis</h1>
            <span className="beta-badge">Batch Processing</span>
          </div>
          <div className="page-subtitle">Process footage frame-by-frame for a complete annotated recording.</div>
        </div>
        <div className="page-actions">
          {videoUrl && (
            <a className="btn btn-secondary" href={videoUrl} download={`safesight-${Date.now()}.mp4`}>
              <Download size={13} />
              Export video
            </a>
          )}
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
            Upload video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".mp4,.avi,.mov"
            onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
          />
        </div>
      </div>

      <div className="workspace-area">
        <div className="image-stage">
          {file && (
            <div className="image-toolbar">
              <div className="file-info">
                <FileVideo size={13} />
                <span className="file-name">{file.name}</span>
                <span className="file-meta">{formatBytes(file.size)}</span>
              </div>
              {loading && (
                <>
                  <div className="toolbar-sep" />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{statusText}</span>
                </>
              )}
            </div>
          )}

          <div className="image-canvas">
            {videoUrl ? (
              <video
                controls
                src={videoUrl}
                style={{
                  maxWidth: '90%',
                  maxHeight: 'calc(100vh - 280px)',
                  borderRadius: 8,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                }}
              />
            ) : loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                  {statusText || 'Processing video…'}
                </p>
                <div
                  style={{
                    width: 260,
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 99,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: 'var(--green)',
                      borderRadius: 99,
                      transition: 'width 0.4s',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{progress}% complete</span>
              </div>
            ) : file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 30, color: 'var(--text-3)' }}>
                <FileVideo size={42} strokeWidth={1.5} style={{ color: 'var(--primary-btn)' }} />
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{file.name}</p>
                <p style={{ fontSize: 12 }}>Ready for processing. Click &quot;Process video&quot; in the right panel.</p>
              </div>
            ) : (
              <div
                className="drop-zone-panel"
                role="button"
                tabIndex={0}
                aria-label="Drop your MP4 video here, or browse files"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) selectFile(f)
                }}
                style={{ margin: 24, alignSelf: 'center', width: 'calc(100% - 48px)' }}
              >
                <div className="drop-icon-circle">
                  <Upload size={17} />
                </div>
                <div className="drop-text">
                  <strong>Drop your MP4 video here, or browse files</strong>
                  <p>MP4, AVI or MOV · Up to 200 MB</p>
                </div>
                <div className="drop-browse">
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <FileVideo size={13} />
                    Browse files
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-err" style={{ margin: '10px 14px' }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          {health && !modelOk && (
            <div className="alert alert-warn" style={{ margin: '10px 14px' }}>
              <AlertTriangle size={14} />
              <strong>Model weights needed</strong> — place <code>best.pt</code> at{' '}
              <code>backend/models/best.pt</code>
            </div>
          )}
        </div>

        {/* Right Panel: Video Results Directly */}
        <div className="results-panel">
          <div className="results-header">
            <span className="results-panel-title">
              <FileVideo size={14} />
              Video Results
            </span>
            {videoUrl && <span className="tab-count">Processed</span>}
          </div>

          <div className="results-body">
            <div style={{ padding: '14px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={!file || loading || !modelOk}
                onClick={run}
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    Processing…
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    Process video
                  </>
                )}
              </button>
            </div>

            <div className="model-row">
              <div className="model-icon">
                <Zap size={12} />
              </div>
              <span className="model-name">YOLOv8 Video Pipeline</span>
              <div className="model-action">{modelOk ? 'Active' : 'Offline'}</div>
            </div>

            {videoUrl ? (
              <div style={{ padding: '14px' }}>
                <div className="assessment-banner safe" style={{ margin: 0 }}>
                  <ShieldCheck size={14} />
                  <div>
                    <span className="banner-title">Video Processed</span>
                    <span className="banner-detail">
                      All frames analyzed with bounding box annotations rendered.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-results" style={{ paddingTop: 30 }}>
                <FileVideo size={28} strokeWidth={1} style={{ color: 'var(--border-2)' }} />
                <p>Run video analysis to view the annotated video result.</p>
              </div>
            )}

            <div className="privacy-note">
              <Shield size={11} />
              Your videos stay private. Always.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Live Webcam View (Direct Results, No Settings Tab) ─── */
function WebcamView() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)
  // Store frame as an object URL (not a base64/data URL) to avoid large string in React state
  const frameObjUrlRef = useRef<string>('')
  const [running, setRunning] = useState(false)
  const [interval, setIntervalMs] = useState(1500)
  const [frameUrl, setFrameUrl] = useState('')
  const [last, setLast] = useState<ImageDetectionResponse | null>(null)
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setRunning(false)
  }, [])

  // Revoke object URL on unmount
  useEffect(() => () => {
    if (frameObjUrlRef.current) URL.revokeObjectURL(frameObjUrlRef.current)
  }, [])

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || busyRef.current) return
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    busyRef.current = true
    try {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82))
      if (!blob) return
      const res = await api.detectImage(new File([blob], 'webcam.jpg', { type: 'image/jpeg' }), 0.5)
      setLast(res)
      // Use object URL from the returned annotated image URL (already a data URL from API);
      // create a blob from it to keep memory clean, or just set as a display URL without storing the base64 in state
      const annotated = api.annotatedImageUrl(res)
      if (annotated) {
        // Revoke the previous object URL before setting the new one
        if (frameObjUrlRef.current) URL.revokeObjectURL(frameObjUrlRef.current)
        // If annotated is already a data: URL (base64), convert to a Blob URL for clean state
        if (annotated.startsWith('data:')) {
          const resp = await fetch(annotated)
          const imgBlob = await resp.blob()
          const objUrl = URL.createObjectURL(imgBlob)
          frameObjUrlRef.current = objUrl
          setFrameUrl(objUrl)
        } else {
          frameObjUrlRef.current = ''
          setFrameUrl(annotated)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Webcam detection failed.')
    } finally {
      busyRef.current = false
    }
  }, [])

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setRunning(true)
      timerRef.current = setInterval(capture, interval)
    } catch {
      setError('Camera permission denied or no camera available.')
    }
  }

  useEffect(() => () => stop(), [stop])
  useEffect(() => {
    if (running) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(capture, interval)
    }
  }, [capture, interval, running])

  const detections = last?.detections ?? []
  const assessment = getAssessmentInfo(last?.safety_assessment, detections.length)

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title">
            <h1>Live webcam</h1>
            {running && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: 'var(--green)',
                  fontWeight: 600,
                  background: 'var(--green-soft)',
                  border: '1px solid #86efac',
                  borderRadius: 4,
                  padding: '2px 7px',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--green)',
                    display: 'inline-block',
                  }}
                />
                LIVE
              </span>
            )}
          </div>
          <div className="page-subtitle">Real-time PPE stream analysis with periodic frame capture.</div>
        </div>
        <div className="page-actions">
          <button
            className={`btn ${running ? 'btn-danger' : 'btn-primary'}`}
            onClick={running ? stop : start}
          >
            {running ? (
              <>
                <X size={13} />
                Stop camera
              </>
            ) : (
              <>
                <Camera size={13} />
                Start camera
              </>
            )}
          </button>
        </div>
      </div>

      <div className="workspace-area">
        <div className="image-stage">
          {running && (
            <div className="image-toolbar">
              <div className="file-info">
                <Camera size={13} />
                <span className="file-name">Live camera stream</span>
                <span className="file-meta">Every {interval / 1000}s</span>
              </div>
              <div className="toolbar-right">
                <label
                  style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  Interval
                  <select
                    value={interval}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    style={{
                      fontSize: 11,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '3px 6px',
                      background: 'var(--white)',
                      color: 'var(--text)',
                    }}
                  >
                    <option value={750}>0.75s</option>
                    <option value={1500}>1.5s</option>
                    <option value={3000}>3s</option>
                    <option value={5000}>5s</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="image-canvas">
            {frameUrl ? (
              <div className="canvas-img-wrap">
                <img src={frameUrl} alt="Annotated webcam frame" />
              </div>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                style={{
                  maxWidth: '90%',
                  maxHeight: 'calc(100vh - 260px)',
                  borderRadius: 8,
                }}
              />
            )}
            {!running && !frameUrl && (
              <div className="empty-stage">
                <Camera size={36} strokeWidth={1} style={{ color: 'var(--icon-muted)' }} />
                <p>Click &quot;Start camera&quot; to begin live monitoring</p>
              </div>
            )}
            <canvas ref={canvasRef} hidden />
          </div>

          {error && (
            <div className="alert alert-err" style={{ margin: '10px 14px' }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          {!running && !frameUrl && (
            <div
              className="drop-zone-panel"
              role="button"
              tabIndex={0}
              aria-label="Start camera monitoring"
              onClick={start}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  start()
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="drop-icon-circle">
                <Camera size={17} />
              </div>
              <div className="drop-text">
                <strong>Click here to start camera monitoring</strong>
                <p>Frames are sent to YOLOv8 at your selected frequency</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Results Directly */}
        <div className="results-panel">
          <div className="results-header">
            <span className="results-panel-title">
              <Camera size={14} />
              Live Results
            </span>
            {last && <span className="tab-count">{detections.length} objects</span>}
          </div>

          <div className="results-body">
            {last ? (
              <>
                <div className="overview-section">
                  <div className="overview-row">
                    <div className="overview-stat">
                      <div className="overview-label">Objects</div>
                      <div className="overview-value">{detections.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-label">Violations</div>
                      <div
                        className="overview-value"
                        style={{
                          color:
                            last?.safety_assessment &&
                              typeof last.safety_assessment === 'object' &&
                              last.safety_assessment.violations?.length
                              ? 'var(--red)'
                              : 'var(--text)',
                        }}
                      >
                        {typeof last?.safety_assessment === 'object'
                          ? last.safety_assessment.violations?.length ?? 0
                          : 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`assessment-banner ${assessment.level}`}
                  role={assessment.level === 'violation' ? 'alert' : 'status'}
                  aria-live={assessment.level === 'violation' ? 'assertive' : 'polite'}
                >
                  <div>
                    {assessment.level === 'violation' ? (
                      <ShieldAlert size={14} />
                    ) : assessment.level === 'safe' ? (
                      <ShieldCheck size={14} />
                    ) : assessment.level === 'neutral' ? (
                      <HelpCircle size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                  </div>
                  <div>
                    <span className="banner-title">{assessment.title}</span>
                    {assessment.detail && (
                      <span className="banner-detail">{assessment.detail}</span>
                    )}
                  </div>
                </div>

                <div className="objects-header">
                  <span className="objects-title">Latest frame detections</span>
                </div>

                {detections.map((d, i) => (
                  <div
                    key={i}
                    className={`object-item ${isViolation(d.class_name) ? 'violation' : ''}`}
                  >
                    <div className="object-icon">
                      <ObjectIcon className={d.class_name} />
                    </div>
                    <span className="object-label">{d.class_name}</span>
                    <span className={`object-conf ${confClass(d.confidence)}`}>
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="empty-results" style={{ paddingTop: 40 }}>
                <Camera size={28} strokeWidth={1} style={{ color: 'var(--icon-muted)' }} />
                <p>Start the camera to see live detection results.</p>
              </div>
            )}
            <div className="privacy-note">
              <Shield size={11} />
              Frames are processed in real time.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Inspection History View ─── */
function HistoryView({
  inspections,
  loading,
  error,
  retry,
}: {
  inspections: Inspection[]
  loading: boolean
  error: string
  retry: () => void
}) {
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null)

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title">
            <h1>Analysis history</h1>
          </div>
          <div className="page-subtitle">All inspection records returned by the backend. Click any record to inspect details.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={retry}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>
      <div className="history-wrap">
        <div className="history-table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              <p>Loading history…</p>
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 10px' }} />
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 6 }}>{error}</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={retry}>
                Try again
              </button>
            </div>
          ) : inspections.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-4)' }}>
              <Clock size={28} strokeWidth={1} style={{ margin: '0 auto 10px', color: 'var(--icon-muted)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No inspections recorded yet.</p>
              <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                Inspections will appear here as you run analysis.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Source</th>
                  <th>Objects</th>
                  <th>Assessment</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((item, i) => {
                  const objCount = item.detections?.length ?? item.detected_objects ?? 0
                  const info = getAssessmentInfo(item.safety_assessment, objCount)
                  const tagClass = info.level === 'violation' ? 'tag-red' : info.level === 'neutral' ? 'tag-gray' : 'tag-green'
                  return (
                    <tr
                      key={item.inspection_id ?? i}
                      className="clickable-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`View inspection record from ${item.created_at ? new Date(item.created_at).toLocaleString() : 'record'}`}
                      onClick={() => setSelectedInspection(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedInspection(item)
                        }
                      }}
                    >
                      <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                      <td>
                        <span className="tag tag-gray">{item.source || 'image'}</span>
                      </td>
                      <td>{objCount}</td>
                      <td>
                        <span className={`tag ${tagClass}`}>
                          {info.level === 'violation' ? 'Violation' : info.level === 'neutral' ? 'Unverified' : 'Clear'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {item.model_version?.slice(0, 12) || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Inspection Detail Modal */}
      {selectedInspection && (
        <div
          className="inspection-modal-overlay"
          onClick={() => setSelectedInspection(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Inspection record details"
        >
          <div className="inspection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspection-modal-header">
              <div className="inspection-modal-title">
                <ShieldCheck size={16} />
                <span>Inspection #{selectedInspection.inspection_id?.slice(0, 8) || 'Audit'}</span>
                <span className={`tag ${
                  getAssessmentInfo(selectedInspection.safety_assessment, selectedInspection.detections?.length ?? selectedInspection.detected_objects ?? 0).level === 'violation' ? 'tag-red' : 'tag-green'
                }`}>
                  {getAssessmentInfo(selectedInspection.safety_assessment, selectedInspection.detections?.length ?? selectedInspection.detected_objects ?? 0).title}
                </span>
              </div>
              <button
                className="icon-btn"
                aria-label="Close modal"
                onClick={() => setSelectedInspection(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="inspection-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 600 }}>Timestamp</span>
                  <span style={{ fontWeight: 600 }}>{selectedInspection.created_at ? new Date(selectedInspection.created_at).toLocaleString() : '—'}</span>
                </div>
                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 600 }}>Source</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedInspection.source || 'Static Image'}</span>
                </div>
                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 600 }}>Model Version</span>
                  <span style={{ fontWeight: 600 }}>{selectedInspection.model_version || 'YOLOv8'}</span>
                </div>
                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 600 }}>Total Objects</span>
                  <span style={{ fontWeight: 600 }}>{selectedInspection.detections?.length ?? selectedInspection.detected_objects ?? 0} detections</span>
                </div>
              </div>

              {selectedInspection.detections && selectedInspection.detections.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Detected Entities ({selectedInspection.detections.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {selectedInspection.detections.map((d, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: 12 }}>
                          <ObjectIcon className={d.class_name} />
                          {d.class_name}
                        </span>
                        <span className={`object-conf ${confClass(d.confidence)}`}>
                          {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {getAssessmentInfo(selectedInspection.safety_assessment, 0).detail}
                </p>
              )}
            </div>

            <div className="inspection-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedInspection, null, 2))
                  const dl = document.createElement('a')
                  dl.setAttribute('href', dataStr)
                  dl.setAttribute('download', `inspection-${selectedInspection.inspection_id || 'record'}.json`)
                  dl.click()
                }}
              >
                <Download size={13} />
                Export JSON
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setSelectedInspection(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Models View ─── */
function ModelsView({ health }: { health: HealthResponse | null }) {
  const modelOk = health?.model_loaded
  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title">
            <h1>Detection Models</h1>
          </div>
          <div className="page-subtitle">Installed AI weights and PPE detection architecture.</div>
        </div>
      </div>
      <div className="overview-dashboard">
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title">Active Inference Model</span>
            <span className={`tag ${modelOk ? 'tag-green' : 'tag-red'}`}>
              {modelOk ? 'Active & Loaded' : 'Missing Weights'}
            </span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/logo.png"
                alt="SafeSight Logo"
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
              />
              <div>
                <strong style={{ fontSize: 15 }}>YOLO Workplace Safety Model</strong>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                  File: <code>backend/models/best.pt</code>
                </p>
              </div>
            </div>
            <div className="bbox-grid" style={{ marginTop: 8 }}>
              <div className="bbox-cell" style={{ background: 'var(--surface)', padding: 12, borderRadius: 6 }}>
                <span className="bbox-axis">Architecture</span>
                <span className="bbox-num" style={{ fontSize: 14 }}>Ultralytics YOLOv8</span>
              </div>
              <div className="bbox-cell" style={{ background: 'var(--surface)', padding: 12, borderRadius: 6 }}>
                <span className="bbox-axis">Input Resolution</span>
                <span className="bbox-num" style={{ fontSize: 14 }}>640 × 640 px</span>
              </div>
              <div className="bbox-cell" style={{ background: 'var(--surface)', padding: 12, borderRadius: 6 }}>
                <span className="bbox-axis">Backend Engine</span>
                <span className="bbox-num" style={{ fontSize: 14 }}>PyTorch / TorchVision</span>
              </div>
              <div className="bbox-cell" style={{ background: 'var(--surface)', padding: 12, borderRadius: 6 }}>
                <span className="bbox-axis">Status</span>
                <span className="bbox-num" style={{ fontSize: 14, color: modelOk ? 'var(--green-dark)' : 'var(--red)' }}>
                  {modelOk ? 'Operational' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Root Component ─── */
export default function Page() {
  const [view, setView] = useState<View>('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState('')

  const loadHealth = useCallback(async () => {
    try {
      setHealth(await api.health())
    } catch {
      setHealth(null)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    setHistError('')
    try {
      setInspections(await api.detections())
    } catch (e) {
      setHistError(e instanceof Error ? e.message : 'Failed to load.')
    } finally {
      setHistLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
    loadHistory()
  }, [loadHealth, loadHistory])

  // Breadcrumb mapping
  const breadcrumbs: Record<View, string> = {
    landing: 'Home / About',
    overview: 'Overview',
    image: 'Image analysis',
    video: 'Video analysis',
    webcam: 'Live webcam',
    history: 'Analysis history',
    models: 'Models',
  }

  const modelOk = health?.model_loaded

  if (view === 'landing') {
    return (
      <LandingPage
        health={health}
        onEnterWorkspace={(targetView) => setView(targetView || 'overview')}
      />
    )
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} health={health} />

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div
                className="sidebar-logo"
                style={{ padding: 0, border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setView('landing')
                  setMobileMenuOpen(false)
                }}
              >
                <img src="/logo.png" alt="SafeSight Logo" className="logo-icon-img" />
                <span className="logo-name">
                  SafeSight <span>AI</span>
                </span>
              </div>
              <button
                className="icon-btn"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="sidebar-section">
              <div className="sidebar-label">Workspace</div>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`sidebar-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setView(item.id)
                    setMobileMenuOpen(false)
                  }}
                >
                  <item.icon size={15} className="item-icon" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="sidebar-bottom">
              <button
                className="sidebar-item"
                onClick={() => {
                  setView('landing')
                  setMobileMenuOpen(false)
                }}
              >
                <HelpCircle size={15} className="item-icon" />
                Safety workspace guide
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <button
            className="mobile-menu-btn"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="topbar-breadcrumb">
            <span>Workspace</span>
            <span className="sep">
              <ChevronRight size={12} />
            </span>
            <strong>{breadcrumbs[view]}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11.5px', gap: '5px' }}
              title="About SafeSight & System Guide"
              onClick={() => setView('landing')}
            >
              <Sparkles size={13} />
              <span>About &amp; Guide</span>
            </button>
            <div className="sys-status">
              <span className={`status-dot ${!health ? 'red' : modelOk ? '' : 'amber'}`} />
              {!health ? 'Backend offline' : modelOk ? 'All systems operational' : 'Model weights missing'}
            </div>
            <button className="icon-btn" title="Refresh backend status" onClick={loadHealth}>
              <Activity size={15} />
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="page-body">
          {view === 'overview' && (
            <OverviewView health={health} inspections={inspections} setView={setView} />
          )}
          {view === 'image' && <ImageAnalysisView health={health} />}
          {view === 'video' && <VideoAnalysisView health={health} />}
          {view === 'webcam' && <WebcamView />}
          {view === 'history' && (
            <HistoryView
              inspections={inspections}
              loading={histLoading}
              error={histError}
              retry={loadHistory}
            />
          )}
          {view === 'models' && <ModelsView health={health} />}
        </div>
      </div>
    </div>
  )
}
