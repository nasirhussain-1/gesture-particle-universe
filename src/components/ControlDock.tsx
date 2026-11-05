import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Maximize2,
  Mic,
  MicOff,
  Music,
  Orbit,
  Paintbrush,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Video,
  VideoOff,
  Hand,
} from 'lucide-react';
import {
  FormationId,
  GestureType,
  PaletteId,
  SimulationConfig,
} from '../types/simulation';
import { FORMATIONS, PALETTES } from '../utils/formations';

export type DockTab = 'formations' | 'physics' | 'gestures';

interface ControlDockProps {
  config: SimulationConfig;
  activeTab: DockTab;
  setActiveTab: (tab: DockTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onChangeConfig: (partial: Partial<SimulationConfig>) => void;
  onSelectFormation: (formation: FormationId) => void;
  onTriggerExplosion: () => void;
  onClearPaint: () => void;
  onResetSimulation: () => void;
  onToggleFullscreen: () => void;
  cameraEnabled: boolean;
  onToggleCamera: () => void;
  micEnabled: boolean;
  onToggleMic: () => void;
  synthEnabled: boolean;
  onToggleSynth: () => void;
  detectedGesture: GestureType;
  simulatedGesture: GestureType;
  onSelectSimulatedGesture: (gesture: GestureType) => void;
}

const GESTURE_PRESETS: { id: GestureType; label: string; hint: string }[] = [
  { id: 'NONE', label: 'Live Auto', hint: 'Use live webcam hand tracking' },
  { id: 'OPEN PALM', label: 'Open Palm', hint: 'Spread particles outward' },
  { id: 'FIST', label: 'Close Fist', hint: 'Attract into dense energy sphere' },
  { id: 'PINCH', label: 'Pinch Cluster', hint: 'Grab & move local cluster' },
  { id: 'POINTING', label: 'Pointing Beam', hint: 'Focused stream & trail painting' },
  { id: 'VORTEX', label: 'Circular Vortex', hint: 'Generate spiral angular swirl' },
  { id: 'TWO HANDS', label: 'Two Open Palms', hint: 'Large-scale radial explosion' },
  { id: 'EXPAND HANDS', label: 'Hands Apart', hint: 'Expand particle universe' },
  { id: 'COMPRESS HANDS', label: 'Hands Together', hint: 'Gravitational collapse' },
  { id: 'SWIPE HORIZONTAL', label: 'Swipe Left/Right', hint: 'Accelerate orbital rotation' },
  { id: 'SWIPE VERTICAL', label: 'Swipe Up/Down', hint: 'Shift vertical elevation' },
];

export const ControlDock: React.FC<ControlDockProps> = ({
  config,
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  onChangeConfig,
  onSelectFormation,
  onTriggerExplosion,
  onClearPaint,
  onResetSimulation,
  onToggleFullscreen,
  cameraEnabled,
  onToggleCamera,
  micEnabled,
  onToggleMic,
  synthEnabled,
  onToggleSynth,
  detectedGesture,
  simulatedGesture,
  onSelectSimulatedGesture,
}) => {
  const currentFormationMeta =
    FORMATIONS.find((f) => f.id === config.formation) || FORMATIONS[0];

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95vw] max-w-[960px] pointer-events-auto transition-transform duration-200"
      style={{
        transform: isCollapsed
          ? 'translate(-50%, calc(100% - 38px))'
          : 'translate(-50%, 0)',
      }}
    >
      {/* Top Collapse/Expand Handle Bar */}
      <div className="flex items-center justify-between px-4 mb-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#070b14]/95 border border-slate-800/90 px-3 py-1.5 rounded-lg">
          <span className="font-medium text-slate-200">{currentFormationMeta.name}</span>
          <span aria-hidden="true">·</span>
          <span>{currentFormationMeta.category}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-cyan-400">
            {(config.lowPerformanceMode
              ? Math.min(config.particleCount, 6000)
              : config.particleCount
            ).toLocaleString()}{' '}
            particles
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-[#070b14]/95 border border-slate-800/90 rounded-lg hover:border-cyan-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Toggle Control Dock (Shortcut: H)"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Surface (No backdrop-filter over WebGL per Three.js skill §4.1) */}
      <div className="bg-[#070b14]/95 border border-slate-800/90 rounded-xl p-4 shadow-2xl">
        {/* Dock Header: Mode Tabs + Quick Utility Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1 p-1 bg-[#0c1220] border border-slate-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('formations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'formations'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Formations & Modes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('physics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'physics'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Physics & Sliders</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gestures')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'gestures'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Gestures & Audio</span>
            </button>
          </div>

          {/* Primary Simulation Action Strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onTriggerExplosion}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Energy Explosion</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeConfig({ blackHoleActive: !config.blackHoleActive })
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.blackHoleActive
                  ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                  : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>{config.blackHoleActive ? 'Black Hole: On' : 'Black Hole'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeConfig({ paintingMode: !config.paintingMode })
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.paintingMode
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                  : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>{config.paintingMode ? 'Painting: On' : 'Paint Trails'}</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeConfig({ isPaused: !config.isPaused })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#0c1220] text-slate-200 border border-slate-800 rounded-lg hover:border-slate-700 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={config.isPaused ? 'Resume Simulation' : 'Pause Simulation'}
            >
              {config.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-slate-300" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onResetSimulation}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#0c1220] text-slate-300 border border-slate-800 rounded-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Reset Simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#0c1220] text-slate-300 border border-slate-800 rounded-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAB 1: 13 FORMATIONS & 6 COLOR PALETTES */}
        {activeTab === 'formations' && (
          <div className="space-y-3">
            {/* 13 Particle Formation Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                13 Particle Formations (Smooth Morphing)
              </span>
              <button
                type="button"
                onClick={() => onChangeConfig({ autoPlay: !config.autoPlay })}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.autoPlay
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#0c1220] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {config.autoPlay ? 'Auto-Cycle Formations: On' : 'Auto-Cycle Formations: Off'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {FORMATIONS.map((f) => {
                const isSelected = config.formation === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectFormation(f.id)}
                    className={`px-2.5 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-[#0c1220] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{f.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{f.category}</div>
                  </button>
                );
              })}
            </div>

            {/* Color Palette Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
              <span className="text-xs font-medium text-slate-400">Color Palette</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETTES.map((pal) => {
                  const active = config.palette === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => onChangeConfig({ palette: pal.id as PaletteId })}
                      className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-slate-800 text-white border-cyan-400'
                          : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        {pal.colors.slice(0, 3).map((hex, i) => (
                          <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </span>
                      <span>{pal.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PHYSICS & SLIDERS */}
        {activeTab === 'physics' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              {/* Particle Count */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Particle Count</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.particleCount.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={30000}
                  step={1000}
                  value={config.particleCount}
                  onChange={(e) =>
                    onChangeConfig({ particleCount: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>

              {/* Particle Size */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Particle Size</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.particleSize.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.05}
                  value={config.particleSize}
                  onChange={(e) =>
                    onChangeConfig({ particleSize: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>

              {/* Time Control / Speed */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Time Dilation / Speed</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.particleSpeed.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.05}
                  value={config.particleSpeed}
                  onChange={(e) =>
                    onChangeConfig({ particleSpeed: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>

              {/* Attraction Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Attraction Strength</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.attractionStrength.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={config.attractionStrength}
                  onChange={(e) =>
                    onChangeConfig({ attractionStrength: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>

              {/* Repulsion Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Repulsion Strength</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.repulsionStrength.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={config.repulsionStrength}
                  onChange={(e) =>
                    onChangeConfig({ repulsionStrength: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>

              {/* Turbulence Intensity */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Turbulence & Curl Noise</span>
                  <span className="font-mono tabular-nums text-cyan-400">
                    {config.turbulenceIntensity.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={2.5}
                  step={0.05}
                  value={config.turbulenceIntensity}
                  onChange={(e) =>
                    onChangeConfig({ turbulenceIntensity: Number(e.target.value) })
                  }
                  className="w-full cosmic-slider"
                />
              </div>
            </div>

            {/* Bottom Row of Physics Tab: Low-Performance Mode & Clear Paint Trails */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangeConfig({
                      lowPerformanceMode: !config.lowPerformanceMode,
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.lowPerformanceMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  {config.lowPerformanceMode
                    ? 'Low-Performance Mode: Enabled (6k Cap, No Bloom)'
                    : 'Low-Performance Mode: Off'}
                </button>
              </div>

              <button
                type="button"
                onClick={onClearPaint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0c1220] text-slate-300 border border-slate-800 rounded-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Painted 3D Trails</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: GESTURE STUDIO & REACTIVE AUDIO */}
        {activeTab === 'gestures' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Active Gesture Signal:</span>
                <span className="font-mono font-semibold text-cyan-400">
                  {simulatedGesture !== 'NONE'
                    ? `${simulatedGesture} (SIMULATED)`
                    : detectedGesture}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraEnabled
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  {cameraEnabled ? (
                    <>
                      <Video className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Webcam Active</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-3.5 h-3.5" />
                      <span>Enable Webcam</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    micEnabled
                      ? 'bg-pink-500/20 text-pink-200 border-pink-400/50'
                      : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  {micEnabled ? (
                    <>
                      <Mic className="w-3.5 h-3.5 text-pink-400" />
                      <span>Mic Reactive: On</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Mic Audio Reactive</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onToggleSynth}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    synthEnabled
                      ? 'bg-purple-500/20 text-purple-200 border-purple-400/50'
                      : 'bg-[#0c1220] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>{synthEnabled ? 'Cosmic Synth: Playing' : 'Play Cosmic Synth'}</span>
                </button>
              </div>
            </div>

            {/* Interactive 10-Gesture Simulator Strip (also works with mouse hover/drag on canvas) */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5">
                Perform hand gestures in front of your webcam, or click any gesture below to test its 3D physics with your cursor:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                {GESTURE_PRESETS.map((g) => {
                  const isActive = simulatedGesture === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSelectSimulatedGesture(g.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-left border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#0c1220] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-medium truncate">{g.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{g.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
