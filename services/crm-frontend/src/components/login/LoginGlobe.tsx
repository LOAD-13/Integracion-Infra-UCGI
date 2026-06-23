import { useEffect, useRef } from "react";
import * as THREE from "three";

// Esfera wireframe + halo + partículas, animada con rAF. Lazy-loaded desde LoginPage
// para que three.js (~600KB gz) no entre al bundle principal.
export default function LoginGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // jsdom (vitest) y entornos sin WebGL — bajamos en silencio sin animación.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Globo principal — wireframe en cyan brand.
    const globeGeom = new THREE.SphereGeometry(2, 48, 32);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x28c2e2,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const globe = new THREE.Mesh(globeGeom, globeMat);
    scene.add(globe);

    // Esfera interna sólida con leve glow.
    const innerGeom = new THREE.SphereGeometry(1.94, 48, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x0a1f3a,
      transparent: true,
      opacity: 0.85,
    });
    const inner = new THREE.Mesh(innerGeom, innerMat);
    scene.add(inner);

    // Halo brillante alrededor.
    const haloGeom = new THREE.SphereGeometry(2.18, 48, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x15a8c8,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    scene.add(halo);

    // Partículas flotando.
    const particleCount = 280;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 3.2 + Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x28c2e2,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      globe.rotation.y = t * 0.18;
      globe.rotation.x = Math.sin(t * 0.12) * 0.1;
      inner.rotation.copy(globe.rotation);
      particles.rotation.y = -t * 0.05;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      globeGeom.dispose();
      globeMat.dispose();
      innerGeom.dispose();
      innerMat.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    />
  );
}
