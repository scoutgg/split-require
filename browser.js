// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks, in case the same module is imported
// multiple times simultaneously.
var receivers = {}

function load (index, cb) {
  // We already have this bundle.
  if (cache[index]) {
    if (cb) setTimeout(cb.bind(null, null, cache[index]), 0)
    return
  }

  var url = load.b[index]
  // TODO throw an error if we don't have the url

  // Combine callbacks if another one was already registered.
  var prev = receivers[index]
  receivers[index] = onload

  function onload (err, result) {
    if (prev) prev(err, result)
    else if (!err) cache[index] = result
    if (cb) cb(err, result)
    delete receivers[index]
  }

  // The <script> element for this bundle was already added.
  if (prev) return

  var s = document.createElement('script')
  s.async = true
  s.type = 'application/javascript'
  s.src = url
  s.onerror = function () {
    onload(Error('Failed to load'))
  }
  document.body.appendChild(s)
}

// Called by dynamic bundles once they have loaded.
function loadedBundle (index, result) {
  if (receivers[index]) {
    receivers[index](null, result)
  } else {
    cache[index] = result
  }
}

// "Load" a module that we know is included in this bundle.
function loadLocal (requirer, onload) {
  try {
    onload(null, requirer())
  } catch (err) {
    onload(err)
  }
}

// Map dynamic bundle entry point IDs to URLs.
load.b = {}

// Used by the bundle.
load.l = loadedBundle
load.t = loadLocal

module.exports = load