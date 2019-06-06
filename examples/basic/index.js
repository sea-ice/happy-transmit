const Webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");
// const express = require('express')
const webpackConfig = require("./webpack.config");

// const app = express()
const compiler = Webpack(webpackConfig);
const devServerOpt = webpackConfig.devServer;
const server = new WebpackDevServer(compiler, devServerOpt);

server.listen(devServerOpt.port, () => {
  console.log(
    `DevServer has listened on port ${devServerOpt.port} successfully!`
  );
});
// app.get(DownloadMiddleware({
//   resources: '/download/*',
//   wsServerPort: 8080
// }));
