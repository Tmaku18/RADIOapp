import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

const CYAN = "#00F0FF";
const CYAN_DEEP = "#22D3EE";

// ─────────────────────────────────────────────────────────────────────
// Music-note texture (canvas-drawn) — used as a sprite material
// ─────────────────────────────────────────────────────────────────────
function makeNoteTexture(char) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.shadowColor = "#00F0FF";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#9EF1FF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 92px serif";
  ctx.fillText(char, size / 2, size / 2 + 4);
  // Second pass for stronger glow core
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#E0FBFF";
  ctx.fillText(char, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────
// One wing — outer cyan arch + a row of glowing audio bars
// ─────────────────────────────────────────────────────────────────────
function Wing({ side = 1 }) {
  // side: 1 = right, -1 = left
  const barsRef = useRef([]);
  const archRef = useRef();

  // 14 bars across the wing, arranged in 2 rows (upper + lower wing-half)
  // For each bar: { x, baseY, h, phase, row(+1 up / -1 down) }
  const bars = useMemo(() => {
    const arr = [];
    const cols = 14;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1); // 0..1 across wing
      const x = THREE.MathUtils.lerp(0.15, 1.85, t) * side;
      // Wing silhouette tapers: tall in middle, short at edges
      const env = Math.sin(t * Math.PI); // 0 at edges, 1 mid
      // Upper-half bar
      arr.push({
        x,
        row: 1,
        baseH: 0.18 + env * 0.95,
        phase: i * 0.31 + (side > 0 ? 0 : 1.7),
      });
      // Lower-half bar (slightly shorter)
      arr.push({
        x,
        row: -1,
        baseH: 0.16 + env * 0.6,
        phase: i * 0.37 + (side > 0 ? 0.8 : 2.4),
      });
    }
    return arr;
  }, [side]);

  // Build outer arch shape — two prominent curved tubes (top + bottom of wing)
  const archGeom = useMemo(() => {
    // Top arch: from near body (0, 0.1) curving outward to (w, 0)
    const w = 2.0;
    const topCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(0.6, 1.25, 0),
      new THREE.Vector3(w * 0.9, 0.9, 0),
      new THREE.Vector3(w, 0.0, 0)
    );
    const botCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, -0.12, 0),
      new THREE.Vector3(0.6, -1.25, 0),
      new THREE.Vector3(w * 0.9, -0.9, 0),
      new THREE.Vector3(w, 0.0, 0)
    );
    const top = new THREE.TubeGeometry(topCurve, 64, 0.06, 12, false);
    const bot = new THREE.TubeGeometry(botCurve, 64, 0.06, 12, false);
    return { top, bot };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    barsRef.current.forEach((m, i) => {
      if (!m) return;
      const def = bars[i];
      const wobble = 0.6 + Math.sin(t * 6 + def.phase) * 0.4;
      const h = def.baseH * wobble;
      m.scale.y = h;
      m.position.y = def.row * (h / 2 + 0.04);
      // Slight emissive pulse
      const mat = m.material;
      if (mat) mat.emissiveIntensity = 1.1 + Math.sin(t * 6 + def.phase) * 0.6;
    });
    if (archRef.current) {
      const mat = archRef.current.children?.[0]?.material;
      if (mat) mat.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * 0.25;
    }
  });

  return (
    <group scale={[side, 1, 1]}>
      {/* Bars — group at x=0 so we can mirror with parent scale */}
      <group>
        {bars.map((def, i) => (
          <mesh
            key={i}
            ref={(el) => (barsRef.current[i] = el)}
            position={[Math.abs(def.x), 0, 0]}
          >
            <boxGeometry args={[0.08, 1, 0.08]} />
            <meshStandardMaterial
              color={CYAN_DEEP}
              emissive={CYAN}
              emissiveIntensity={1.4}
              roughness={0.25}
              metalness={0.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Outer cyan arch */}
      <group ref={archRef}>
        <mesh geometry={archGeom.top}>
          <meshStandardMaterial
            color="#A6FBFF"
            emissive={CYAN}
            emissiveIntensity={1.6}
            roughness={0.15}
            metalness={0.7}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={archGeom.bot}>
          <meshStandardMaterial
            color="#A6FBFF"
            emissive={CYAN}
            emissiveIntensity={1.6}
            roughness={0.15}
            metalness={0.7}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────
// The flapping butterfly (wings hinge around body axis)
// ─────────────────────────────────────────────────────────────────────
function Butterfly() {
  const leftHinge = useRef();
  const rightHinge = useRef();
  const body = useRef();
  const root = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const flap = Math.sin(t * 4.4) * 0.6 + 0.2; // bias forward
    if (rightHinge.current) rightHinge.current.rotation.y = -flap;
    if (leftHinge.current) leftHinge.current.rotation.y = flap;
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * 0.18;
      root.current.rotation.z = Math.sin(t * 0.8) * 0.04;
    }
    if (body.current) {
      const mat = body.current.material;
      if (mat) mat.emissiveIntensity = 1.6 + Math.sin(t * 4.4) * 0.4;
    }
  });

  return (
    <group ref={root}>
      {/* Body */}
      <mesh ref={body}>
        <capsuleGeometry args={[0.05, 1.4, 8, 16]} />
        <meshStandardMaterial
          color="#A6FBFF"
          emissive={CYAN}
          emissiveIntensity={1.6}
          roughness={0.2}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>
      {/* Tiny head circle */}
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#A6FBFF"
          emissive={CYAN}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      {/* Right wing hinge */}
      <group ref={rightHinge}>
        <Wing side={1} />
      </group>
      {/* Left wing hinge */}
      <group ref={leftHinge}>
        <Wing side={-1} />
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Cyan particle dust trailing around the butterfly
// ─────────────────────────────────────────────────────────────────────
function ParticleDust({ count = 600 }) {
  const ref = useRef();
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spawn near butterfly center
      positions[i * 3] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
      velocities[i * 3] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 1] = Math.random() * 0.006 + 0.002;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    const geom = ref.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += data.velocities[i * 3];
      pos[i * 3 + 1] += data.velocities[i * 3 + 1];
      pos[i * 3 + 2] += data.velocities[i * 3 + 2];
      if (pos[i * 3 + 1] > 3.5) {
        pos[i * 3] = (Math.random() - 0.5) * 4;
        pos[i * 3 + 1] = -2.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
      }
    }
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <Points ref={ref} positions={data.positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={CYAN}
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </Points>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Music notes floating up and away
// ─────────────────────────────────────────────────────────────────────
const NOTE_CHARS = ["\u266A", "\u266B", "\u266C", "\u2669"];

function MusicNotes({ count = 14 }) {
  const refs = useRef([]);
  const textures = useMemo(() => NOTE_CHARS.map(makeNoteTexture), []);
  const notes = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        tex: textures[i % textures.length],
        offset: Math.random() * 6, // life offset
        speed: 0.45 + Math.random() * 0.4,
        side: Math.random() < 0.5 ? -1 : 1,
        amp: 0.6 + Math.random() * 0.9,
        spawnX: (Math.random() - 0.5) * 1.6,
        size: 0.4 + Math.random() * 0.35,
      });
    }
    return arr;
  }, [count, textures]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((sprite, i) => {
      if (!sprite) return;
      const def = notes[i];
      const life = (t * def.speed + def.offset) % 6; // 0..6 lifecycle
      const p = life / 6; // 0..1
      sprite.position.x = def.spawnX + def.side * Math.sin(life * 1.4) * def.amp;
      sprite.position.y = -1.2 + p * 4.6;
      sprite.position.z = Math.cos(life * 0.8 + i) * 0.4;
      // Fade in/out
      const fade = Math.sin(p * Math.PI); // 0..1..0
      sprite.material.opacity = fade * 0.95;
      sprite.scale.setScalar(def.size * (0.6 + fade * 0.6));
      sprite.material.rotation = Math.sin(life * 2) * 0.4;
    });
  });

  return (
    <group>
      {notes.map((n, i) => (
        <sprite
          key={i}
          ref={(el) => (refs.current[i] = el)}
          position={[0, 0, 0]}
        >
          <spriteMaterial
            map={n.tex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Distant star field for ambience
// ─────────────────────────────────────────────────────────────────────
function StarField() {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r = 7 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.015;
  });
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.022}
        sizeAttenuation
        depthWrite={false}
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// ─────────────────────────────────────────────────────────────────────
// The exported scene
// ─────────────────────────────────────────────────────────────────────
export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.2, 6.4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 9, 22]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 3, 4]} intensity={2.6} color={CYAN} />
      <pointLight position={[-4, -2, 3]} intensity={1.6} color="#00B7C9" />
      <pointLight position={[0, 0, -3]} intensity={1.2} color={CYAN} />
      <StarField />
      <group position={[2.4, 0.2, 0]}>
        <ParticleDust />
        <Butterfly />
        <MusicNotes />
      </group>
    </Canvas>
  );
}
