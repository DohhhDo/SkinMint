import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Material, Mesh, Object3D } from "three";

export interface ModelProps {
  url: string;
  wireframe?: boolean;
  draco?: boolean;
  onLoad?: () => void;
}

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true;
}

/**
 * Loads a GLB/glTF and renders it. The scene is cloned so that toggling
 * wireframe (or mounting the same URL twice) never mutates drei's cache.
 */
export function Model({ url, wireframe = false, draco = true, onLoad }: ModelProps) {
  const gltf = useGLTF(url, draco);

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if (!isMesh(o)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const materials: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        // `wireframe` exists on the standard material types we care about.
        (m as Material & { wireframe?: boolean }).wireframe = wireframe;
      }
    });
  }, [scene, wireframe]);

  useEffect(() => {
    onLoad?.();
  }, [onLoad, scene]);

  return <primitive object={scene} />;
}
