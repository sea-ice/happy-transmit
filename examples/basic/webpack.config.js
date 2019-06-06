const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    demo: path.resolve(__dirname, "./src/index.js")
  },
  output: {
    publicPath: "/",
    path: path.resolve(__dirname, "dist")
  },
  devServer: {
    port: 8090,
    contentBase: path.resolve(__dirname, "dist")
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: "babel-loader"
      }
    ]
  },
  plugins: [
    new CopyPlugin([
      {
        from: path.resolve(__dirname, "public/index.html"),
        to: path.resolve(__dirname, "dist")
      }
    ])
  ]
};
