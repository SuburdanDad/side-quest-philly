import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Side Quest Philadelphia",
    short_name: "SQ Philly",
    description:
      "Neighborhood scavenger hunts for Philadelphia — summer 2026.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#004C54",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
