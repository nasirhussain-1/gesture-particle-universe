import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand } from 'lucide-react';
import {
  FormationId,
  GestureType,
  HandTrackingData,
  SimulationConfig,
} from './types/simulation';
import { FORMATIONS } from './utils/formations';
import { HandGestureController } from './utils/handGestureRecognizer';
import { AudioSpectrumData, CosmicAudioEngine } from './utils/audioAnalyzer';
import { ParticleUniverseCanvas } from './components/ParticleUniverseCanvas';
import { ControlDock, DockTab } from './components/ControlDock';
import { GestureGuideModal } from './components/GestureGuideModal';

const INITIAL_CONFIG: SimulationConfig = {
  particleCount: 18000,
  particleSize: 1.15,
  particleSpeed: 1.0,
  attractionStrength: 1.25,
  repulsionStrength: 1.35,
  turbulenceIntensity: 0.65,
  formation: 'galaxy',
  palette: 'cosmic_cyan',
  autoPlay: false,
  isPaused: false,
  lowPerformanceMode: false,
  blackHoleActive: false,
  paintingMode: false,
  audioReactive: false,
  synthAudioActive: false,
  trailDecay: 0.92,
};

export default function App() {
  const [config, setConfig] = useState<SimulationConfig>(INITIAL_CONFIG);
  const [activeTab, setActiveTab] = useState<DockTab>('formations');
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  // Loading & Tutorial states
  const [bootProgress, setBootProgress] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  // Webcam & Hand Gesture Tracking states
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [virtualCamActive, setVirtualCamActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    'IDLE' | 'REQUESTING' | 'ACTIVE' | 'DENIED'
  >('IDLE');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [detectedGesture, setDetectedGesture] = useState<GestureType>('NONE');
  const [simulatedGesture, setSimulatedGesture] = useState<GestureType>('NONE');
  const [handsCount, setHandsCount] = useState(0);
  const [fps, setFps] = useState(60);

  // Audio states
  const [micEnabled, setMicEnabled] = useState(false);
  const [synthEnabled, setSynthEnabled] = useState(false);

  // Refs for real-time 60fps loop access
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureControllerRef = useRef<HandGestureController | null>(null);
  const audioEngineRef = useRef<CosmicAudioEngine | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const virtualPointerRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  const handDataRef = useRef<HandTrackingData>({
    handsDetected: 0,
    primaryGesture: 'NONE',
    gestureConfidence: 0,
    leftHandCenter: null,
    rightHandCenter: null,
    indexFingerTip: null,
    pinchCenter: null,
    handDistance: 0.5,
    handVelocity: { vx: 0, vy: 0 },
    angularVelocity: 0,
    isSimulated: false,
  });

  const audioSpectrumRef = useRef<AudioSpectrumData>({
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0,
  });

  const explosionTriggerRef = useRef(0);
  const clearPaintTriggerRef = useRef(0);
  const resetTriggerRef = useRef(0);

  // Track pointer globally for Virtual Hand Camera mode
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      virtualPointerRef.current = {
        x: e.clientX / Math.max(1, window.innerWidth),
        y: e.clientY / Math.max(1, window.innerHeight),
      };
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // 1. Cinematic Boot Sequence + Pre-warm MediaPipe in background
  useEffect(() => {
    if (!gestureControllerRef.current) {
      gestureControllerRef.current = new HandGestureController();
      gestureControllerRef.current.init().catch(() => {});
    }

    const timer = window.setInterval(() => {
      setBootProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsBooting(false);
          return 100;
        }
        return prev + 25;
      });
    }, 110);
    return () => clearInterval(timer);
  }, []);

  // 2. Auto-Play Formation Cycling
  useEffect(() => {
    if (!config.autoPlay || config.isPaused) return;
    const interval = window.setInterval(() => {
      setConfig((prev) => {
        const idx = FORMATIONS.findIndex((f) => f.id === prev.formation);
        const nextMeta = FORMATIONS[(idx + 1) % FORMATIONS.length];
        return {
          ...prev,
          formation: nextMeta.id,
          palette: nextMeta.defaultPalette,
        };
      });
    }, 8500);
    return () => clearInterval(interval);
  }, [config.autoPlay, config.isPaused]);

  // 3. Keyboard Shortcuts (H = Hide/Show Dock, Space = Supernova Explosion, P = Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        explosionTriggerRef.current += 1;
      } else if (e.key === 'p' || e.key === 'P') {
        setConfig((prev) => ({ ...prev, isPaused: !prev.isPaused }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 4. Webcam & MediaPipe Hand Tracking Loop
  const stopWebcam = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setCameraEnabled(false);
    setVirtualCamActive(false);
    setCameraStatus('IDLE');
    setCameraErrorMsg('');
    setDetectedGesture('NONE');
    setHandsCount(0);
    handDataRef.current = {
      ...handDataRef.current,
      handsDetected: 0,
      primaryGesture: 'NONE',
    };
  }, []);

  const startVirtualHandCam = useCallback(() => {
    stopWebcam();
    setVirtualCamActive(true);
    setCameraEnabled(true);
    setCameraStatus('ACTIVE');
    setCameraErrorMsg('');
    if (simulatedGesture === 'NONE') {
      setSimulatedGesture('OPEN PALM');
    }
  }, [simulatedGesture, stopWebcam]);

  const startWebcam = useCallback(async (customDeviceId?: string) => {
    setCameraStatus('REQUESTING');
    setCameraErrorMsg('');
    setVirtualCamActive(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('DENIED');
      setCameraErrorMsg('Browser camera API unavailable in this context.');
      return;
    }

    // Stop any previous stream before requesting a new one
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }

    const targetDeviceId = customDeviceId !== undefined ? customDeviceId : selectedDeviceId;

    // Request getUserMedia IMMEDIATELY before awaiting any external network calls
    // so the browser's user-gesture permission prompt never expires.
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;

    const constraintCandidates: MediaStreamConstraints[] = [];
    if (targetDeviceId) {
      constraintCandidates.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    }
    constraintCandidates.push(
      {
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      },
      {
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      },
      {
        video: true,
        audio: false,
      }
    );

    for (const constraints of constraintCandidates) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastErr = err;
      }
    }

    // If all standard constraints failed, try enumerating any available videoinput device
    if (!stream) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
        if (cams.length > 0) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: cams[0].deviceId } },
            audio: false,
          });
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!stream) {
      const errName = lastErr instanceof Error ? lastErr.name : '';
      let friendlyMsg = 'Unable to access webcam. Check camera permissions or try Virtual Hand Mode.';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        friendlyMsg = 'Camera permission blocked by browser. Allow camera in the address bar or use Virtual Hand Mode.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        friendlyMsg = 'No webcam hardware detected. Use Virtual Hand Mode below to control with your cursor.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        friendlyMsg = 'Webcam is currently in use by another application.';
      }
      setCameraEnabled(false);
      setCameraStatus('DENIED');
      setCameraErrorMsg(friendlyMsg);
      return;
    }

    cameraStreamRef.current = stream;

    // Populate camera device list once permission is granted
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      const activeTrack = stream.getVideoTracks()[0];
      const activeDevId = activeTrack?.getSettings()?.deviceId;
      if (activeDevId) {
        setSelectedDeviceId(activeDevId);
      }
    } catch {
      // ignore enumeration errors
    }

    // Attach stream to video element and ensure playback starts reliably
    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) {
          resolve();
        } else {
          const onLoaded = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            resolve();
          };
          video.addEventListener('loadedmetadata', onLoaded);
          window.setTimeout(resolve, 1500);
        }
      });

      try {
        await video.play();
      } catch {
        // Ignore play interruption
      }
    }

    setCameraEnabled(true);
    setCameraStatus('ACTIVE');
    setSimulatedGesture('NONE');

    // Ensure MediaPipe HandLandmarker is initialized
    if (!gestureControllerRef.current) {
      gestureControllerRef.current = new HandGestureController();
    }
    if (!gestureControllerRef.current.isReady()) {
      gestureControllerRef.current.init().catch(() => {});
    }
  }, [selectedDeviceId]);

  const handleToggleCamera = useCallback(() => {
    if (cameraEnabled) {
      stopWebcam();
    } else {
      startWebcam();
    }
  }, [cameraEnabled, startWebcam, stopWebcam]);

  // Poll MediaPipe hand landmarks (or Virtual Hand Camera) & Audio Spectrum at ~30fps
  useEffect(() => {
    let rafId = 0;
    let lastPoll = 0;

    const drawVirtualHandSkeleton = (
      canvas: HTMLCanvasElement,
      normX: number,
      normY: number,
      gesture: GestureType,
      timeSec: number
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle grid background
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const cx = Math.max(28, Math.min(w - 28, normX * w));
      const cy = Math.max(28, Math.min(h - 28, normY * h));
      const spread =
        gesture === 'FIST'
          ? 0.38
          : gesture === 'PINCH'
          ? 0.55
          : gesture === 'EXPAND HANDS' || gesture === 'TWO HANDS'
          ? 1.25
          : 1.0;

      const wristX = cx;
      const wristY = cy + 26;

      const fingerAngles = [-0.65, -0.28, 0.0, 0.28, 0.58];
      const fingerLengths = [26, 36, 40, 36, 28];

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;

      fingerAngles.forEach((ang, idx) => {
        const isPointingFinger = gesture === 'POINTING' && idx === 1;
        const fingerScale =
          gesture === 'POINTING' && idx !== 1
            ? 0.35
            : isPointingFinger
            ? 1.15
            : spread;
        const tipX =
          cx +
          Math.sin(ang * spread + Math.sin(timeSec * 3 + idx) * 0.04) *
            fingerLengths[idx] *
            fingerScale;
        const tipY =
          cy -
          Math.cos(ang * spread) * fingerLengths[idx] * fingerScale;
        const midX = (wristX + tipX) * 0.5;
        const midY = (wristY + tipY) * 0.5;

        ctx.beginPath();
        ctx.moveTo(wristX, wristY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(midX, midY, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Palm center node
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const pollSensors = (now: number) => {
      if (now - lastPoll >= 33) {
        lastPoll = now;

        if (cameraEnabled && virtualCamActive) {
          // Virtual Hand Camera Mode
          const ptr = virtualPointerRef.current;
          const activeGest =
            simulatedGesture !== 'NONE' ? simulatedGesture : 'OPEN PALM';
          if (overlayCanvasRef.current) {
            drawVirtualHandSkeleton(
              overlayCanvasRef.current,
              ptr.x,
              ptr.y,
              activeGest,
              now / 1000
            );
          }
          const worldX = (ptr.x - 0.5) * 2.0;
          const worldY = (0.5 - ptr.y) * 2.0;
          handDataRef.current = {
            handsDetected: activeGest === 'TWO HANDS' || activeGest === 'EXPAND HANDS' || activeGest === 'COMPRESS HANDS' ? 2 : 1,
            primaryGesture: activeGest,
            gestureConfidence: 0.98,
            leftHandCenter: { x: worldX, y: worldY, z: 0 },
            rightHandCenter: { x: -worldX, y: worldY, z: 0 },
            indexFingerTip: { x: worldX, y: worldY + 0.15, z: 0 },
            pinchCenter: { x: worldX, y: worldY, z: 0 },
            handDistance: activeGest === 'EXPAND HANDS' ? 1.2 : activeGest === 'COMPRESS HANDS' ? 0.25 : 0.7,
            handVelocity: { vx: worldX * 2.0, vy: worldY * 2.0 },
            angularVelocity: activeGest === 'VORTEX' ? 0.8 : 0,
            isSimulated: true,
          };
          setDetectedGesture(activeGest);
          setHandsCount(handDataRef.current.handsDetected);
        } else if (
          cameraEnabled &&
          videoRef.current &&
          gestureControllerRef.current
        ) {
          // Real Webcam MediaPipe Hand Landmarks
          const data = gestureControllerRef.current.detect(
            videoRef.current,
            overlayCanvasRef.current,
            now
          );
          handDataRef.current = data;
          setDetectedGesture((prev) =>
            prev !== data.primaryGesture ? data.primaryGesture : prev
          );
          setHandsCount((prev) =>
            prev !== data.handsDetected ? data.handsDetected : prev
          );
        }

        // Poll Audio Spectrum
        if (audioEngineRef.current && (micEnabled || synthEnabled)) {
          audioSpectrumRef.current = audioEngineRef.current.getSpectrum(
            now / 1000
          );
        } else {
          audioSpectrumRef.current = { bass: 0, mid: 0, treble: 0, overall: 0 };
        }
      }
      rafId = requestAnimationFrame(pollSensors);
    };

    rafId = requestAnimationFrame(pollSensors);
    return () => cancelAnimationFrame(rafId);
  }, [cameraEnabled, micEnabled, simulatedGesture, synthEnabled, virtualCamActive]);

  // Cleanup audio and camera on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      audioEngineRef.current?.dispose();
    };
  }, [stopWebcam]);

  const handleChangeConfig = useCallback((partial: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleSelectFormation = useCallback((formationId: FormationId) => {
    const meta = FORMATIONS.find((f) => f.id === formationId);
    setConfig((prev) => ({
      ...prev,
      formation: formationId,
      palette: meta ? meta.defaultPalette : prev.palette,
    }));
  }, []);

  const handleToggleMic = useCallback(async () => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new CosmicAudioEngine();
    }
    if (micEnabled) {
      audioEngineRef.current.disableMicrophone();
      setMicEnabled(false);
    } else {
      const ok = await audioEngineRef.current.enableMicrophone();
      setMicEnabled(ok);
    }
  }, [micEnabled]);

  const handleToggleSynth = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new CosmicAudioEngine();
    }
    const next = !synthEnabled;
    audioEngineRef.current.toggleProceduralSynth(next);
    setSynthEnabled(next);
  }, [synthEnabled]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleFpsUpdate = useCallback((currentFps: number, isSoftwareGl: boolean) => {
    setFps(currentFps);
    if (isSoftwareGl) {
      setConfig((prev) =>
        prev.lowPerformanceMode ? prev : { ...prev, lowPerformanceMode: true }
      );
    }
  }, []);

  const activeGestureLabel: GestureType =
    simulatedGesture !== 'NONE' ? simulatedGesture : detectedGesture;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#03050a] select-none">
      {/* 1. Full-Screen 3D Particle Universe Canvas */}
      <ParticleUniverseCanvas
        config={config}
        handDataRef={handDataRef}
        audioSpectrumRef={audioSpectrumRef}
        explosionTriggerRef={explosionTriggerRef}
        clearPaintTriggerRef={clearPaintTriggerRef}
        resetTriggerRef={resetTriggerRef}
        simulatedGesture={simulatedGesture}
        onFpsUpdate={handleFpsUpdate}
      />

      {/* 2. Top Navigation Bar (Strict 3-Zone Top Bar Contract per Frontend Design Skill §2) */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#050811]/90 border-b border-slate-800/80">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#universe"
          onClick={(e) => {
            e.preventDefault();
            setIsDockCollapsed(false);
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Aetheris
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              setActiveTab('formations');
              setIsDockCollapsed(false);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Formations
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('physics');
              setIsDockCollapsed(false);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Physics
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('gestures');
              setIsDockCollapsed(false);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Gestures
          </button>
          <button
            type="button"
            onClick={() => {
              setIsFirstLaunch(false);
              setIsGuideOpen(true);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Gesture Guide
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleCamera}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {cameraEnabled ? 'Disable Webcam' : 'Enable Webcam'}
          </button>
        </div>
      </header>

      {/* 3. Discreet Corner Hand Tracking & Webcam Preview HUD */}
      <aside
        className="fixed top-16 right-4 z-20 w-60 bg-[#070b14]/95 border border-slate-800/90 rounded-xl p-3 shadow-xl pointer-events-auto"
        aria-label="Live Hand Tracking Status and Webcam Preview"
      >
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Hand className="w-3.5 h-3.5 text-cyan-400" />
            <span>{virtualCamActive ? 'Virtual Hand Cam' : 'Hand Tracking'}</span>
          </span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            {fps} FPS
          </span>
        </div>

        {/* Camera Device Selector when multiple cameras are available */}
        {cameraEnabled && !virtualCamActive && videoDevices.length > 1 && (
          <div className="mb-2">
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                startWebcam(e.target.value);
              }}
              className="w-full bg-[#0c1220] border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
              aria-label="Select Camera Device"
            >
              {videoDevices.map((dev, i) => (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  {dev.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Compact Webcam Preview Viewport (Never use display:none on video so playback never stalls) */}
        <div className="relative w-full h-32 bg-[#03050a] border border-slate-800 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              cameraEnabled && !virtualCamActive
                ? 'opacity-75'
                : 'opacity-0 pointer-events-none'
            }`}
          />
          <canvas
            ref={overlayCanvasRef}
            width={240}
            height={140}
            className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 ${
              cameraEnabled ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {!cameraEnabled && (
            <div className="relative z-10 text-center px-2.5 py-1">
              {cameraStatus === 'DENIED' ? (
                <>
                  <CameraOff className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-[10px] text-amber-300 leading-tight mb-2">
                    {cameraErrorMsg ||
                      'Camera blocked or unavailable. Retry or launch Virtual Hand Mode.'}
                  </p>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-400 leading-tight mb-2">
                    Enable live webcam hand tracking or Virtual Hand Mode
                  </p>
                </>
              )}
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startWebcam()}
                  className="px-2.5 py-1 text-[11px] font-medium text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 rounded-md hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {cameraStatus === 'REQUESTING' ? 'Starting...' : 'Start Camera'}
                </button>
                <button
                  type="button"
                  onClick={startVirtualHandCam}
                  className="px-2.5 py-1 text-[11px] font-medium text-purple-200 bg-purple-500/20 border border-purple-500/40 rounded-md hover:bg-purple-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Simulate live hand tracking in the camera viewport using your mouse/touch"
                >
                  Virtual Hand
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detected Gesture Readout */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Detected Gesture</span>
            <span className="font-mono font-semibold text-cyan-400">
              {activeGestureLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Hands Tracked</span>
            <span className="font-mono tabular-nums text-slate-200">
              {cameraEnabled ? handsCount : simulatedGesture !== 'NONE' ? 1 : 0}
            </span>
          </div>
        </div>
      </aside>

      {/* 4. Unified Collapsible Bottom Control Dock */}
      <ControlDock
        config={config}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isDockCollapsed}
        setIsCollapsed={setIsDockCollapsed}
        onChangeConfig={handleChangeConfig}
        onSelectFormation={handleSelectFormation}
        onTriggerExplosion={() => {
          explosionTriggerRef.current += 1;
        }}
        onClearPaint={() => {
          clearPaintTriggerRef.current += 1;
        }}
        onResetSimulation={() => {
          setSimulatedGesture('NONE');
          setConfig(INITIAL_CONFIG);
          resetTriggerRef.current += 1;
        }}
        onToggleFullscreen={handleToggleFullscreen}
        cameraEnabled={cameraEnabled}
        onToggleCamera={handleToggleCamera}
        micEnabled={micEnabled}
        onToggleMic={handleToggleMic}
        synthEnabled={synthEnabled}
        onToggleSynth={handleToggleSynth}
        detectedGesture={detectedGesture}
        simulatedGesture={simulatedGesture}
        onSelectSimulatedGesture={(gesture) => setSimulatedGesture(gesture)}
      />

      {/* 5. Gesture Tutorial Modal */}
      <GestureGuideModal
        isOpen={isGuideOpen}
        isFirstLaunch={isFirstLaunch}
        onClose={() => setIsGuideOpen(false)}
        onEnableCameraAndStart={() => {
          setIsGuideOpen(false);
          startWebcam();
        }}
      />

      {/* 6. Cinematic Loading Overlay on Initial Launch */}
      {isBooting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03050a] px-6 text-center">
          <div className="max-w-md w-full space-y-4">
            <div className="text-xs font-mono text-cyan-400 tracking-widest">
              INITIALIZING QUANTUM PARTICLE FIELD
            </div>
            <h1 className="text-3xl font-bold text-white font-display tracking-tight">
              Aetheris Universe
            </h1>
            <p className="text-xs text-slate-400">
              Preparing 30,000 WebGL shader particles & MediaPipe hand vision...
            </p>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${bootProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
