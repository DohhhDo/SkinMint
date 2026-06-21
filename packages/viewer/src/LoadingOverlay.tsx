import { useProgress } from "@react-three/drei";

/**
 * DOM overlay that reads drei's global loading store. Rendered as a sibling
 * of <Canvas> (not inside it), so it does not need R3F context.
 */
export function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        pointerEvents: "none",
        color: "#475569",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 140,
          height: 4,
          borderRadius: 999,
          background: "rgba(100,116,139,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#6366f1",
            transition: "width 120ms linear",
          }}
        />
      </div>
      <span>{Math.round(progress)}%</span>
    </div>
  );
}
