/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.OUTPUT_STANDALONE ? 'standalone' : 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
