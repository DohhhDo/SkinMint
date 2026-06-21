export interface PlaceholderProps {
  wireframe?: boolean;
}

/**
 * Shown when no `modelUrl` is provided, so the viewer renders something
 * interactive (and the chrome can be verified) before a model exists.
 */
export function Placeholder({ wireframe = false }: PlaceholderProps) {
  return (
    <mesh castShadow receiveShadow>
      <torusKnotGeometry args={[0.7, 0.26, 160, 32]} />
      <meshStandardMaterial
        color="#6366f1"
        roughness={0.25}
        metalness={0.1}
        wireframe={wireframe}
      />
    </mesh>
  );
}
