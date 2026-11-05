# ✨ Gesture Particle Universe

**Control a living 3D universe with your hands.**

Gesture Particle Universe is an interactive 3D particle simulation that transforms natural hand movements into real-time visual experiences. Using computer vision and 3D graphics, users can attract, repel, rotate, expand, and reshape thousands of glowing particles through webcam-based hand gestures.

## 🌌 Overview

Imagine controlling thousands of particles without touching your keyboard or mouse.

This project combines real-time hand tracking, interactive physics, and GPU-powered 3D rendering to create an immersive digital universe controlled by natural human movements.

From creating galaxies and spirals to triggering particle explosions, every gesture becomes an interaction with the digital environment.

## 🚀 Features

- **Real-Time Hand Tracking:** Detect and track hand landmarks using MediaPipe.
- **Gesture-Based Interaction:** Control particle behavior through natural hand movements.
- **3D Particle Simulation:** Thousands of dynamic particles moving in a 3D environment.
- **Attraction & Repulsion:** Pull particles together or push them apart.
- **Dynamic Formations:** Transform particles into different shapes and structures.
- **Particle Explosions:** Trigger energetic particle bursts through gestures.
- **Dual-Hand Interaction:** Manipulate particle formations using both hands.
- **Interactive Controls:** Adjust particle count, speed, size, and physics settings.
- **Mouse Fallback:** Explore the simulation without webcam access.
- **Responsive Interface:** A clean futuristic interface designed for immersive interaction.

## 🖐️ Gesture Controls

| Hand Gesture | Interaction |
|---|---|
| Open Palm | Expand and disperse particles |
| Closed Fist | Attract particles into a sphere |
| Pinch Fingers | Grab and manipulate particle clusters |
| Move Hand Left/Right | Rotate particle formations |
| Move Hand Up/Down | Control vertical movement |
| Move Both Hands Apart | Expand the particle universe |
| Move Both Hands Together | Compress particle formations |
| Circular Hand Movement | Create a particle vortex |
| Two Open Palms | Trigger particle explosion |
| Index Finger Pointing | Generate a particle stream |

*Gesture availability depends on the implemented tracking and interaction logic.*

## 🎨 Particle Formations

The simulation can feature multiple particle arrangements:

- Galaxy
- DNA Double Helix
- Heart
- Flower
- Saturn and Rings
- Spiral Galaxy
- 3D Sphere
- Butterfly
- Infinity Symbol
- Custom Particle Cloud

Each formation provides a different visual experience with smooth particle transitions.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Type-safe development |
| Three.js | 3D graphics rendering |
| WebGL | GPU-powered graphics |
| MediaPipe | Real-time hand tracking |
| Vite | Development and build tooling |
| Tailwind CSS | Interface styling |

## ⚙️ Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- Modern browser with WebGL support
- Webcam for gesture control

### Installation

1. Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/gesture-particle-universe.git
```

2. Navigate to the project directory:

```bash
cd gesture-particle-universe
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

5. Open the local URL displayed in your terminal.

### Webcam Permissions

Allow webcam access when prompted by your browser. Camera access generally requires HTTPS or localhost.

## 🧠 How It Works

The application combines three major systems:

**1. Hand Tracking**

MediaPipe detects hand landmarks through the webcam and identifies finger positions and hand movements.

**2. Gesture Interpretation**

The detected landmarks are processed to recognize gestures such as open palms, fists, pinches, and two-hand movements.

**3. Particle Simulation**

Recognized gestures are translated into physical forces and transformations that affect the particle system in real time.

```text
Webcam Input
     |
     v
MediaPipe Hand Tracking
     |
     v
Gesture Recognition
     |
     v
Interaction / Physics Engine
     |
     v
Three.js Particle Renderer
     |
     v
Interactive 3D Universe
```

## ⚡ Performance

The project aims to deliver smooth real-time rendering through GPU-friendly particle calculations.

Performance considerations include:

- Efficient particle rendering.
- Optimized animation loops.
- Adaptive particle density.
- Reduced unnecessary calculations.
- Support for lower-performance devices.

Actual performance depends on the device, browser, GPU, and particle count.

## 🔮 Future Improvements

- Voice-controlled particle interactions.
- AI-generated particle formations.
- Music-reactive visual effects.
- Advanced 3D particle sculpting.
- More complex hand gesture combinations.
- Custom gesture configuration.
- VR and AR interaction support.
- Advanced GPU shader effects.


## 🤝 Contributing

Contributions, suggestions, and ideas are welcome!

1. Fork this repository.
2. Create a feature branch.
3. Commit your changes.
4. Submit a pull request.

## 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for details.

---

**Built with curiosity, creativity, and code.**

⭐ If you find this project interesting, consider giving the repository a star!

