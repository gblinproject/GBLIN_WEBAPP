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
  // Crawlers probe common contact/about paths and locale variants the site
  // never had (language is a client-side toggle, not a URL segment). These
  // were returning 404 in the Vercel logs. Redirect them to real destinations
  // so bots and humans land somewhere instead of hitting an error.
  async redirects() {
    return [
      // "about the company" variants → homepage (solo project, no separate page)
      { source: '/company', destination: '/', permanent: true },
      { source: '/nosotros', destination: '/', permanent: true },
      // contact variants → homepage (contact is the in-nav menu + email)
      { source: '/contact', destination: '/', permanent: true },
      { source: '/contatti', destination: '/', permanent: true },
      { source: '/contato', destination: '/', permanent: true },
      { source: '/contacto', destination: '/', permanent: true },
      { source: '/en/contact', destination: '/', permanent: true },
      { source: '/es/contacto', destination: '/', permanent: true },
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
