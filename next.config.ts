import type { NextConfig } from "next";

/**
 * Identifies the deployed build to the running client.
 *
 * Vercel sets VERCEL_GIT_COMMIT_SHA; locally there is no commit to read, so
 * "dev" keeps the comparison well-defined rather than undefined-vs-undefined.
 */
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },

  async headers() {
    return [
      {
        // Every API response carries the build that served it. `authedJson`
        // compares it against the build the running tab was loaded from, so a
        // tab left open across a deploy can be told to reload.
        //
        // This must be live *before* Phase 5 revokes the client's write
        // grants: an old tab still running old JS would otherwise write
        // directly, get a 42501, and fire "SYNC_FAILED" on a loop with no
        // indication that the fix is simply to refresh.
        source: "/api/:path*",
        headers: [{ key: "x-app-build", value: buildId }],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
