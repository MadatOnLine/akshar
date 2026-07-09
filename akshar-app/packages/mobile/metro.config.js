const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');

const config = {
  watchFolders: [
    path.resolve(__dirname, '../crypto'),
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
    extraNodeModules: {
      'node:crypto': path.resolve(__dirname, 'mock-crypto.js'),
      'crypto': path.resolve(__dirname, 'mock-crypto.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
