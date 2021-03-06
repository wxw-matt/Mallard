/*global window EventSource fetch */
import { getContainer } from './run';
import { Chrome } from '../../../LibWrappers';

const version = process.env.REACT_APP_VERSION;
const API = process.env.REACT_APP_API || '';

// Missing support
// :load <url> - to inject new DOM

const welcome = () => ({
  value: `Use <strong>:help</strong> to show jsconsole commands
version: ${version}`,
  html: true,
});

const help = () => ({
  value: `:listen [id] - starts remote debugging session
:theme dark|light
:load &lt;script_url&gt; load also supports shortcuts, like \`:load jquery\`
:libraries
:clear
:history
:about
:version
copy(<value>) and $_ for last value

${about().value}`,
  html: true,
});

const about = () => ({
  value:
    'Built by <a href="https://twitter.com/rem" target="_blank">@rem</a> • <a href="https://github.com/remy/jsconsole" target="_blank">open source</a> • <a href="https://www.paypal.me/rem/9.99usd" target="_blank">donate</a>',
  html: true,
});

const libs = {
  tensorflow: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.12.0',
  vega3: 'https://cdnjs.cloudflare.com/ajax/libs/vega/3.3.1/vega.js',
  vega4: 'https://cdnjs.cloudflare.com/ajax/libs/vega/4.2.0/vega.js',
  vega5: 'https://cdn.jsdelivr.net/npm/vega@5.0.0-rc2/build/vega.js',
  'vega-lite': 'https://cdnjs.cloudflare.com/ajax/libs/vega-lite/2.6.0/vega-lite.js',
  'vega-lite-3': 'https://cdn.jsdelivr.net/npm/vega-lite@3.0.0-rc13/build/vega-lite.js',
  'vega-embed': 'https://cdn.jsdelivr.net/npm/vega-embed@3.29.1/build/vega-embed.js',
  jquery: 'https://code.jquery.com/jquery.min.js',
  underscore: 'https://cdn.jsdelivr.net/underscorejs/latest/underscore-min.js',
  lodash: 'https://cdn.jsdelivr.net/lodash/latest/lodash.min.js',
  moment: 'https://cdn.jsdelivr.net/momentjs/latest/moment.min.js',
  datefns: 'https://cdn.jsdelivr.net/gh/date-fns/date-fns/dist/date_fns.min.js',
  faceapi: 'https://bearzx.com/pgxz3/face-api.js',
  ml5: 'https://bearzx.com/pgxz3/ml5.js',
};

const _load = async ({ args: urls, console }) => {
  // const document = getContainer().contentDocument;
  urls.forEach(url => {
    url = libs[url] || url;
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => console.log(`Loaded ${url}`);
    script.onerror = () => console.warn(`Failed to load ${url}`);
    document.body.appendChild(script);
  });
  return 'Loading script...';
};

// const load = async ({ args: url }) => {
//   await remoteLoad({ args: url });
// }

const load = async ({ args: urls, console }) => {
  for (const url of urls) {
    // console._log(`loading ${url}`);
    await remoteLoad({ args: url });
  }
};

const remoteLoad = async ({ args: url }) => {
    return new Promise((resolve, reject) => {
      url = libs[url] || url;
      console.log(`loading ${url}`);
      fetch(url).then((res) => {
          res.text().then((code) => {
              eval.call(window, code);
              console.log(`${url} <span class="sGreen">loaded</span>`);
              resolve();
          });
      });
    })
}

const yo = () => { console.log('yo'); }

const libraries = () => {
  return {
    value: Object.keys(libs)
      .map(name => `<strong>${name}</strong>: ${libs[name]}`)
      .join('\n'),
    html: true,
  };
};

const set = async ({ args: [key, value], app }) => {
  switch (key) {
    case 'theme':
      if (['light', 'dark'].includes(value)) {
        app.props.setTheme(value);
      }
      break;
    case 'layout':
      if (['top', 'bottom'].includes(value)) {
        app.props.setLayout(value);
      }
      break;
    default:
  }
};

