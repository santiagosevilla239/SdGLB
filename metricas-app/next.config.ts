import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "nodemailer",
    "@supabase/ssr",
    "@supabase/supabase-js",
  ],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
