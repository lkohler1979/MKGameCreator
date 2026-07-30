import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #241454, #5b3fd9)",
          color: "#ffc736",
          fontSize: 220,
          fontWeight: 800,
        }}
      >
        MK
      </div>
    ),
    { width: 512, height: 512 },
  );
}
