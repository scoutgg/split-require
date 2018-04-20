var test = require('tape')
var path = require('path')
var hasAsyncHooks = require('has-async-hooks')()
var sr = require('../')

var expected = {
  one: [
    path.join(__dirname, 'capture/view1.js'),
    path.join(__dirname, 'capture/data1.js'),
    path.join(__dirname, 'capture/data3.js')
  ].sort(),
  two: [
    path.join(__dirname, 'capture/view2.js'),
    path.join(__dirname, 'capture/data3.js')
  ].sort()
}

test('capture', { skip: !hasAsyncHooks }, function (t) {
  t.plan(200)
  var app = require('./capture/app')

  // Ensure multiple concurrent renders don't interfere
  // by just setting off a ton of them
  for (var i = 0; i < 200; i++) {
    var which = Math.random() > 0.5 ? 'one' : 'two'
    queue(which)
  }

  function queue (which) {
    setTimeout(function () {
      app(which).then(function (result) {
        t.deepEqual(result.bundles.sort(), expected[which])
      }).catch(t.fail)
    }, 4 + Math.floor(Math.random() * 10))
  }
})

test('capture sync', { skip: !hasAsyncHooks }, function (t) {
  t.plan(20)
  var render = require('./capture/render')

  // similar to above, but every call originates in the same
  // async context
  for (var i = 0; i < 20; i++) {
    (function (i) {
      var which = i % 2 ? 'one' : 'two'

      sr.capture(function () {
        return render(which)
      }).then(function (result) {
        t.deepEqual(result.bundles.sort(), expected[which])
      }).catch(t.fail)
    }(i))
  }
})

test('no capture', { skip: hasAsyncHooks }, function (t) {
  t.plan(1)
  t.pass('ok')
})
