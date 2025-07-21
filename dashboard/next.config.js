/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: process.env.API_URL ? `${process.env.API_URL}/api/:path*` : 'http://localhost:8081/api/:path*',
            },
            {
                source: '/metrics',
                destination: process.env.API_URL ? `${process.env.API_URL}/metrics` : 'http://localhost:8081/metrics',
            },
            {
                source: '/health',
                destination: process.env.API_URL ? `${process.env.API_URL}/health` : 'http://localhost:8081/health',
            },
        ]
    },
}

module.exports = nextConfig