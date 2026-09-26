import type { NextConfig } from "next";

// Antete de securitate statice. Content-Security-Policy (cu nonce) e în src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fără indicatorul/popup-ul de dezvoltare Next.js în colțul paginii.
  devIndicators: false,
  // pg are o dependență opțională nativă (pg-native) pe care nu o folosim.
  serverExternalPackages: ["pg"],
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // Rutele din versiunea 1 duc la echivalentele noi.
    return [
      { source: "/orders", destination: "/requests", permanent: true },
      { source: "/contracts", destination: "/bookings", permanent: true },
      { source: "/verification", destination: "/account", permanent: true },
      { source: "/dashboard", destination: "/map", permanent: true },
      { source: "/clusters", destination: "/requests", permanent: true },
      { source: "/chat", destination: "/map", permanent: true },
    ];
  },
};

export default nextConfig;
