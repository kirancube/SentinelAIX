import React, { useState } from 'react';
import { ShieldAlert, Check, X, Wind, Users, Send } from 'lucide-react';

export default function IncidentDossierModal({ alert, onClose, onFeedback }) {
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [actionTaken, setActionTaken] = useState(null);

  if (!alert) return null;

  const handleAction = (type, label) => {
    setActionTaken(label);
    setFeedbackSent(true);
    if (onFeedback) {
      onFeedback(alert.id, type);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="dossier-modal">
        <div className="modal-header">
          <div className="header-badge">
            <ShieldAlert size={20} className="text-crimson" />
            <h2>TACTICAL INCIDENT DOSSIER // CRITICAL ALERT</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="incident-summary-card">
            <div className="summary-col">
              <span className="label">INCIDENT ID:</span>
              <span className="val text-cyan">{alert.id || 'INC-2026-0924-001'}</span>
            </div>
            <div className="summary-col">
              <span className="label">PRIMARY SENSOR:</span>
              <span className="val text-amber">{alert.camera || 'CAM_01 // NORTH GATE'}</span>
            </div>
            <div className="summary-col">
              <span className="label">PEAK ANOMALY SCORE:</span>
              <span className="val text-crimson large">{alert.score || '0.9824'}</span>
            </div>
            <div className="summary-col">
              <span className="label">CLASSIFICATION:</span>
              <span className="val text-crimson">{alert.type || 'ASSAULT / VIOLENT ALTERCATION'}</span>
            </div>
          </div>

          <div className="decision-matrix-box">
            <h3>HUMAN-IN-THE-LOOP OPERATOR DECISION MATRIX</h3>
            <p className="matrix-explainer">
              Under SentinelAI X AI Transparency Protocol, tactical actions require operator validation. Operator decisions close the feedback loop and mine hard negatives.
            </p>

            {feedbackSent ? (
              <div className="feedback-confirmation">
                <Check size={20} className="text-emerald" />
                <div>
                  <strong>OPERATOR DECISION REGISTERED: {actionTaken}</strong>
                  <p>Telemetry recorded into system audit ledger. Feedback loop updated.</p>
                </div>
              </div>
            ) : (
              <div className="action-buttons-row">
                <button
                  className="decision-btn btn-confirm"
                  onClick={() => handleAction('CONFIRMED_THREAT', 'THREAT CONFIRMED (TACTICAL MOBILIZATION)')}
                >
                  <Send size={16} />
                  <div>
                    <strong>CONFIRM THREAT</strong>
                    <span>Dispatch Tactical Response Units</span>
                  </div>
                </button>

                <button
                  className="decision-btn btn-dismiss-env"
                  onClick={() => handleAction('FALSE_POSITIVE_ENVIRONMENTAL', 'DISMISSED (OPTICAL / WEATHER)')}
                >
                  <Wind size={16} />
                  <div>
                    <strong>DISMISS (OPTICAL / WEATHER)</strong>
                    <span>Recalibrate Sensor & Clean Lens</span>
                  </div>
                </button>

                <button
                  className="decision-btn btn-dismiss-crowd"
                  onClick={() => handleAction('FALSE_POSITIVE_BEHAVIORAL', 'DISMISSED (BENIGN CROWD GATHERING)')}
                >
                  <Users size={16} />
                  <div>
                    <strong>DISMISS (BENIGN CROWD)</strong>
                    <span>Mine as Hard Negative Instance</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
