/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@agent-studio/shared'],
  webpack: (config) => {
    // NodeNext .js 확장자 import를 .ts로도 해석하도록 (workspace 패키지용)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
