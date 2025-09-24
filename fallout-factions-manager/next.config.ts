/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // używamy lokalnych plików w /public – bez optymalizera
        unoptimized: true,
    },
};

module.exports = nextConfig;
