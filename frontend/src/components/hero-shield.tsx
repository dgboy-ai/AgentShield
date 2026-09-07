"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

// ultra-light dome - static + slow rotation only, no instance updates
function ShieldDome() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.015;
  });
  return (
    <group>
      <mesh ref={ref} position={[0, 0.15, -2.2]}>
        <sphereGeometry args={[3.4, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshBasicMaterial color="#0D7C5F" transparent opacity={0.055} wireframe />
      </mesh>
      <mesh position={[0, 0.15, -2.2]}>
        <sphereGeometry args={[3.38, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
      {/* subtle wall grid - horizontal lines */}
      {[ -0.8, -0.25, 0.3, 0.85 ].map((y, i) => (
        <mesh key={i} position={[0, y, -2.0]} rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[2.1 + i*0.35, 2.13 + i*0.35, 48]} />
          <meshBasicMaterial color="#10B981" transparent opacity={0.07 - i*0.012} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// tiny edge orbs - pushed to background, not covering text
function EdgeOrbs() {
  const orbs = useMemo(() => [
    { pos: [-2.6,  0.85, -1.2] as const, c: "#10B981", s: 0.11 },
    { pos: [ 2.55,  0.65, -1.0] as const, c: "#06B6D4", s: 0.09 },
    { pos: [-2.2, -0.85, -1.4] as const, c: "#8B5CF6", s: 0.10 },
    { pos: [ 2.1, -0.75, -1.3] as const, c: "#F59E0B", s: 0.08 },
  ], []);
  return (
    <group>
      {orbs.map((o, i) => (
        <mesh key={i} position={[o.pos[0], o.pos[1], o.pos[2]]}>
          <sphereGeometry args={[o.s, 12, 12]} />
          <meshBasicMaterial color={o.c} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Dust() {
  const count = 140;
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i*3]   = (Math.random() - 0.5) * 13;
      a[i*3+1] = (Math.random() - 0.5) * 8;
      a[i*3+2] = -1.5 - Math.random()*1.5;
    }
    return a;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#10B981" transparent opacity={0.28} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function HeroShield() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "radial-gradient(ellipse 85% 70% at 50% 38%, #0A2E22 0%, #061A14 30%, #020412 68%)" }}>
      {/* CSS shield-wall texture behind canvas - hexagonal grid subtle */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.8) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)"
      }} />
      <div className="absolute inset-0 opacity-30" style={{
        background: "radial-gradient(ellipse 420px 420px at 22% 50%, rgba(16,185,129,0.15), transparent 70%), radial-gradient(ellipse 380px 380px at 78% 65%, rgba(6,182,212,0.10), transparent 70%)"
      }} />

      <Canvas
        camera={{ position: [0, 0.2, 5.8], fov: 48 }}
        dpr={[1, 1.2]}
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%", display: "block" }}
        frameloop="always"
        onCreated={({ gl }) => gl.setClearColor("#020412", 1)}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <Dust />
          <ShieldDome />
          <EdgeOrbs />
        </Suspense>
      </Canvas>

      {/* vertical wall highlight */}
      <div className="absolute left-1/2 top-[14%] -translate-x-1/2 w-[86%] max-w-[1100px] h-[58%] rounded-[3rem] pointer-events-none" style={{
        background: "linear-gradient(to bottom, rgba(16,185,129,0.06), transparent 22%, transparent 78%, rgba(2,4,18,0.5))",
        border: "1px solid rgba(16,185,129,0.10)",
        boxShadow: "inset 0 1px 0 rgba(16,185,129,0.08), 0 0 80px rgba(16,185,129,0.08)"
      }} />

      {/* vignette for text readability */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(2,4,18,0.10) 0%, transparent 35%, rgba(2,4,18,0.55) 82%, #020412 100%)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 48%, rgba(2,4,18,0.45) 100%)" }} />
    </div>
  );
}
