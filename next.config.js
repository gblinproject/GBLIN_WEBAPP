/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-wagmi', '@reown/appkit-scaffold-ui', 'wagmi', '@wagmi/core', 'viem', '@phosphor-icons/webcomponents'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'fs': false,
      'net': false,
      'tls': false,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    
    // Fix per WebSocket su iOS Safari - aggiungi polyfill globale
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'ws': false,
      };
    }
    
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

module.exports = nextConfig;
