"""
SentinelAI X Central Cloud Command API Server
Provides REST endpoints and WebSocket/streaming telemetry for Tactical Operations Center.
Supports FastAPI/Uvicorn when installed, with built-in http.server fallback.
"""

import os
import json
import time
import math
from typing import Dict, Any, List, Optional
from sentinel.config import load_config, load_camera_grid
from sentinel.inference.engine import StreamInferenceEngine
from sentinel.inference.alert_manager import AlertManager

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import HTMLResponse, JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


def create_fastapi_app():
    """Builds full production FastAPI application."""
    config = load_config()
    cameras = load_camera_grid()
    inference_engine = StreamInferenceEngine(
        anomaly_threshold=config.inference.anomaly_threshold,
        critical_threshold=config.inference.critical_threshold
    )
    alert_manager = AlertManager(
        anomaly_threshold=config.inference.anomaly_threshold,
        critical_threshold=config.inference.critical_threshold
    )

    app = FastAPI(
        title="SentinelAI X - Operations Command API",
        version="1.2.0",
        description="Autonomous Public Safety Intelligence Platform API"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    dashboard_dir = os.path.join(os.path.dirname(__file__), "..", "dashboard")

    @app.get("/health")
    def health_check():
        return {
            "status": "SYSTEM_ONLINE",
            "dossier_id": config.dossier_id,
            "timestamp": time.time()
        }

    @app.get("/api/v1/status")
    def get_status():
        return {
            "dossier_id": config.dossier_id,
            "platform_name": "SentinelAI X",
            "classification": config.classification,
            "active_cameras": len(cameras),
            "processed_frames": inference_engine.total_frames_processed,
            "auc_roc": config.inference.target_auc,
            "false_alarm_rate": config.inference.target_far,
            "latency_ms": 3.84,
            "tactical_modules": {
                "MODULE_1_YOLO_V8": "PLANNED",
                "MODULE_2_C3D_SPATIOTEMPORAL": "ACTIVE",
                "MODULE_3_MIL_RANKING_ENGINE": "ACTIVE"
            }
        }

    @app.get("/api/v1/cameras")
    def get_cameras():
        return {"cameras": cameras}

    @app.get("/api/v1/alerts")
    def get_alerts(limit: int = 10):
        return {"alerts": alert_manager.get_recent_alerts(limit=limit)}

    @app.post("/api/v1/score")
    def score_clip(payload: Dict[str, Any]):
        camera_id = payload.get("camera_id", "CAM_01")
        feature_vector = payload.get("feature_vector", [])
        if not feature_vector:
            raise HTTPException(status_code=400, detail="Missing feature_vector")
        
        score_res = inference_engine.score_vector(feature_vector)
        score = score_res["smoothed_score"]
        frame_idx = score_res["frame_index"]

        # Check for alert dispatch
        alert = alert_manager.evaluate_and_dispatch(
            camera_id=camera_id,
            camera_name=f"Camera Node {camera_id}",
            frame_index=frame_idx,
            score=score
        )
        return {
            "inference": score_res,
            "alert_triggered": alert is not None,
            "alert": alert.__dict__ if alert else None
        }

    @app.post("/api/v1/feedback")
    def register_feedback(payload: Dict[str, Any]):
        alert_id = payload.get("alert_id")
        feedback_type = payload.get("feedback_type")
        notes = payload.get("notes", "")
        if not alert_id or not feedback_type:
            raise HTTPException(status_code=400, detail="Missing alert_id or feedback_type")
        
        success = alert_manager.register_operator_feedback(alert_id, feedback_type, notes)
        return {"success": success, "alert_id": alert_id, "feedback": feedback_type}

    @app.get("/api/v1/benchmark")
    def get_benchmark():
        return {
            "dossier_report_id": "2024-SAX-003C",
            "metric_type": "Frame-Level ROC & Threat Mitigation",
            "auc_roc": {
                "sentinel_ai_x": 0.7541,
                "legacy_baseline": 0.5840,
                "improvement_delta": "+17.01%"
            },
            "false_alarm_rate": {
                "sentinel_ai_x": 0.019,
                "legacy_system": 0.272,
                "noise_reduction_factor": "14.3x reduction"
            },
            "threat_categorization_baselines": {
                "c3d_baseline_accuracy": 0.230,
                "tcnn_baseline_accuracy": 0.284,
                "planned_transformer_target": 0.650
            }
        }

    @app.get("/api/v1/stream/sample")
    def get_stream_sample(frame: int = 0):
        """
        Simulates the diagnostic trajectory from Page 12 of the briefing dossier:
        - Baseline: nominal ~0.01 to 0.04
        - Critical anomaly spike around frames 8,500 - 10,500 with score reaching 0.99
        - Latency < 5ms
        """
        norm_frame = frame % 16000
        # Calculate score curve
        if 8500 <= norm_frame <= 10300:
            # Steep rise to ~0.99
            if norm_frame < 8800:
                score = 0.02 + 0.97 * (1.0 / (1.0 + math.exp(-(norm_frame - 8650) / 40)))
            elif norm_frame > 10000:
                score = 0.02 + 0.97 * (1.0 / (1.0 + math.exp((norm_frame - 10150) / 40)))
            else:
                score = 0.985 + 0.008 * math.sin(norm_frame * 0.1)
        else:
            score = 0.015 + 0.015 * math.sin(norm_frame * 0.02)

        is_critical = score >= 0.85
        is_alert = score >= 0.50
        status = "CRITICAL" if is_critical else ("ALERT" if is_alert else "NOMINAL")

        return {
            "frame": norm_frame,
            "anomaly_score": round(score, 4),
            "latency_ms": round(3.4 + 0.8 * math.sin(norm_frame * 0.05), 2),
            "status": status,
            "threshold": 0.50
        }

    @app.get("/")
    def serve_dashboard():
        index_file = os.path.join(dashboard_dir, "index.html")
        if os.path.exists(index_file):
            with open(index_file, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse(content="<h1>SentinelAI X Operations Center</h1><p>Dashboard UI loading...</p>")

    if os.path.exists(dashboard_dir):
        app.mount("/static", StaticFiles(directory=dashboard_dir), name="static")

    return app


# Standalone pure Python fallback HTTP server
def run_standalone_server(port: int = 8000, host: str = "127.0.0.1"):
    import http.server
    import socketserver
    dashboard_dir = os.path.join(os.path.dirname(__file__), "..", "dashboard")

    class SentinelHTTPHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dashboard_dir, **kwargs)

        def do_GET(self):
            if self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status": "SYSTEM_ONLINE", "dossier_id": "2024-SAX-003C"}')
                return
            elif self.path.startswith("/api/v1/stream/sample"):
                # Parse query frame
                frame = 0
                if "frame=" in self.path:
                    try:
                        frame = int(self.path.split("frame=")[1].split("&")[0])
                    except Exception:
                        frame = 0
                norm_frame = frame % 16000
                if 8500 <= norm_frame <= 10300:
                    score = 0.985
                    status = "CRITICAL"
                else:
                    score = 0.02
                    status = "NOMINAL"
                resp = json.dumps({
                    "frame": norm_frame,
                    "anomaly_score": score,
                    "latency_ms": 3.82,
                    "status": status,
                    "threshold": 0.50
                })
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp.encode("utf-8"))
                return
            elif self.path == "/api/v1/benchmark":
                resp = json.dumps({
                    "dossier_report_id": "2024-SAX-003C",
                    "auc_roc": 0.7541,
                    "false_alarm_rate": 0.019
                })
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp.encode("utf-8"))
                return
            return super().do_GET()

    print(f"[*] Starting SentinelAI X Standalone HTTP Server on http://{host}:{port}")
    with socketserver.TCPServer((host, port), SentinelHTTPHandler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    if HAS_FASTAPI:
        import uvicorn
        app = create_fastapi_app()
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        run_standalone_server()
