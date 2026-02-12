import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";
import { Howl, Howler } from "https://cdn.jsdelivr.net/npm/howler@2.2.3/+esm";

// #region agent log
try {
  fetch("http://127.0.0.1:7242/ingest/2e670ee4-5f89-4f2b-9841-117c6890c6a5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "script.js:after-imports",
      message: "Script module loaded, all imports succeeded",
      data: { hypothesisId: "H1" },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch (_) {}
// #endregion

class DiamondHeart {
  constructor() {
    this.preloadShaderTextures();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;

    const existingCanvas = document.querySelector(".scene canvas");
    if (existingCanvas) {
      existingCanvas.remove();
    }

    document.querySelector(".scene").appendChild(this.renderer.domElement);

    this.createHeart();
    this.createRings();
    this.setupLights();
    this.setupEnvironment();
    this.createDolphinPendant();
    this.createHeartPendant();

    this.initParticles();
    this.initEventListeners();
    this.lastUpdate = Date.now();

    this.initAudioReactivity();
    this.animate();
  }

  async preloadShaderTextures() {
    const textureLoader = new THREE.TextureLoader();

    try {
      this.particleTexture = await textureLoader.loadAsync(
        "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/sprites/disc.png"
      );

      console.log("Shader textures preloaded successfully");
    } catch (error) {
      console.error("Error preloading shader textures:", error);
    }
  }

  createHeart() {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0);
    heartShape.bezierCurveTo(0, 0, 0, -50, 50, -50);
    heartShape.bezierCurveTo(100, -50, 100, 0, 100, 0);
    heartShape.bezierCurveTo(100, 50, 50, 100, 0, 150);
    heartShape.bezierCurveTo(-50, 100, -100, 50, -100, 0);
    heartShape.bezierCurveTo(-100, -50, -50, -50, 0, 0);

    const extrudeSettings = {
      depth: 35,
      bevelEnabled: true,
      bevelSegments: 20,
      steps: 7,
      bevelSize: 10,
      bevelThickness: 10
    };

    const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xff6666),
      transmission: 0.98,
      opacity: 1,
      reflectivity: 1,
      roughness: 0,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0,
      ior: 2.7,
      transparent: true,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xff2222),
      emissiveIntensity: 0.05
    });

    geometry.computeVertexNormals();

    this.heart = new THREE.Mesh(geometry, material);
    this.heart.position.set(0, 0, -200);
    this.heart.rotation.x = Math.PI / 4;
    this.heart.castShadow = true;
    this.heart.receiveShadow = true;
    this.scene.add(this.heart);

    this.camera.position.z = 500;
  }

  createRings() {
    const outerRadius = 70;
    const innerRadius = 60;
    const ringHeight = 10;
    const chamferSize = 2;

    const ringShape = new THREE.Shape();
    ringShape.moveTo(outerRadius, 0);
    ringShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

    const holeShape = new THREE.Shape();
    holeShape.moveTo(innerRadius, 0);
    holeShape.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);

    ringShape.holes.push(holeShape);

    const extrudeSettings = {
      depth: ringHeight,
      steps: 3,
      bevelEnabled: true,
      bevelSize: chamferSize,
      bevelThickness: chamferSize,
      bevelSegments: 10
    };

    const ringGeometry = new THREE.ExtrudeGeometry(ringShape, extrudeSettings);

    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0,
      reflectivity: 1,
      transmission: 0.05,
      opacity: 0.98,
      ior: 1.8,
      iridescence: 0.3,
      iridescenceIOR: 1.6,
      specularIntensity: 1,
      specularColor: new THREE.Color(0xffc125),
      side: THREE.DoubleSide
    });

    this.rings = [];
    const orbitRadius = 220;
    const verticalSpread = 80;

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(
        Math.cos((i * Math.PI * 2) / 3) * orbitRadius,
        Math.sin((i * Math.PI * 2) / 3) * orbitRadius * 0.6,
        -200 + (i - 1) * verticalSpread
      );
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
      this.rings.push(ring);
    }
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const lights = [
      [1, 1, 1, 0xff4444],
      [-1, -1, -1, 0xffffff],
      [1, -1, 1, 0xff2222],
      [-1, 1, -1, 0xffffff]
    ];

    lights.forEach(([x, y, z, color]) => {
      const light = new THREE.DirectionalLight(color, 0.7);
      light.position.set(x * 200, y * 200, z * 200);
      this.scene.add(light);
    });

    const pointLight = new THREE.PointLight(0xff3333, 1.5, 700);
    pointLight.position.set(0, 0, 300);
    this.scene.add(pointLight);
  }

  setupEnvironment() {
    const solidColor = new THREE.Color(0x4b0082);
    this.scene.background = solidColor;
    this.scene.environment = null;

    this.renderer.toneMappingExposure = 1.3;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }

  createDolphinPendant() {
    const dolphinShape = new THREE.Shape();

    dolphinShape.moveTo(0, 0);
    dolphinShape.quadraticCurveTo(-20, 10, -40, 20);
    dolphinShape.quadraticCurveTo(-60, 40, -50, 60);
    dolphinShape.quadraticCurveTo(-40, 80, -20, 70);
    dolphinShape.lineTo(0, 50);
    dolphinShape.lineTo(20, 70);
    dolphinShape.quadraticCurveTo(40, 80, 50, 60);
    dolphinShape.quadraticCurveTo(60, 40, 40, 20);
    dolphinShape.quadraticCurveTo(20, 10, 0, 0);

    const extrudeSettings = {
      depth: 20,
      bevelEnabled: true,
      bevelSegments: 10,
      steps: 4,
      bevelSize: 5,
      bevelThickness: 5
    };

    const geometry = new THREE.ExtrudeGeometry(dolphinShape, extrudeSettings);

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x6a5acd),
      metalness: 1,
      roughness: 0.2,
      reflectivity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transmission: 0.1,
      opacity: 0.95,
      ior: 1.7,
      iridescence: 1,
      iridescenceIOR: 1.5,
      specularIntensity: 1,
      specularColor: new THREE.Color(0x9370db),
      side: THREE.DoubleSide
    });

    this.dolphinPendant = new THREE.Mesh(geometry, material);
    this.dolphinPendant.position.set(0, 0, -300);
    this.dolphinPendant.rotation.z = Math.PI / 2;
    this.dolphinPendant.scale.set(0.8, 0.8, 0.8);
    this.dolphinPendant.castShadow = true;
    this.scene.add(this.dolphinPendant);
  }

  createHeartPendant() {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0);
    heartShape.bezierCurveTo(0, 0, 0, -50, 50, -50);
    heartShape.bezierCurveTo(100, -50, 100, 0, 100, 0);
    heartShape.bezierCurveTo(100, 50, 50, 100, 0, 150);
    heartShape.bezierCurveTo(-50, 100, -100, 50, -100, 0);
    heartShape.bezierCurveTo(-100, -50, -50, -50, 0, 0);

    const extrudeSettings = {
      depth: 20,
      bevelEnabled: true,
      bevelSegments: 10,
      steps: 4,
      bevelSize: 5,
      bevelThickness: 5
    };

    const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x8a4fff),
      metalness: 1,
      roughness: 0.15,
      reflectivity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transmission: 0.1,
      opacity: 0.95,
      ior: 1.7,
      iridescence: 1,
      iridescenceIOR: 1.5,
      specularIntensity: 1,
      specularColor: new THREE.Color(0x7b68ee),
      side: THREE.DoubleSide
    });

    this.heartPendant = new THREE.Mesh(geometry, material);
    this.heartPendant.position.set(0, 0, -300);
    this.heartPendant.rotation.z = Math.PI;
    this.heartPendant.scale.set(0.5, 0.5, 0.5);
    this.heartPendant.castShadow = true;
    this.scene.add(this.heartPendant);
  }

  initParticles() {
    this.particles = [];
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const velocities = [];

    for (let i = 0; i < 10000; i++) {
      const radius = Math.random() * 1000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions.push(x, y, z);

      const hue = Math.random();
      const saturation = 0.5 + Math.random() * 0.5;
      const lightness = 0.5 + Math.random() * 0.5;

      colors.push(
        Math.cos(hue * Math.PI * 2) * 0.5 + 0.5,
        Math.cos(hue * Math.PI * 2 + 2) * 0.5 + 0.5,
        Math.cos(hue * Math.PI * 2 + 4) * 0.5 + 0.5
      );

      sizes.push(1 + Math.random() * 3);

      velocities.push(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "velocity",
      new THREE.Float32BufferAttribute(velocities, 3)
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        musicEnergy: { value: 0 },
        pointTexture: {
          value:
            this.particleTexture ||
            new THREE.TextureLoader().load(
              "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/sprites/disc.png"
            )
        }
      },
      vertexShader: `
                attribute float size;
                attribute vec3 velocity;
                uniform float time;
                uniform float musicEnergy;
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec3 newPosition = position;
                    
                    // Music-synchronized movement
                    float movementIntensity = musicEnergy * 50.0;
                    newPosition += velocity * movementIntensity * (sin(time * 2.0 + length(position) * 0.01) + 1.0) * 0.5;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z) * (1.0 + musicEnergy * 2.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                uniform sampler2D pointTexture;
                uniform float musicEnergy;
                varying vec3 vColor;
                
                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    float dist = length(coord);
                    
                    float alpha = smoothstep(0.5, 0.0, dist);
                    vec3 dynamicColor = vColor * (1.0 + musicEnergy * 2.0);
                    gl_FragColor = vec4(dynamicColor, alpha * (0.7 + musicEnergy * 0.3));
                }
            `,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      vertexColors: true
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  initEventListeners() {
    document.addEventListener("mousemove", (e) => {
      const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      const mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      this.heart.rotation.y = mouseX * 0.5;
      this.heart.rotation.x = mouseY * 0.3;
      this.camera.position.z = 500 + mouseY * 50;
      this.camera.position.x = mouseX * 50;
      this.camera.lookAt(this.heart.position);
    });
  }

  initAudioReactivity() {
    this.sound = new Howl({
      src: [
        "https://www.amigaremix.com/listen/3595/tony_fluke73_wiren_-_planets_live_performance_-_amigaremix_03595.mp3"
      ],
      html5: true,
      pool: 1,
      onplay: () => {
        document.querySelector(".valentine-text").style.opacity = "1";
        document.querySelector(".loading-screen").style.opacity = "0";
      },
      onload: () => {
        document.querySelector(".loading-screen").style.opacity = "0";
      }
    });

    this.analyser = Howler.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    Howler.masterGain.connect(this.analyser);
    this.audioData = new Uint8Array(this.analyser.frequencyBinCount);

    this.energyHistory = new Array(30).fill(0.0001);
    this.beatCutoff = 0.25;
    this.beatThreshold = 1.4;
  }

  getFrequencyEnergy(startBin, endBin) {
    return (
      Array.from(this.audioData.slice(startBin, endBin)).reduce(
        (acc, val) => acc + val / 255,
        0
      ) /
      (endBin - startBin)
    );
  }

  detectBeat(energy, history) {
    const averageEnergy = history.reduce((a, b) => a + b) / history.length;
    const isBeat =
      energy > averageEnergy * this.beatThreshold && energy > this.beatCutoff;
    this.energyHistory = [...this.energyHistory.slice(1), energy];
    return isBeat;
  }

  animate() {
    const now = Date.now();
    const delta = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.audioData);

      const subBass = this.getFrequencyEnergy(0, 10);
      const bass = this.getFrequencyEnergy(10, 40);
      const lowMid = this.getFrequencyEnergy(40, 150);
      const mid = this.getFrequencyEnergy(150, 400);
      const highMid = this.getFrequencyEnergy(400, 900);
      const presence = this.getFrequencyEnergy(900, 1800);

      const beat = this.detectBeat(subBass + bass, this.energyHistory);

      const rotationIntensity = {
        heart: bass * 0.0005 + highMid * 0.0003,
        rings: mid * 0.001,
        dolphin: lowMid * 0.0007,
        heartPendant: presence * 0.0004
      };

      this.heart.rotation.y += rotationIntensity.heart * (beat ? 1.5 : 1);
      this.heart.rotation.x += rotationIntensity.heart * 0.6 * (beat ? 1.2 : 1);
      this.heart.rotation.z += subBass * 0.0003 * Math.sin(now * 0.001);

      this.rings.forEach((ring, i) => {
        const rhythmFactor = 1 + (beat ? mid * 0.02 : 0);
        ring.rotation.x += rotationIntensity.rings * rhythmFactor;
        ring.rotation.y +=
          rotationIntensity.rings * (i % 2 ? 0.8 : 1.2) * rhythmFactor;
        ring.rotation.z += highMid * 0.0002 * Math.cos(now * 0.0005 + i);
      });

      if (this.dolphinPendant) {
        this.dolphinPendant.rotation.x +=
          rotationIntensity.dolphin * Math.sin(now * 0.0007);
        this.dolphinPendant.rotation.y +=
          rotationIntensity.dolphin * Math.cos(now * 0.0008);
        this.dolphinPendant.rotation.z +=
          lowMid * 0.0004 * Math.sin(now * 0.0006);
      }

      if (this.heartPendant) {
        this.heartPendant.rotation.x +=
          rotationIntensity.heartPendant * Math.sin(now * 0.0009);
        this.heartPendant.rotation.y +=
          rotationIntensity.heartPendant * Math.cos(now * 0.001);
        this.heartPendant.rotation.z +=
          presence * 0.0003 * Math.sin(now * 0.0007);
      }

      this.heart.material.color.setHSL(
        (Math.cos(now * 0.0007) * 0.05 + 0.9) % 1,
        0.7 + mid * 0.4,
        0.5 + presence * 0.3
      );

      this.rings.forEach((ring, i) => {
        if (beat) {
          ring.scale.set(1.3, 1.3, 1.3);
        } else {
          ring.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }
      });

      const positions = this.particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(now * 0.001 + i) * (presence * 0.7);
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;

      const baseScale = 1 + subBass * 0.4;
      const beatScale = beat ? 1.15 : 1;
      this.heart.scale.set(
        baseScale * beatScale,
        baseScale * beatScale,
        baseScale * beatScale
      );
    }

    this.heart.rotation.y += 0.007;
    this.heart.rotation.x += 0.004;
    this.heart.rotation.z += 0.002;

    const scale = 1 + Math.sin(Date.now() * 0.001) * 0.05;
    this.heart.scale.set(scale, scale, scale);

    this.rings.forEach((ring, i) => {
      const angle = Date.now() * 0.0005 + (i * 2 * Math.PI) / 3;
      const orbitRadius = 220 + Math.sin(Date.now() * 0.001 + i) * 20;

      ring.position.x = Math.cos(angle) * orbitRadius;
      ring.position.y = Math.sin(angle * 1.2) * (orbitRadius * 0.6);
      ring.position.z = -200 + (i - 1) * 80 + Math.cos(angle * 0.8) * 30;

      // Maintain minimum distance between rings
      this.rings.forEach((otherRing, j) => {
        if (i !== j) {
          const distance = ring.position.distanceTo(otherRing.position);
          if (distance < 100) {
            const pushForce = (100 - distance) * 0.1;
            const direction = new THREE.Vector3()
              .subVectors(ring.position, otherRing.position)
              .normalize();
            ring.position.addScaledVector(direction, pushForce);
          }
        }
      });
    });

    if (this.dolphinPendant) {
      const time = Date.now() * 0.0005;
      const orbitRadius = 350;

      this.dolphinPendant.position.x = Math.cos(time) * orbitRadius;
      this.dolphinPendant.position.y =
        Math.sin(time * 1.5) * (orbitRadius * 0.4);
      this.dolphinPendant.position.z = -300 + Math.sin(time * 0.9) * 50;
    }

    if (this.heartPendant) {
      const time = Date.now() * 0.0005 + Math.PI;
      const orbitRadius = 300;

      this.heartPendant.position.x = Math.cos(time) * orbitRadius;
      this.heartPendant.position.y = Math.sin(time * 1.7) * (orbitRadius * 0.3);
      this.heartPendant.position.z = -250 + Math.cos(time * 1.1) * 60;
    }

    if (Date.now() % 300 < delta * 1000) {
      this.createFloatingHeart();
    }

    if (this.particleSystem) {
      this.particleSystem.material.uniforms.time.value = Date.now() * 0.001;
    }

    const subBass = this.getFrequencyEnergy(0, 10);
    const bass = this.getFrequencyEnergy(10, 40);
    const musicEnergy = subBass + bass;

    if (this.particleSystem) {
      this.particleSystem.material.uniforms.musicEnergy.value = musicEnergy;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  createFloatingHeart() {
    const heartGeometry = new THREE.SphereGeometry(2, 8, 8);
    const heartMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
      transparent: true,
      opacity: 0.7
    });

    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    heart.position.set(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
      -200
    );

    this.scene.add(heart);

    const speed = 0.1 + Math.random() * 0.2;
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 100;

    const animate = () => {
      heart.position.x += Math.cos(angle) * speed;
      heart.position.y += Math.sin(angle) * speed;
      heart.position.z += speed * 2;
      heart.scale.multiplyScalar(0.99);
      heart.material.opacity *= 0.99;

      if (heart.material.opacity < 0.1) {
        this.scene.remove(heart);
        return;
      }
      requestAnimationFrame(animate);
    };
    animate();
  }
}

