const fs = require('fs-extra');
const Readable = require('stream').Readable;
const extend = require('extend');
const console = require('./console');

class RulePattern {
  rulesPattern() {
    if (!(this.config && this.config.rules && this.config.rules.length)) {
      this.pattern = {};
      return {};
    }
    var options = {
      disableHttpRequest: false
    };
    this.config.rules.map((rule, idx) => {
      if (options.matched) return;
      if (!rule.regx) return;
      if (typeof rule.regx === 'object' && rule.regx.constructor === RegExp) {
        options.matched = rule.regx.test(this.options.url);
        if (RegExp.$1) {
          options.filepath = RegExp.$1;
        }
      } else if (typeof rule.regx === 'string') {
        options.matched = this.options.url.indexOf(rule.regx) > -1;
      } else if (typeof rule.regx === 'function') {
        options.matched = rule.regx(this.options.url);
        if (options.matched && RegExp.$1) {
          options.filepath = RegExp.$1;
        }
      }
      // matched and get this rule
      if (options.matched) {
        options.rule = rule;
      }
    });

    // response rule use local file and disable http request
    if (options.matched) {
      'file|path|status'.split('|').map(item => {
        if (options.disableHttpRequest) return;
        if (options.rule && options.rule.hasOwnProperty(item)) {
          options.disableHttpRequest = true;
        }
      });
    }
    this.pattern = options;
    // matched rule and add extend headers
    if (options.matched) {
      if (options.disableHttpRequest) {
        this.dataset.responseHeaders['x-hostip'] = '127.0.0.1';
      }
      if (!options.disableHttpRequest && options.rule && options.rule.host) {
        this.dataset.responseHeaders['x-hostip'] = options.rule.host;
      }
      this.dataset.responseHeaders['x-bproxy-match'] = 1;
    }
    return options;
  }

  readLocalData() {
    let options = this.pattern;
    if (options.rule.file) {
      let stat = fs.existsSync(options.rule.file);
      if (stat) {
        this.dataset.res.writeHead(200, {});
        let readStream = fs.createReadStream(options.rule.file);
        readStream.setEncoding('utf8');
        this.$resolve(readStream);
      } else {
        this.dataset.res.writeHead(404, {});
        this.dataset.res.end('');
      }
    } else if (options.rule.status) {
      this.dataset.res.writeHead(options.rule.status, {});
      this.dataset.res.end(options.rule.body || '');
    } else if (options.rule.path) {
      let filepath = options.rule.path + options.filepath;
      let stat = fs.existsSync(filepath);
      if (stat) {
        this.dataset.httpStatus = 200;
        this.writeHead();
        let readStream = fs.createReadStream(filepath);
        readStream.setEncoding('utf8');
        this.$resolve(readStream);
      } else {
        this.dataset.httpStatus = 404;
        this.writeHead();
        this.dataset.res.end('');
      }
    }
  }

  writeHead() {
    this.dataset.res.writeHead(this.dataset.httpStatus, this.dataset.responseHeaders);
  }
}

module.exports = RulePattern;