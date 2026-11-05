export type FormationId =
  | 'galaxy'
  | 'dna_helix'
  | 'heart'
  | 'flower'
  | 'saturn'
  | 'spiral_galaxy'
  | 'sphere'
  | 'brain'
  | 'butterfly'
  | 'infinity'
  | 'fire_explosion'
  | 'dna_molecule'
  | 'freeform';

export type PaletteId =
  | 'cosmic_cyan'
  | 'nebula_magenta'
  | 'solar_flare'
  | 'bioluminescent'
  | 'supernova'
  | 'aurora';

export type GestureType =
  | 'NONE'
  | 'OPEN PALM'
  | 'FIST'
  | 'PINCH'
  | 'TWO HANDS'
  | 'EXPAND HANDS'
  | 'COMPRESS HANDS'
  | 'POINTING'
  | 'VORTEX'
  | 'SWIPE HORIZONTAL'
  | 'SWIPE VERTICAL';

export interface FormationMeta {
  id: FormationId;
  name: string;
  category: string;
  description: string;
  defaultPalette: PaletteId;
}

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  colors: [string, string, string, string];
}

export interface SimulationConfig {
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  attractionStrength: number;
  repulsionStrength: number;
  turbulenceIntensity: number;
  formation: FormationId;
  palette: PaletteId;
  autoPlay: boolean;
  isPaused: boolean;
  lowPerformanceMode: boolean;
  blackHoleActive: boolean;
  paintingMode: boolean;
  audioReactive: boolean;
  synthAudioActive: boolean;
  trailDecay: number;
}

export interface HandPoint3D {
  x: number; // Normalized -1 to 1 (screen centered)
  y: number; // Normalized -1 to 1
  z: number; // Depth
}

export interface HandTrackingData {
  handsDetected: number;
  primaryGesture: GestureType;
  gestureConfidence: number;
  leftHandCenter: HandPoint3D | null;
  rightHandCenter: HandPoint3D | null;
  indexFingerTip: HandPoint3D | null;
  pinchCenter: HandPoint3D | null;
  handDistance: number; // Normalized distance between two hands
  handVelocity: { vx: number; vy: number };
  angularVelocity: number; // Circular swirl detection
  isSimulated: boolean;
}
