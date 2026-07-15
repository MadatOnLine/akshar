const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const cryptoPath = path.resolve(projectRoot, '../crypto');
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');

const defaultConfig = getDefaultConfig(projectRoot);

/**
 * Metro configuration — resolves @akshar/crypto/face-hash without Node-only exports.
 */
const config = {
  watchFolders: [cryptoPath],
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      '@babel/runtime': path.join(mobileNodeModules, '@babel/runtime'),
      'node:crypto': path.resolve(projectRoot, 'mock-crypto.js'),
      crypto: path.resolve(projectRoot, 'mock-crypto.js'),
    },
    nodeModulesPaths: [mobileNodeModules],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@akshar/crypto/face-hash') {
        return {
          filePath: path.join(cryptoPath, 'dist/cjs/face-hash.js'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
