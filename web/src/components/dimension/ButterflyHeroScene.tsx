'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const CYAN = '#00F0FF';
const CYAN_DEEP = '#22D3EE';
const NOTE_CHARS = ['\u266A', '\u266B', '\u266C', '\u2669'];

/** Deterministic 0..1 value for stable particle seeds (avoids Math.random in render). */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeNoteTexture(char: string) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, size, size);
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#9EF1FF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 92px serif';
  ctx.fillText(char, size / 2, size / 2 + 4);
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#E0FBFF';
  ctx.fillText(char, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

type BarDef = {
  x: number;
  row: number;
  baseH: number;
  phase: number;
};

function Wing({ side = 1 }: { side?: number }) {
  const barsRef = useRef<(THREE.Mesh | null)[]>([]);
  const archRef = useRef<THREE.Group>(null);

  const bars = useMemo<BarDef[]>(() => {
    const arr: BarDef[] = [];
    const cols = 14;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1);
      const x = THREE.MathUtils.lerp(0.15, 1.85, t) * side;
      const env = Math.sin(t * Math.PI);
      arr.push({
        x,
        row: 1,
        baseH: 0.18 + env * 0.95,
        phase: i * 0.31 + (side > 0 ? 0 : 1.7),
      });
      arr.push({
        x,
        row: -1,
        baseH: 0.16 + env * 0.6,
        phase: i * 0.37 + (side > 0 ? 0.8 : 2.4),
      });
    }
    return arr;
  }, [side]);

  const archGeom = useMemo(() => {
    const w = 2.0;
    const topCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(0.6, 1.25, 0),
      new THREE.Vector3(w * 0.9, 0.9, 0),
      new THREE.Vector3(w, 0.0, 0),
    );
    const botCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, -0.12, 0),
      new THREE.Vector3(0.6, -1.25, 0),
      new THREE.Vector3(w * 0.9, -0.9, 0),
      new THREE.Vector3(w, 0.0, 0),
    );
    return {
      top: new THREE.TubeGeometry(topCurve, 64, 0.06, 12, false),
      bot: new THREE.TubeGeometry(botCurve, 64, 0.06, 12, false),
    };
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
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 1.1 + Math.sin(t * 6 + def.phase) * 0.6;
    });
    if (archRef.current) {
      const child = archRef.current.children[0] as THREE.Mesh | undefined;
      const mat = child?.material as THREE.MeshStandardMaterial | undefined;
      if (mat) mat.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * 0.25;
    }
  });

  return (
    <group scale={[side, 1, 1]}>
      <group>
        {bars.map((def, i) => (
          <mesh
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
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

function Butterfly({
  burstTimeRef,
  onBurst,
}: {
  burstTimeRef: React.MutableRefObject<number>;
  onBurst: (kind: 'hover' | 'click') => void;
}) {
  const leftHinge = useRef<THREE.Group>(null);
  const rightHinge = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const root = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;
    const since = now - (burstTimeRef.current ?? -10);
    const bp = Math.min(Math.max(since / 1.4, 0), 1);
    const burstAngle = bp > 0 && bp < 1 ? Math.sin(bp * Math.PI) * 1.35 : 0;
    const burstScale = bp > 0 && bp < 1 ? 1 + Math.sin(bp * Math.PI) * 0.14 : 1;
    const burstFlash = bp > 0 && bp < 1 ? Math.sin(bp * Math.PI) * 2.4 : 0;

    const flap = Math.sin(t * 4.4) * 0.6 + 0.2;
    if (rightHinge.current) rightHinge.current.rotation.y = -flap - burstAngle;
    if (leftHinge.current) leftHinge.current.rotation.y = flap + burstAngle;
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * 0.18;
      root.current.rotation.z = Math.sin(t * 0.8) * 0.04;
      root.current.scale.setScalar(burstScale);
    }
    if (body.current) {
      const mat = body.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 1.6 + Math.sin(t * 4.4) * 0.4 + burstFlash;
    }
  });

  const hitHandlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      onBurst('hover');
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto';
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onBurst('click');
    },
  };

  return (
    <group ref={root}>
      <mesh {...hitHandlers} position={[0, 0, 0.1]}>
        <planeGeometry args={[5.2, 2.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#A6FBFF" emissive={CYAN} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      <group ref={rightHinge}>
        <Wing side={1} />
      </group>
      <group ref={leftHinge}>
        <Wing side={-1} />
      </group>
    </group>
  );
}

type NoteSeed = {
  tex: THREE.CanvasTexture;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  spin: number;
};

function NoteBurst({
  burstTimeRef,
  count = 56,
}: {
  burstTimeRef: React.MutableRefObject<number>;
  count?: number;
}) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const textures = useMemo(() => NOTE_CHARS.map(makeNoteTexture), []);
  const seeds = useMemo<NoteSeed[]>(() => {
    const arr: NoteSeed[] = [];
    for (let i = 0; i < count; i++) {
      const r1 = seededRand(i * 7 + 1);
      const r2 = seededRand(i * 7 + 2);
      const r3 = seededRand(i * 7 + 3);
      const r4 = seededRand(i * 7 + 4);
      const r5 = seededRand(i * 7 + 5);
      const angle = (i / count) * Math.PI * 2 + r1 * 0.4;
      const speed = 3.2 + r2 * 3.0;
      arr.push({
        tex: textures[i % textures.length],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.85 + 0.6,
        vz: (r3 - 0.5) * 1.5,
        size: 0.55 + r4 * 0.5,
        spin: (r5 - 0.5) * 5,
      });
    }
    return arr;
  }, [count, textures]);

  useFrame(() => {
    const now = performance.now() / 1000;
    const since = now - (burstTimeRef.current ?? -10);
    const active = since >= 0 && since < 2.2;
    refs.current.forEach((sprite, i) => {
      if (!sprite) return;
      if (!active) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;
      const s = seeds[i];
      const tau = since;
      sprite.position.x = s.vx * tau;
      sprite.position.y = s.vy * tau - 0.4 * tau * tau;
      sprite.position.z = s.vz * tau;
      const life = THREE.MathUtils.clamp(tau / 2.0, 0, 1);
      const fade = life < 0.1 ? life / 0.1 : 1 - (life - 0.1) / 0.9;
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, fade);
      sprite.scale.setScalar(s.size * (0.6 + fade * 0.7));
      mat.rotation = s.spin * tau;
    });
  });

  return (
    <group>
      {seeds.map((s, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <spriteMaterial
            map={s.tex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            opacity={0}
          />
        </sprite>
      ))}
    </group>
  );
}

