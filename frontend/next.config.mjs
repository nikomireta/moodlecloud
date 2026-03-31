/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/privasi",
        destination: "/kebijakan-privasi",
        permanent: true,
      },
      {
        source: "/syarat",
        destination: "/syarat-layanan",
        permanent: true,
      },
      {
        source: "/syarat-ketentuan",
        destination: "/syarat-layanan",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
