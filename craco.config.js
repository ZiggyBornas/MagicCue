const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for node modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        url: false,
        util: false,
        zlib: false,
        stream: false,
      };

      // Configure worker-loader for PDF.js worker
      webpackConfig.module.rules.push({
        test: /pdf\.worker\.entry/,
        type: 'asset/resource',
        generator: {
          filename: 'static/js/[name].[hash:8][ext]'
        }
      });

      // Configure module rules
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });

      return webpackConfig;
    },
  },
}; 