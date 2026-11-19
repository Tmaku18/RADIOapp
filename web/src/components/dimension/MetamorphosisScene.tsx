/* eslint-disable react-hooks/purity -- ported 3d scene uses Math.random in useMemo for stable mesh layout */
/* eslint-disable @typescript-eslint/ban-ts-comment -- large 3d port; typed at export boundary */
// @ts-nocheck
'use client';

import { Suspense, useRef, useMemo, useEffect, type MutableRefObject } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, useTexture } from "@react-three/drei";
import * as THREE from "three";

const CYAN = "#00F0FF";
const PINK = "#FF007F";
const YELLOW = "#F4D03F";
const WHITE = "#ffffff";

// =====================================================================
// Helpers
// =====================================================================
function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Apply opacity to all meshes inside a group
function applyOpacity(group, alpha) {
  if (!group) return;
  group.traverse((c) => {
    if (c.isMesh && c.material) {
      c.material.transparent = alpha < 0.999;
      c.material.opacity = alpha;
      c.material.depthWrite = alpha > 0.95;
    } else if (c.isPoints && c.material) {
      c.material.opacity = alpha;
    }
  });
}

function radialTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function place(mesh, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

// =====================================================================
// STAGE 1 — HIDDEN GEM: a prospector breaks the stone and finds the gem
// =====================================================================
function Stage1Gem({ activeRef, progressRef }) {
  const root = useRef();
  const armRef = useRef();
  const forearmRef = useRef();
  const torsoRef = useRef();
  const pickaxe = useRef();
  const gem = useRef();
  const gemCore = useRef();
  const gemSpin = useRef();
  const sparksRef = useRef();
  const dustRef = useRef();
  const gemLight = useRef();
  const sparkVelocities = useRef([]);
  const lastStrike = useRef(-99);

  const rig = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({ color: "#4a3422", roughness: 0.72, metalness: 0.04 });
    const dark = new THREE.MeshStandardMaterial({ color: "#07080c", roughness: 0.86, metalness: 0.35 });
    const steel = new THREE.MeshStandardMaterial({
      color: "#c5ced4",
      roughness: 0.22,
      metalness: 0.92,
      emissive: "#102026",
      emissiveIntensity: 0.15,
    });
    const pick = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      pick.add(place(new THREE.Mesh(geo, mat), x, y, z, rx, ry, rz));
    };
    add(new THREE.CylinderGeometry(0.022, 0.028, 0.5, 16), wood, 0, 0.25, 0);
    const wrap = new THREE.TorusGeometry(0.03, 0.006, 6, 14);
    add(wrap, dark, 0, 0.08, 0, Math.PI / 2);
    add(wrap, dark, 0, 0.12, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), steel, 0, 0.5, 0);
    add(new THREE.ConeGeometry(0.055, 0.22, 12), steel, 0.12, 0.5, 0, 0, 0, -Math.PI / 2);
    add(new THREE.ConeGeometry(0.04, 0.12, 12), steel, -0.07, 0.5, 0, 0, 0, Math.PI / 2);
    return { pick };
  }, []);

  const glowMap = useMemo(() => radialTexture(), []);
  const prospectorMap = useTexture("/lore/prospector.png");
  prospectorMap.colorSpace = THREE.SRGBColorSpace;
  prospectorMap.anisotropy = 8;

  // Spark particles
  useEffect(() => {
    const v = [];
    for (let i = 0; i < 40; i++) {
      v.push({
        vx: (Math.random() - 0.5) * 4,
        vy: 1.5 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 2,
        life: -1,
      });
    }
    sparkVelocities.current = v;
  }, []);

  const sparkPositions = useMemo(() => new Float32Array(40 * 3), []);

  useFrame((state, dt) => {
    const a = activeRef.current;
    const p = progressRef.current ?? 0;
    if (!root.current) return;

    // Local stage progress 0..1 inside its visible window (first ~25% of overall scroll)
    const local = THREE.MathUtils.clamp(p / 0.22, 0, 1);

    // Position & opacity
    root.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, a));
    applyOpacity(root.current, a);

    // Overhead wind-up, then a weighted strike that lands on the stone.
    const cycle = 1.85;
    const time = state.clock.elapsedTime;
    const t = (time % cycle) / cycle;
    let shoulder;
    let elbow;
    if (t < 0.62) {
      shoulder = THREE.MathUtils.lerp(-0.35, -1.15, smoothstep(0, 0.62, t));
      elbow = THREE.MathUtils.lerp(0, -0.35, smoothstep(0, 0.55, t));
    } else if (t < 0.74) {
      shoulder = THREE.MathUtils.lerp(-1.15, -0.2, smoothstep(0.62, 0.74, t));
      elbow = THREE.MathUtils.lerp(-0.35, 0.15, smoothstep(0.62, 0.71, t));
    } else {
      shoulder = THREE.MathUtils.lerp(-0.2, -0.35, smoothstep(0.74, 1, t));
      elbow = THREE.MathUtils.lerp(0.15, 0, smoothstep(0.74, 0.92, t));
    }
    if (armRef.current) armRef.current.rotation.z = shoulder;
    if (forearmRef.current) forearmRef.current.rotation.z = elbow;
    if (pickaxe.current) {
      const snap = t > 0.66 && t < 0.84
        ? smoothstep(0.66, 0.73, t) * (1 - smoothstep(0.76, 0.9, t))
        : 0;
      pickaxe.current.rotation.z = -Math.PI / 2 + snap * 0.45;
    }

    const lean = t > 0.62 && t < 0.88
      ? smoothstep(0.62, 0.72, t) * (1 - smoothstep(0.76, 0.9, t))
      : 0;
    if (torsoRef.current) {
      torsoRef.current.rotation.z = -lean * 0.06;
      torsoRef.current.position.y = Math.sin(time * 1.6) * 0.008 - lean * 0.02;
    }
    const isStrikeFrame = t > 0.71 && t < 0.745;
    if (isStrikeFrame && time - lastStrike.current > 0.6) {
      lastStrike.current = time;
      sparkVelocities.current.forEach((s, i) => {
        s.vx = (Math.random() - 0.5) * 5;
        s.vy = 1.5 + Math.random() * 4;
        s.vz = (Math.random() - 0.5) * 2;
        s.life = 0;
        sparkPositions[i * 3] = 0;
        sparkPositions[i * 3 + 1] = -0.55;
        sparkPositions[i * 3 + 2] = 0;
      });
    }

    // Advance sparks
    sparkVelocities.current.forEach((s, i) => {
      if (s.life < 0) return;
      s.life += dt;
      sparkPositions[i * 3] += s.vx * dt;
      sparkPositions[i * 3 + 1] += (s.vy - s.life * 6) * dt;
      sparkPositions[i * 3 + 2] += s.vz * dt;
      if (s.life > 0.7) s.life = -1;
    });
    if (sparksRef.current) {
      sparksRef.current.geometry.attributes.position.needsUpdate = true;
      const liveCount = sparkVelocities.current.filter((s) => s.life >= 0).length;
      sparksRef.current.material.opacity = (liveCount / 40) * a;
    }

    const sinceStrike = time - lastStrike.current;
    const flash = Math.max(0, 1 - sinceStrike / 0.45);
    if (gemLight.current) {
      gemLight.current.intensity = (1.5 + local * 1.1 + flash * 4.5) * a;
    }
    if (gemSpin.current) {
      gemSpin.current.rotation.y = time * 0.35;
      gemSpin.current.position.y = -0.56 + Math.sin(time * 1.4) * 0.012;
      const punch = Math.max(0, 1 - sinceStrike / 0.16);
      gemSpin.current.scale.setScalar(1 + punch * 0.1);
    }
    if (gem.current) gem.current.material.emissiveIntensity = 0.4 + local * 0.4 + flash * 1.5;
    if (gemCore.current) gemCore.current.material.emissiveIntensity = 1.5 + flash * 2.4;
    if (dustRef.current) {
      const u = sinceStrike / 0.55;
      if (sinceStrike > 0 && u < 1) {
        dustRef.current.scale.set(0.45 + u * 1.5, 0.45 + u * 1.5, 1);
        dustRef.current.material.transparent = true;
        dustRef.current.material.depthWrite = false;
        dustRef.current.material.opacity = (1 - u) * (1 - u) * 0.7 * a;
      } else {
        dustRef.current.material.opacity = 0;
      }
    }
  });

  return (
    <group ref={root}>
      <mesh position={[0, -0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 64]} />
        <meshStandardMaterial color="#0c0d11" roughness={1} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 48]} />
        <meshBasicMaterial
          map={glowMap}
          color="#2a2416"
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>

      {[
        [-0.55, -0.78, 0.2, 0.42, 0.26, 0.34, 0.35, 0.2, 0.1],
        [0.52, -0.8, 0.16, 0.48, 0.3, 0.36, 0.2, -0.4, 0.25],
        [0.08, -0.86, 0.38, 0.3, 0.18, 0.26, 0.5, 0.3, 0.05],
        [-0.16, -0.88, -0.26, 0.38, 0.22, 0.32, 0.25, 1.1, 0.15],
        [0.82, -0.9, -0.08, 0.24, 0.16, 0.2, 0.4, 0.2, 0.3],
        [-0.88, -0.9, -0.02, 0.2, 0.13, 0.16, 0.15, 0.7, 0.2],
      ].map((r, i) => (
        <mesh
          key={i}
          position={[r[0], r[1], r[2]]}
          scale={[r[3], r[4], r[5]]}
          rotation={[r[6], r[7], r[8]]}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#23262e" : "#2c2824"}
            roughness={0.92}
            metalness={0.08}
            flatShading
          />
        </mesh>
      ))}
      {[
        [0.18, -0.64, 0.12],
        [-0.28, -0.66, 0.08],
        [0.4, -0.66, 0.02],
      ].map((f, i) => (
        <mesh key={`fleck-${i}`} position={f} scale={0.045}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={YELLOW}
            emissive={YELLOW}
            emissiveIntensity={0.6}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
      ))}

      <group ref={gemSpin} position={[0, -0.56, 0]}>
        <mesh ref={gem}>
          <octahedronGeometry args={[0.22, 1]} />
          <meshStandardMaterial
            color="#ffe7a0"
            emissive={YELLOW}
            emissiveIntensity={0.55}
            roughness={0.12}
            metalness={0.78}
          />
        </mesh>
        <mesh ref={gemCore} scale={0.52}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#fff8dc"
            emissive="#fff1b0"
            emissiveIntensity={1.6}
            roughness={0.05}
            toneMapped={false}
          />
        </mesh>
      </group>
      <pointLight ref={gemLight} position={[0, -0.35, 0.35]} color={YELLOW} intensity={2} distance={2.8} decay={2} />
      <mesh ref={dustRef} position={[0, -0.7, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial
          map={glowMap}
          color={YELLOW}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <group position={[-0.72, -0.9, 0.15]}>
        <group ref={torsoRef}>
          <mesh position={[0, 0.78, 0]}>
            <planeGeometry args={[1.22, 1.62]} />
            <meshBasicMaterial
              map={prospectorMap}
              transparent
              alphaTest={0.04}
              toneMapped={false}
            />
          </mesh>
          <group ref={armRef} position={[0.18, 0.72, 0.16]}>
            <group ref={forearmRef}>
              <group ref={pickaxe} position={[0.06, 0, 0.04]} scale={0.72}>
                <primitive object={rig.pick} />
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Sparks */}
      <points ref={sparksRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={40}
            array={sparkPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          color={YELLOW}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

// =====================================================================
// STAGE 2 ??? RIPPLE: growing concentric waves
// =====================================================================
function RippleRing({ delay, color }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cycle = 3.0;
    const local = ((t + delay) % cycle) / cycle; // 0..1
    if (ref.current) {
      const scale = 0.05 + local * 2.4;
      ref.current.scale.set(scale, scale, scale);
      const op = (1 - local) * 0.85;
      ref.current.material.opacity = op;
      ref.current.rotation.z = local * 0.6;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.96, 1.0, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Stage2Ripple({ activeRef }) {
  const root = useRef();
  const core = useRef();
  const halo = useRef();

  useFrame((state) => {
    const a = activeRef.current;
    if (!root.current) return;
    root.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, a));
    applyOpacity(root.current, a);

    const t = state.clock.elapsedTime;
    if (core.current) {
      const pulse = 1 + Math.sin(t * 4.5) * 0.12;
      core.current.scale.set(pulse, pulse, pulse);
      core.current.material.emissiveIntensity = 1.5 + Math.sin(t * 4.5) * 0.6;
    }
    if (halo.current) {
      halo.current.rotation.z = t * 0.6;
    }
  });

  return (
    <group ref={root}>
      {/* Central pulsing core sphere */}
      <mesh ref={core}>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial
          color="#ffe4f0"
          emissive={PINK}
          emissiveIntensity={1.6}
          roughness={0.15}
          metalness={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Halo behind core */}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.55, 64]} />
        <meshBasicMaterial
          color={PINK}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Concentric ripple rings, staggered */}
      {[0, 0.55, 1.1, 1.6, 2.15].map((d, i) => (
        <RippleRing
          key={i}
          delay={d}
          color={i % 2 === 0 ? PINK : "#ff66b0"}
        />
      ))}
    </group>
  );
}

