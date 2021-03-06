import React, { Component } from 'react';
import Line from './Line';
import { Chrome } from '../../../LibWrappers';
import run from '../lib/run';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

let guid = 0;
let visid = 0;
let canvasid = 0;
const getNext = () => guid++;
const getNextVisid = () => visid++;
const getNextCanvasid = () => canvasid++;

function AssertError(message) {
  this.name = 'Assertion fail';
  this.message = message;
  this.stack = new Error().stack;
}

AssertError.prototype = new Error();

function interpolate(...args) {
  let [string, ...rest] = args;
  let html = false;

  if (typeof string === 'string' && string.includes('%') && rest.length) {
    string = string.replace(
      /(%[scdif]|%(\d*)\.(\d*)[dif])/g,
      (all, key, width = '', dp) => {
        // NOTE: not supporting Object type

        if (key === '%s') {
          // string
          return rest.shift();
        }

        if (key === '%c') {
          html = true;
          return `</span><span style="${rest.shift()}">`;
        }

        const value = rest.shift();
        let res = null;

        if (key.substr(-1) === 'f') {
          if (isNaN(parseInt(dp, 10))) {
            res = value;
          } else {
            res = value.toFixed(dp);
          }
        } else {
          res = parseInt(value, 10);
        }

        if (width === '') {
          return res;
        }

        return res.toString().padStart(width, ' ');
      }
    );

    if (html) {
      string = `<span>${string}</span>`;
    }

    args = [string, ...rest];
  }

  return { html, args };
}

class Console extends Component {
  constructor(props) {
    super(props);

    window.resetConsoleState = () => {

    };

    this.state = {};
    // TODO: add hidden property
    this.state.lines = (props.commands || []).reduce((acc, curr) => {
      acc[getNext()] = curr;
      return acc;
    }, {});

    this.log = this.log.bind(this);
    this._log = this._log.bind(this);
    this._error = this._error.bind(this);
    this.warn = this.warn.bind(this);
    this._warn = this._warn.bind(this);
    this.clear = this.clear.bind(this);
    this.push = this.push.bind(this);
    this.onUploadedCodeChange = this.onUploadedCodeChange.bind(this);
  }

  push(command) {
    const next = command.linei ? command.linei : getNext();
    let addons = { hidden: command.level === 'warn' ? true : false };
    const newLine = {
      [next]: {
        ...command,
        ...addons
      }
    };
    // console._log(newLine);
    this.setState({ lines: Object.assign(this.state.lines, newLine) });
  }

  clear() {
    this.setState({ lines: {} });
  }

  error = (...rest) => {
    this._error(...rest);

    const { html, args } = interpolate(...rest);
    this.push({
      error: true,
      html,
      value: args,
      type: 'log',
    });
  };

  _error = (...rest) => {
    window.console._error(...rest);
  };

  assert(test, ...rest) {
    // intentional loose assertion test - matches devtools
    if (!test) {
      let msg = rest.shift();
      if (msg === undefined) {
        msg = 'console.assert';
      }
      rest.unshift(new AssertError(msg));
      this.push({
        error: true,
        value: rest,
        type: 'log',
      });
    }
  }

  dir = (...rest) => {
    const { html, args } = interpolate(...rest);

    this.push({
      value: args,
      html,
      open: true,
      type: 'log',
    });
  };

  warn(...rest) {
    this._warn(...rest);

    const { html, args } = interpolate(...rest);
    this.push({
      error: true,
      level: 'warn',
      html,
      value: args,
      type: 'log',
    });
  }

  _warn = (...rest) => {
    window.console._warn(...rest);
  };

  debug = (...args) => this.log(...args);
  info = (...args) => this.log(...args);

  log(...rest) {
    let { html, args } = interpolate(...rest);
    html = true;

    this.push({
      value: args,
      html,
      type: 'log',
    });
  }

  table(df) {
    this.push({
      type: 'table',
      value: {
        df: df
      }
    });
  }

  img(img) {
    this.push({
      type: 'img',
      value: {
        src: img.src
      }
    });
  }

  vis() {
    this.push({
      type: 'vis',
      value: { plotId: getNextVisid() }
    });
  }

  html(_text) {
    this.push({
      type: 'html',
      value: { text: _text }
    });
  }

  canvas(_canvasId) {
    this.push({
      type: 'canvas',
      value: { canvasId: getNextCanvasid() }
    });
  }

  webcam() {
    this.push({
      type: 'webcam'
    });
  }

