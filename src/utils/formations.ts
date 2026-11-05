import * as THREE from 'three';
import { FormationId, FormationMeta, PaletteId, PaletteMeta } from '../types/simulation';

export const FORMATIONS: FormationMeta[] = [
  {
    id: 'galaxy',
    name: 'Andromeda Galaxy',
    category: 'Cosmic',
    description: 'Multi-arm galactic core with dense stellar nursery and orbital dust lanes.',
    defaultPalette: 'cosmic_cyan',
  },
  {
    id: 'dna_helix',
    name: 'DNA Double Helix',
    category: 'Biological',
    description: 'Intertwined twin phosphate backbones bridged by hydrogen-bonded base pairs.',
    defaultPalette: 'bioluminescent',
  },
  {
    id: 'heart',
    name: 'Harmonic Heart',
    category: 'Geometric',
    description: 'Parametric 3D cardioid surface pulsing with synchronized radial energy.',
    defaultPalette: 'nebula_magenta',
  },
  {
    id: 'flower',
    name: 'Lotus Mandala',
    category: 'Botanical',
    description: 'Harmonic phyllotaxis petals arranged in sacred golden-angle spirals.',
    defaultPalette: 'aurora',
  },
  {
    id: 'saturn',
    name: 'Saturn & Rings',
    category: 'Planetary',
    description: 'Oblate gas giant surrounded by concentric icy Cassini division ring bands.',
    defaultPalette: 'solar_flare',
  },
  {
    id: 'spiral_galaxy',
    name: 'Logarithmic Spiral',
    category: 'Cosmic',
    description: 'Tightly wound Whirlpool galaxy with high-velocity relativistic jets.',
    defaultPalette: 'supernova',
  },
  {
    id: 'sphere',
    name: 'Dyson Sphere',
    category: 'Megastructure',
    description: 'Fibonacci geodesic energy shell enclosing a radiant quantum core.',
    defaultPalette: 'cosmic_cyan',
  },
  {
    id: 'brain',
    name: 'Neural Connectome',
    category: 'Biological',
    description: 'Bilobed cerebral cortex with folded gyri and synaptic pathways.',
    defaultPalette: 'nebula_magenta',
  },
  {
    id: 'butterfly',
    name: 'Lorenz Butterfly',
    category: 'Chaos Math',
    description: 'Strange attractor wings modulated by transcendental butterfly curves.',
    defaultPalette: 'aurora',
  },
  {
    id: 'infinity',
    name: 'Mobius Infinity',
    category: 'Topology',
    description: 'Three-dimensional Lemniscate of Bernoulli with continuous torsional flow.',
    defaultPalette: 'cosmic_cyan',
  },
  {
    id: 'fire_explosion',
    name: 'Supernova Remnant',
    category: 'High Energy',
    description: 'Turbulent shockwave filaments expanding from a stellar core collapse.',
    defaultPalette: 'solar_flare',
  },
  {
    id: 'dna_molecule',
    name: 'Atomic Lattice',
    category: 'Molecular',
    description: '3D macromolecular nucleotide clusters with covalent orbital shells.',
    defaultPalette: 'bioluminescent',
  },
  {
    id: 'freeform',
    name: 'Freeform Nebula',
    category: 'Fluid Field',
    description: 'Unbound curl-noise quantum cloud responsive to gravitational currents.',
    defaultPalette: 'supernova',
  },
];

export const PALETTES: PaletteMeta[] = [
  {
    id: 'cosmic_cyan',
    name: 'Cosmic Cyan',
    colors: ['#00f2fe', '#4facfe', '#7f00ff', '#ffffff'],
  },
  {
    id: 'nebula_magenta',
    name: 'Nebula Pulse',
    colors: ['#ff0844', '#ffb199', '#b721ff', '#00d2ff'],
  },
  {
    id: 'solar_flare',
    name: 'Solar Flare',
    colors: ['#ff8008', '#ffc837', '#ff3131', '#fffbeb'],
  },
  {
    id: 'bioluminescent',
    name: 'Bioluminescent',
    colors: ['#00ff87', '#60efff', '#0061ff', '#e0f2fe'],
  },
  {
    id: 'supernova',
    name: 'Supernova Ice',
    colors: ['#e0c3fc', '#8ec5fc', '#38bdf8', '#ffffff'],
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    colors: ['#2af598', '#009efd', '#a855f7', '#ec4899'],
  },
];

