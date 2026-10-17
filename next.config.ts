import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
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
    ],
    unoptimized: false,
    dangerouslyAllowLocalIP: true,
    /*
     * Next 16 allows only the qualities listed here and silently coerces any
     * other `quality` prop to the nearest entry — the default allowlist is
     * `[75]` alone. Product photography asks for `quality={90}`, so without
     * this the crispness fix would compile, ship, and do nothing: every image
     * would quietly drop back to 75. See `ProductImage.tsx`.
     */
    qualities: [75, 90],
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