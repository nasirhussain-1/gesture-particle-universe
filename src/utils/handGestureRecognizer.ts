import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureType, HandPoint3D, HandTrackingData } from '../types/simulation';

interface TrajectorySample {
  x: number;
  y: number;
  t: number;
}

export class HandGestureController {
  private landmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private history: TrajectorySample[] = [];
  private prevHandDist: number | null = null;
  private smoothedLeft: HandPoint3D = { x: 0, y: 0, z: 0 };
  private smoothedRight: HandPoint3D = { x: 0, y: 0, z: 0 };
  private smoothedIndex: HandPoint3D = { x: 0, y: 0, z: 0 };
  private gestureHoldName: GestureType = 'NONE';
  private gestureHoldFrames = 0;
  private lastTimestampMs = -1;

  public isReady(): boolean {
    return this.landmarker !== null;
  }

  public async init(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;
    this.isInitializing = true;

    const wasmUrls = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
      'https://unpkg.com/@mediapipe/tasks-vision/wasm',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    ];

    const modelUrl =
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

    for (const wasmUrl of wasmUrls) {
      try {
        const vision = await FilesetResolver.forVisionTasks(wasmUrl);
        try {
          this.landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          // Fallback to CPU delegate if GPU delegate fails on this browser/driver
          this.landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }
        this.isInitializing = false;
        return true;
      } catch {
        // Try next WASM CDN URL
      }
    }

