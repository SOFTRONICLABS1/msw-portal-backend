module.exports = {
  apps: [
    {
      name: "MSW Portal Backend",
      script: "/Deployment/backend/server.js",
      env: {
        NODE_ENV: 'production',
        PORT: 85,
        HTTPS: true
      },
    },
  ],
};
