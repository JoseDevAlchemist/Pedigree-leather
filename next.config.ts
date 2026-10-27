import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    loader: "custom",
    loaderFile: "./supabase-image-loader.ts",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      /* Supabase image transformation endpoint: /storage/v1/render/image/public/ */
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
    unoptimized: false,
    dangerouslyAllowLocalIP: true,
    /*
     * Next 16 allows only the qualities listed here and silently coerces any
     * other `quality` prop to the nearest entry. Product photography uses 75:
     * at 800px that is roughly 130 KB from a 2 MB original, where 90 was over
     * 300 KB for the same frame. See `ProductImage.tsx`.
     */
    qualities: [75],
    /*
     * The loader normalises product photographs to 800px on phone-sized
     * candidates and 1200px on desktop ones. Ending the srcset at 1200 avoids
     * advertising 1440–3840px candidates that the loader would collapse anyway.
     * 800 is included so a 480px phone at 3x can select the phone bucket
     * directly instead of falling through to the desktop bucket.
     */
    deviceSizes: [640, 750, 800, 828, 1080, 1200],
  },
};

const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  silent: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;