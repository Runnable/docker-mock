'use strict'

var app = require('express')()
var mw = require('./middleware')
var not = require('101/not')
var envIs = require('101/env-is')

var miscRoutesBase = require('./routes/base/misc')
var eventStream = miscRoutesBase.eventStream

app.use(function (req, res, next) {
  req.url = req.originalUrl.replace(/\/v\d+\.\d+/, '')
  next()
})

app.use(require('./routes/base/containers'))
app.use(require('./routes/base/images'))
app.use(require('./routes/base/misc'))

app.events = {
  stream: eventStream,
  generateEvent: mw.generateEvent
}

app.all('*', mw.notYetImplemented)

app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
  if (not(envIs('test'))) {
    console.error('ERROR (' + req.originalUrl + ')')
    console.error(err.stack || err.message || err)
  }
  res.status(500).end(err.message)
})

module.exports = app