// =====================================================================
// STAGE 3 ??? WINGS UNFOLD: butterfly wings with proper unfold animation
// =====================================================================
function ButterflyWing({ side = 1, unfoldRef }) {
  const barsRef = useRef([]);
  const archRef = useRef();

  const bars = useMemo(() => {
    const arr = [];
    const cols = 12;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1);
      const x = THREE.MathUtils.lerp(0.18, 1.6, t) * side;
      const env = Math.sin(t * Math.PI);
      arr.push({ x, row: 1, baseH: 0.14 + env * 0.78, phase: i * 0.31 });
      arr.push({ x, row: -1, baseH: 0.12 + env * 0.5, phase: i * 0.37 });
    }
    return arr;
  }, [side]);

  const archGeom = useMemo(() => {
    const w = 1.75;
    const topCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0.55, 1.05, 0),
      new THREE.Vector3(w * 0.9, 0.8, 0),
      new THREE.Vector3(w, 0.0, 0)
    );
    const botCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0.55, -1.05, 0),
      new THREE.Vector3(w * 0.9, -0.8, 0),
      new THREE.Vector3(w, 0.0, 0)
    );
    return {
      top: new THREE.TubeGeometry(topCurve, 64, 0.055, 12, false),
      bot: new THREE.TubeGeometry(botCurve, 64, 0.055, 12, false),
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const unfold = unfoldRef.current; // 0..1
    barsRef.current.forEach((m, i) => {
      if (!m) return;
      const def = bars[i];
      // Bars are flat (h=0.01) when folded, blossom out when unfolded
      const wobble = 0.6 + Math.sin(t * 6 + def.phase) * 0.4;
      const h = THREE.MathUtils.lerp(0.02, def.baseH * wobble, unfold);
      m.scale.y = h;
      m.position.y = def.row * (h / 2 + 0.03);
      if (m.material) m.material.emissiveIntensity = (1.1 + Math.sin(t * 6 + def.phase) * 0.6) * unfold;
    });
    if (archRef.current) {
      // Arch scales out from the body ??? x scale grows with unfold
      archRef.current.scale.x = THREE.MathUtils.lerp(0.08, 1, unfold);
      const mat = archRef.current.children?.[0]?.material;
      if (mat) mat.emissiveIntensity = 1.5 + Math.sin(t * 2.4) * 0.25;
    }
  });

  return (
    <group scale={[side, 1, 1]}>
      <group>
        {bars.map((def, i) => (
          <mesh
            key={i}
            ref={(el) => (barsRef.current[i] = el)}
            position={[Math.abs(def.x), 0, 0]}
          >
            <boxGeometry args={[0.07, 1, 0.07]} />
            <meshStandardMaterial
              color="#22D3EE"
              emissive={CYAN}
              emissiveIntensity={1.4}
              roughness={0.25}
              metalness={0.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
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

function Stage3Wings({ activeRef, progressRef }) {
  const root = useRef();
  const left = useRef();
  const right = useRef();
  const body = useRef();
  const unfoldRef = useRef(0);

  useFrame((state) => {
    const a = activeRef.current;
    const p = progressRef.current ?? 0;
    if (!root.current) return;

    // Map overall scroll [0.5, 0.78] to unfold local 0..1
    const unfold = smoothstep(0.5, 0.78, p);
    unfoldRef.current = unfold;

    root.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1.05, a));
    applyOpacity(root.current, a);

    const t = state.clock.elapsedTime;
    // Smooth, asymmetric flap with anticipation pause
    const flapBase = (Math.sin(t * 3.6) * 0.5 + Math.sin(t * 7.2) * 0.12) * unfold;
    // Initial unfold pose: wings start at -??/2 (folded back), rotate to flap range
    const foldedAngle = THREE.MathUtils.lerp(Math.PI / 2, 0, unfold);

    if (right.current) right.current.rotation.y = -foldedAngle - flapBase;
    if (left.current) left.current.rotation.y = foldedAngle + flapBase;
    if (body.current) {
      const mat = body.current.material;
      if (mat) mat.emissiveIntensity = 1.5 + Math.sin(t * 3.6) * 0.35;
      body.current.position.y = Math.sin(t * 1.4) * 0.08 * unfold;
    }
    if (root.current) {
      root.current.rotation.z = Math.sin(t * 0.8) * 0.04 * unfold;
    }
  });

  return (
    <group ref={root}>
      {/* Body */}
      <mesh ref={body}>
        <capsuleGeometry args={[0.05, 1.3, 8, 16]} />
        <meshStandardMaterial
          color="#A6FBFF"
          emissive={CYAN}
          emissiveIntensity={1.5}
          roughness={0.2}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#A6FBFF"
          emissive={CYAN}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <group ref={right}>
        <ButterflyWing side={1} unfoldRef={unfoldRef} />
      </group>
      <group ref={left}>
        <ButterflyWing side={-1} unfoldRef={unfoldRef} />
      </group>
    </group>
  );
}

// =====================================================================
// STAGE 4 ??? DIAMOND: proper faceted diamond with sparkles
// =====================================================================
function diamondGeometry() {
  // Build a brilliant-cut-ish geometry: top pyramid (crown), middle band (girdle), bottom inverted pyramid (pavilion)
  const verts = [];
  const idx = [];
  const sides = 10;
  const crownRadius = 1.0;
  const girdleY = 0.0;
  const crownTopY = 0.55;
  const pavilionTipY = -1.1;
  // top center
  verts.push(0, crownTopY, 0); // 0
  // crown ring around girdle - slightly above girdle level
  const crownRingY = girdleY + 0.05;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    verts.push(Math.cos(a) * crownRadius, crownRingY, Math.sin(a) * crownRadius);
  }
  // pavilion tip
  verts.push(0, pavilionTipY, 0); // index = 1 + sides
  const tipIdx = 1 + sides;
  // crown faces (top -> ring i, ring i+1)
  for (let i = 0; i < sides; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % sides);
    idx.push(0, a, b);
  }
  // pavilion faces (ring i, tip, ring i+1)
  for (let i = 0; i < sides; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % sides);
    idx.push(a, tipIdx, b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

function Stage4Diamond({ activeRef }) {
  const root = useRef();
  const dia = useRef();
  const innerDia = useRef();
  const sparkleRef = useRef();
  const geom = useMemo(() => diamondGeometry(), []);
  const wireGeom = useMemo(() => diamondGeometry(), []);

  // Sparkles around the diamond
  const sparklePositions = useMemo(() => {
    const arr = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      const r = 1.6 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state) => {
    const a = activeRef.current;
    if (!root.current) return;
    root.current.scale.setScalar(THREE.MathUtils.lerp(0.3, 1.05, a));
    applyOpacity(root.current, a);

    const t = state.clock.elapsedTime;
    if (dia.current) {
      dia.current.rotation.y = t * 0.6;
      dia.current.rotation.x = Math.sin(t * 0.5) * 0.15;
      const mat = dia.current.material;
      if (mat) mat.emissiveIntensity = 0.4 + Math.sin(t * 2.2) * 0.25;
    }
    if (innerDia.current) {
      innerDia.current.rotation.y = -t * 0.4;
      innerDia.current.rotation.x = Math.cos(t * 0.5) * 0.15;
    }
    if (sparkleRef.current) {
      sparkleRef.current.rotation.y = t * 0.2;
      sparkleRef.current.material.opacity = a * (0.7 + Math.sin(t * 3) * 0.3);
    }
  });

  return (
    <group ref={root}>
      {/* Outer faceted shell */}
      <mesh ref={dia} geometry={geom}>
        <meshPhysicalMaterial
          color="#E6FCFF"
          emissive={CYAN}
          emissiveIntensity={0.5}
          roughness={0.05}
          metalness={0.8}
          clearcoat={1}
          clearcoatRoughness={0.05}
          flatShading
          toneMapped={false}
        />
      </mesh>

      {/* Inner reverse-rotating diamond for refraction feel */}
      <mesh ref={innerDia} geometry={wireGeom} scale={0.78}>
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.25}
          wireframe
          toneMapped={false}
        />
      </mesh>

      {/* Halo ring around the girdle */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.18, 1.32, 64]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Sparkles */}
      <Points
        ref={sparkleRef}
        positions={sparklePositions}
        stride={3}
        frustumCulled={false}
      >
        <PointMaterial
          transparent
          color={WHITE}
          size={0.06}
          sizeAttenuation
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </Points>
    </group>
  );
}

// =====================================================================
// Driver ??? receives external scrollYProgress via progressRef (0..1)
// =====================================================================
function StageDriver({ progressRef }) {
  // active refs are written each frame from progressRef
  const a1 = useRef(0);
  const a2 = useRef(0);
  const a3 = useRef(0);
  const a4 = useRef(0);

  useFrame(() => {
    const p = progressRef.current ?? 0;
    // Same handoff windows as the text panels in AboutPage
    a1.current = THREE.MathUtils.clamp(1 - smoothstep(0.18, 0.27, p), 0, 1);
    a2.current = smoothstep(0.22, 0.32, p) * (1 - smoothstep(0.47, 0.55, p));
    a3.current = smoothstep(0.5, 0.6, p) * (1 - smoothstep(0.74, 0.82, p));
    a4.current = smoothstep(0.76, 0.86, p);
  });

  return (
    <>
      <Stage1Gem activeRef={a1} progressRef={progressRef} />
      <Stage2Ripple activeRef={a2} />
      <Stage3Wings activeRef={a3} progressRef={progressRef} />
      <Stage4Diamond activeRef={a4} />
    </>
  );
}

// =====================================================================
// Exported scene
// =====================================================================
export function MetamorphosisScene({
  progressRef,
}: {
  progressRef: MutableRefObject<number>;
}) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.2, 4.6], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={2.5} color={CYAN} />
      <pointLight position={[-3, -2, 2]} intensity={2.2} color={PINK} />
      <pointLight position={[0, 3, 1.5]} intensity={1.8} color={YELLOW} />
      <pointLight position={[2, -2, 4]} intensity={1.4} color={WHITE} />
      <Suspense fallback={null}>
        <StageDriver progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}
