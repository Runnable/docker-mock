/**
 * @module lib/middleware
 */
'use strict';

var utils = require('./utils');

var middlewares = module.exports = {
  // status is optional
  generateEvent: function (status) {
    var statuses = [
      'create',
      'destroy',
      'die',
      'export',
      'kill',
      'pause',
      'restart',
      'start',
      'stop',
      'unpause',
      'untag',
      'delete'
    ];
    var froms = [ 'sequenceiq/socat:latest', 'base:latest', 'nginx:latest' ];
    var id = utils.randomId();
    var from = froms[Math.floor(Math.random() * froms.length)];
    var time = Date.now();
    status = status || statuses[Math.floor(Math.random() * statuses.length)];
    return JSON.stringify({
      status: status,
      id: id,
      from: from,
      time: time
    });
  },
  getEvents: function (targetStream) {
    return function (req, res) {
      // do streaming when params are not specified
      // send response immediately when params are there
      if (req.query.since || req.query.until) {
        res.set('Content-Type', 'application/json');
        var data = '';
        for (var i = 0; i < 100; i++) {
          data += middlewares.generateEvent();
        }
        res.send(data);
      } else {
        res.writeHead(200, {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked'
        });
        // Force flush headers - Write headers to socket and mark as sent
        res.socket.write(res._header);
        res._headerSent = true;
        targetStream.pipe(res);
        // by default every 100ms new random event would be generated
        // and pushed to the response stream
        // if DISABLE_RANDOM_EVENTS = true than no event would be generated.
        if (!process.env.DISABLE_RANDOM_EVENTS) {
          setInterval(function () {
            targetStream.emit('data', middlewares.generateEvent());
          }, 100);
        }
      }
    };
  },
  notYetImplemented: function (req, res) {
    res.status(501).send(
      'endpoint not yet implemented: ' + req.method + ' ' + req.path);
  }
};