  dnd() {
    this.push({
      type: 'dnd'
    });
  }

  _log(...rest) {
    window.console._log(rest);
  }

  downloadCode() {
    let commands = this.state.lines || {};
    let blob = new Blob([JSON.stringify(commands)], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    Chrome.downloads.download({
        url: url,
        filename: 'pgxz3-backup.json'
    });
  }

  uploadCode() {
    // TODO: clean this up as a exported lib
    window._$('#code-upload').click();
  }

  onUploadedCodeChange(e) {
    // console._log(e.target.files);
    let backupCode = e.target.files[0];
    let reader = new FileReader();
    let lineIndices = [];
    reader.onload = (_e) => {
      let newLines = JSON.parse(_e.target.result);
      for (let key of Object.keys(newLines)) {
        newLines[key].linei = parseInt(key);
        lineIndices.push(parseInt(key));
        if (newLines[key].type === 'command') {
          newLines[key].evalable = true;
        }
      }
      guid = Math.max(...lineIndices) + 1;
      this.setState({ lines: newLines });
    };
    reader.readAsText(backupCode);
  }

  showTensor(tensor, canvas) {
    const ctx = canvas.getContext('2d');
    const [height, width] = tensor.shape;
    canvas.width = width;
    canvas.height = height;
    const buffer = new Uint8ClampedArray(width * height * 4);
    const imageData = new ImageData(width, height);
    const data = tensor.dataSync();
    var cnt = 0;
    for(var y = 0; y < height; y++) {
        for(var x = 0; x < width; x++) {
            var pos = (y * width + x) * 4; // position in buffer based on x and y
            buffer[pos  ] = data[cnt]; // some R value [0, 255]
            buffer[pos + 1] = data[cnt + 1]; // some G value
            buffer[pos + 2] = data[cnt + 2]; // some B value
            buffer[pos + 3] = 255; // set alpha channel
            cnt += 3;
        }
    }
    imageData.data.set(buffer);
    ctx.putImageData(imageData, 0, 0);
  }

  _edit_(name) {
    Chrome.storage.local.get(['saved_scripts'], function(result) {
      if (result.saved_scripts[name]) {
        window.changeAppState({
          fname: name,
          code: result.saved_scripts[name],
          tabId: 1
        });
      } else {
        console.error('No such file');
      }
    });
  }

  _run_(name) {
    const _this = this;
    Chrome.storage.local.get(['saved_scripts'], function(result) {
      if (result.saved_scripts[name]) {
        try {
          window.eval(result.saved_scripts[name]);
        } catch (error) {
          const res = {};
          res.error = true;
          res.value = error;
          _this.push({
            name,
            type: 'response',
            ...res,
          });
        }
        // run(result.saved_scripts[name]);
      } else {
        console.error('No such file');
      }
    });
  }

  onHide(i) {
    return () => {
      let lines = {...this.state.lines};
      let lineToHide = {
        ...lines[i],
        hidden: true
      };
      lines[i] = lineToHide;
      this.setState({ lines: lines });
    }
  }

  onReRun(i) {
    return async () => {
      // console._log(`re-running ${this.state.lines[i].command}`);
      let lines = {...this.state.lines};
      let lineToHide = {
        ...lines[i],
        evalable: false
      };
      lines[i] = lineToHide;
      this.setState({ lines: lines });
      this.props.onRun(this.state.lines[i].command, lines[i].linei);
    }
  }

  render() {
    const commands = this.state.lines || {};
    const keys = Object.keys(commands).filter((_) => !commands[_].hidden);
    // console.log(typeof keys[0]);
    if (this.props.reverse) {
      keys.reverse();
    }

    // [Xiong] Bug TODO: why is the key order guaranteed?
    return (
      <div
        className="react-console-container"
        onClick={e => {
          e.stopPropagation(); // prevent the focus on the input element
        }}
      >
        <input
          id="code-upload"
          type="file"
          name="backupCode"
          onChange={(e) => this.onUploadedCodeChange(e)}
          multiple/>
        <ReactCSSTransitionGroup
          transitionName="line-transition"
          transitionEnterTimeout={300}
          transitionLeaveTimeout={300}
        >
          { keys.map(_ =>
            <Line
              key={`line-${_}`}
              onHide={this.onHide(_)}
              onReRun={this.onReRun(_)}
              {...commands[_]}
            />) }
        </ReactCSSTransitionGroup>
      </div>
    );
  }
}

export default Console;
