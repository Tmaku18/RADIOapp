/* eslint-disable react-hooks/purity -- ported 3d scene uses Math.random in useMemo for stable mesh layout */
/* eslint-disable @typescript-eslint/ban-ts-comment -- large 3d port; typed at export boundary */
// @ts-nocheck
'use client';

import { useRef, useMemo, useEffect, type MutableRefObject } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
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

// =====================================================================
// STAGE 1 ??? HIDDEN GEM: miner figure swings pickaxe, gem glows underneath
// =====================================================================
function Stage1Gem({ activeRef, progressRef }) {
  const root = useRef();
  const armRef = useRef();      // pivots the arm + pickaxe together
  const torsoRef = useRef();    // slight bob to match strike
  const headRef = useRef();
  const pickaxe = useRef();
  const gem = useRef();
  const sparksRef = useRef();
  const sparkVelocities = useRef([]);
  const lastStrike = useRef(-99);

  // Build pickaxe geometry once ??? pivot at the bottom of the handle (so it rotates from the hand)
  const pickaxeNode = useMemo(() => {
    const g = new THREE.Group();
    // Handle ??? pivot at y=0 (hand grip), extends up to y=1.0
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.045, 1.1, 16),
      new THREE.MeshStandardMaterial({
        color: "#8B5A2B",
        emissive: "#3a1f0a",
        emissiveIntensity: 0.3,
        roughness: 0.85,
        metalness: 0.1,
      })
    );
    handle.position.y = 0.55;
    g.add(handle);
    // Head capsule across the top of the handle
    const headMat = new THREE.MeshStandardMaterial({
      color: "#cdd6dc",
      emissive: "#202830",
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.95,
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.22), headMat);
    head.position.set(0, 1.1, 0);
    head.rotation.z = Math.PI / 2;
    g.add(head);
    // Pointy tip (the striking end)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 8), headMat);
    tip.position.set(0.55, 1.1, 0);
    tip.rotation.z = -Math.PI / 2;
    g.add(tip);
    return g;
  }, []);

  // Build the miner ??? stylized cyan-glow silhouette so it fits the cyber aesthetic
  const minerNode = useMemo(() => {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#0a0a0f",
      emissive: CYAN,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.55,
      toneMapped: false,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: "#A6FBFF",
      emissive: CYAN,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.7,
      toneMapped: false,
    });

    // Torso (slightly hunched capsule)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 6, 14), bodyMat);
    torso.position.y = 0.15;
    g.add(torso);

    // Hip belt (cyan trim)
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), trimMat);
    belt.position.y = -0.1;
    belt.rotation.x = Math.PI / 2;
    g.add(belt);

    // Legs
    const legGeom = new THREE.CapsuleGeometry(0.07, 0.42, 4, 10);
    const legL = new THREE.Mesh(legGeom, bodyMat);
    legL.position.set(-0.1, -0.42, 0.02);
    legL.rotation.z = 0.05;
    g.add(legL);
    const legR = new THREE.Mesh(legGeom, bodyMat);
    legR.position.set(0.1, -0.42, -0.05);
    legR.rotation.z = -0.05;
    g.add(legR);

    // Left (free) arm ??? slight outward bend
    const armGeom = new THREE.CapsuleGeometry(0.06, 0.38, 4, 10);
    const armL = new THREE.Mesh(armGeom, bodyMat);
    armL.position.set(-0.22, 0.18, 0.05);
    armL.rotation.z = 0.45;
    g.add(armL);

    // Helmet (head + miner lamp ring)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 18), bodyMat);
    head.position.y = 0.5;
    g.add(head);
    const helmRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 24), trimMat);
    helmRim.position.y = 0.48;
    helmRim.rotation.x = Math.PI / 2;
    g.add(helmRim);
    // Lamp glow on the helmet front
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshStandardMaterial({
        color: "#FFFFFF",
        emissive: YELLOW,
        emissiveIntensity: 2.4,
        toneMapped: false,
      })
    );
    lamp.position.set(0, 0.54, 0.14);
    g.add(lamp);

    return g;
  }, []);

  // Build rock chunks
  const rocks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.3;
      arr.push({
        x: Math.cos(angle) * r,
        y: -0.7 + Math.random() * 0.2,
        z: Math.sin(angle) * r * 0.3,
        scale: 0.22 + Math.random() * 0.22,
        rot: Math.random() * Math.PI,
      });
    }
    return arr;
  }, []);

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

    // Pickaxe + arm swing cycle (anticipation ??? strike ??? recovery)
    const cycle = 1.4;
    const time = state.clock.elapsedTime;
    const t = (time % cycle) / cycle;
    // arm rotation: wind back overhead, then strike forward+down toward gem
    // 0..0.55 -> wind up from rest (-0.3) to peak (-2.1 rad, overhead-back)
    // 0.55..0.72 -> strike from -2.1 down to 0.6 rad (forward-down into gem)
    // 0.72..1   -> ease back to rest (-0.3)
    let armAngle;
    if (t < 0.55) {
      armAngle = THREE.MathUtils.lerp(-0.3, -2.1, smoothstep(0, 0.55, t));
    } else if (t < 0.72) {
      armAngle = THREE.MathUtils.lerp(-2.1, 0.6, smoothstep(0.55, 0.72, t));
    } else {
      armAngle = THREE.MathUtils.lerp(0.6, -0.3, smoothstep(0.72, 1, t));
    }
    if (armRef.current) armRef.current.rotation.z = armAngle;

    // Torso bob ??? small forward lean on strike
    if (torsoRef.current) {
      const lean = t > 0.55 && t < 0.78 ? smoothstep(0.55, 0.72, t) * (1 - smoothstep(0.72, 0.85, t)) : 0;
      torsoRef.current.rotation.z = lean * 0.18;
      torsoRef.current.position.y = -lean * 0.04;
    }
    if (headRef.current) {
      headRef.current.rotation.x = -0.15 - (t > 0.55 && t < 0.85 ? 0.1 : 0);
    }

    // Strike detection ??? emit sparks at the moment the pickaxe hits the gem
    const isStrikeFrame = t > 0.7 && t < 0.74;
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

    // Gem glow rises with each strike
    if (gem.current) {
      const sinceStrike = time - lastStrike.current;
      const flash = Math.max(0, 1 - sinceStrike / 0.5);
      const baseGlow = 0.6 + local * 0.6;
      gem.current.material.emissiveIntensity = baseGlow + flash * 2;
      gem.current.position.y = -0.55 + Math.sin(time * 1.6) * 0.02;
      gem.current.rotation.y = time * 0.5;
    }
  });

  return (
    <group ref={root}>
      {/* Ground plate */}
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#161616" roughness={1} metalness={0.1} />
      </mesh>

      {/* Rock chunks around the gem */}
      {rocks.map((r, i) => (
        <mesh
          key={i}
          position={[r.x, r.y, r.z]}
          rotation={[r.rot, r.rot * 0.7, r.rot * 0.4]}
          scale={r.scale}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#2d2d35"
            roughness={0.9}
            metalness={0.15}
            flatShading
          />
        </mesh>
      ))}

      {/* The gem ??? small octahedron peeking out of the ground */}
      <mesh ref={gem} position={[0, -0.55, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color={YELLOW}
          emissive={YELLOW}
          emissiveIntensity={0.8}
          roughness={0.15}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>

      {/* Glow ring under the gem */}
      <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.55, 48]} />
        <meshBasicMaterial
          color={YELLOW}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Miner figure ??? stands to the left, swings the pickaxe at the gem */}
      <group position={[-1.0, -0.3, 0]}>
        <group ref={torsoRef}>
          <primitive object={minerNode} />
          {/* Arm pivot at the right shoulder, holding the pickaxe */}
          <group ref={armRef} position={[0.18, 0.32, 0.05]}>
            {/* Right arm (capsule) extending from shoulder downward; pickaxe attached at the hand */}
            <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.06, 0.38, 4, 10]} />
              <meshStandardMaterial
                color="#0a0a0f"
                emissive={CYAN}
                emissiveIntensity={0.45}
                roughness={0.35}
                metalness={0.55}
                toneMapped={false}
              />
            </mesh>
            {/* Pickaxe ??? pivots from the hand (end of arm) */}
            <group ref={pickaxe} position={[0.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <primitive object={pickaxeNode} />
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
          size={0.08}
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
      <StageDriver progressRef={progressRef} />
    </Canvas>
  );
}
