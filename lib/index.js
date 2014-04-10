var _ = require('lodash');
var app = require('express')();
var mw = require('./middleware');
var series = require('middleware-flow').series;

var containers = {};
var runningContainers = {};
var images = {};
var tags = {};

app.get('/containers/json', mw.respondContainers(containers));

app.post('/containers/create', 
  mw.createContainer(containers),
  mw.respondContainer(201));

app.get('/containers/:id/json',
  mw.findContainer(containers),
  mw.respondContainer());

app.get('/containers/:id/top', mw.notYetImplemented);

app.get('/containers/:id/changes', mw.notYetImplemented);

app.get('/containers/:id/export', mw.notYetImplemented);

app.post('/containers/:id/start',
  mw.findContainer(containers),
  mw.startContainer(runningContainers));

app.post('/containers/:id/stop',
  mw.findContainer(containers),
  mw.stopContainer(runningContainers));

app.post('/containers/:id/restart', mw.notYetImplemented);

app.post('/containers/:id/kill', mw.notYetImplemented);

app.post('/containers/:id/attach', mw.notYetImplemented);

app.post('/containers/:id/wait', mw.notYetImplemented);

app.del('/containers/:id',
  mw.findContainer(containers),
  mw.deleteContainer(containers));

app.post('/containers/:id/copy', mw.notYetImplemented);

app.post('/containers/:id/resize', mw.notYetImplemented);

app.get('/images/json', mw.respondImages(images, tags));

app.post('/images/create', mw.notYetImplemented);

app.post('/images/:repository/insert', mw.notYetImplemented);
app.post('/images/:namespace/:repository/insert', mw.notYetImplemented);
app.post('/images/:registry/:namespace/:repository/insert', mw.notYetImplemented);

var getImageJson = series(
  mw.combine,
  mw.findImage(images, tags),
  mw.respondImage());
app.get('/images/:repository/json', getImageJson);
app.get('/images/:namespace/:repository/json', getImageJson);
app.get('/images/:registry/:namespace/:repository/json', getImageJson);

app.get('/images/:repository/history', mw.notYetImplemented);
app.get('/images/:namespace/:repository/history', mw.notYetImplemented);
app.get('/images/:registry/:namespace/:repository/history', mw.notYetImplemented);

app.post('/images/:repository/push', mw.notYetImplemented);
app.post('/images/:namespace/:repository/push', mw.notYetImplemented);
app.post('/images/:registry/:namespace/:repository/push', mw.notYetImplemented);

app.post('/images/:repository/tag', mw.notYetImplemented);
app.post('/images/:namespace/:repository/tag', mw.notYetImplemented);
app.post('/images/:registry/:namespace/:repository/tag', mw.notYetImplemented);

var deleteImage = series(
  mw.combine,
  mw.findImage(images, tags),
  mw.deleteImage(images, tags));
app.del('/images/:repository', deleteImage);
app.del('/images/:namespace/:repository', deleteImage);
app.del('/images/:registry/:namespace/:repository', deleteImage);

app.get('/images/search', mw.notYetImplemented);

app.post('/build', mw.buildImage(images, tags));

app.get('/auth', mw.notYetImplemented);

app.get('/info', mw.getInfo(containers, images));

app.get('/version', mw.getVersion);

app.post('/commit', 
  mw.findContainer(containers),
  mw.commitContainer(images, tags),
  mw.respondImage(201));

app.get('/events', mw.notYetImplemented);

app.get('/images/:repository/get', mw.notYetImplemented);

app.get('/images/:namespace/:repository/get', mw.notYetImplemented);

app.get('/images/:registry/:namespace/:repository/get', mw.notYetImplemented);

app.post('/images/load', mw.notYetImplemented);

app.all('*', mw.notYetImplemented);

module.exports = app;
