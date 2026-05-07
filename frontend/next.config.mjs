/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Scan pages use force-dynamic — no prerender needed
}

export default config
