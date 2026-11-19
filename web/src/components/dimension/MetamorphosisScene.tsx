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
  const oreMap = useTexture("/lore/ore.png");
  oreMap.colorSpace = THREE.SRGBColorSpace;
  oreMap.anisotropy = 8;

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
      gemSpin.current.position.y = -0.58 + Math.sin(time * 1.4) * 0.006;
      const punch = Math.max(0, 1 - sinceStrike / 0.16);
      gemSpin.current.scale.setScalar(1 + punch * 0.045);
    }
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

      <group ref={gemSpin} position={[-0.02, -0.58, 0.08]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.28, 1.28]} />
          <meshBasicMaterial
            map={oreMap}
            transparent
            alphaTest={0.04}
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
// STAGE 2 — a drop falls into a lake and the ripples open into waves
// =====================================================================
function Stage2Ripple({ activeRef }) {
  const root = useRef();
  const waterRef = useRef();
  const dropRef = useRef();
  const splashRef = useRef();
  const ringsRef = useRef();
  const lake = useMemo(() => {
    const rings = 42;
    const segs = 80;
    const radius = 1.85;
    const positions = [0, 0, 0];
    const indices = [];
    for (let r = 1; r <= rings; r++) {
      const rad = (r / rings) * radius;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        positions.push(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      }
    }
    for (let s = 0; s < segs; s++) {
      indices.push(0, 1 + ((s + 1) % segs), 1 + s);
    }
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < segs; s++) {
        const a = 1 + r * segs + s;
        const b = 1 + r * segs + ((s + 1) % segs);
        const c = 1 + (r + 1) * segs + s;
        const d = 1 + (r + 1) * segs + ((s + 1) % segs);
        indices.push(a, b, d, a, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const base = new Float32Array(geo.attributes.position.array);
    return { geo, base };
  }, []);

  useFrame((state) => {
    const a = activeRef.current;
    if (!root.current) return;
    root.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, a));
    applyOpacity(root.current, a);

    const t = state.clock.elapsedTime;
    const cycle = 4.2;
    const phase = (t % cycle) / cycle;
    const impact = 0.34;
    const fall = smoothstep(0, impact, phase);
    const since = Math.max(0, phase - impact);
    const age = since * cycle;

    if (dropRef.current) {
      const falling = phase < impact;
      dropRef.current.visible = falling && a > 0.02;
      dropRef.current.position.y = THREE.MathUtils.lerp(1.72, 0.03, fall * fall);
      const stretch = 1 + (1 - fall) * 0.45;
      dropRef.current.scale.set(0.72, stretch, 0.72);
    }

    const pos = lake.geo.attributes.position;
    const src = lake.base;
    for (let i = 0; i < pos.count; i++) {
      const x = src[i * 3];
      const z = src[i * 3 + 2];
      const r = Math.hypot(x, z);
      let y =
        Math.sin(x * 1.6 + t * 0.65) * 0.01 +
        Math.cos(z * 1.25 - t * 0.5) * 0.008;
      if (since > 0) {
        const rippleFront = age * 1.15;
        const rippleGap = r - rippleFront;
        const ripple =
          Math.sin(rippleGap * 18 - age * 8) *
          Math.exp(-age * 0.9) *
          Math.exp(-rippleGap * rippleGap * 8) *
          0.16;
        const waveFront = age * 0.55;
        const waveGap = r - waveFront;
        const wave =
          Math.sin(waveGap * 3.4 - age * 1.8) *
          Math.exp(-age * 0.18) *
          Math.exp(-waveGap * waveGap * 0.55) *
          Math.min(1, age * 1.2) *
          0.22;
        y += ripple + wave;
      }
      const shore = smoothstep(1.35, 1.85, r);
      pos.setXYZ(i, x, y * (1 - shore), z);
    }
    pos.needsUpdate = true;
    lake.geo.computeVertexNormals();

    if (waterRef.current) {
      waterRef.current.material.transparent = true;
      waterRef.current.material.depthWrite = false;
      waterRef.current.material.opacity = 0.96 * a;
    }

    if (splashRef.current) {
      const kids = splashRef.current.children;
      const burst = since > 0 && age < 0.85 ? age / 0.85 : -1;
      kids.forEach((drop, i) => {
        if (burst < 0) {
          drop.visible = false;
          return;
        }
        drop.visible = true;
        const ang = (i / kids.length) * Math.PI * 2;
        const travel = burst * (0.35 + (i % 3) * 0.08);
        const hop = Math.sin(burst * Math.PI) * (0.28 + (i % 4) * 0.04);
        drop.position.set(Math.cos(ang) * travel, hop, Math.sin(ang) * travel);
        drop.scale.setScalar((1 - burst) * 0.7);
        drop.material.transparent = true;
        drop.material.depthWrite = false;
        drop.material.opacity = (1 - burst) * a;
      });
    }

    if (ringsRef.current) {
      ringsRef.current.children.forEach((ring, i) => {
        const delay = i * 0.18;
        const localAge = age - delay;
        if (since <= 0 || localAge < 0) {
          ring.material.opacity = 0;
          return;
        }
        const ripple = i < 3;
        const maxR = ripple ? 1.35 : 1.62;
        const spread = Math.min(maxR, 0.06 + localAge * (ripple ? 0.62 : 0.34));
        ring.scale.set(spread, spread, spread);
        const fade = 1 - spread / maxR;
        ring.material.transparent = true;
        ring.material.depthWrite = false;
        ring.material.opacity = fade * (ripple ? 0.55 : 0.28) * a;
      });
    }
  });

  return (
    <group ref={root} position={[-0.72, -0.15, 0]}>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.05, 64]} />
        <meshBasicMaterial color="#041018" />
      </mesh>
      <mesh ref={waterRef} geometry={lake.geo} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#1a5670"
          roughness={0.08}
          metalness={0.72}
          emissive="#083044"
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh ref={dropRef} position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshPhysicalMaterial
          color="#e7f7ff"
          roughness={0.04}
          metalness={0.05}
          transmission={0.92}
          thickness={0.18}
          ior={1.33}
          transparent
        />
      </mesh>
      <group ref={splashRef}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} visible={false}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshStandardMaterial color="#f4fbff" roughness={0.08} metalness={0.2} />
          </mesh>
        ))}
      </group>
      <group ref={ringsRef} position={[0, 0.02, 0]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[i < 3 ? 0.985 : 0.9, 1.0, 96]} />
            <meshBasicMaterial
              color={i < 3 ? "#e9f8ff" : "#7ec4e4"}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
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
// STAGE 4 — a photographed brilliant-cut diamond
// =====================================================================
function Stage4Diamond({ activeRef }) {
  const root = useRef();
  const dia = useRef();
  const glint = useRef();
  const sparkleRef = useRef();
  const glintMap = useMemo(() => radialTexture(), []);
  const diamondMap = useTexture("/lore/diamond.png");
  diamondMap.colorSpace = THREE.SRGBColorSpace;
  diamondMap.anisotropy = 8;

  const sparklePositions = useMemo(() => {
    const arr = new Float32Array(28 * 3);
    for (let i = 0; i < 28; i++) {
      const r = 0.15 + Math.random() * 0.72;
      const theta = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(theta) * r;
      arr[i * 3 + 1] = (Math.random() - 0.45) * 0.55;
      arr[i * 3 + 2] = Math.sin(theta) * r * 0.35;
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
      dia.current.position.y = Math.sin(t * 0.8) * 0.04;
      dia.current.material.transparent = true;
      dia.current.material.depthWrite = false;
      dia.current.material.opacity = a;
    }
    if (glint.current) {
      const sweep = (Math.sin(t * 0.7) + 1) / 2;
      glint.current.position.x = THREE.MathUtils.lerp(-0.35, 0.4, sweep);
      glint.current.material.transparent = true;
      glint.current.material.depthWrite = false;
      glint.current.material.opacity = a * (0.18 + Math.sin(t * 1.7) * 0.08);
    }
    if (sparkleRef.current) {
      sparkleRef.current.material.opacity = a * (0.35 + Math.sin(t * 3) * 0.2);
    }
  });

  return (
    <group ref={root} position={[-0.78, 0.08, 0]}>
      <mesh ref={dia} position={[0, 0.05, 0]}>
        <planeGeometry args={[2.35, 2.35]} />
        <meshBasicMaterial
          map={diamondMap}
          transparent
          alphaTest={0.04}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={glint} position={[0, 0.12, 0.02]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial
          map={glintMap}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0.4, 1.2, 1.6]} intensity={6} color="#ffffff" distance={4} decay={2} />
      <Points
        ref={sparkleRef}
        positions={sparklePositions}
        stride={3}
        frustumCulled={false}
      >
        <PointMaterial
          transparent
          color={WHITE}
          size={0.035}
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
