import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * MorphScene — four shapes (caterpillar capsule -> cocoon ellipsoid -> butterfly wings -> diamond octahedron)
 * Driven by a scroll progress 0..1 ref passed via prop. We blend visibility + scale + rotation.
 */
function ShapeStage({ progressRef }) {
  const caterpillar = useRef();
  const cocoon = useRef();
  const butterflyL = useRef();
  const butterflyR = useRef();
  const diamond = useRef();
  const group = useRef();

  useFrame((state, dt) => {
    const p = progressRef.current ?? 0;
    const t = state.clock.elapsedTime;

    // 4 stages: 0..0.25, 0.25..0.5, 0.5..0.75, 0.75..1
    const stage1 = THREE.MathUtils.smoothstep(p, 0.0, 0.22);    // caterpillar fades out
    const stage2In = THREE.MathUtils.smoothstep(p, 0.18, 0.4);  // cocoon appears
    const stage2Out = THREE.MathUtils.smoothstep(p, 0.45, 0.6); // cocoon fades
    const stage3 = THREE.MathUtils.smoothstep(p, 0.55, 0.78);   // butterfly appears
    const stage3Out = THREE.MathUtils.smoothstep(p, 0.78, 0.9); // butterfly morphs
    const stage4 = THREE.MathUtils.smoothstep(p, 0.82, 1.0);    // diamond crystallizes

    if (caterpillar.current) {
      const s = THREE.MathUtils.lerp(1, 0.0, stage1);
      caterpillar.current.scale.setScalar(s);
      caterpillar.current.rotation.z += dt * 0.4;
      caterpillar.current.position.y = Math.sin(t * 1.3) * 0.15;
    }
    if (cocoon.current) {
      cocoon.current.scale.setScalar(THREE.MathUtils.lerp(0.1, 1, stage2In) * (1 - stage2Out * 0.6));
      cocoon.current.material.opacity = stage2In * (1 - stage2Out);
      cocoon.current.rotation.y = t * 0.6;
      const pulse = 1 + Math.sin(t * 4) * 0.04 * (stage2In - stage2Out);
      cocoon.current.scale.multiplyScalar(pulse);
    }
    if (butterflyL.current && butterflyR.current) {
      const op = stage3 * (1 - stage3Out * 0.9);
      butterflyL.current.material.opacity = op;
      butterflyR.current.material.opacity = op;
      const flap = Math.sin(t * 4.5) * 0.7 * stage3;
      butterflyL.current.rotation.y = -0.4 - flap;
      butterflyR.current.rotation.y = 0.4 + flap;
      const lift = THREE.MathUtils.lerp(0, 0.6, stage3);
      butterflyL.current.position.y = lift + Math.sin(t * 2) * 0.05;
      butterflyR.current.position.y = lift + Math.sin(t * 2) * 0.05;
      const s = THREE.MathUtils.lerp(0.6, 1, stage3);
      butterflyL.current.scale.setScalar(s);
      butterflyR.current.scale.setScalar(s);
    }
    if (diamond.current) {
      diamond.current.material.opacity = stage4;
      diamond.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 1.4, stage4));
      diamond.current.rotation.x = t * 0.5;
      diamond.current.rotation.y = t * 0.7;
    }
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, p * Math.PI * 0.3, 0.05);
    }
  });

  // Butterfly wing geometry — extruded plane heart-ish
  const wingShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.4, 0.6, 1.4, 1.1, 1.6, 0.4);
    s.bezierCurveTo(1.7, 0.0, 1.5, -0.4, 1.2, -0.5);
    s.bezierCurveTo(0.9, -0.6, 0.4, -0.4, 0, 0);
    return s;
  }, []);

  return (
    <group ref={group}>
      {/* Caterpillar — segmented sphere chain */}
      <group ref={caterpillar}>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((px, i) => (
          <mesh key={i} position={[px, 0, 0]}>
            <sphereGeometry args={[0.35 - Math.abs(px) * 0.08, 24, 24]} />
            <meshStandardMaterial
              color={i % 2 ? "#00F0FF" : "#F4D03F"}
              emissive={i % 2 ? "#00F0FF" : "#F4D03F"}
              emissiveIntensity={0.4}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        ))}
      </group>

      {/* Cocoon — elongated ellipsoid */}
      <mesh ref={cocoon} scale={[0.6, 1.2, 0.6]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial
          color="#FF007F"
          emissive="#FF007F"
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          roughness={0.15}
          metalness={0.85}
          wireframe={false}
        />
      </mesh>

      {/* Butterfly wings */}
      <mesh ref={butterflyL} position={[-0.2, 0, 0]} rotation={[0, -0.4, 0]}>
        <extrudeGeometry args={[wingShape, { depth: 0.04, bevelEnabled: false, curveSegments: 24 }]} />
        <meshStandardMaterial
          color="#00F0FF"
          emissive="#00F0FF"
          emissiveIntensity={0.8}
          transparent
          opacity={0}
          roughness={0.2}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={butterflyR} position={[0.2, 0, 0]} rotation={[0, Math.PI + 0.4, 0]} scale={[-1, 1, 1]}>
        <extrudeGeometry args={[wingShape, { depth: 0.04, bevelEnabled: false, curveSegments: 24 }]} />
        <meshStandardMaterial
          color="#FF007F"
          emissive="#FF007F"
          emissiveIntensity={0.8}
          transparent
          opacity={0}
          roughness={0.2}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Diamond */}
      <mesh ref={diamond}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#00F0FF"
          emissiveIntensity={0.5}
          transparent
          opacity={0}
          roughness={0.05}
          metalness={1.0}
        />
      </mesh>
    </group>
  );
}

export default function MetamorphosisScene({ progressRef }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 3, 3]} intensity={2.5} color="#00F0FF" />
      <pointLight position={[-3, -2, 2]} intensity={2.2} color="#FF007F" />
      <pointLight position={[0, 4, -3]} intensity={1.4} color="#F4D03F" />
      <ShapeStage progressRef={progressRef} />
    </Canvas>
  );
}
