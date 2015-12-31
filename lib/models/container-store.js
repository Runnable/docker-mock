'use strict'

var BaseStore = require('./base-store')
var ConflictError = BaseStore.ConflictError
var Container = require('./container')
var find = require('101/find')
var isObject = require('101/is-object')
var keypather = require('keypather')()
var last = require('101/last')
var Promise = require('bluebird')
var util = require('util')

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

ContainerStore._formatQueryFilters = function (filters) {
  if (filters.label) {
    // label is an array. split them up if necessary
    var labels = {}
    filters.label.forEach(function (str) {
      str = str.split('=')
      var key = str.shift()
      // str.join('=') will give an empty string when there's just a label
      // with no value
      labels[key] = str.join('=')
      // remove any quotes
      if (labels[key][0] === '"' && last(labels[key]) === '"') {
        labels[key] = labels[key].substr(1, labels[key].length - 2)
      }
    })
    filters.label = labels
  }
  return filters
}

ContainerStore.prototype.listContainers = function (filters) {
  filters = filters || {}
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
          Names: Names,
          Labels: keypather.get(container, 'Config.Labels'),
          State: container.State
        }
      }.bind(this))
    })
    .then(function (containers) {
      return ContainerStore._runFilters(containers, filters)
    })
}

ContainerStore._runFilters = function (containers, filters) {
  Object.keys(filters).forEach(function (filter) {
    switch (filter) {
      case 'label':
        var key = Object.keys(filters[filter])[0]
        var value = filters[filter][key]
        containers = containers.filter(filterLabel(key, value))
        break
      case 'status':
        var running = filters[filter] === 'running'
        containers = containers.filter(filterStatus(running))
        break
    }
  })
  return containers

  function filterLabel (key, value) {
    return function (c) {
      if (!c.Labels) { return false }
      var containerValue = c.Labels[key]
      if (containerValue === '' && value === '') { return true }
      if (!containerValue || containerValue !== value) { return false }
      return true
    }
  }
  function filterStatus (status) {
    return function (c) { return c.State.Running === status }
  }
}

ContainerStore._formatBodyLabels = function (labels) {
  if (!labels) { return labels }
  if (Array.isArray(labels)) {
    var objLabels = {}
    labels.forEach(function (l) { objLabels[l] = '' })
    return objLabels
  } else if (!isObject(labels)) {
    throw new Error('Labels is malformed.')
  }
  return labels
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
      body.Labels = ContainerStore._formatBodyLabels(body.Labels)
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
