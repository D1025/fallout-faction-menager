/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Use local files from /public without Next image optimizer
        unoptimized: true,
    },
};

module.exports = nextConfig;
