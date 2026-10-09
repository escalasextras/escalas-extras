import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Escalas e Extras",
    short_name: "Escalas",
    description: "Escalas semanais e vagas de extra por casa",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7F4",
    theme_color: "#15211C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
