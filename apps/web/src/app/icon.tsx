import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
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
          background: "linear-gradient(135deg, #241454, #5b3fd9)",
          color: "#ffc736",
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        MK
      </div>
    ),
    { ...size },
  );
}
