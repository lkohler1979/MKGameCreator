import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MK Game Creator",
    short_name: "MK Game Creator",
    description: "Transforme qualquer desenho em um jogo",
    start_url: "/",
    display: "standalone",
    background_color: "#241454",
    theme_color: "#241454",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
