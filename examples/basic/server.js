const { uploadService } = require("../../index");
const path = require("path");

uploadService({
  saveDirectory: path.join(__dirname, "upload")
});