let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    new DiamondHeart();
  }, 250);
});

let codigoParActual = null;

function launchExperience() {
  codigoParActual = generarCodigoPar();
  window.codigoPar = codigoParActual;

  document.querySelector(".start-screen").style.opacity = "0";
  setTimeout(() => {
    document.querySelector(".start-screen").style.display = "none";
    const ps = document.querySelector(".players-screen");
    if (ps) {
      ps.style.display = "flex";
      ps.classList.add("visible");
      const codigoEl = document.getElementById("codigo-par-val");
      if (codigoEl) codigoEl.textContent = codigoParActual;
      renderPlayersQR();
    }
  }, 500);
}

async function renderPlayersQR() {
  const canvasA = document.getElementById("qrcode-sujeto-a");
  const canvasB = document.getElementById("qrcode-sujeto-b");
  if (!canvasA || !canvasB || !codigoParActual) return;
  try {
    const QRCode = (await import("https://cdn.skypack.dev/qrcode")).default;
    const urlA = getRegistroUrl("A", codigoParActual);
    const urlB = getRegistroUrl("B", codigoParActual);
    await QRCode.toCanvas(canvasA, urlA, { width: 200, margin: 2 });
    await QRCode.toCanvas(canvasB, urlB, { width: 200, margin: 2 });
  } catch (e) {
    console.error("Error generando QR:", e);
  }
}