/**
 * Generates target 3D positions (Float32Array of length maxCount * 3)
 * and per-particle color weights (Float32Array of length maxCount) for a given formation.
 */
export function generateFormationPositions(
  formation: FormationId,
  maxCount: number,
  outPositions: Float32Array,
  outColorMix: Float32Array
): void {
  for (let i = 0; i < maxCount; i++) {
    const i3 = i * 3;
    const t = i / maxCount;
    const u = Math.random();
    const v = Math.random();
    let x = 0;
    let y = 0;
    let z = 0;
    let cMix = t;

    switch (formation) {
      case 'galaxy': {
        const arms = 4;
        const armIndex = i % arms;
        const radius = Math.pow(u, 0.65) * 15.0;
        const spinAngle = radius * 0.55;
        const branchAngle = ((Math.PI * 2) / arms) * armIndex;
        const randomSpread = Math.max(0.25, (1.0 - radius / 16.0) * 1.4);
        const rx = (Math.random() - 0.5) * randomSpread * 2.2;
        const ry = (Math.random() - 0.5) * randomSpread * 0.75;
        const rz = (Math.random() - 0.5) * randomSpread * 2.2;

        x = Math.cos(branchAngle + spinAngle) * radius + rx;
        y = ry * (1.2 - radius / 18.0);
        z = Math.sin(branchAngle + spinAngle) * radius + rz;
        cMix = Math.min(1, radius / 14.0);
        break;
      }

      case 'spiral_galaxy': {
        const arms = 2;
        const arm = i % arms;
        const r = Math.pow(u, 0.5) * 14.5;
        const theta = r * 0.95 + arm * Math.PI;
        const spread = (1.0 - r / 16.0) * 1.1 + 0.15;
        x = Math.cos(theta) * r + (Math.random() - 0.5) * spread;
        z = Math.sin(theta) * r + (Math.random() - 0.5) * spread;
        // Relativistic central jet for 10% of particles
        if (i % 10 === 0 && r < 3.5) {
          x = (Math.random() - 0.5) * 0.8;
          z = (Math.random() - 0.5) * 0.8;
          y = (Math.random() - 0.5) * 18.0;
          cMix = 0.95;
        } else {
          y = (Math.random() - 0.5) * spread * 0.6;
          cMix = r / 14.5;
        }
        break;
      }

      case 'dna_helix': {
        const turns = 4.5;
        const height = 22.0;
        const yPos = (t - 0.5) * height;
        const angle = t * Math.PI * 2 * turns;
        const radius = 4.8;
        const role = i % 3;

        if (role === 0) {
          // Strand A
          x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.35;
          y = yPos;
          z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.35;
          cMix = 0.15;
        } else if (role === 1) {
          // Strand B
          x = Math.cos(angle + Math.PI) * radius + (Math.random() - 0.5) * 0.35;
          y = yPos;
          z = Math.sin(angle + Math.PI) * radius + (Math.random() - 0.5) * 0.35;
          cMix = 0.85;
        } else {
          // Base pair rungs quantized
          const rungIndex = Math.floor(t * 48);
          const rungT = rungIndex / 48;
          const rungAngle = rungT * Math.PI * 2 * turns;
          const rungY = (rungT - 0.5) * height;
          const bridgePos = (u - 0.5) * 2.0; // -1 to 1
          x = Math.cos(rungAngle) * radius * bridgePos + (Math.random() - 0.5) * 0.2;
          y = rungY + (Math.random() - 0.5) * 0.2;
          z = Math.sin(rungAngle) * radius * bridgePos + (Math.random() - 0.5) * 0.2;
          cMix = 0.5;
        }
        break;
      }

      case 'heart': {
        // Parametric 3D heart surface + volume fill
        const phi = u * Math.PI * 2;
        const theta = v * Math.PI;
        const scale = 0.55 * (0.75 + 0.25 * Math.cbrt(Math.random()));
        const hx = 16 * Math.pow(Math.sin(phi), 3);
        const hy =
          13 * Math.cos(phi) -
          5 * Math.cos(2 * phi) -
          2 * Math.cos(3 * phi) -
          Math.cos(4 * phi);
        const hz = Math.sin(theta) * 6.5 * Math.sin(phi);

        x = hx * scale;
        y = hy * scale + 1.2;
        z = (Math.random() - 0.5) * hz * 1.4;
        cMix = Math.min(1, Math.sqrt(x * x + y * y) / 10.0);
        break;
      }

      case 'flower': {
        // Sacred phyllotaxis lotus mandala
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const theta = i * goldenAngle;
        const r = Math.sqrt(t) * 12.5;
        const petals = 7;
        const petalWave = Math.sin(theta * petals) * 2.2 * (r / 12.5);
        const cupCurve = Math.pow(r / 12.5, 1.6) * 4.5 - 2.0;

        x = Math.cos(theta) * (r + petalWave * 0.45);
        z = Math.sin(theta) * (r + petalWave * 0.45);
        y = cupCurve + Math.cos(theta * petals) * 1.1 * (r / 12.5);
        cMix = r / 12.5;
        break;
      }

      case 'saturn': {
        if (i < maxCount * 0.38) {
          // Oblate planet body
          const phi = Math.acos(2 * u - 1);
          const theta = v * Math.PI * 2;
          const rad = 4.6 * Math.cbrt(Math.random() * 0.3 + 0.7);
          x = rad * Math.sin(phi) * Math.cos(theta);
          y = rad * 0.86 * Math.cos(phi);
          z = rad * Math.sin(phi) * Math.sin(theta);
          cMix = 0.2 + 0.3 * Math.abs(Math.cos(phi * 4));
        } else {
          // Concentric ring bands with Cassini gap
          const ringChoice = Math.random();
          const rMin = ringChoice < 0.6 ? 6.2 : 10.4;
          const rMax = ringChoice < 0.6 ? 9.6 : 14.8;
          const r = rMin + Math.random() * (rMax - rMin);
          const angle = Math.random() * Math.PI * 2;
          const tilt = 0.42; // 24 deg axial tilt
          const rawX = Math.cos(angle) * r;
          const rawY = (Math.random() - 0.5) * 0.28;
          const rawZ = Math.sin(angle) * r;

          x = rawX;
          y = rawY * Math.cos(tilt) - rawZ * Math.sin(tilt);
          z = rawY * Math.sin(tilt) + rawZ * Math.cos(tilt);
          cMix = (r - 6.0) / 9.0;
        }
        break;
      }

      case 'sphere': {
        // Fibonacci geodesic shell + inner core
        const isCore = i < maxCount * 0.2;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const idx = isCore ? i : i - Math.floor(maxCount * 0.2);
        const total = isCore ? maxCount * 0.2 : maxCount * 0.8;
        const yNorm = 1 - (idx / (total - 1)) * 2;
        const radiusAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
        const theta = (2 * Math.PI * idx) / goldenRatio;
        const shellRadius = isCore ? 3.2 * Math.cbrt(u) : 10.2 + Math.sin(theta * 6) * 0.25;

        x = Math.cos(theta) * radiusAtY * shellRadius;
        y = yNorm * shellRadius;
        z = Math.sin(theta) * radiusAtY * shellRadius;
        cMix = isCore ? 0.95 : (yNorm + 1) * 0.45;
        break;
      }

      case 'brain': {
        // Bilobed cerebral hemispheres with cortical gyri folds
        const hemisphere = i % 2 === 0 ? 1 : -1;
        const phi = u * Math.PI; // 0 to PI
        const theta = (v - 0.5) * Math.PI; // -PI/2 to PI/2
        const baseR = 6.8 + 0.6 * Math.sin(phi * 10) * Math.cos(theta * 8);
        const bx = Math.sin(phi) * Math.cos(theta) * baseR * 0.72;
        const by = Math.sin(phi) * Math.sin(theta) * baseR * 0.85;
        const bz = Math.cos(phi) * baseR * 1.15;

        x = hemisphere * (Math.abs(bx) + 0.55) + (Math.random() - 0.5) * 0.35;
        y = by + (Math.random() - 0.5) * 0.35;
        z = bz + (Math.random() - 0.5) * 0.35;
        cMix = 0.5 + 0.5 * Math.sin(phi * 6);
        break;
      }

      case 'butterfly': {
        // Temple H. Fay Butterfly curve in 3D space
        const theta = t * Math.PI * 24.0;
        const eTerm =
          Math.exp(Math.cos(theta)) -
          2 * Math.cos(4 * theta) -
          Math.pow(Math.sin(theta / 12), 5);
        const scale = 3.2 * (0.7 + 0.3 * u);
        const rawX = Math.sin(theta) * eTerm * scale;
        const rawY = Math.cos(theta) * eTerm * scale;
        const wingSweep = Math.abs(rawX) * 0.45;

        x = rawX + (Math.random() - 0.5) * 0.4;
        y = rawY + (Math.random() - 0.5) * 0.4;
        z = wingSweep * Math.sin(theta * 2) * 0.5 + (Math.random() - 0.5) * 1.2;
        cMix = Math.min(1, Math.abs(rawX) / 10.0);
        break;
      }

      case 'infinity': {
        // 3D Lemniscate of Bernoulli with tubular thickness
        const angle = t * Math.PI * 2;
        const tubeAngle = u * Math.PI * 2;
        const tubeRadius = 1.35 + 0.4 * Math.sin(angle * 3);
        const a = 12.5;
        const denom = 1 + Math.sin(angle) * Math.sin(angle);
        const cx = (a * Math.cos(angle)) / denom;
        const cy = (a * Math.sin(angle) * Math.cos(angle)) / denom;
        const cz = Math.sin(angle) * 3.8;

        x = cx + Math.cos(tubeAngle) * tubeRadius;
        y = cy + Math.sin(tubeAngle) * tubeRadius;
        z = cz + (Math.random() - 0.5) * tubeRadius;
        cMix = (Math.sin(angle) + 1) * 0.5;
        break;
      }

      case 'fire_explosion': {
        // Supernova shockwave filaments
        const filamentCount = 28;
        const fIdx = i % filamentCount;
        const golden = Math.PI * (3 - Math.sqrt(5));
        const fY = 1 - (fIdx / (filamentCount - 1)) * 2;
        const fR = Math.sqrt(Math.max(0, 1 - fY * fY));
        const fTheta = golden * fIdx;
        const dirX = Math.cos(fTheta) * fR;
        const dirY = fY;
        const dirZ = Math.sin(fTheta) * fR;

        const dist = Math.pow(u, 0.55) * 14.5;
        const scatter = (dist / 14.5) * 2.4;
        x = dirX * dist + (Math.random() - 0.5) * scatter;
        y = dirY * dist + (Math.random() - 0.5) * scatter;
        z = dirZ * dist + (Math.random() - 0.5) * scatter;
        cMix = 1.0 - Math.min(1, dist / 14.5);
        break;
      }

      case 'dna_molecule': {
        // Multi-atom molecular crystal & orbital rings
        const atomCenters = [
          [0, 0, 0],
          [5.5, 3.2, -2.0],
          [-5.5, 3.2, 2.0],
          [0, -5.8, 3.0],
          [0, 5.8, -3.0],
          [6.2, -3.5, 2.5],
          [-6.2, -3.5, -2.5],
          [3.5, 0, 5.8],
          [-3.5, 0, -5.8],
        ];
        const center = atomCenters[i % atomCenters.length];
        const phi = Math.acos(2 * u - 1);
        const theta = v * Math.PI * 2;
        const isElectronShell = i % 3 === 0;
        const rad = isElectronShell ? 2.6 : 1.15 * Math.cbrt(Math.random());

        x = center[0] + rad * Math.sin(phi) * Math.cos(theta);
        y = center[1] + rad * Math.cos(phi);
        z = center[2] + rad * Math.sin(phi) * Math.sin(theta);
        cMix = (i % atomCenters.length) / atomCenters.length;
        break;
      }

      case 'freeform':
      default: {
        // Curl-like volumetric nebula cloud
        const phi = Math.acos(2 * u - 1);
        const theta = v * Math.PI * 2;
        const r = 13.5 * Math.cbrt(Math.random());
        const wave = Math.sin(phi * 4 + theta * 2) * 2.2;
        x = (r + wave) * Math.sin(phi) * Math.cos(theta);
        y = (r + wave) * 0.75 * Math.cos(phi);
        z = (r + wave) * Math.sin(phi) * Math.sin(theta);
        cMix = (y + 10) / 20;
        break;
      }
    }

    outPositions[i3] = x;
    outPositions[i3 + 1] = y;
    outPositions[i3 + 2] = z;
    outColorMix[i] = Math.max(0, Math.min(1, cMix));
  }
}

export function getPaletteColors(paletteId: PaletteId): [THREE.Color, THREE.Color, THREE.Color, THREE.Color] {
  const found = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];
  return [
    new THREE.Color(found.colors[0]),
    new THREE.Color(found.colors[1]),
    new THREE.Color(found.colors[2]),
    new THREE.Color(found.colors[3]),
  ];
}
