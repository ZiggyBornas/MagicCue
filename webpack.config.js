const path = require('path');

module.exports = {
  resolve: {
    fallback: {
      fs: false,
      http: false,
      https: false,
      url: false,
      util: false,
      zlib: false,
      stream: false,
    },
  },
  module: {
    rules: [
      {
        test: /pdf\.worker\.(min\.)?js/,
        type: 'asset/resource'
      }
    ]
  }
}; 