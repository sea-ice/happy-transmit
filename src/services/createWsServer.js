const WebsocketServer = require("websocket").server;
const http = require("http");

module.exports = function(options) {
  const { port, initWsServer } = options;

  const server = http.createServer(function(req, res) {
    res.writeHead(404);
    res.end();
  });
  server.listen(port, function() {
    console.log(`Server has listend on port ${port} successfully!`);
  });

  const wsServer = new WebsocketServer({
    httpServer: server,
    autoAcceptConnections: false
  });
  initWsServer(wsServer);
};
