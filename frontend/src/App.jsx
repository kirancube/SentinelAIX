import React, { useState, useEffect } from 'react';
import Dither from './components/Dither/Dither';
import ModelVerificationConsole from './components/ModelVerificationConsole';
import TacticalCameraGrid from './components/TacticalCameraGrid';
import TelemetryChart from './components/TelemetryChart';
import DitherControls, { DITHER_PALETTES } from './components/DitherControls';
import IncidentDossierModal from './components/IncidentDossierModal';
import ErrorBoundary from './components/ErrorBoundary';
import { Shield, Radio, ShieldAlert, Cpu, Activity, Clock, Terminal } from 'lucide-react';
import './App.css';

export default function App() {
  const [selectedCam, setSelectedCam] = useState('CAM_01');
  const [currentScore, setCurrentScore] = useState(0.024);
  const [worldSurprise, setWorldSurprise] = useState(0.031);
  const [activeAlert, setActiveAlert] = useState(null);
  const [autoThreatSync, setAutoThreatSync] = useState(true);

  // Dither Shader configuration from React Bits
  const [ditherConfig, setDitherConfig] = useState({
    waveSpeed: 0.05,
    waveFrequency: 3.0,
    waveAmplitude: 0.3,
    waveColor: DITHER_PALETTES.CYBER_CYAN.wave,
    backgroundColor: DITHER_PALETTES.CYBER_CYAN.bg,
    colorNum: 4,
    pixelSize: 2,
    disableAnimation: false,
    enableMouseInteraction: true,
    mouseRadius: 0.35
  });

  const [backendUrl, setBackendUrl] = useState(
    import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
  );

  const [utcTime, setUtcTime] = useState('');

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // When model verification triggers an incident or normal score
  const handleTriggerScore = (newScore, status) => {
    setCurrentScore(newScore);
    if (newScore > 0.5) {
      setWorldSurprise(0.89);
      setActiveAlert({
        id: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        camera: 'CAM_01 // NORTH GATE',
        score: newScore.toFixed(4),
        type: newScore > 0.85 ? 'VIOLENT ASSAULT DETECTED' : 'ELEVATED SUSPICIOUS MOTION'
      });

      // If auto-threat sync is enabled, transition Dither shader to Crimson Alert!
      if (autoThreatSync) {
        setDitherConfig(prev => ({
          ...prev,
          waveColor: DITHER_PALETTES.CRIMSON_ALERT.wave,
          backgroundColor: DITHER_PALETTES.CRIMSON_ALERT.bg,
          waveSpeed: 0.12,
          waveAmplitude: 0.45
        }));
      }
    } else {
      setWorldSurprise(0.035);
      if (autoThreatSync) {
        setDitherConfig(prev => ({
          ...prev,
          waveColor: DITHER_PALETTES.CYBER_CYAN.wave,
          backgroundColor: DITHER_PALETTES.CYBER_CYAN.bg,
          waveSpeed: 0.05,
          waveAmplitude: 0.3
        }));
      }
    }
  };

  const handleFeedback = (alertId, feedbackType) => {
    console.log(`[HITL Audit Ledger] Alert ${alertId} resolved as: ${feedbackType}`);
    setTimeout(() => {
      setActiveAlert(null);
      handleTriggerScore(0.024, 'NOMINAL');
    }, 1200);
  };

  const isAlertState = currentScore >= 0.5;

  return (
    <div className="sentinel-app">
      {/* 1. React Bits Dither Dynamic Visualizer Background */}
      <div className="dither-background-layer">
        <ErrorBoundary>
          <Dither
            waveSpeed={ditherConfig.waveSpeed}
            waveFrequency={ditherConfig.waveFrequency}
            waveAmplitude={ditherConfig.waveAmplitude}
            waveColor={ditherConfig.waveColor}
            backgroundColor={ditherConfig.backgroundColor}
            colorNum={ditherConfig.colorNum}
            pixelSize={ditherConfig.pixelSize}
            disableAnimation={ditherConfig.disableAnimation}
            enableMouseInteraction={ditherConfig.enableMouseInteraction}
            mouseRadius={ditherConfig.mouseRadius}
          />
        </ErrorBoundary>
      </div>

      {/* 2. Tactical HUD Glassmorphism Foreground */}
      <div className="hud-container">
        {/* Header Ribbon */}
        <header className="tactical-header">
          <div className="header-left">
            <div className="dossier-meta">
              <span className="doc-tag">DOSSIER: 2024-SAX-003C</span>
              <span className="intel-tag">UNCLASSIFIED // DEFENSE INTEL</span>
            </div>
            <h1 className="system-title">
              SENTINELAI X <span className="title-sub">AUTONOMOUS TACTICAL INTELLIGENCE</span>
            </h1>
            <div className="authors-credit">
              LEAD RESEARCHERS: <strong>P R Kiran Kumar Reddy</strong> &nbsp;|&nbsp; <strong>Kurapati SriHarsha Vardhan</strong>
            </div>
          </div>

          <div className="header-center">
            <div className={`status-pill ${isAlertState ? 'alert' : 'nominal'}`}>
              <span className="pulse-indicator"></span>
              <span className="status-text">
                {isAlertState ? 'CRITICAL_THREAT_ACTIVE' : 'SYSTEM_ONLINE // NOMINAL'}
              </span>
            </div>
            <div className="telemetry-pill">
              <Activity size={14} className="icon-cyan" />
              <span>LATENCY: <strong>3.78 ms</strong> &lt; 5MS BUDGET</span>
            </div>
          </div>

          <div className="header-right">
            <div className="clock-readout">
              <Clock size={14} />
              <span>{utcTime || '2026-09-24 03:40:00 UTC'}</span>
            </div>
            <div className="model-stats">
              <span>SOTA ROC-AUC: <strong>75.41% MIL (88.40% WORLD)</strong></span>
              <span>FAR: <strong>1.9% (-14.3x)</strong></span>
            </div>
          </div>
        </header>

        {/* Main Operational Workspace Grid */}
        <main className="tactical-workspace">
          {/* Left Column: 4-Node CCTV Grid */}
          <section className="col-left">
            <TacticalCameraGrid
              selectedCam={selectedCam}
              onSelectCam={setSelectedCam}
              threatLevel={currentScore}
              activeIncident={isAlertState}
            />
          </section>

          {/* Center Column: Model Verification Lab & Live Trajectory */}
          <section className="col-center">
            <ModelVerificationConsole
              backendUrl={backendUrl}
              onTriggerIncident={handleTriggerScore}
            />
            <TelemetryChart
              currentScore={currentScore}
              worldSurprise={worldSurprise}
              isSimulating={true}
            />
          </section>

          {/* Right Column: Dither Controls & System Telemetry */}
          <section className="col-right">
            <DitherControls
              ditherConfig={ditherConfig}
              onChangeConfig={setDitherConfig}
              autoThreatSync={autoThreatSync}
              onToggleAutoSync={() => setAutoThreatSync(!autoThreatSync)}
            />

            <div className="audit-panel">
              <div className="panel-header">
                <div className="header-title">
                  <Terminal size={16} className="icon-cyan" />
                  <h3>AI TRANSPARENCY PROTOCOL AUDIT</h3>
                </div>
              </div>
              <div className="audit-log-body">
                <div className="log-entry">
                  <span className="time">[03:39:12]</span>
                  <span className="text">C3D Kernel (3x3x3) spatiotemporal forward pass nominal.</span>
                </div>
                <div className="log-entry">
                  <span className="time">[03:39:15]</span>
                  <span className="text">Law 1 (Sparsity) and Law 2 (Smoothness) active: λ₁=8e-5, λ₂=8e-5.</span>
                </div>
                <div className="log-entry">
                  <span className="time">[03:39:18]</span>
                  <span className="text">SLWM 256-D latent prediction divergence below 0.05 threshold.</span>
                </div>
                {isAlertState && (
                  <div className="log-entry alert-log">
                    <span className="time">[03:39:24]</span>
                    <span className="text">CRITICAL ALERT DISPATCH: Score {currentScore.toFixed(3)} on CAM_01. Awaiting operator validation.</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Incident Modal for Human-In-The-Loop Decision */}
      {activeAlert && (
        <IncidentDossierModal
          alert={activeAlert}
          onClose={() => setActiveAlert(null)}
          onFeedback={handleFeedback}
        />
      )}
    </div>
  );
}
