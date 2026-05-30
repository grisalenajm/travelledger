/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Scan pages use force-dynamic — no prerender needed
  webpack(webpackConfig) {
    // Allow importing PNGs from leaflet's node_modules (marker icons)
    webpackConfig.module.rules.push({
      test: /\.(png|jpg|jpeg|gif)$/i,
      include: /node_modules[\\/]leaflet/,
      type: "asset/resource",
    })
    return webpackConfig
  },
}

export default config
