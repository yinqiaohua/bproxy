const httpMiddleware = require('./http-middleware');
const configApi = require('./config-parse');
const util = require('./common/util');
const fs = require('fs');

var app = require('http').createServer(handler);
var io = require('socket.io')(app);
app.listen(9000);
console.log('socket start up with UI panel: http:127.0.0.1:9000');
var socket;
io.on('connection', function (skt) {
  socket = skt;
});

function handler(req, res) {
  var filepath;
  if (req.url === '/') {
    req.url = '/index.html';
  }
  if (req.url === '/install') {
    req.url = '/install.html';
  }
  if (req.url === '/settings') {
    req.url = '/settings.html';
  }
  if (req.url.indexOf('/') === 0) {
    filepath = req.url;
  } else {
    return;
  }
  if (req.url === '/cert.crt') {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream'
    });
    res.end(fs.readFileSync(config.getDefaultCACertPath()));
    return;
  }

  fs.readFile(__dirname + '/../ui' + filepath, function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}

function proxy(req, res) {
  if (!req.__sid__) req.__sid__ = util.newGuid();
  let httpProxy = new httpMiddleware({ configApi: configApi });
  let pattern = httpProxy.init(req, res);

  if (socket && typeof socket.emit === 'function') {
    socket.emit('request', {
      sid: req.__sid__,
      url: req.url,
      reqHeaders: req.headers,
      query: httpProxy.dataset.query
    });
  }
  let start = function () {
    httpProxy.proxy(socket).catch(error => {
      res.end(error);
    }).then(responseStream => {
      responseStream.pipe(res);
      httpProxy = null;
      pattern = null;
    });
  };
  let delay = pattern && pattern.rule && pattern.rule.delay || httpProxy.config && httpProxy.config.delay;
  if (delay) {
    setTimeout(start, delay);
  } else {
    start();
  }
}

module.exports = proxy;