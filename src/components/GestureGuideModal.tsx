import React from 'react';
import { Camera, Hand, Sparkles, X } from 'lucide-react';

interface GestureGuideModalProps {
  isOpen: boolean;
  isFirstLaunch: boolean;
  onClose: () => void;
  onEnableCameraAndStart: () => void;
}

const TEN_GESTURES = [
  {
    num: '01.',
    name: 'Open Palm',
    command: 'OPEN PALM',
    effect: 'Spreads particles outward in an expanding radial energy field and increases dispersion.',
  },
  {
    num: '02.',
    name: 'Close Fist',
    command: 'FIST',
    effect: 'Attracts surrounding particles toward the center of your palm into a dense glowing sphere.',
  },
  {
    num: '03.',
    name: 'Pinch Fingers',
    command: 'PINCH',
    effect: 'Grabs a localized particle cluster between thumb and index finger and moves it in 3D space.',
  },
  {
    num: '04.',
    name: 'Move Both Hands Apart',
    command: 'EXPAND HANDS',
    effect: 'Expands the entire particle universe and increases separation across formations.',
  },
  {
    num: '05.',
    name: 'Move Both Hands Together',
    command: 'COMPRESS HANDS',
    effect: 'Compresses the formation inward into a high-density gravitational collapse.',
  },
  {
    num: '06.',
    name: 'Move Hand Left or Right',
    command: 'SWIPE HORIZONTAL',
    effect: 'Applies rotational torque to spin the entire 3D formation horizontally.',
  },
  {
    num: '07.',
    name: 'Move Hand Up or Down',
    command: 'SWIPE VERTICAL',
    effect: 'Controls vertical elevation and wave displacement of the particle universe.',
  },
  {
    num: '08.',
    name: 'Circular Hand Movement',
    command: 'VORTEX',
    effect: 'Generates an angular spiral vortex that swirls particles into an orbital cyclone.',
  },
  {
    num: '09.',
    name: 'Two Open Palms',
    command: 'TWO HANDS',
    effect: 'Triggers a large-scale supernova explosion, releasing high-velocity particles in every direction.',
  },
  {
    num: '10.',
    name: 'Finger Pointing',
    command: 'POINTING',
    effect: 'Creates a focused energy stream and paints glowing 3D particle trails following your index finger.',
  },
];

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({
  isOpen,
  isFirstLaunch,
  onClose,
  onEnableCameraAndStart,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 pointer-events-auto">
      <div className="relative w-full max-w-4xl bg-[#070b14] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          aria-label="Close Gesture Guide"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 text-xs text-cyan-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive 3D Particle Universe</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time Computer Vision</span>
          </div>
          <h2
            className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2"
            style={{ textWrap: 'balance' }}
          >
            {isFirstLaunch
              ? 'Shape Matter and Energy With Your Hands'
              : 'Hand Gesture Recognition Guide'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Control up to 30,000 glowing 3D particles across 13 mathematical formations using live MediaPipe hand landmark tracking, or interact directly with your cursor and the built-in Gesture Simulator.
          </p>
        </div>

        {/* 10 Gestures Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {TEN_GESTURES.map((g) => (
            <div
              key={g.num}
              className="p-3.5 rounded-xl bg-[#0c1220] border border-slate-800/90 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-white">
                  {g.num} {g.name}
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  {g.command}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{g.effect}</p>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Hand className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Camera video stays 100% local in your browser. You can also test all 10 gestures via mouse drag.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-[#0c1220] border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Explore With Mouse / Touch
            </button>
            <button
              type="button"
              onClick={onEnableCameraAndStart}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Enable Webcam & Launch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
