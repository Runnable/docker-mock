'use strict';

var app = require('express')();
var bodyParser = require('body-parser');
var mw = require('./middleware');
var series = require('middleware-flow').series;

app.use(function (req, res, next) {
  req.url = req.originalUrl.replace(/\/v\d+\.\d+/, '');
  next();
});

app.get('/containers/json', mw.respondContainers);

app.post('/containers/create',
  bodyParser.json(),
  mw.createContainer,
  mw.emitEvent('create'),
  mw.respondContainer(201));

app.get('/containers/:id/json',
  mw.findContainer,
  mw.respondContainer());

/**
 * This GET is to retrieve the Docker Log stream from the container
 */
app.get('/containers/:id/logs',
  mw.respondLogStream(200));

app.get('/containers/:id/top', mw.notYetImplemented);

app.get('/containers/:id/changes', mw.notYetImplemented);

app.get('/containers/:id/export', mw.notYetImplemented);

app.post('/containers/:id/start',
  mw.findContainer,
  mw.startContainer,
  mw.emitEvent('start'),
  mw.respondContainer(204));

app.post('/containers/:id/stop',
  mw.findContainer,
  mw.stopContainer(false),
  mw.emitEvent('die'),
  mw.emitEvent('stop'),
  mw.respondContainer(204));

app.post('/containers/:id/restart',
  mw.findContainer,
  mw.stopContainer(true),
  mw.startContainer,
  mw.emitEvent('die'),
  mw.emitEvent('start'),
  mw.emitEvent('restart'),
  mw.respondContainer(204));

app.post('/containers/:id/kill',
  mw.findContainer,
  mw.stopContainer(true),
  mw.emitEvent('die'),
  mw.emitEvent('kill'),
  mw.respondContainer(204));

app.post('/containers/:id/attach',
  mw.findContainer,
  mw.attachContainer);

app.post('/containers/:id/wait',
  mw.findContainer,
  mw.stopAndWaitContainer);

app.delete('/containers/:id',
  mw.findContainer,
  mw.deleteContainer,
  mw.emitEvent('destroy'),
  mw.respondContainer(204));

app.post('/containers/:id/copy', mw.notYetImplemented);

app.post('/containers/:id/resize', mw.notYetImplemented);

app.get('/images/json', mw.respondImages);

app.post('/images/create', mw.createImage);

app.post('/images/:repository/insert', mw.notYetImplemented);
app.post('/images/:namespace/:repository/insert', mw.notYetImplemented);
app.post('/images/:registry/:namespace/:repository/insert',
  mw.notYetImplemented);

var getImageJson = series(
  mw.combine,
  mw.findImage,
  mw.respondImage());
app.get('/images/:repository/json', getImageJson);
app.get('/images/:namespace/:repository/json', getImageJson);
app.get('/images/:registry/:namespace/:repository/json', getImageJson);

var getImageHistory = series(
  mw.combine,
  mw.findImage,
  mw.respondImageHistory);
app.get('/images/:repository/history', getImageHistory);
app.get('/images/:namespace/:repository/history', getImageHistory);
app.get('/images/:registry/:namespace/:repository/history', getImageHistory);

app.post('/images/:repository/push', mw.pushRepo);
app.post('/images/:namespace/:repository/push', mw.pushRepo);
app.post('/images/:registry/:namespace/:repository/push', mw.pushRepo);

app.post('/images/:repository/tag', mw.notYetImplemented);
app.post('/images/:namespace/:repository/tag', mw.notYetImplemented);
app.post('/images/:registry/:namespace/:repository/tag', mw.notYetImplemented);

var deleteImage = series(
  mw.combine,
  mw.findImage,
  mw.deleteImage);
app.delete('/images/:repository', deleteImage);
app.delete('/images/:namespace/:repository', deleteImage);
app.delete('/images/:registry/:namespace/:repository', deleteImage);

app.get('/images/search', mw.notYetImplemented);

app.post('/build', mw.buildImage);

app.get('/auth', mw.notYetImplemented);

app.get('/info', mw.getInfo);

app.get('/version', mw.getVersion);

app.post('/commit',
  mw.findContainer,
  mw.commitContainer,
  mw.respondImage(201));

app.get('/events', mw.getEvents());

app.get('/images/:repository/get',
  mw.combine,
  mw.findImage,
  mw.imageSave);

app.get('/images/:namespace/:repository/get', mw.notYetImplemented);

app.get('/images/:registry/:namespace/:repository/get', mw.notYetImplemented);

app.post('/images/load', mw.imageLoad);

app.all('*', mw.notYetImplemented);


app.events = {
  stream: mw.eventsStream,
  generateEvent: mw.generateEvent
};

module.exports = app;
