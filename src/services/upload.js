const debug = require("debug")("");
const path = require("path");
const fs = require("fs");
const createWsServer = require("./createWsServer");
const DataFrame = require("./DateFrame");
const {
  randomStr,
  errorMessage,
  statusMessage,
  unwrapFrame
} = require("../utils");
const {
  UPLOAD_FILE_EXISTS,
  SAME_TASK_CREATED
} = require("../constants/errorCode");
const {
  GENERATE_TRANSMIT_ID,
  UPLOAD_FINISHED,
  URGE_MISSING_FRAME,
  CONFIRM_GET_EXPECT_FRAME
} = require("../constants/statusCode");

const DEFAULT_OPTIONS = {
  defaultFrameSize: 10 * 1024,
  wsServerPort: 8082,
  allowOverwrite: false,
  flushSizeThres: 10 * 10 * 1024
};

const uploadService = options => {
  console.log("initialize upload service");
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
          console.log("message type: " + message.type);
          if (message.type === "utf8") {
            message = JSON.parse(message.utf8Data);
            const { transmitId, type } = message;
            console.log("get message: " + JSON.stringify(message));

            if (type === "INIT_TRANSMIT") {
              // create file
              const {
                totalSize,
                frameSize = defaultFrameSize,
                fileExtension
              } = message;
              console.log("fileExtension: " + fileExtension);

              // generate random filename
              var randomFilename, savePath;
              do {
                randomFilename = randomStr() + fileExtension;
                savePath = path.join(saveDirectory, randomFilename);
              } while (
                fs.existsSync(savePath) ||
                Object.values(transmission).some(
                  t => t.filename === randomFilename
                )
              );

              // add transmission record
              var genTransmitId;
              do {
                genTransmitId = randomStr();
              } while (genTransmitId in transmission);
              transmission[genTransmitId] = {
                filename: randomFilename,
                totalSize,
                frameSize,
                receivedFrames: [],
                expectFrame: 0,
                savePath,
                paused: false
              };
              conn.sendUTF(
                statusMessage(GENERATE_TRANSMIT_ID, {
                  id: genTransmitId
                })
              );
            } else if (type === "PAUSE_TRANSMIT") {
              if (transmission[transmitId]) {
                const transmitRecord = transmission[transmitId];

                if (transmitRecord.paused) return;
                transmitRecord.paused = true;

                const { receivedFrames, expectFrame } = transmitRecord;
                const boundIndex = receivedFrames.findIndex(
                  f => f.index > expectFrame
                );
                if (boundIndex !== -1) {
                  const writeFrames = receivedFrames.slice(0, boundIndex);
                  fs.writeFileSync(savePath + ".uploading", writeFrames, {
                    mode: "a"
                  });
                }
                transmitRecord.receivedFrames = [];
              } else {
                console.log("Have not found transmitId: " + transmitId);
              }
            } else if (type === "QUERY_TRANSMIT_PROGRESS") {
              if (transmission[transmitId]) {
                const transmitRecord = transmission[transmitId];

                transmitRecord.paused = false;

                const { expectFrame } = transmitRecord;
                conn.send(
                  statusMessage(URGE_MISSING_FRAME, {
                    expectFrame
                  })
                );
              } else {
                console.log("Have not found transmitId: " + transmitId);
              }
            }
          } else if (message.type === "binary") {
            // transmit data
            // console.log("get message: " + JSON.stringify(message));
            const [transmitId, frameIndex, frameData] = unwrapFrame(
              message.binaryData
            );
            console.log("decoded transmitId: " + transmitId);
            debug("index of frame got: " + frameIndex);
            debug("length of frame got: " + frameData.length);
            const transmitRecord = transmission[transmitId];

            if (transmitRecord.paused) return;

            const {
              receivedFrames,
              frameSize,
              savePath,
              totalSize
            } = transmitRecord;
            var { expectFrame } = transmitRecord;

            const df = new DataFrame(Buffer.from(frameData), frameIndex);
            if (df.index > expectFrame) {
              receivedFrames.push(df);
            } else {
              // df.index === expectFrame
              let insertPos = 0;
              for (let i = 0, len = receivedFrames.length; i < len; i++) {
                if (receivedFrames[i].index > expectFrame) {
                  insertPos = i;
                  break;
                } else if (i === len - 1) {
                  insertPos = len;
                }
              }
              receivedFrames.splice(insertPos, 0, df);

              // calculate next expectFrame
              const nextIndex = df.index;
              while (receivedFrames[++insertPos]) {
                if (receivedFrames[insertPos].index !== ++nextIndex) {
                  expectFrame = nextIndex;
                  break;
                }
              }
              expectFrame = receivedFrames[insertPos]
                ? expectFrame
                : nextIndex + 1;
              conn.send(
                statusMessage(CONFIRM_GET_EXPECT_FRAME, {
                  confirm: expectFrame
                })
              );
            }
            if (
              receivedFrames.length * frameSize > flushSizeThres &&
              receivedFrames[0].index < expectFrame
            ) {
              const boundIndex = receivedFrames.findIndex(
                f => f.index > expectFrame
              );
              var writeFrames;
              if (boundIndex === -1) {
                writeFrames = receivedFrames;
                transmitRecord.receivedFrames = [];
              } else {
                writeFrames = receivedFrames.splice(0, boundIndex);
              }
              writeFrames = writeFrames.map(f => f.data);

              fs.writeFileSync(
                savePath + ".uploading",
                Buffer.concat(writeFrames),
                {
                  mode: "a"
                }
              );
            } else {
              conn.send(
                statusMessage(URGE_MISSING_FRAME, {
                  expectFrame
                })
              );
            }
            if (expectFrame === Math.ceil(totalSize / frameSize)) {
              // upload done
              fs.renameSync(savePath + ".uploading", savePath);
              delete transmission[transmitId];
              conn.send(statusMessage(UPLOAD_FINISHED));
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
