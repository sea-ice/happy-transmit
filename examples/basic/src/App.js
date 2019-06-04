import React, { Component } from "react";
import createUploadTask from "../../../src/browser/upload";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.onFileChange = this.onFileChange.bind(this);
    this.upload = this.upload.bind(this);
    this.state = {
      uploadTasks: []
    };
  }
  onFileChange(e) {
    this.selectedFile = e.target.value;
    this.setState({
      showUploadBtn: true
    });
  }
  upload() {
    const task = createUploadTask({
      uploadWsURL: "ws://localhost:8080",
      file: this.selectedFile,
      filename: "", // rename the file
      frameSize: 20 * 1024
    });
    task.start();
    const { uploadTasks } = this.state;
    uploadTasks.push(task);
    this.setState({
      uploadTasks
    });
  }
  render() {
    let { showUploadBtn, uploadTasks } = this.state;
    return (
      <div>
        <input type="file" onChange={this.onFileChange} />
        {showUploadBtn ? <button onClick={this.upload}>upload</button> : null}
        <h2>upload list</h2>
        {uploadTasks.length ? (
          <ul>
            {uploadTasks.map(t => (
              <li />
            ))}
          </ul>
        ) : (
          <p>Nothing uploaded</p>
        )}
      </div>
    );
  }
}
