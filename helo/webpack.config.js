const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  if (!config.devServer) {
    config.devServer = {};
  }

  // Ensure public path is set correctly for Replit environment
  config.output.publicPath = '/';

  config.devServer.port = 8085;
  config.devServer.host = '0.0.0.0';
  config.devServer.allowedHosts = 'all';
  
  // Disable manifest error overlay in development if needed
  if (config.devServer.client) {
    config.devServer.client.overlay = {
      errors: true,
      warnings: false,
    };
  }

  return config;
};
