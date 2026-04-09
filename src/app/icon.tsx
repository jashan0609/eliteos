import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 238,
          fontWeight: 800,
          letterSpacing: "-0.08em",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 36,
            borderRadius: 112,
            border: "10px solid rgba(139, 92, 246, 0.34)",
            boxShadow:
              "0 0 50px rgba(139, 92, 246, 0.28), inset 0 0 40px rgba(6, 182, 212, 0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 84,
            borderRadius: 88,
            background:
              "linear-gradient(145deg, rgba(139,92,246,0.18), rgba(6,182,212,0.08))",
          }}
        />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            textShadow:
              "0 0 24px rgba(139, 92, 246, 0.4), 0 0 50px rgba(6, 182, 212, 0.15)",
          }}
        >
          E
        </span>
      </div>
    ),
    size
  );
}
