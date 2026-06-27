/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the games app lightweight for low-end Android / limited bandwidth:
  // no image optimization service dependency assumptions, minimal bundle surface.
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
