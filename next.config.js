/** @type {import('next').NextConfig} */
const nextConfig = {
  // @x402/next carica '@x402/extensions/bazaar' con un import dinamico
  // (webpackIgnore) risolto a runtime da node_modules: va marcato esterno
  // e incluso nel file tracing, altrimenti ERR_MODULE_NOT_FOUND nei log.
  serverExternalPackages: ['@x402/extensions'],
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@x402/extensions/**'],
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/.well-known/x402',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ws: false,
      };
    }

    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

module.exports = nextConfig;