function ParticleDust({ count = 600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r1 = seededRand(i * 11 + 1);
      const r2 = seededRand(i * 11 + 2);
      const r3 = seededRand(i * 11 + 3);
      const r4 = seededRand(i * 11 + 4);
      const r5 = seededRand(i * 11 + 5);
      const r6 = seededRand(i * 11 + 6);
      positions[i * 3] = (r1 - 0.5) * 4;
      positions[i * 3 + 1] = (r2 - 0.5) * 2.5;
      positions[i * 3 + 2] = (r3 - 0.5) * 2.5;
      velocities[i * 3] = (r4 - 0.5) * 0.002;
      velocities[i * 3 + 1] = r5 * 0.006 + 0.002;
      velocities[i * 3 + 2] = (r6 - 0.5) * 0.002;
    }
    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    const geom = ref.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
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

type MusicNoteDef = {
  tex: THREE.CanvasTexture;
  offset: number;
  speed: number;
  side: number;
  amp: number;
  spawnX: number;
  size: number;
};

function MusicNotes({ count = 14 }: { count?: number }) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const textures = useMemo(() => NOTE_CHARS.map(makeNoteTexture), []);
  const notes = useMemo<MusicNoteDef[]>(() => {
    const arr: MusicNoteDef[] = [];
    for (let i = 0; i < count; i++) {
      const r1 = seededRand(i * 13 + 1);
      const r2 = seededRand(i * 13 + 2);
      const r3 = seededRand(i * 13 + 3);
      const r4 = seededRand(i * 13 + 4);
      const r5 = seededRand(i * 13 + 5);
      const r6 = seededRand(i * 13 + 6);
      arr.push({
        tex: textures[i % textures.length],
        offset: r1 * 6,
        speed: 0.45 + r2 * 0.4,
        side: r3 < 0.5 ? -1 : 1,
        amp: 0.6 + r4 * 0.9,
        spawnX: (r5 - 0.5) * 1.6,
        size: 0.4 + r6 * 0.35,
      });
    }
    return arr;
  }, [count, textures]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((sprite, i) => {
      if (!sprite) return;
      const def = notes[i];
      const life = (t * def.speed + def.offset) % 6;
      const p = life / 6;
      sprite.position.x = def.spawnX + def.side * Math.sin(life * 1.4) * def.amp;
      sprite.position.y = -1.2 + p * 4.6;
      sprite.position.z = Math.cos(life * 0.8 + i) * 0.4;
      const fade = Math.sin(p * Math.PI);
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.opacity = fade * 0.95;
      sprite.scale.setScalar(def.size * (0.6 + fade * 0.6));
      mat.rotation = Math.sin(life * 2) * 0.4;
    });
  });

  return (
    <group>
      {notes.map((n, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
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

function StarField() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r1 = seededRand(i * 17 + 1);
      const r2 = seededRand(i * 17 + 2);
      const r3 = seededRand(i * 17 + 3);
      const r = 7 + r1 * 9;
      const theta = r2 * Math.PI * 2;
      const phi = Math.acos(2 * r3 - 1);
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

function SceneContents() {
  const burstTimeRef = useRef(-10);
  const lastBurstHoverRef = useRef(-10);

  const triggerBurst = (kind: 'hover' | 'click') => {
    const now = performance.now() / 1000;
    const since = now - burstTimeRef.current;
    if (kind === 'hover' && since < 1.6) return;
    if (kind === 'click' && since < 0.6) return;
    if (kind === 'hover' && now - lastBurstHoverRef.current < 4) return;
    if (kind === 'hover') lastBurstHoverRef.current = now;
    burstTimeRef.current = now;
  };

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 9, 22]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 3, 4]} intensity={2.6} color={CYAN} />
      <pointLight position={[-4, -2, 3]} intensity={1.6} color="#00B7C9" />
      <pointLight position={[0, 0, -3]} intensity={1.2} color={CYAN} />
      <StarField />
      <group position={[2.4, 0.2, 0]}>
        <ParticleDust />
        <Butterfly burstTimeRef={burstTimeRef} onBurst={triggerBurst} />
        <MusicNotes />
        <NoteBurst burstTimeRef={burstTimeRef} />
      </group>
    </>
  );
}

export function ButterflyHeroScene() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.2, 6.4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneContents />
    </Canvas>
  );
}
