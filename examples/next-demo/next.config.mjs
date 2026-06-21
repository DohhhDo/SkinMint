/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace UI packages from source during local development.
  transpilePackages: ["@skinmint/viewer", "@skinmint/react", "@skinmint/embed"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep native / wasm generation deps out of the server bundle; they are
      // require()'d from node_modules at runtime instead.
      config.externals.push({
        sharp: "commonjs sharp",
        draco3dgltf: "commonjs draco3dgltf",
        "@aws-sdk/client-s3": "commonjs @aws-sdk/client-s3",
      });
    }
    return config;
  },
};

export default nextConfig;
