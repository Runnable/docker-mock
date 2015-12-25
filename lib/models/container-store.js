'use strict'

var util = require('util')
var find = require('101/find')
var BaseStore = require('./base-store')
var Container = require('./container')
var Promise = require('bluebird')
var ConflictError = BaseStore.ConflictError

module.exports = ContainerStore

function ContainerStore () {
  BaseStore.call(this)
}
util.inherits(ContainerStore, BaseStore)

ContainerStore.prototype.findOneByName = function (name) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      var foundId = find(
        Object.keys(this._store),
        function (storeId) {
          return this._store[storeId].Name === '/' + name
        }.bind(this))
      if (!foundId) {
        throw new BaseStore.NotFoundError('Container not found')
      }
      return this._store[foundId]
    })
}

ContainerStore.prototype.findOneByIdOrName = function (id) {
  return Promise.any([
    this.findOneByName(id),
    this.findOneById(id)
  ]).catch(function (errs) {
    // if we get all errors, throw just the first one
    throw errs[0]
  })
}

ContainerStore.prototype.deleteById = function (id) {
  return this.findOneByIdOrName(id)
    .bind(this)
    .then(function (container) {
      delete this._store[container.Id]
      return container
    })
    .then(function (container) {
      this.emit('event', 'destroy', container)
      return container
    })
    .then(function (container) {
      container.removeAllListeners('event')
      return container
    })
}

ContainerStore.prototype.listContainers = function () {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      return Object.keys(this._store).map(function (storeId) {
        var container = this._store[storeId]
        // TODO: extend with other data we may want

        // List containers api returns each container's name in a list named "Names"
        // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.21/#list-containers
        var Names
        if (container.Name) {
          Names = [container.Name]
        }
        return {
          Id: container.Id,
          Image: container.Image,
          Created: container.Created,
          Names: Names
        }
      }.bind(this))
    })
}

ContainerStore.prototype.createContainer = function (body) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      if (body.name) {
        return this.findOneByName(body.name)
        .then(function (container) {
          var errMsg = util.format('Conflict. The name "%s" is already in use by container %s.' +
                       'You have to remove (or rename) that container to be able to reuse that name.',
                       body.name, container.Id)
          throw new ConflictError(errMsg)
        }, function () { return true })
      }
      return Promise.resolve(true)
    })
    .then(function () {
      var container = new Container(body)
      this._store[container.Id] = container
      return container
    })
    .then(function (container) {
      container.on('event', function () {
        var args = Array.prototype.slice.call(arguments)
        args.unshift('event')
        this.emit.apply(this, args)
      }.bind(this))
      return container
    })
    .then(function (container) {
      this.emit('event', 'create', container)
      return container
    })
}
