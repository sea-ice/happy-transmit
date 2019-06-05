const W3CWebsocket = require("websocket").w3cwebsocket;
const {
  GENERATE_TRANSMIT_ID,
  CONFIRM_GET_EXPECT_FRAME,
  UPLOAD_FINISHED
} = require("../constants/statusCode");

// each file uses one websocket connection
function createUploadTask(options) {
  checkOptions(options);

  const { uploadWsURL, file, frameSize } = options;
  const client = new W3CWebsocket(uploadWsURL);

  const meta = {
    frameSize,
    totalSize: file.size,
    paused: false
  };
  client.onopen = () => {};
  client.onmessage = e => {
    const message = JSON.parse(e.data);
    const { code } = message;
    switch (code) {
      case GENERATE_TRANSMIT_ID:
        const {
          data: { id }
        } = message;
        meta.transmitId = id;

        // start transmit
        start();
        break;
      case URGE_MISSING_FRAME:
        // set timer
        break;
      case CONFIRM_GET_EXPECT_FRAME:
        break;
      case UPLOAD_FINISHED:
        break;
    }
  };
  const task = {
    start(file) {
      client.send(
        JSON.stringify({
          type: "INIT_TRANSMIT",
          totalSize: meta.totalSize,
          frameSize
        })
      );
    },
    continue() {
      if (!meta.paused) return;
      meta.paused = false;

      client.send(
        JSON.stringify({
          type: "QUERY_TRANSMIT_PROGRESS",
          transmitId: meta.transmitId
        })
      );
    },
    pause() {
      if (meta.paused) return;
      meta.paused = true;
    },
    abort() {}
  };
  Object.defineProperty(task, "meta", {
    get() {
      return meta;
    }
  });
  return task;

  function start() {
    const fr = new FileReader();
    fr.addEventListener('load', e => {
      const raw = e.target.result
      const binary = new Int8Array(raw)
      console.log(binary.length)
      const frameIndex = 0
      const frameOffset = 0
      const totalFrames = Math.ceil(file.size / frameSize)

      sendFrame()
      function sendFrame() {
        if (frameIndex === totalFrames) return
        const frame = binary.slice(frameOffset, frameSize)
        client.send(frame) // TODO: each frame needs identity
        frameIndex++
        frameOffset += frameSize
        setTimeout(sendFrame, 10)
      }
    })
    fr.readAsArrayBuffer(file);


  }
}

function checkOptions(options) {
  const { uploadWsURL } = options;
  if (!uploadWsURL) {
    throw new Error("`uploadWsURL` option is required!");
  }

  if (!file) {
    throw new Error("`file` option is required!");
  }
}

module.exports = createUploadTask;