// #region agent log
try {
  fetch("http://127.0.0.1:7242/ingest/2e670ee4-5f89-4f2b-9841-117c6890c6a5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "script.js:launchExperience-assigned",
      message: "launchExperience assigned to window",
      data: { hypothesisId: "H3" },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch (_) {}
// #endregion
window.launchExperience = launchExperience;

// ——— Escenarios (QR, 3D, lista) ———
const ESCENARIO_QR = "1";
const ESCENARIO_3D = "2";
const ESCENARIO_LISTA = "3";

function getBaseUrl() {
  const base = window.location.origin + window.location.pathname.replace(/\/?index\.html$/, "") || window.location.origin;
  return base.replace(/\/$/, "");
}

function getRegistroUrl(sujeto, codigo) {
  const base = getBaseUrl();
  const params = new URLSearchParams({ sujeto, codigo });
  return base + "/registro.html?" + params.toString();
}

function generarCodigoPar() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function initEscenarios() {
  const wrapper = document.getElementById("escenarios-wrapper");
  if (!wrapper) return;

  const buttons = wrapper.querySelectorAll(".escenario-btn");
  const panels = wrapper.querySelectorAll(".escenario-panel");

  function setActiveEscenario(num) {
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-escenario") === num);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.getAttribute("data-escenario") === num);
    });
    if (num === ESCENARIO_QR) renderEscenarioQR();
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveEscenario(btn.getAttribute("data-escenario"));
    });
  });

  setActiveEscenario(ESCENARIO_3D);
}

