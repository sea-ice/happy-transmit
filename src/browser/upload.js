const W3CWebsocket = require("websocket").w3cwebsocket;

// each file uses one websocket connection
function createUploadTask(options) {
  checkOptions(options);

  const { uploadWsURL, filename, file, frameSize } = options;
  const client = new W3CWebsocket(uploadWsURL);
  client.onopen = () => {
    client.send(
      JSON.stringify({
        type: "transmit",
        filename,
        totalSize: file.size,
        frameSize
      })
    );
  };
  client.onmessage = e => {};
  const meta = {};
  const task = {
    start(file) {
      client;
    },
    continue() {},
    pause() {},
    abort() {}
  };
  Object.defineProperty(task, "meta", {
    get() {
      return meta;
    }
  });
  return task;
}

function checkOptions(options) {
  const { uploadWsURL } = options;
  if (!uploadWsURL) {
    throw new Error("`uploadWsURL` option is required");
  }
}

module.exports = createUploadTask;
