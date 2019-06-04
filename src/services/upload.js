const path = require("path");
const fs = require("fs");
const createWsServer = require("./createWsServer");
const DataFrame = require("./DateFrame");
const { randomStr, errorMessage, statusMessage } = require("../utils");
const {
  UPLOAD_FILE_EXISTS,
  SAME_TASK_CREATED
} = require("../constants/errorCode");
const {
  GENERATE_TRANSMIT_ID,
  UPLOAD_FINISHED
} = require("../constants/statusCode");

const DEFAULT_OPTIONS = {
  defaultFrameSize: 10 * 1024,
  wsServerPort: 8081,
  allowOverwrite: false,
  flushSizeThres: 10 * 10 * 1024
};

const uploadService = options => {
  options = Object.assign(DEFAULT_OPTIONS, options);
  checkOptions(options);

  const {
    wsServerPort,
    saveDirectory,
    allowOverwrite,
    defaultFrameSize,
    flushSizeThres
  } = options;
  const transmission = {};

  createWsServer({
    port: wsServerPort,
    initWsServer(wsServer) {
      wsServer.on("request", request => {
        // a new connection
        const conn = request.accept("echo-protocol", request.origin);
        console.log("Request from origin: " + request.origin);

        conn.on("message", message => {
          const { transmitId, type } = message;
          if (type === "query") {
            if (transmission[transmitId]) {
            }
          } else if (type === "transmit") {
            if (transmitId && transmission[transmitId]) {
              const transmitRecord = transmission[transmitId]
              const {
                receivedFrames,
                frameSize,
                savePath,
                expectFrame,
                totalSize
              } = transmitRecord;

              const { frameData, frameIndex } = message;
              const df = new DataFrame(frameData, frameIndex);
              if (df.index > expectFrame) {
                receivedFrames.push(df)
              } else {
                // df.index === expectFrame
                let insertPos = 0
                for (let i = 0, len = receivedFrames.length; i < len; i++) {
                  if (receivedFrames[i].index > expectFrame) {
                    insertPos = i
                    break
                  } else if (i === len - 1) {
                    insertPos = len
                  }
                }
                receivedFrames.splice(insertPos, 0, df)

                // calculate next expectFrame
                const nextIndex = df.index
                while (receivedFrames[++insertPos]) {
                  if (receivedFrames[insertPos].index !== ++nextIndex) {
                    expectFrame = nextIndex
                    break
                  }
                }
                expectFrame = receivedFrames[insertPos] ? expectFrame : nextIndex + 1
              }
              if (
                receivedFrames.length * frameSize > flushSizeThres &&
                receivedFrames[0].index < expectFrame
              ) {
                const boundIndex = receivedFrames.findIndex(f => f.index > expectFrame)
                var writeFrames
                if (boundIndex === -1) {
                  writeFrames = receivedFrames
                  transmitRecord.receivedFrames = []
                } else {
                  writeFrames = receivedFrames.splice(0, boundIndex)
                }
                fs.writeFileSync(savePath + '.uploading', writeFrames, {
                  mode: 'a'
                })
              }
              if (expectFrame === Math.ceil(totalSize / frameSize)) {
                // upload done
                fs.renameSync(savePath + '.uploading', savePath)
                conn.send(statusMessage(UPLOAD_FINISHED))
              }
            } else {
              // create file
              const {
                filename,
                totalSize,
                frameSize = defaultFrameSize
              } = message;
              const savePath = path.join(saveDirectory, filename);

              const fileExists = fs.existsSync(savePath);
              if (fileExists && !allowOverwrite) {
                conn.sendUTF(errorMessage(UPLOAD_FILE_EXISTS));
              } else {
                if (
                  Object.values(transmission).some(t => t.filename === filename)
                ) {
                  conn.sendUTF(errorMessage(SAME_TASK_CREATED));
                  return;
                }
                if (fileExists) fs.truncateSync(savePath);

                const genTransmitId = randomStr();
                transmission[genTransmitId] = {
                  filename,
                  totalSize,
                  frameSize,
                  receivedFrames: [],
                  expectFrame: 0,
                  savePath
                };
                conn.sendUTF(
                  statusMessage(GENERATE_TRANSMIT_ID, {
                    id: transmitId
                  })
                );
              }
            }
          }
        });

        conn.on("close", () => {
          console.log(new Date() + " " + conn.remoteAddress + " disconnected.");
        });
      });
    }
  });
};

function checkOptions(options) {
  const { saveDirectory } = options;
  if (!saveDirectory || !fs.existsSync(saveDirectory)) {
    throw new Error(
      "`saveDirectory` option is required and check whether it exists"
    );
  }
}

module.exports = uploadService;
