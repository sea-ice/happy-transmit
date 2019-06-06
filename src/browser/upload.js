const W3CWebsocket = require("websocket").w3cwebsocket;
const mime = require("mime");
const {
  GENERATE_TRANSMIT_ID,
  CONFIRM_GET_EXPECT_FRAME,
  UPLOAD_FINISHED
} = require("../constants/statusCode");
const { wrapFrame } = require('../utils');

// each file uses one websocket connection
function createUploadTask(options) {
  checkOptions(options);

  const { uploadWsURL, file, frameSize } = options;
  const client = new W3CWebsocket(uploadWsURL, "echo-protocol");

  const filenameSplit = file.name.split(".");
  const meta = {
    frameSize,
    fileExtension:
      "." +
      (file.type
        ? mime.getExtension(file.type)
        : filenameSplit[filenameSplit.length - 1]),
    totalSize: file.size,
    paused: false
  };
  const missingIndexes = [];
  client.onopen = () => {
    console.log("websocket open");
  };
  client.onmessage = e => {
    const message = JSON.parse(e.data);
    const { code } = message;
    switch (code) {
      case GENERATE_TRANSMIT_ID:
        const {
          data: { id }
        } = message;
        meta.transmitId = id;
        console.log("GENERATE_TRANSMIT_ID: " + id);

        // start transmit
        start();
        break;
      case URGE_MISSING_FRAME:
        // set timer
        const {
          data: { expectFrame }
        } = message;

        setRetransmitTimer(expectFrame);
        break;
      case CONFIRM_GET_EXPECT_FRAME:
        const {
          data: { confirm }
        } = message;
        const missingIndex = missingFrames.findIndex(f => f.index === confirm);
        if (missingIndex !== -1) {
          const { timer } = missingFrames[missingIndex];
          clearTimeout(timer);
          missingFrames.splice(missingIndex, 1);
        }
        break;
      case UPLOAD_FINISHED:
        break;
    }
  };
  client.onerror = e => {
    console.log(e);
  };
  const task = {
    start() {
      checkConnectAndStart();
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

  function checkConnectAndStart() {
    var timer;
    const check = () => {
      if (client.readyState === client.OPEN) {
        if (timer) clearTimeout(timer);
        client.send(
          JSON.stringify({
            type: "INIT_TRANSMIT",
            totalSize: meta.totalSize,
            frameSize,
            fileExtension: meta.fileExtension
          })
        );
        console.log("init transmit");
      } else {
        timer = setTimeout(check, 10);
      }
    };
    return check();
  }

  function start() {
    const fr = new FileReader();
    fr.addEventListener("load", e => {
      const raw = e.target.result;
      meta.binary = new Int8Array(raw);
      var frameIndex = 0;
      var frameOffset = 0;
      const totalFrames = Math.ceil(file.size / frameSize);
      console.log(meta.binary);

      sendFrame();
      function sendFrame() {
        if (frameIndex === totalFrames) return;
        const frame = meta.binary.slice(frameOffset, frameSize);
        client.send(wrapFrame(frame, meta.transmitId, frameIndex)); // each frame needs identity
        frameIndex++;
        frameOffset += frameSize;
        setTimeout(sendFrame, 10);
      }
    });
    fr.readAsArrayBuffer(file);
  }

  function setRetransmitTimer(frameIndex) {
    const frame = meta.binary.slice(frameIndex, frameIndex + frameSize);
    const timer = setTimeout(() => {
      // timeout
      setRetransmitTimer(frameIndex);
    }, 30 * 1000);
    const missingIndex = missingFrames.findIndex(f => f.index === frameIndex);
    if (missingIndex !== -1) {
      missingFrames[missingIndex].timer = timer;
    } else {
      missingFrames.push({ index: frameIndex, timer });
    }
  }
}

function checkOptions(options) {
  const { uploadWsURL, file } = options;
  if (!uploadWsURL) {
    throw new Error("`uploadWsURL` option is required!");
  }

  if (!file) {
    throw new Error("`file` option is required!");
  }
}

module.exports = createUploadTask;
