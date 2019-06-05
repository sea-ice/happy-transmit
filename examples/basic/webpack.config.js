const path = require("path");

module.exports = {
  entry: {
    demo: path.resolve(__dirname, "./src/index.js")
  },
  output: {
    path: path.resolve(__dirname, "dist")
  },
  devServer: {
    port: 8090
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: "babel-loader"
      }
    ]
  }
};
