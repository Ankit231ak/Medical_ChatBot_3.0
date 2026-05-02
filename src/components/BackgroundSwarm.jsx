import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

extend({ UnrealBloomPass });

const ParticleSwarm = () => {
  const meshRef = useRef();
  const count = 20000;
  const speedMult = 1;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const color = pColor; // Alias for user code compatibility
  
  const positions = useMemo(() => {
     const pos = [];
     for(let i=0; i<count; i++) pos.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
     return pos;
  }, []);

  // Material & Geom
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);

  const PARAMS = useMemo(() => ({"field":0.1,"morph":0,"flow":0.1,"jitter":0.651}), []);
  const addControl = (id, l, min, max, val) => {
      return PARAMS[id] !== undefined ? PARAMS[id] : val;
  };
  const setInfo = () => {};
  const annotate = () => {};

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speedMult;
    const THREE_LIB = THREE;

    if(material.uniforms && material.uniforms.uTime) {
         material.uniforms.uTime.value = time;
    }

    for (let i = 0; i < count; i++) {
        // USER CODE START
        const fieldStrength = addControl("field", "Fractal Influence", 0.1, 5.0, 1.2);
        const morph = addControl("morph", "Helix Morph", 0.0, 1.0, 0.4);
        const flowSpeed = addControl("flow", "Flow Velocity", 0.1, 2.0, 0.5);
        const jitter = addControl("jitter", "Particle Vibration", 0.1, 3.0, 1.0);
        
        const n = i / count;
        const t = time * 0.2 * flowSpeed;
        
        // Математическая база: спираль с динамическим радиусом
        const angle = n * Math.PI * 100 + t;
        const radius = 25 + Math.sin(angle * 0.1) * 10;
        
        // Вычисление базовых координат
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;
        let y = (n - 0.5) * 180;
        
        // Фрактальный шум
        const noiseX = Math.sin(n * 50 + t) * Math.cos(n * 20) * fieldStrength * 10;
        const noiseY = Math.cos(n * 40 + t) * fieldStrength * 10;
        const noiseZ = Math.tan(Math.sin(n * 10 + t)) * fieldStrength * 2;
        
        // Локальная микро-анимация (вибрация частиц)
        // Используем индивидуальную фазу для каждой частицы на основе индекса 'i'
        const vibX = Math.sin(time * 3.0 + i) * jitter;
        const vibY = Math.cos(time * 2.5 + i * 0.5) * jitter;
        const vibZ = Math.sin(time * 4.0 - i) * jitter;
        
        // Смешивание и добавление движения
        const finalX = x + (noiseX * (1.0 - morph)) + vibX;
        const finalY = y + noiseY + vibY;
        const finalZ = z + (noiseZ * (1.0 - morph)) + vibZ;
        
        // Масштабирование
        const finalZoom = 1.8;
        target.set(finalX * finalZoom, finalY * finalZoom, finalZ * finalZoom);
        
        // Цветовая палитра: Монохромный голубой (Cyan/Azure)
        // Варьируем только яркость для создания глубины и эффекта мерцания
        const pulse = Math.sin(time * 2.0 + n * 10.0) * 0.2 + 0.6;
        const lightness = 0.3 + (Math.pow(Math.sin(n * Math.PI + t * 2.0), 4) * 0.4);
        
        // Все частицы в голубой гамме (HSL: 0.55 - 0.6)
        if (i % 10 === 0) {
        // Информационные узлы — ярко-голубые/белые
        color.setHSL(0.55, 1.0, lightness + 0.2);
        } else {
        // Основная масса — глубокий голубой
        color.setHSL(0.58, 1.0, lightness * pulse);
        }
        
        if (i === 0) {
        setInfo("Голубая Эфирная Матрица", "Кинетическая модель ДНК в монохромном спектре. Добавлена микро-вибрация частиц и пульсирующая яркость.");
        }
        // USER CODE END

        positions[i].lerp(target, 0.1);
        dummy.position.copy(positions[i]);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
};

export default function BackgroundSwarm() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 100], fov: 60 }} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <fog attach="fog" args={['#000000', 0.01]} />
        <ParticleSwarm />
        <OrbitControls autoRotate={true} autoRotateSpeed={0.5} enableZoom={false} enablePan={false} enableRotate={false} />
        <Effects disableGamma>
            <unrealBloomPass threshold={0} strength={2.0} radius={0.25} />
        </Effects>
      </Canvas>
    </div>
  );
}