const theme = async ({ args: [theme], app }) => {
  if (['light', 'dark'].includes(theme)) {
    app.props.setTheme(theme);
    return;
  }

  return 'Try ":theme dark" or ":theme light"';
};

const history = async ({ app, args: [n = null] }) => {
  const history = app.context.store.getState().history;
  if (n === null) {
    return history.map((item, i) => `${i}: ${item.trim()}`).join('\n');
  }

  // try to re-issue the historical command
  const command = history.find((item, i) => i === n);
  if (command) {
    app.onRun(command);
  }

  return;
};

const clear = ({ console }) => {
  console.log('console clear');
  console.clear();
};

const edit = async ({ args: [name], console }) => {
  console._edit_(name);
};

const showCode = async () => {
  window.show_code();
};

const backup = async () => {
  console.downloadCode();
};

const upload = async () => {
  console.uploadCode();
};

const run = async ({ args: [name], console }) => {
  console._run_(name);
  console.log(`${name} <span class="sGreen">evaled</span>`); // [Xiong] more indicators?
};

const seqrun = async ({ args: names, console }) => {
  for (const name of names) {
    await run(name);
  }
};

const vis = async ({ args: id, console }) => {
  console.vis(id);
};

const canvas = async ({ args: id, console }) => {
  console.canvas(id);
};

const showTensor = async ({ args: [tensor, id], console }) => {
  console.showTensor(window[tensor], window._$(`#canvas-${id}`));
};

const vexport = async ({ args: _vname, console }) => {
  console.log(`exporting variable ${_vname}`);
  // check if the variable exists
  if (window[_vname]) {
    Chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let tab = tabs[0];
      let msg = {
        action: 'export-variable',
        tabId: tab.id,
        vname: _vname,
        vvalue: window[_vname]
      };
      Chrome.runtime.sendMessage(msg, (response) => { });
    });
  } else {
    console.warn(`variable ${_vname} doesn't exist`);
  }
};

const vimport = async ({ args: [_tabId, _vname], console }) => {
  console.log(`importing variable ${_vname} from tab ${_tabId}`);
  let msg = {
    action: 'import-variable',
    tabId: _tabId,
    vname: _vname
  };
  Chrome.runtime.sendMessage(msg, (response) => {
    console._log('import response bla');
    console._log(response.vname);
    console._log(response.vvalue);
    window[response.vname] = response.vvalue;
  });
};

const listen = async ({ args: [id], console: internalConsole }) => {
  // create new eventsocket
  const res = await fetch(`${API}/remote/${id || ''}`);
  id = await res.json();

  return new Promise(resolve => {
    const sse = new EventSource(`${API}/remote/${id}/log`);
    sse.onopen = () => {
      resolve(
        `Connected to "${id}"\n\n<script src="${
          window.location.origin
        }/js/remote.js?${id}"></script>`
      );
    };

    sse.onmessage = event => {
      console.log(event);
      const data = JSON.parse(event.data);
      if (data.response) {
        if (typeof data.response === 'string') {
          internalConsole.log(data.response);
          return;
        }

        const res = data.response.map(_ => {
          if (_.startsWith('Error:')) {
            return new Error(_.split('Error: ', 2).pop());
          }

          if (_ === 'undefined') {
            // yes, the string
            return undefined;
          }

          return JSON.parse(_);
        });
        internalConsole.log(...res);
      }
    };

    sse.onclose = function() {
      internalConsole.log('Remote connection closed');
    };
  });
};

const commands = {
  libraries,
  help,
  about,
  load,
  listen,
  theme,
  clear,
  history,
  set,
  welcome,
  yo,
  remoteLoad,
  edit,
  showCode,
  backup,
  upload,
  run,
  seqrun,
  vis,
  canvas,
  showTensor,
  vimport,
  vexport,
  version: () => version,
};

export default commands;
