'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  HardHat,
  Eye,
  Camera,
  FileVideo,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Sliders,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Layers,
  Cpu,
  BarChart3,
  Lock,
} from 'lucide-react'
import type { HealthResponse } from '@/src/api'

interface LandingPageProps {
  health: HealthResponse | null
  onEnterWorkspace: (view?: 'overview' | 'image' | 'video' | 'webcam' | 'history' | 'models') => void
}

export default function LandingPage({ health, onEnterWorkspace }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'compliant' | 'violation'>('compliant')
  const modelOk = health?.model_loaded

  return (
    <div className="landing-container">
      {/* ─── Top Navigation Bar ─── */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand" onClick={() => onEnterWorkspace('overview')}>
            <img
              src="/logo.png"
              alt="SafeSight Logo"
              className="landing-logo-img"
            />
            <span className="landing-brand-name">
              SafeSight <span>AI</span>
            </span>
          </div>

          <nav className="landing-nav-links">
            <a href="#about">About</a>
            <a href="#modes">Detection Modes</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#what-to-expect">What to Expect</a>
            <a href="#architecture">Tech Stack</a>
          </nav>

          <div className="landing-header-actions">
            <div className="sys-status-badge">
              <span className={`status-dot ${!health ? 'red' : modelOk ? '' : 'amber'}`} />
              <span className="status-label">
                {!health ? 'API Offline' : modelOk ? 'System Ready' : 'Model Missing'}
              </span>
            </div>

            <button
              className="btn btn-primary landing-cta-btn"
              onClick={() => onEnterWorkspace('overview')}
            >
              <span>Open Workspace</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="landing-hero-section">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content">
          <div className="landing-pill">
            <Sparkles size={13} className="pill-icon" />
            <span>AI-Powered Computer Vision &middot; Workplace Safety &amp; PPE Compliance</span>
          </div>

          <h1 className="landing-hero-title">
            Protect Every Worker on Site with Real-Time Safety Vision
          </h1>

          <p className="landing-hero-subtitle">
            SafeSight AI applies fine-tuned YOLO computer vision to inspection photos, CCTV surveillance video, and live webcam feeds. Automatically detect PPE adherence, flag safety violations in milliseconds, and build an airtight safety compliance audit trail.
          </p>

          <div className="landing-hero-actions">
            <button
              className="btn btn-primary landing-btn-large"
              onClick={() => onEnterWorkspace('overview')}
            >
              <LayoutDashboardIcon />
              <span>Launch Safety Dashboard</span>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary landing-btn-large"
              onClick={() => onEnterWorkspace('image')}
            >
              <ImageIcon size={16} />
              <span>Try Image Inspection</span>
            </button>

            <button
              className="btn btn-secondary landing-btn-large"
              onClick={() => onEnterWorkspace('webcam')}
            >
              <Camera size={16} />
              <span>Live Webcam Feed</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="landing-stats-bar">
            <div className="stat-item">
              <div className="stat-number">&lt; 100ms</div>
              <div className="stat-label">Inference Latency</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">3 Modes</div>
              <div className="stat-label">Image, Video &amp; Live Stream</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">YOLOv11/v8</div>
              <div className="stat-label">Edge-Optimized Neural Network</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">100%</div>
              <div className="stat-label">Human-in-the-Loop Verification</div>
            </div>
          </div>
        </div>

        {/* Interactive Visual Simulation Mockup */}
        <div className="landing-demo-showcase">
          <div className="demo-window">
            <div className="demo-window-header">
              <div className="demo-dots">
                <span className="dot red" />
                <span className="dot amber" />
                <span className="dot green" />
              </div>
              <div className="demo-window-title">SafeSight Neural Detection Engine &mdash; Live Feed Preview</div>
              <div className="demo-tabs">
                <button
                  className={`demo-tab ${activeTab === 'compliant' ? 'active' : ''}`}
                  onClick={() => setActiveTab('compliant')}
                >
                  <CheckCircle2 size={13} /> Scenario 1: Compliant Site
                </button>
                <button
                  className={`demo-tab ${activeTab === 'violation' ? 'active' : ''}`}
                  onClick={() => setActiveTab('violation')}
                >
                  <AlertTriangle size={13} /> Scenario 2: PPE Violation
                </button>
              </div>
            </div>

            <div className="demo-window-body">
              {activeTab === 'compliant' ? (
                <div className="demo-scenario-grid">
                  <div className="demo-preview-canvas">
                    <div className="simulated-view simulated-site-safe">
                      {/* Bounding Boxes */}
                      <div className="bbox bbox-safe bbox-helmet">
                        <span className="bbox-tag">Hard Hat 98.4%</span>
                      </div>
                      <div className="bbox bbox-safe bbox-vest">
                        <span className="bbox-tag">Safety Vest 96.1%</span>
                      </div>
                      <div className="bbox bbox-safe bbox-boots">
                        <span className="bbox-tag">Safety Boots 92.5%</span>
                      </div>
                      <div className="simulated-watermark">
                        <Camera size={14} /> LIVE CAMERA FEED &middot; ZONE B-12
                      </div>
                    </div>
                  </div>

                  <div className="demo-insights-panel">
                    <div className="insights-header">
                      <div className="insights-badge safe">
                        <CheckCircle2 size={14} />
                        <span>All PPE Compliant</span>
                      </div>
                      <span className="confidence-pill">Avg Conf: 95.6%</span>
                    </div>

                    <div className="detection-list">
                      <div className="det-row">
                        <div className="det-icon safe"><HardHat size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">Hard Hat Detected</div>
                          <div className="det-sub">Head protection confirmed &middot; ANSI Z89.1</div>
                        </div>
                        <span className="det-score">98.4%</span>
                      </div>

                      <div className="det-row">
                        <div className="det-icon safe"><ShieldCheck size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">High-Visibility Vest</div>
                          <div className="det-sub">Class 2 reflective wear confirmed</div>
                        </div>
                        <span className="det-score">96.1%</span>
                      </div>

                      <div className="det-row">
                        <div className="det-icon safe"><CheckCircle2 size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">Protective Footwear</div>
                          <div className="det-sub">Steel-toe work boots confirmed</div>
                        </div>
                        <span className="det-score">92.5%</span>
                      </div>
                    </div>

                    <div className="assessment-box safe-box">
                      <div className="box-title">Compliance Verdict</div>
                      <p>No PPE non-compliance detected. Worker matches standard worksite protocol.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="demo-scenario-grid">
                  <div className="demo-preview-canvas">
                    <div className="simulated-view simulated-site-violation">
                      {/* Bounding Boxes */}
                      <div className="bbox bbox-violation bbox-missing-helmet">
                        <span className="bbox-tag violation">VIOLATION: Missing Helmet</span>
                      </div>
                      <div className="bbox bbox-violation bbox-missing-vest">
                        <span className="bbox-tag violation">VIOLATION: Missing Safety Vest</span>
                      </div>
                      <div className="bbox bbox-safe bbox-person">
                        <span className="bbox-tag">Worker Detected 94.2%</span>
                      </div>
                      <div className="simulated-watermark">
                        <Camera size={14} /> CCTV STREAM &middot; CRANE ZONE 4
                      </div>
                    </div>
                  </div>

                  <div className="demo-insights-panel">
                    <div className="insights-header">
                      <div className="insights-badge violation">
                        <AlertTriangle size={14} />
                        <span>Potential Violation Detected</span>
                      </div>
                      <span className="confidence-pill warning">Severity: High</span>
                    </div>

                    <div className="detection-list">
                      <div className="det-row violation">
                        <div className="det-icon violation"><AlertTriangle size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">NO-Hardhat Flagged</div>
                          <div className="det-sub">Worker operating in active drop zone without helmet</div>
                        </div>
                        <span className="det-score danger">Alert</span>
                      </div>

                      <div className="det-row violation">
                        <div className="det-icon violation"><AlertTriangle size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">NO-Safety Vest Flagged</div>
                          <div className="det-sub">Low visibility worker near moving machinery</div>
                        </div>
                        <span className="det-score danger">Alert</span>
                      </div>

                      <div className="det-row">
                        <div className="det-icon safe"><ShieldCheck size={14} /></div>
                        <div className="det-info">
                          <div className="det-title">Worker Detected</div>
                          <div className="det-sub">Subject tracked in hazard zone</div>
                        </div>
                        <span className="det-score">94.2%</span>
                      </div>
                    </div>

                    <div className="assessment-box violation-box">
                      <div className="box-title">Safety Action Required</div>
                      <p>Immediate supervisor notification recommended. Worker lacks mandatory hard hat and reflective vest.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── About Section ─── */}
      <section id="about" className="landing-section">
        <div className="section-header">
          <div className="section-pill">Core Capabilities</div>
          <h2 className="section-title">What is SafeSight AI?</h2>
          <p className="section-subtitle">
            SafeSight AI bridges deep learning computer vision and industrial health &amp; safety (HSE) management to deliver autonomous, non-intrusive safety monitoring.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon-wrap green">
              <Zap size={22} />
            </div>
            <h3>Real-Time YOLO Inference</h3>
            <p>
              Leverages state-of-the-art Ultralytics YOLO models trained specifically on workplace safety equipment. Detects objects, computes bounding coordinates, and calculates confidence scores in milliseconds.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap blue">
              <Camera size={22} />
            </div>
            <h3>Triple Ingestion Pipeline</h3>
            <p>
              Inspect still photos for spot compliance checks, upload multi-minute MP4 surveillance videos for asynchronous frame audits, or stream live webcams directly from your browser.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap amber">
              <ShieldAlert size={22} />
            </div>
            <h3>Conservative Safety Logic</h3>
            <p>
              Does not assume compliance without explicit proof. Operates on a safe-by-design policy where missing PPE triggers actionable potential violation assessments for safety officers.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap purple">
              <BarChart3 size={22} />
            </div>
            <h3>Auditable Compliance History</h3>
            <p>
              Keep a complete log of inspection dates, total objects detected, safety assessments, and full annotated evidence snapshots for audits, post-incident reviews, and OSHA records.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Detection Modes Section ─── */}
      <section id="modes" className="landing-section bg-surface">
        <div className="section-header">
          <div className="section-pill">Flexible Workflows</div>
          <h2 className="section-title">Three Tailored Detection Modes</h2>
          <p className="section-subtitle">
            Whether auditing a single snapshot or monitoring an active facility gate, SafeSight provides dedicated tooling for each scenario.
          </p>
        </div>

        <div className="modes-grid">
          <div className="mode-card" onClick={() => onEnterWorkspace('image')}>
            <div className="mode-card-badge">Instant</div>
            <div className="mode-card-icon">
              <ImageIcon size={26} />
            </div>
            <h3>Image Analysis</h3>
            <p>
              Drag and drop high-resolution JPEG, PNG, or WebP photos. SafeSight highlights every detected gear piece with color-coded bounding boxes and complete confidence metrics.
            </p>
            <ul className="mode-features">
              <li><CheckCircle2 size={13} /> Sub-second inspection turnaround</li>
              <li><CheckCircle2 size={13} /> Downloadable annotated output</li>
              <li><CheckCircle2 size={13} /> Automatic history persistence</li>
            </ul>
            <div className="mode-link">
              <span>Try Image Analysis</span>
              <ArrowRight size={14} />
            </div>
          </div>

          <div className="mode-card" onClick={() => onEnterWorkspace('video')}>
            <div className="mode-card-badge">Asynchronous</div>
            <div className="mode-card-icon">
              <FileVideo size={26} />
            </div>
            <h3>Video Surveillance</h3>
            <p>
              Upload MP4 site surveillance recordings up to 200MB. Processed in the background with customizable frame strides and downloadable annotated video clips.
            </p>
            <ul className="mode-features">
              <li><CheckCircle2 size={13} /> Background job queue with live progress</li>
              <li><CheckCircle2 size={13} /> MP4 video validation &amp; bounds checking</li>
              <li><CheckCircle2 size={13} /> Playable annotated video playback</li>
            </ul>
            <div className="mode-link">
              <span>Upload Video Footage</span>
              <ArrowRight size={14} />
            </div>
          </div>

          <div className="mode-card" onClick={() => onEnterWorkspace('webcam')}>
            <div className="mode-card-badge">Live Stream</div>
            <div className="mode-card-icon">
              <Camera size={26} />
            </div>
            <h3>Live Webcam &amp; CCTV</h3>
            <p>
              Connect an on-site webcam or RTSP/WebRTC stream. Continuous frame sampling gives floor managers an instant heads-up display of PPE compliance in real-time.
            </p>
            <ul className="mode-features">
              <li><CheckCircle2 size={13} /> Zero-plugin browser video capture</li>
              <li><CheckCircle2 size={13} /> Real-time heads-up bounding overlay</li>
              <li><CheckCircle2 size={13} /> Safe non-persisted frame sampling</li>
            </ul>
            <div className="mode-link">
              <span>Start Webcam Stream</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── How to Use & What to Do Section ─── */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <div className="section-pill">Getting Started</div>
          <h2 className="section-title">How to Use SafeSight AI</h2>
          <p className="section-subtitle">
            Follow this simple 4-step workflow to start auditing worksite PPE compliance immediately.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-badge">Step 1</div>
            <div className="step-content">
              <h4>Choose an Inspection Mode</h4>
              <p>
                From the workspace sidebar, select <strong>Image analysis</strong> for quick photo uploads, <strong>Video analysis</strong> for CCTV footage, or <strong>Live webcam</strong> for real-time monitoring.
              </p>
            </div>
          </div>

          <div className="step-connector" />

          <div className="step-card">
            <div className="step-badge">Step 2</div>
            <div className="step-content">
              <h4>Calibrate Confidence Sensitivity</h4>
              <p>
                Adjust the sensitivity slider (default 0.25, bounded between 0.05 and 0.95). Increase confidence for high-light closeups, or decrease it for distant wide-angle surveillance cameras.
              </p>
            </div>
          </div>

          <div className="step-connector" />

          <div className="step-card">
            <div className="step-badge">Step 3</div>
            <div className="step-content">
              <h4>Run Detection &amp; Review Visual Overlay</h4>
              <p>
                Click <strong>Run Inspection</strong>. The YOLO model identifies each safety element with pixel-precise bounding boxes, class labels, and certainty percentages in under 100 milliseconds.
              </p>
            </div>
          </div>

          <div className="step-connector" />

          <div className="step-card">
            <div className="step-badge">Step 4</div>
            <div className="step-content">
              <h4>Inspect Verdict &amp; Export Audit Log</h4>
              <p>
                View the safety assessment breakdown (Compliant vs Potential Violation). Download the annotated media file or view historic compliance rates in the <strong>Analysis history</strong> tab.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── What to Expect Section ─── */}
      <section id="what-to-expect" className="landing-section bg-surface">
        <div className="section-header">
          <div className="section-pill">Transparency &amp; Best Practices</div>
          <h2 className="section-title">What to Expect &amp; How to Interpret Results</h2>
          <p className="section-subtitle">
            SafeSight is engineered to support safety professionals, providing clear, unambiguous classifications without overpromising.
          </p>
        </div>

        <div className="expect-grid">
          <div className="expect-box">
            <div className="expect-icon green">
              <CheckCircle2 size={22} />
            </div>
            <h4>What the System Delivers</h4>
            <ul>
              <li>
                <strong>Instant visual markers:</strong> Highlighting hard hats, reflective vests, protective boots, and workers with colored bounding boxes.
              </li>
              <li>
                <strong>Targeted violation flags:</strong> Clear alerts whenever the fine-tuned model identifies missing equipment classes (such as <code>NO-Hardhat</code> or <code>NO-Safety Vest</code>).
              </li>
              <li>
                <strong>Fast edge/cloud latency:</strong> Fast enough for continuous live camera feeds without bogging down local hardware.
              </li>
              <li>
                <strong>Standardized JSON outputs:</strong> API-first architecture ready for integration into enterprise HSE dashboards or webhooks.
              </li>
            </ul>
          </div>

          <div className="expect-box">
            <div className="expect-icon amber">
              <AlertTriangle size={22} />
            </div>
            <h4>Responsible Safety Guidelines</h4>
            <ul>
              <li>
                <strong>Human-in-the-Loop review:</strong> SafeSight is an automated detection assistant designed to accelerate hazard detection, not replace certified safety inspectors.
              </li>
              <li>
                <strong>Conservative rule evaluation:</strong> Detecting a helmet on a worker does not automatically prove all other PPE requirements are satisfied.
              </li>
              <li>
                <strong>Lighting and camera angle:</strong> Ensure adequate worksite illumination and camera positioning to minimize occlusion from machinery or distance.
              </li>
              <li>
                <strong>Privacy by default:</strong> Live webcam inspection frames are processed on-the-fly without saving personal identity records to disk.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Architecture Section ─── */}
      <section id="architecture" className="landing-section">
        <div className="section-header">
          <div className="section-pill">Modern Architecture</div>
          <h2 className="section-title">Engineered for Scalability &amp; Reliability</h2>
          <p className="section-subtitle">
            A modern, decoupled full-stack platform built with production-grade tools.
          </p>
        </div>

        <div className="arch-diagram">
          <div className="arch-card">
            <div className="arch-card-header">
              <Layers size={18} />
              <span>Next.js 16 Frontend</span>
            </div>
            <p>React 19, Turbopack, Lucide Icons, and responsive Vanilla CSS. Deployed on Vercel with zero cold starts.</p>
            <div className="arch-tags">
              <span>Next.js 16</span>
              <span>React 19</span>
              <span>Turbopack</span>
            </div>
          </div>

          <div className="arch-arrow">
            <ArrowRight size={20} />
            <span>REST API</span>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <Cpu size={18} />
              <span>FastAPI Backend</span>
            </div>
            <p>Python 3.12, Uvicorn, OpenCV, and rate-limiting. High-throughput container deployed on Railway.</p>
            <div className="arch-tags">
              <span>FastAPI</span>
              <span>Python 3.12</span>
              <span>OpenCV</span>
            </div>
          </div>

          <div className="arch-arrow">
            <ArrowRight size={20} />
            <span>Inference</span>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <Zap size={18} />
              <span>YOLO Neural Engine</span>
            </div>
            <p>Ultralytics YOLO checkpoint (<code>best.pt</code>) loaded in-memory for sub-100ms multi-class object detection.</p>
            <div className="arch-tags">
              <span>Ultralytics YOLO</span>
              <span>PyTorch</span>
              <span>best.pt</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="landing-cta-banner">
        <div className="cta-banner-content">
          <div className="cta-icon">
            <ShieldCheck size={36} />
          </div>
          <h2>Ready to upgrade your worksite safety?</h2>
          <p>
            Launch the SafeSight AI dashboard now to test sample inspection photos, upload surveillance clips, or connect your webcam.
          </p>
          <div className="cta-buttons">
            <button
              className="btn btn-primary landing-btn-large"
              onClick={() => onEnterWorkspace('overview')}
            >
              <span>Enter Workspace</span>
              <ArrowRight size={16} />
            </button>
            <button
              className="btn btn-secondary landing-btn-large"
              onClick={() => onEnterWorkspace('image')}
            >
              <span>Inspect an Image</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-col-brand">
            <div className="landing-brand">
              <img
                src="/logo.png"
                alt="SafeSight Logo"
                className="landing-logo-img"
              />
              <span className="landing-brand-name">
                SafeSight <span>AI</span>
              </span>
            </div>
            <p className="footer-desc">
              Intelligent Workplace Safety &amp; PPE Compliance Detection platform powered by YOLO and modern web technologies.
            </p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h5>Navigation</h5>
              <button onClick={() => onEnterWorkspace('overview')}>Overview</button>
              <button onClick={() => onEnterWorkspace('image')}>Image Analysis</button>
              <button onClick={() => onEnterWorkspace('video')}>Video Analysis</button>
              <button onClick={() => onEnterWorkspace('webcam')}>Live Webcam</button>
            </div>

            <div className="footer-col">
              <h5>Platform</h5>
              <button onClick={() => onEnterWorkspace('history')}>Inspection History</button>
              <button onClick={() => onEnterWorkspace('models')}>Models &amp; Weights</button>
              <a href="#about">About System</a>
              <a href="#what-to-expect">Safety Guidelines</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} SafeSight AI. All rights reserved.</div>
          <div className="footer-status">
            <span className={`status-dot ${!health ? 'red' : modelOk ? '' : 'amber'}`} />
            <span>Backend: {!health ? 'Offline' : modelOk ? 'Operational' : 'Model Missing'}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function LayoutDashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}