let qrEscenarioRendered = false;
async function renderEscenarioQR() {
  const canvasA = document.getElementById("qrcode-canvas-a");
  const canvasB = document.getElementById("qrcode-canvas-b");
  if (!canvasA || !canvasB || qrEscenarioRendered) return;
  const codigo = codigoParActual || generarCodigoPar();
  if (!codigoParActual) {
    codigoParActual = codigo;
    window.codigoPar = codigo;
    const codigoEl = document.getElementById("codigo-escenario-val");
    if (codigoEl) codigoEl.textContent = codigo;
  }
  try {
    const QRCode = (await import("https://cdn.skypack.dev/qrcode")).default;
    const urlA = getRegistroUrl("A", codigo);
    const urlB = getRegistroUrl("B", codigo);
    await QRCode.toCanvas(canvasA, urlA, { width: 220, margin: 2 });
    await QRCode.toCanvas(canvasB, urlB, { width: 220, margin: 2 });
    qrEscenarioRendered = true;
  } catch (e) {
    console.error("Error generando QR:", e);
  }
}

async function initListaParticipantes() {
  const listEl = document.getElementById("lista-participantes");
  if (!listEl) return;

  let supabase;
  try {
    const mod = await import("./supabaseClient.js");
    supabase = mod.supabase;
  } catch (e) {
    console.warn("supabaseClient no disponible (p. ej. no desplegado):", e);
    return;
  }

  function addParticipante(p) {
    const li = document.createElement("li");
    const sujeto = p.sujeto ? ` (Sujeto ${escapeHtml(p.sujeto)})` : "";
    const codigo = p.codigo_par ? ` [${escapeHtml(p.codigo_par)}]` : "";
    li.innerHTML =
      "<span class=\"nombre\">" + escapeHtml(p.nombre) + "</span>" + sujeto + " <span class=\"carrera\">" + escapeHtml(p.carrera || "") + "</span>" + codigo;
    listEl.appendChild(li);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  supabase
    .from("participantes_valentine")
    .select("id, nombre, carrera, sujeto, codigo_par, created_at")
    .order("created_at", { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error("Error cargando participantes:", error);
        return;
      }
      (data || []).forEach((row) => addParticipante({ id: row.id, nombre: row.nombre, carrera: row.carrera, sujeto: row.sujeto, codigo_par: row.codigo_par }));
    });

  supabase
    .channel("participantes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "participantes_valentine" },
      (payload) => {
        const row = payload.new;
        addParticipante({ id: row.id, nombre: row.nombre, carrera: row.carrera, sujeto: row.sujeto, codigo_par: row.codigo_par });
      }
    )
    .subscribe();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initEscenarios();
    initListaParticipantes();
  });
} else {
  initEscenarios();
  initListaParticipantes();
}
