const errorCode = require('../constants/errorCode')
const statusCode = require("../constants/statusCode");

function randomStr(len = 20) {
  let str = ''
  while (str.length < len) {
    str += Math.random().toString(36).slice(2)
  }
  return str.slice(0, len)
}

function errorMessage(code) {
  return JSON.stringify({
    code,
    message: errorCode[code]
  });
}

function statusMessage(code, payload) {
  payload = payload ? { data: payload } : {}
  return JSON.stringify({
    code,
    message: statusCode[code],
    ...payload
  })
}

module.exports = {
  randomStr,
  errorMessage,
  statusMessage
}