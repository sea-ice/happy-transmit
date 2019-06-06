const errorCode = require("../constants/errorCode");
const statusCode = require("../constants/statusCode");
const debug = require("debug")("[Send Message]:");

const frameIndexByteLen = 4;
const transmitIdLen = 20;

function randomStr(len = 20) {
  let str = "";
  while (str.length < len) {
    str += Math.random()
      .toString(36)
      .slice(2);
  }
  return str.slice(0, len);
}

function errorMessage(code) {
  return JSON.stringify({
    code,
    message: errorCode[code]
  });
}

function statusMessage(code, data) {
  const payload = data ? { data } : {};
  const sendMsg = JSON.stringify({
    code,
    message: statusCode[code],
    ...payload
  });
  debug(sendMsg);
  return sendMsg;
}

function wrapFrame(frameData, transmitId, index) {
  const frame = new Int8Array(frameData.length + transmitId.length + frameIndexByteLen);

  // encode transmitId
  const encodedTransmitId = transmitId.split('').map(char => char.charCodeAt(0))
  console.log('encoded transmitId: ')
  console.log(encodedTransmitId)

  // encode frame index
  const indexStr = index.toString(2).padStart(frameIndexByteLen * 8, "0");
  const encodedindex = [];
  for (let i = 0; i < frameIndexByteLen; i++) {
    encodedindex.push(parseInt(indexStr.substr(i * 8, 8), 2));
  }
  console.log("encoded result of index " + index + " :");
  console.log(encodedindex);

  frame.set(encodedTransmitId, 0)
  frame.set(encodedindex, transmitId.length);
  frame.set(frameData, transmitId.length + frameIndexByteLen);
  return frame;
}

function unwrapFrame(frame) {
  const encodedTransmitId = frame.slice(0, transmitIdLen)

  const encodedindex = frame.slice(transmitIdLen, transmitIdLen + frameIndexByteLen);

  const frameData = new Int8Array(frame.length - frameIndexByteLen - transmitIdLen)
  frameData.set(frame.slice(transmitIdLen + frameIndexByteLen), 0);

  return [
    Array.from(encodedTransmitId.values())
      .map(code => String.fromCharCode(code))
      .join(""),
    parseInt(encodedindex.map(v => v.toString(2)).join(""), 2),
    frameData
  ];
}

module.exports = {
  randomStr,
  errorMessage,
  statusMessage,
  wrapFrame,
  unwrapFrame
};
