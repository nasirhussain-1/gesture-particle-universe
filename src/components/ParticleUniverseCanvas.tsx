import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GestureType, HandTrackingData, SimulationConfig } from '../types/simulation';
import { generateFormationPositions, getPaletteColors } from '../utils/formations';
import { AudioSpectrumData } from '../utils/audioAnalyzer';

interface ParticleUniverseCanvasProps {
  config: SimulationConfig;
  handDataRef: React.MutableRefObject<HandTrackingData>;
  audioSpectrumRef: React.MutableRefObject<AudioSpectrumData>;
  explosionTriggerRef: React.MutableRefObject<number>;
  clearPaintTriggerRef: React.MutableRefObject<number>;
  resetTriggerRef: React.MutableRefObject<number>;
  simulatedGesture: GestureType;
  onFpsUpdate: (fps: number, isSoftwareGl: boolean) => void;
}

const MAX_PARTICLES = 30000;
const MAX_PAINT_POINTS = 2400;

// Pre-allocated module-scope math helpers to guarantee zero GC in the animation loop
const _tempColorA = new THREE.Color();
const _tempColorB = new THREE.Color();
const _pointerWorld = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export const ParticleUniverseCanvas: React.FC<ParticleUniverseCanvasProps> = ({
  config,
  handDataRef,
  audioSpectrumRef,
  explosionTriggerRef,
  clearPaintTriggerRef,
  resetTriggerRef,
  simulatedGesture,
  onFpsUpdate,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<SimulationConfig>(config);
  const simGestureRef = useRef<GestureType>(simulatedGesture);

  // Keep mutable refs synced without re-creating the WebGL context
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    simGestureRef.current = simulatedGesture;
  }, [simulatedGesture]);

  // Target formation buffers
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLES * 3));
  const targetColorMixRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLES));
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLES * 3));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLES * 3));
  const particleSeedsRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLES));

  // Recompute target formation whenever formation changes
  useEffect(() => {
    generateFormationPositions(
      config.formation,
      MAX_PARTICLES,
      targetPositionsRef.current,
      targetColorMixRef.current
    );
  }, [config.formation]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection per Three.js skill §2.1
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL context loss/restore listeners
    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    // 2. Scene, Fog & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050a);
    scene.fog = new THREE.FogExp2(0x03050a, 0.015);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    camera.position.set(0, 4.5, 28);

    // Mandatory Studio Environment Reflection (RoomEnvironment) per Three.js skill §2.2
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Balanced 3-Point Warm/Cool Studio Lighting Rig per Three.js skill §3.1
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 1.2);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(15, 22, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.6);
    rimLight.position.set(-18, -12, -15);
    scene.add(rimLight);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 65;
    controls.minDistance = 6;
    controls.enablePan = false;

    // 5. Post-Processing Bloom (Hardware GPU only, skipped on software WebGL or lowPerfMode)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(width / 2), Math.floor(height / 2)),
      1.25,
      0.45,
      0.22
    );
    composer.addPass(bloomPass);

    // 6. Composite 8-Part Central Quantum Singularity & Resonator Assembly (THREE.Group)
    const universeRoot = new THREE.Group();
    scene.add(universeRoot);

    const singularityCoreGroup = new THREE.Group();
    singularityCoreGroup.position.set(0, 0, 0);
    universeRoot.add(singularityCoreGroup);

    // Part 1: Crystalline Core Icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(0.95, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      metalness: 0.2,
      roughness: 0.12,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.65 : 0.95,
      ior: 1.6,
      thickness: 1.2,
      clearcoat: 1.0,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    singularityCoreGroup.add(coreMesh);

    // Part 2: Inner Brushed Titanium Gyroscope Ring (roughness 0.18, metalness 0.95)
    const innerRingGeo = new THREE.TorusGeometry(1.55, 0.045, 16, 64);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.18,
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    singularityCoreGroup.add(innerRingMesh);

    // Part 3: Middle Anodized Cobalt Gimbal Ring (roughness 0.45, metalness 0.85)
    const midRingGeo = new THREE.TorusGeometry(2.1, 0.035, 16, 64);
    const midRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.45,
    });
    const midRingMesh = new THREE.Mesh(midRingGeo, midRingMat);
    midRingMesh.rotation.x = Math.PI / 3;
    singularityCoreGroup.add(midRingMesh);

    // Part 4: Outer Meridian Stabilizer Ring (roughness 0.7, metalness 0.6)
    const outerRingGeo = new THREE.TorusGeometry(2.65, 0.025, 12, 64);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      metalness: 0.6,
      roughness: 0.7,
    });
    const outerRingMesh = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRingMesh.rotation.y = Math.PI / 4;
    singularityCoreGroup.add(outerRingMesh);

    // Parts 5-8: Four Orbital Harmonic Nodes
    const nodeGeo = new THREE.OctahedronGeometry(0.18, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let n = 0; n < 4; n++) {
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      const angle = (n * Math.PI) / 2;
      nodeMesh.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);
      midRingMesh.add(nodeMesh);
    }

    // Grounding Radial Contact Horizon Plane beneath the universe (Three.js skill §3.2)
    const contactCanvas = document.createElement('canvas');
    contactCanvas.width = 256;
    contactCanvas.height = 256;
    const cCtx = contactCanvas.getContext('2d');
    if (cCtx) {
      const grad = cCtx.createRadialGradient(128, 128, 8, 128, 128, 124);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.26)');
      grad.addColorStop(0.45, 'rgba(124, 58, 237, 0.09)');
      grad.addColorStop(1, 'rgba(3, 5, 10, 0)');
      cCtx.fillStyle = grad;
      cCtx.fillRect(0, 0, 256, 256);
    }
    const contactTex = new THREE.CanvasTexture(contactCanvas);
    contactTex.colorSpace = THREE.SRGBColorSpace;
    contactTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const horizonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    horizonPlane.rotation.x = -Math.PI / 2;
    horizonPlane.position.y = -13.5;
    scene.add(horizonPlane);

    // Composite 4-Part Hand Energy Attractor Probe (moves to tracked hand / pointer in 3D space)
    const handProbeGroup = new THREE.Group();
    const probeCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.2,
        metalness: 0.85,
        roughness: 0.15,
      })
    );
    const probeHalo1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.03, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xe879f9,
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.35,
      })
    );
    const probeHalo2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.02, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        metalness: 0.7,
        roughness: 0.55,
      })
    );
    probeHalo2.rotation.x = Math.PI / 2;
    handProbeGroup.add(probeCore, probeHalo1, probeHalo2);
    handProbeGroup.visible = false;
    scene.add(handProbeGroup);

    // 7. Initialize Particle Buffers & Custom ShaderMaterial
    generateFormationPositions(
      configRef.current.formation,
      MAX_PARTICLES,
      targetPositionsRef.current,
      targetColorMixRef.current
    );

    const posArray = currentPositionsRef.current;
    const velArray = velocitiesRef.current;
    const seedArray = particleSeedsRef.current;
    const colorAttrArray = new Float32Array(MAX_PARTICLES * 3);
    const sizeScaleArray = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const i3 = i * 3;
      posArray[i3] = targetPositionsRef.current[i3] + (Math.random() - 0.5) * 2.0;
      posArray[i3 + 1] = targetPositionsRef.current[i3 + 1] + (Math.random() - 0.5) * 2.0;
      posArray[i3 + 2] = targetPositionsRef.current[i3 + 2] + (Math.random() - 0.5) * 2.0;
      velArray[i3] = 0;
      velArray[i3 + 1] = 0;
      velArray[i3 + 2] = 0;
      seedArray[i] = Math.random();
      sizeScaleArray[i] = 0.55 + Math.random() * 1.15;
    }

    const particleGeo = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(posArray, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    const colorAttr = new THREE.BufferAttribute(colorAttrArray, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    const sizeAttr = new THREE.BufferAttribute(sizeScaleArray, 1);

    particleGeo.setAttribute('position', positionAttr);
    particleGeo.setAttribute('customColor', colorAttr);
    particleGeo.setAttribute('sizeScale', sizeAttr);
    particleGeo.setDrawRange(0, configRef.current.particleCount);

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uBaseSize: { value: configRef.current.particleSize * (isSoftwareGl ? 18.0 : 26.0) },
        uAudioBoost: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        attribute vec3 customColor;
        attribute float sizeScale;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uBaseSize;
        uniform float uAudioBoost;
        uniform float uTime;

        void main() {
          vColor = customColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(1.5, -mvPosition.z);
          float pulse = 1.0 + 0.18 * sin(uTime * 3.0 + sizeScale * 6.2831) + uAudioBoost * 0.45;
          gl_PointSize = clamp((uBaseSize * sizeScale * pulse) / dist, 1.5, 42.0);
          vAlpha = smoothstep(75.0, 8.0, dist);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r2 = dot(cxy, cxy);
          if (r2 > 1.0) discard;
          float core = exp(-r2 * 4.2);
          float halo = (1.0 - r2) * 0.45;
          vec3 finalCol = vColor * (0.85 + core * 1.35) + vec3(core * 0.45);
          gl_FragColor = vec4(finalCol, (core + halo) * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMaterial);
    particleSystem.frustumCulled = false;
    universeRoot.add(particleSystem);

    // 8. Particle Painting 3D Trail System (Gesture 10 / Painting Mode)
    const paintPositions = new Float32Array(MAX_PAINT_POINTS * 3);
    const paintColors = new Float32Array(MAX_PAINT_POINTS * 3);
    const paintGeo = new THREE.BufferGeometry();
    const paintPosAttr = new THREE.BufferAttribute(paintPositions, 3);
    paintPosAttr.setUsage(THREE.DynamicDrawUsage);
    const paintColAttr = new THREE.BufferAttribute(paintColors, 3);
    paintColAttr.setUsage(THREE.DynamicDrawUsage);
    paintGeo.setAttribute('position', paintPosAttr);
    paintGeo.setAttribute('color', paintColAttr);
    paintGeo.setDrawRange(0, 0);

    const paintMat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const paintCloud = new THREE.Points(paintGeo, paintMat);
    paintCloud.frustumCulled = false;
    scene.add(paintCloud);

    let paintCursor = 0;
    let paintCount = 0;

    const addPaintPoint = (wx: number, wy: number, wz: number, hueOffset: number) => {
      const idx3 = (paintCursor % MAX_PAINT_POINTS) * 3;
      paintPositions[idx3] = wx + (Math.random() - 0.5) * 0.18;
      paintPositions[idx3 + 1] = wy + (Math.random() - 0.5) * 0.18;
      paintPositions[idx3 + 2] = wz + (Math.random() - 0.5) * 0.18;

      _tempColorA.setHSL((hueOffset % 1 + 1) % 1, 0.95, 0.65);
      paintColors[idx3] = _tempColorA.r;
      paintColors[idx3 + 1] = _tempColorA.g;
      paintColors[idx3 + 2] = _tempColorA.b;

      paintCursor++;
      paintCount = Math.min(MAX_PAINT_POINTS, paintCount + 1);
      paintPosAttr.needsUpdate = true;
      paintColAttr.needsUpdate = true;
      paintGeo.setDrawRange(0, paintCount);
    };

    // 9. Interactive Pointer / Mouse Fallback for 3D Hand Attraction & Painting
    let isPointerDown = false;
    let pointerNormalized = { x: 0, y: 0 };
    let pointerActiveFrames = 0;

    const updatePointerCoords = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNormalized.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNormalized.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointerActiveFrames = 45;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isPointerDown = true;
        updatePointerCoords(e.clientX, e.clientY);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      updatePointerCoords(e.clientX, e.clientY);
    };
    const onPointerUp = () => {
      isPointerDown = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);

    // Pre-compile shaders on hardware GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 10. Resize Handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(Math.floor(w / 2), Math.floor(h / 2));
    };
    window.addEventListener('resize', onResize);

    // 11. Continuous Physics & Animation Loop with Software-WebGL Pacing per Three.js skill §2.3
    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let fpsCounter = 0;
    let fpsTimer = performance.now();

    let lastExplosionId = explosionTriggerRef.current;
    let lastClearPaintId = clearPaintTriggerRef.current;
    let lastResetId = resetTriggerRef.current;
    let lastPaletteId: string = '';

    let universeScale = 1.0;
    let targetUniverseScale = 1.0;
    let rotVelY = 0.18;
    let rotVelX = 0.0;
    let elevationOffset = 0.0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updatePaletteBuffer(paletteId: SimulationConfig['palette']) {
      const [c0, c1, c2, c3] = getPaletteColors(paletteId);
      const mixArr = targetColorMixRef.current;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const m = mixArr[i];
        const i3 = i * 3;
        if (m < 0.33) {
          _tempColorA.copy(c0).lerp(c1, m / 0.33);
        } else if (m < 0.66) {
          _tempColorA.copy(c1).lerp(c2, (m - 0.33) / 0.33);
        } else {
          _tempColorA.copy(c2).lerp(c3, (m - 0.66) / 0.34);
        }
        colorAttrArray[i3] = _tempColorA.r;
        colorAttrArray[i3 + 1] = _tempColorA.g;
        colorAttrArray[i3 + 2] = _tempColorA.b;
      }
      colorAttr.needsUpdate = true;
      coreMat.color.copy(c0);
      coreMat.emissive.copy(c1);
      midRingMat.color.copy(c2);
    }

    function triggerSupernovaBlast(strength: number) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const i3 = i * 3;
        const px = posArray[i3];
        const py = posArray[i3 + 1];
        const pz = posArray[i3 + 2];
        const len = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        const speed = (12.0 + Math.random() * 20.0) * strength;
        velArray[i3] += (px / len) * speed;
        velArray[i3 + 1] += (py / len) * speed;
        velArray[i3 + 2] += (pz / len) * speed;
      }
    }

    function tick() {
      if (isDisposed) return;

      const now = performance.now();
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      fpsCounter++;
      if (now - fpsTimer >= 600) {
        const currentFps = Math.round((fpsCounter * 1000) / (now - fpsTimer));
        onFpsUpdate(currentFps, isSoftwareGl);
        fpsCounter = 0;
        fpsTimer = now;
      }

      const cfg = configRef.current;
      const hand = handDataRef.current;
      const audio = audioSpectrumRef.current;
      const activeGesture: GestureType =
        simGestureRef.current !== 'NONE' ? simGestureRef.current : hand.primaryGesture;

      // Sync palette colors when changed or formation morphed
      const paletteKey = `${cfg.palette}_${cfg.formation}`;
      if (paletteKey !== lastPaletteId) {
        updatePaletteBuffer(cfg.palette);
        lastPaletteId = paletteKey;
      }

      // Check one-shot triggers
      if (explosionTriggerRef.current !== lastExplosionId) {
        lastExplosionId = explosionTriggerRef.current;
        triggerSupernovaBlast(1.35);
      }

      if (clearPaintTriggerRef.current !== lastClearPaintId) {
        lastClearPaintId = clearPaintTriggerRef.current;
        paintCursor = 0;
        paintCount = 0;
        paintGeo.setDrawRange(0, 0);
      }

      if (resetTriggerRef.current !== lastResetId) {
        lastResetId = resetTriggerRef.current;
        targetUniverseScale = 1.0;
        universeScale = 1.0;
        elevationOffset = 0;
        rotVelX = 0;
        rotVelY = 0.18;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const i3 = i * 3;
          posArray[i3] = targetPositionsRef.current[i3];
          posArray[i3 + 1] = targetPositionsRef.current[i3 + 1];
          posArray[i3 + 2] = targetPositionsRef.current[i3 + 2];
          velArray[i3] = 0;
          velArray[i3 + 1] = 0;
          velArray[i3 + 2] = 0;
        }
      }

      // Adapt particle draw count for Low Performance Mode or user slider
      const effectiveCount = cfg.lowPerformanceMode
        ? Math.min(cfg.particleCount, 6000)
        : cfg.particleCount;
      particleGeo.setDrawRange(0, effectiveCount);

      particleMaterial.uniforms.uBaseSize.value =
        cfg.particleSize * (isSoftwareGl ? 18.0 : 26.0);
      particleMaterial.uniforms.uAudioBoost.value = audio.overall;

      if (!cfg.isPaused) {
        const dt = rawDt * cfg.particleSpeed;
        elapsedTotal += dt;
        particleMaterial.uniforms.uTime.value = elapsedTotal;

        // Animate central 8-part Quantum Singularity Core
        innerRingMesh.rotation.z = elapsedTotal * 0.9;
        innerRingMesh.rotation.x = Math.sin(elapsedTotal * 0.5) * 0.6;
        midRingMesh.rotation.y = -elapsedTotal * 0.65;
        outerRingMesh.rotation.x = elapsedTotal * 0.35;
        const coreScale =
          (cfg.blackHoleActive ? 1.65 : 1.0) + audio.bass * 0.65;
        singularityCoreGroup.scale.setScalar(
          THREE.MathUtils.damp(singularityCoreGroup.scale.x, coreScale, 6, rawDt)
        );

        // Determine active 3D attractor point from webcam hand or mouse pointer
        let hasAttractor = false;
        let attrX = 0;
        let attrY = 0;
        let attrZ = 0;

        if (hand.handsDetected > 0 && hand.leftHandCenter) {
          hasAttractor = true;
          const focal =
            activeGesture === 'POINTING' && hand.indexFingerTip
              ? hand.indexFingerTip
              : activeGesture === 'PINCH' && hand.pinchCenter
              ? hand.pinchCenter
              : hand.leftHandCenter;
          attrX = focal.x * 14.0;
          attrY = focal.y * 10.0;
          attrZ = focal.z * 8.0;
        } else if (pointerActiveFrames > 0 || simGestureRef.current !== 'NONE') {
          pointerActiveFrames = Math.max(0, pointerActiveFrames - 1);
          _rayOrigin.set(pointerNormalized.x, pointerNormalized.y, 0.5).unproject(camera);
          _rayDir.copy(_rayOrigin).sub(camera.position).normalize();
          const distanceToOriginPlane = -camera.position.z / (_rayDir.z || -0.001);
          _pointerWorld
            .copy(camera.position)
            .addScaledVector(_rayDir, Math.max(5, Math.min(45, distanceToOriginPlane)));

          if (simGestureRef.current !== 'NONE' || isPointerDown || cfg.paintingMode) {
            hasAttractor = true;
            attrX = _pointerWorld.x;
            attrY = _pointerWorld.y;
            attrZ = _pointerWorld.z;
          }
        }

        if (hasAttractor) {
          handProbeGroup.visible = true;
          handProbeGroup.position.lerp(_pointerWorld.set(attrX, attrY, attrZ), 0.25);
          probeHalo1.rotation.x += rawDt * 3.0;
          probeHalo2.rotation.y += rawDt * 2.4;
        } else {
          handProbeGroup.visible = false;
        }

        // Gesture-driven macro transformations (Gestures 4, 5, 6, 7, 9)
        if (activeGesture === 'EXPAND HANDS') {
          targetUniverseScale = Math.min(2.15, targetUniverseScale + rawDt * 0.75);
        } else if (activeGesture === 'COMPRESS HANDS') {
          targetUniverseScale = Math.max(0.32, targetUniverseScale - rawDt * 0.75);
        } else if (activeGesture === 'TWO HANDS') {
          targetUniverseScale = 1.65;
          // Continuous outward burst while two open palms are held
          if (Math.random() < 0.14) {
            triggerSupernovaBlast(0.45);
          }
        } else {
          targetUniverseScale = THREE.MathUtils.damp(targetUniverseScale, 1.0, 1.5, rawDt);
        }

        if (activeGesture === 'SWIPE HORIZONTAL') {
          const dir = hand.handVelocity.vx !== 0 ? Math.sign(hand.handVelocity.vx) : 1;
          rotVelY = THREE.MathUtils.damp(rotVelY, dir * 2.2, 4.0, rawDt);
        } else {
          rotVelY = THREE.MathUtils.damp(rotVelY, 0.18, 2.0, rawDt);
        }

        if (activeGesture === 'SWIPE VERTICAL') {
          const dir = hand.handVelocity.vy !== 0 ? Math.sign(hand.handVelocity.vy) : 1;
          elevationOffset = THREE.MathUtils.damp(elevationOffset, dir * 4.5, 3.0, rawDt);
        } else {
          elevationOffset = THREE.MathUtils.damp(elevationOffset, 0.0, 2.0, rawDt);
        }

        universeScale = THREE.MathUtils.damp(universeScale, targetUniverseScale, 4.0, rawDt);
        universeRoot.rotation.y += rotVelY * dt;
        universeRoot.rotation.x = THREE.MathUtils.damp(universeRoot.rotation.x, rotVelX, 3.0, rawDt);
        universeRoot.position.y = elevationOffset;

        // Particle Painting trail deposition (Gesture 10 POINTING or Painting Mode)
        if (hasAttractor && (cfg.paintingMode || activeGesture === 'POINTING')) {
          addPaintPoint(attrX, attrY, attrZ, elapsedTotal * 0.15);
        }

        // Update Particle Physics Loop
        const targetArr = targetPositionsRef.current;
        const springK = 3.2;
        const damping = Math.pow(0.9, dt * 60);
        const turb = cfg.turbulenceIntensity * (1.0 + audio.mid * 1.4);
        const attractMult = cfg.attractionStrength;
        const repelMult = cfg.repulsionStrength;
        const blackHole = cfg.blackHoleActive;

        // Transform attractor into universeRoot local space so rotations align naturally
        const cosY = Math.cos(-universeRoot.rotation.y);
        const sinY = Math.sin(-universeRoot.rotation.y);
        const localAttrX = attrX * cosY - attrZ * sinY;
        const localAttrY = attrY - elevationOffset;
        const localAttrZ = attrX * sinY + attrZ * cosY;

        for (let i = 0; i < effectiveCount; i++) {
          const i3 = i * 3;
          let px = posArray[i3];
          let py = posArray[i3 + 1];
          let pz = posArray[i3 + 2];

          let vx = velArray[i3];
          let vy = velArray[i3 + 1];
          let vz = velArray[i3 + 2];

          const tx = targetArr[i3] * universeScale;
          const ty = targetArr[i3 + 1] * universeScale;
          const tz = targetArr[i3 + 2] * universeScale;

          // 1. Harmonic Spring force toward formation target
          vx += (tx - px) * springK * dt;
          vy += (ty - py) * springK * dt;
          vz += (tz - pz) * springK * dt;

          // 2. Fluid Curl-Noise Approximation (Turbulence)
          if (turb > 0.01) {
            const seed = seedArray[i] * 6.283;
            vx += Math.sin(py * 0.25 + elapsedTotal * 1.8 + seed) * turb * 4.5 * dt;
            vy += Math.cos(pz * 0.25 + elapsedTotal * 1.6 + seed) * turb * 4.5 * dt;
            vz += Math.sin(px * 0.25 + elapsedTotal * 1.7 + seed) * turb * 4.5 * dt;
          }

          // 3. Audio Reactive Radial Pulse
          if (audio.bass > 0.05) {
            const rLen = Math.sqrt(px * px + py * py + pz * pz) + 0.01;
            const audioForce = audio.bass * 18.0 * dt;
            vx += (px / rLen) * audioForce;
            vy += (py / rLen) * audioForce;
            vz += (pz / rLen) * audioForce;
          }

          // 4. Black Hole Singularity Vortex
          if (blackHole) {
            const r2 = px * px + py * py + pz * pz + 0.35;
            const r = Math.sqrt(r2);
            const pull = (32.0 * attractMult * dt) / Math.max(1.2, r);
            // Pull inward + strong tangential swirl around Y axis
            vx += (-px / r) * pull - (pz / r) * pull * 1.45;
            vy += (-py / r) * pull * 1.2;
            vz += (-pz / r) * pull + (px / r) * pull * 1.45;
          }

          // 5. Hand Gesture Forces (Gestures 1, 2, 3, 8, 10)
          if (hasAttractor || activeGesture !== 'NONE') {
            const dx = localAttrX - px;
            const dy = localAttrY - py;
            const dz = localAttrZ - pz;
            const distSq = dx * dx + dy * dy + dz * dz + 0.25;
            const dist = Math.sqrt(distSq);

            if (activeGesture === 'OPEN PALM') {
              // Gesture 1: Open Palm -> Spread particles outward in an expanding energy field
              if (dist < 13.0) {
                const push = ((13.0 - dist) / 13.0) * 34.0 * repelMult * dt;
                vx -= (dx / dist) * push;
                vy -= (dy / dist) * push;
                vz -= (dz / dist) * push;
              }
            } else if (activeGesture === 'FIST') {
              // Gesture 2: Close Fist -> Attract particles toward palm into a compact glowing sphere
              if (dist < 18.0) {
                const pull = ((18.0 - dist) / 18.0) * 38.0 * attractMult * dt;
                vx += (dx / dist) * pull;
                vy += (dy / dist) * pull;
                vz += (dz / dist) * pull;
                // Tangential containment so it forms a tight glowing energy sphere of radius ~1.8
                if (dist < 2.2) {
                  vx -= (dx / dist) * 18.0 * dt;
                  vy -= (dy / dist) * 18.0 * dt;
                  vz -= (dz / dist) * 18.0 * dt;
                }
              }
            } else if (activeGesture === 'PINCH') {
              // Gesture 3: Pinch Fingers -> Grab and control a localized particle cluster
              if (dist < 6.5) {
                const grab = 46.0 * attractMult * dt;
                vx += dx * grab * 0.35;
                vy += dy * grab * 0.35;
                vz += dz * grab * 0.35;
              }
            } else if (activeGesture === 'VORTEX') {
              // Gesture 8: Circular Hand Movement -> Generate spiral vortex effect
              const rXZ = Math.sqrt(px * px + pz * pz) + 0.1;
              const swirl = 26.0 * attractMult * dt;
              vx += (-pz / rXZ) * swirl;
              vz += (px / rXZ) * swirl;
              vy += Math.sin(rXZ * 0.5 - elapsedTotal * 4.0) * 6.0 * dt;
            } else if (activeGesture === 'POINTING') {
              // Gesture 10: Finger Pointing -> Focused energy beam / stream following index finger
              if (i % 6 === 0 && dist < 15.0) {
                const streamForce = 32.0 * attractMult * dt;
                vx += (dx / dist) * streamForce;
                vy += (dy / dist) * streamForce;
                vz += (dz / dist) * streamForce;
              }
            } else if (isPointerDown && hasAttractor) {
              // Default mouse press attraction when no specific gesture override is selected
              if (dist < 12.0) {
                const pull = ((12.0 - dist) / 12.0) * 24.0 * attractMult * dt;
                vx += (dx / dist) * pull;
                vy += (dy / dist) * pull;
                vz += (dz / dist) * pull;
              }
            }
          }

          // Apply velocity damping and integrate position
          vx *= damping;
          vy *= damping;
          vz *= damping;

          posArray[i3] = px + vx * dt;
          posArray[i3 + 1] = py + vy * dt;
          posArray[i3 + 2] = pz + vz * dt;

          velArray[i3] = vx;
          velArray[i3 + 1] = vy;
          velArray[i3 + 2] = vz;
        }

        positionAttr.needsUpdate = true;
      }

      controls.update();

      // Render with EffectComposer on hardware GPUs, or direct single-pass render on software WebGL / lowPerformanceMode
      if (isSoftwareGl || cfg.lowPerformanceMode) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      particleGeo.dispose();
      particleMaterial.dispose();
      paintGeo.dispose();
      paintMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      midRingGeo.dispose();
      midRingMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      contactTex.dispose();
      renderer.dispose();
    };
  }, [
    audioSpectrumRef,
    clearPaintTriggerRef,
    explosionTriggerRef,
    handDataRef,
    onFpsUpdate,
    resetTriggerRef,
  ]);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-full h-full overflow-hidden z-0 cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Particle Universe Viewport"
    />
  );
};
