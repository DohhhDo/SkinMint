"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Stage } from "@react-three/drei";
import { Model } from "./Model";
import { Placeholder } from "./Placeholder";
import { LoadingOverlay } from "./LoadingOverlay";
import { ModelErrorBoundary } from "./ErrorBoundary";
import type { GeneratedModelViewerProps } from "./types";

/**
 * Drop-in viewer for text-generated 3D models.
 *
 * ```tsx
 * <GeneratedModelViewer modelUrl="https://cdn.example.com/x.glb" autoRotate />
 * ```
 *
 * Works without a `modelUrl` (renders a placeholder), so it can be wired up
 * and styled before the generation backend exists.
 */
export function GeneratedModelViewer({
  modelUrl,
  autoRotate = true,
  autoRotateSpeed = 1,
  environment = "studio",
  showBackground = false,
  backgroundColor,
  showControls = true,
  wireframe = false,
  shadows = true,
  variant = "card",
  height,
  draco = true,
  className,
  style,
  onLoad,
  onError,
}: GeneratedModelViewerProps) {
  const resolvedHeight = height ?? (variant === "full" ? "100%" : 420);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: resolvedHeight,
        ...style,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        camera={{ position: [0, 0.8, 5], fov: 45 }}
        style={{ background: backgroundColor ?? "transparent" }}
      >
        {/* Image-based lighting (and optional background) loads from a CDN, so
            it gets its own Suspense and never blocks the model/placeholder. */}
        <Suspense fallback={null}>
          <Environment preset={environment} background={showBackground} />
        </Suspense>

        {/* environment={null} keeps Stage's built-in light rig, so content is
            lit and visible immediately — before any HDRI finishes loading. */}
        <Stage
          intensity={0.5}
          environment={null}
          adjustCamera={1.2}
          shadows={shadows ? { type: "contact", opacity: 0.5, blur: 2 } : false}
        >
          <ModelErrorBoundary
            onError={onError}
            fallback={<Placeholder wireframe={wireframe} />}
          >
            <Suspense fallback={null}>
              {modelUrl ? (
                <Model
                  url={modelUrl}
                  wireframe={wireframe}
                  draco={draco}
                  onLoad={onLoad}
                />
              ) : (
                <Placeholder wireframe={wireframe} />
              )}
            </Suspense>
          </ModelErrorBoundary>
        </Stage>

        {showControls && (
          <OrbitControls
            makeDefault
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enableDamping
            enablePan={false}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 1.8}
          />
        )}
      </Canvas>

      <LoadingOverlay />
    </div>
  );
}
