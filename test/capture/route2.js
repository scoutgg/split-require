var parallel = require('run-parallel')
module.exports = function (cb) {
  process.nextTick(function () {
    Promise.resolve().then(function () {
      parallel([
        function (cb) { require('../../')('./view2', cb) },
        function (cb) { require('../../')('./data3', cb) },
        function (cb) { setTimeout(cb, 1) } // ensure that there is an event loop yield at some point
      ], function (err, xyz) {
        cb(null, xyz[0](`Second route. ${xyz[1]}`))
      })
    })
  })
}