    this.isInitializing = false;
    return false;
  }

  private dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private classifySingleHand(landmarks: NormalizedLandmark[]): {
    isOpenPalm: boolean;
    isFist: boolean;
    isPinch: boolean;
    isPointing: boolean;
  } {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const indexPip = landmarks[6];
    const indexTip = landmarks[8];
    const middleMcp = landmarks[9];
    const middlePip = landmarks[10];
    const middleTip = landmarks[12];
    const ringMcp = landmarks[13];
    const ringPip = landmarks[14];
    const ringTip = landmarks[16];
    const pinkyMcp = landmarks[17];
    const pinkyPip = landmarks[18];
    const pinkyTip = landmarks[20];

    const palmSize = Math.max(0.08, this.dist2D(wrist, middleMcp));
    const pinchDist = this.dist2D(thumbTip, indexTip) / palmSize;

    const indexExtended = this.dist2D(wrist, indexTip) > this.dist2D(wrist, indexPip) * 1.12;
    const middleExtended = this.dist2D(wrist, middleTip) > this.dist2D(wrist, middlePip) * 1.12;
    const ringExtended = this.dist2D(wrist, ringTip) > this.dist2D(wrist, ringPip) * 1.12;
    const pinkyExtended = this.dist2D(wrist, pinkyTip) > this.dist2D(wrist, pinkyPip) * 1.12;

    const indexCurled = this.dist2D(wrist, indexTip) < this.dist2D(wrist, indexMcp) * 1.35;
    const middleCurled = this.dist2D(wrist, middleTip) < this.dist2D(wrist, middleMcp) * 1.35;
    const ringCurled = this.dist2D(wrist, ringTip) < this.dist2D(wrist, ringMcp) * 1.35;
    const pinkyCurled = this.dist2D(wrist, pinkyTip) < this.dist2D(wrist, pinkyMcp) * 1.35;

    const isPinch = pinchDist < 0.44 && !middleCurled;
    const isPointing =
      indexExtended && !middleExtended && !ringExtended && !pinkyExtended && pinchDist >= 0.4;
    const isOpenPalm =
      indexExtended && middleExtended && ringExtended && pinkyExtended && pinchDist >= 0.44;
    const isFist = indexCurled && middleCurled && ringCurled && pinkyCurled;

    return { isOpenPalm, isFist, isPinch, isPointing };
  }

  private motionCanvas: HTMLCanvasElement | null = null;
  private prevMotionFrame: Uint8ClampedArray | null = null;

  private detectOpticalMotionFallback(
    video: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement | null,
    timestampMs: number
  ): HandTrackingData {
    if (!this.motionCanvas) {
      this.motionCanvas = document.createElement('canvas');
      this.motionCanvas.width = 64;
      this.motionCanvas.height = 48;
    }
    const mCtx = this.motionCanvas.getContext('2d', { willReadFrequently: true });
    if (!mCtx) {
      return {
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
      };
    }

    const mw = this.motionCanvas.width;
    const mh = this.motionCanvas.height;
    mCtx.drawImage(video, 0, 0, mw, mh);
    const frameData = mCtx.getImageData(0, 0, mw, mh).data;

    let sumX = 0;
    let sumY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    let weightTotal = 0;

    if (this.prevMotionFrame && this.prevMotionFrame.length === frameData.length) {
      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          const idx = (y * mw + x) * 4;
          const dr = Math.abs(frameData[idx] - this.prevMotionFrame[idx]);
          const dg = Math.abs(frameData[idx + 1] - this.prevMotionFrame[idx + 1]);
          const db = Math.abs(frameData[idx + 2] - this.prevMotionFrame[idx + 2]);
          const diff = (dr + dg + db) / 3;
          if (diff > 18) {
            const normX = 1.0 - x / mw; // Mirror X
            const normY = y / mh;
            sumX += normX * diff;
            sumY += normY * diff;
            sumX2 += normX * normX * diff;
            sumY2 += normY * normY * diff;
            weightTotal += diff;
          }
        }
      }
    }

    if (!this.prevMotionFrame || this.prevMotionFrame.length !== frameData.length) {
      this.prevMotionFrame = new Uint8ClampedArray(frameData);
    } else {
      this.prevMotionFrame.set(frameData);
    }

    if (weightTotal < 350) {
      if (overlayCanvas) {
        const oCtx = overlayCanvas.getContext('2d');
        oCtx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      return {
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
      };
    }

    const cx = sumX / weightTotal;
    const cy = sumY / weightTotal;
    const varX = Math.max(0, sumX2 / weightTotal - cx * cx);
    const varY = Math.max(0, sumY2 / weightTotal - cy * cy);
    const spread = Math.sqrt(varX + varY);

    const worldX = (cx - 0.5) * 2.0;
    const worldY = (0.5 - cy) * 2.0;

    this.smoothedLeft.x += (worldX - this.smoothedLeft.x) * 0.35;
    this.smoothedLeft.y += (worldY - this.smoothedLeft.y) * 0.35;

    this.history.push({ x: this.smoothedLeft.x, y: this.smoothedLeft.y, t: timestampMs });
    if (this.history.length > 12) this.history.shift();

    let vx = 0;
    let vy = 0;
    if (this.history.length >= 4) {
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = Math.max(0.016, (newest.t - oldest.t) / 1000);
      vx = (newest.x - oldest.x) / dt;
      vy = (newest.y - oldest.y) / dt;
    }

    let gesture: GestureType = 'OPEN PALM';
    if (Math.abs(vx) > 1.8 && Math.abs(vx) > Math.abs(vy) * 1.3) {
      gesture = 'SWIPE HORIZONTAL';
    } else if (Math.abs(vy) > 1.8 && Math.abs(vy) > Math.abs(vx) * 1.3) {
      gesture = 'SWIPE VERTICAL';
    } else if (spread > 0.28) {
      gesture = 'TWO HANDS';
    } else if (spread < 0.11) {
      gesture = 'FIST';
    }

    if (overlayCanvas) {
      const oCtx = overlayCanvas.getContext('2d');
      if (oCtx) {
        oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        const px = cx * overlayCanvas.width;
        const py = cy * overlayCanvas.height;
        oCtx.strokeStyle = '#38bdf8';
        oCtx.lineWidth = 2;
        oCtx.beginPath();
        oCtx.arc(px, py, Math.max(14, spread * 90), 0, Math.PI * 2);
        oCtx.stroke();
        oCtx.fillStyle = '#ffffff';
        oCtx.beginPath();
        oCtx.arc(px, py, 4, 0, Math.PI * 2);
        oCtx.fill();
      }
    }

    return {
      handsDetected: spread > 0.28 ? 2 : 1,
      primaryGesture: gesture,
      gestureConfidence: 0.85,
      leftHandCenter: { ...this.smoothedLeft },
      rightHandCenter: null,
      indexFingerTip: { ...this.smoothedLeft },
      pinchCenter: { ...this.smoothedLeft },
      handDistance: spread * 2.5,
      handVelocity: { vx, vy },
      angularVelocity: 0,
      isSimulated: false,
    };
  }

  public detect(
    video: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement | null,
    timestampMs: number
  ): HandTrackingData {
    const emptyState: HandTrackingData = {
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
    };

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      video.paused
    ) {
      return emptyState;
    }

    if (!this.landmarker) {
      return this.detectOpticalMotionFallback(video, overlayCanvas, timestampMs);
    }

    // MediaPipe requires strictly increasing timestamps in VIDEO mode
    const safeTimestamp = Math.max(Math.floor(timestampMs), this.lastTimestampMs + 1);
    this.lastTimestampMs = safeTimestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, safeTimestamp);
    } catch {
      return this.detectOpticalMotionFallback(video, overlayCanvas, timestampMs);
    }

    const hands = result.landmarks || [];
    if (overlayCanvas) {
      this.drawSkeleton(overlayCanvas, hands);
    }

    if (hands.length === 0) {
      this.prevHandDist = null;
      return emptyState;
    }

    // Convert normalized landmarks (mirroring X for natural webcam interaction)
    const toWorld = (lm: NormalizedLandmark): HandPoint3D => ({
      x: (0.5 - lm.x) * 2.0,
      y: (0.5 - lm.y) * 2.0,
      z: -lm.z * 2.0,
    });

    const firstHand = hands[0];
    const palmCenter0 = toWorld(firstHand[9]); // Middle MCP as stable palm center
    const indexTip0 = toWorld(firstHand[8]);
    const thumbTip0 = toWorld(firstHand[4]);

    this.smoothedLeft.x += (palmCenter0.x - this.smoothedLeft.x) * 0.35;
    this.smoothedLeft.y += (palmCenter0.y - this.smoothedLeft.y) * 0.35;
    this.smoothedLeft.z += (palmCenter0.z - this.smoothedLeft.z) * 0.35;

    this.smoothedIndex.x += (indexTip0.x - this.smoothedIndex.x) * 0.42;
    this.smoothedIndex.y += (indexTip0.y - this.smoothedIndex.y) * 0.42;
    this.smoothedIndex.z += (indexTip0.z - this.smoothedIndex.z) * 0.42;

    // Record trajectory for velocity and circular vortex detection
    this.history.push({ x: this.smoothedLeft.x, y: this.smoothedLeft.y, t: safeTimestamp });
    if (this.history.length > 18) {
      this.history.shift();
    }

    let vx = 0;
    let vy = 0;
    let angularVel = 0;

    if (this.history.length >= 6) {
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = Math.max(0.016, (newest.t - oldest.t) / 1000);
      vx = (newest.x - oldest.x) / dt;
      vy = (newest.y - oldest.y) / dt;

      let cx = 0;
      let cy = 0;
      for (const pt of this.history) {
        cx += pt.x;
        cy += pt.y;
      }
      cx /= this.history.length;
      cy /= this.history.length;

      let totalCross = 0;
      let avgRadius = 0;
      for (let i = 1; i < this.history.length; i++) {
        const p0 = this.history[i - 1];
        const p1 = this.history[i];
        const r0x = p0.x - cx;
        const r0y = p0.y - cy;
        const r1x = p1.x - cx;
        const r1y = p1.y - cy;
        totalCross += r0x * r1y - r0y * r1x;
        avgRadius += Math.sqrt(r1x * r1x + r1y * r1y);
      }
      avgRadius /= this.history.length;
      if (avgRadius > 0.12) {
        angularVel = totalCross * 18.0;
      }
    }

    const c0 = this.classifySingleHand(firstHand);
    let rawGesture: GestureType = 'NONE';
    let rightHandPoint: HandPoint3D | null = null;
    let handDistance = 0.5;

    if (hands.length >= 2) {
      const secondHand = hands[1];
      const palmCenter1 = toWorld(secondHand[9]);
      this.smoothedRight.x += (palmCenter1.x - this.smoothedRight.x) * 0.35;
      this.smoothedRight.y += (palmCenter1.y - this.smoothedRight.y) * 0.35;
      this.smoothedRight.z += (palmCenter1.z - this.smoothedRight.z) * 0.35;
      rightHandPoint = { ...this.smoothedRight };

      const dx = this.smoothedLeft.x - this.smoothedRight.x;
      const dy = this.smoothedLeft.y - this.smoothedRight.y;
      handDistance = Math.sqrt(dx * dx + dy * dy);

      const c1 = this.classifySingleHand(secondHand);

      if (c0.isOpenPalm && c1.isOpenPalm && handDistance > 0.75) {
        rawGesture = 'TWO HANDS';
      } else if (this.prevHandDist !== null) {
        const deltaDist = handDistance - this.prevHandDist;
        if (deltaDist > 0.035 || handDistance > 1.05) {
          rawGesture = 'EXPAND HANDS';
        } else if (deltaDist < -0.035 || handDistance < 0.35) {
          rawGesture = 'COMPRESS HANDS';
        } else if (c0.isOpenPalm && c1.isOpenPalm) {
          rawGesture = 'TWO HANDS';
        }
      }
      this.prevHandDist = handDistance;
    } else {
      this.prevHandDist = null;
    }

    if (rawGesture === 'NONE') {
      if (Math.abs(angularVel) > 0.22) {
        rawGesture = 'VORTEX';
      } else if (c0.isPinch) {
        rawGesture = 'PINCH';
      } else if (c0.isPointing) {
        rawGesture = 'POINTING';
      } else if (c0.isFist) {
        rawGesture = 'FIST';
      } else if (Math.abs(vx) > 1.65 && Math.abs(vx) > Math.abs(vy) * 1.4) {
        rawGesture = 'SWIPE HORIZONTAL';
      } else if (Math.abs(vy) > 1.65 && Math.abs(vy) > Math.abs(vx) * 1.4) {
        rawGesture = 'SWIPE VERTICAL';
      } else if (c0.isOpenPalm) {
        rawGesture = 'OPEN PALM';
      }
    }

    // Temporal debouncing so gesture label and physics transitions stay rock-solid
    if (rawGesture === this.gestureHoldName) {
      this.gestureHoldFrames = Math.min(10, this.gestureHoldFrames + 1);
    } else {
      this.gestureHoldFrames -= 1;
      if (this.gestureHoldFrames <= 0) {
        this.gestureHoldName = rawGesture;
        this.gestureHoldFrames = 3;
      }
    }

    const pinchMid: HandPoint3D = {
      x: (indexTip0.x + thumbTip0.x) * 0.5,
      y: (indexTip0.y + thumbTip0.y) * 0.5,
      z: (indexTip0.z + thumbTip0.z) * 0.5,
    };

    return {
      handsDetected: hands.length,
      primaryGesture: this.gestureHoldName,
      gestureConfidence: 0.94,
      leftHandCenter: { ...this.smoothedLeft },
      rightHandCenter: rightHandPoint,
      indexFingerTip: { ...this.smoothedIndex },
      pinchCenter: pinchMid,
      handDistance,
      handVelocity: { vx, vy },
      angularVelocity: angularVel,
      isSimulated: false,
    };
  }

  private drawSkeleton(canvas: HTMLCanvasElement, hands: NormalizedLandmark[][]): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];

    hands.forEach((landmarks, handIdx) => {
      ctx.strokeStyle = handIdx === 0 ? '#38bdf8' : '#e879f9';
      ctx.lineWidth = 1.75;

      for (const [startIdx, endIdx] of connections) {
        const a = landmarks[startIdx];
        const b = landmarks[endIdx];
        ctx.beginPath();
        ctx.moveTo((1 - a.x) * canvas.width, a.y * canvas.height);
        ctx.lineTo((1 - b.x) * canvas.width, b.y * canvas.height);
        ctx.stroke();
      }

      landmarks.forEach((lm, idx) => {
        const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
        ctx.fillStyle = isTip ? '#ffffff' : handIdx === 0 ? '#0284c7' : '#c026d3';
        ctx.beginPath();
        ctx.arc((1 - lm.x) * canvas.width, lm.y * canvas.height, isTip ? 3.2 : 2.0, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }
}
