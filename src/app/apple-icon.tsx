import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, #1f1f1f 0%, #090909 58%, #000000 100%)",
          color: "#f5f3ff",
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.08em",
          position: "relative",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 28,
            border: "4px solid rgba(139, 92, 246, 0.34)",
            boxShadow:
              "0 0 20px rgba(139, 92, 246, 0.28), inset 0 0 18px rgba(6, 182, 212, 0.16)",
          }}
        />
        <span
          style={{
            textShadow:
              "0 0 12px rgba(139, 92, 246, 0.4), 0 0 24px rgba(6, 182, 212, 0.15)",
          }}
        >
          E
        </span>
      </div>
    ),
    size
  );
}
