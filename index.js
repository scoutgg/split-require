var path = require('path')
var fs = require('fs')
var transformAst = require('transform-ast')
var babylon = require('babylon')
var through = require('through2')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')
var runParallel = require('run-parallel')

// import function name used internally only, to rewrite `import()` calls
// so module-deps doesn't error out on them.
var importFunction = '_$browserifyDynamicImport'

var helperPath = require.resolve('./helper')
var parseOpts = {
  parser: babylon,
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

function transform (file, opts) {
  var source = ''
  return through(onwrite, onend)
  function onwrite (chunk, enc, next) {
    source += chunk
    next()
  }
  function onend (next) {
    var moduleOpts = Object.assign({}, parseOpts, {
      sourceType: 'module',
      plugins: ['dynamicImport']
    })
    var hasImport = false
    var result = transformAst(source, moduleOpts, function (node) {
      if (node.type === 'Import') {
        // rewrite to require() call to make module-deps pick up on this
        node.edit.update('require')
        node.parent.edit
          .prepend(importFunction + '(')
          .append(')')
        hasImport = true
      }
      if (node.type === 'Program' && hasImport) {
        var relative = path.relative(path.dirname(file), helperPath)
        node.prepend('var ' + importFunction + ' = require(' + JSON.stringify(relative) + ');\n')
      }
    })
    next(null, result.toString())
  }
}

module.exports = function dynamicImportPlugin (b, opts) {
  var outputDir = opts.dir || './'
  var outname = opts.chunkName || function (chunk) {
    return 'chunk.' + chunk.index + '.js'
  }
  var publicPath = opts.public || './'
  var receiverPrefix = opts.prefix || '__browserifyDynamicImport__'

  var rows = []
  var rowsById = Object.create(null)
  var imports = []
  b.transform(transform, { global: true })
  b.pipeline.get('label').push(through.obj(onwrite, onend))

  b._bpack.hasExports = true

  function onwrite (row, enc, cb) {
    var result = transformAst(row.source, parseOpts, function (node) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === importFunction) {
        processDynamicImport(row, node)
      }
    })

    row.transformable = result
    rows.push(row)
    rowsById[row.index] = row

    cb(null)
  }

  function onend (cb) {
    var self = this
    // Remove dynamic imports from row dependencies.
    imports.forEach(function (imp) {
      var row = getRow(imp.row)
      var dep = getRow(imp.dep)
      deleteValue(row.deps, dep.id)
      deleteValue(row.indexDeps, dep.index)
    })

    // Collect rows that should be in the main bundle.
    var mainRows = []
    rows.filter(function (row) { return row.entry }).forEach(function (row) {
      mainRows.push(row.index)
      gatherDependencyIds(row, mainRows)
    })

    // Find which rows belong in which dynamic bundle.
    var dynamicBundles = Object.create(null)
    imports.forEach(function (imp) {
      var row = getRow(imp.row)
      var depEntry = getRow(imp.dep)
      var node = imp.node
      if (mainRows.includes(depEntry.index)) {
        // this entry point is also non-dynamically required by the main bundle.
        // we should not move it into a dynamic bundle.
        node.update('Promise.resolve().then(function () { return require(' + JSON.stringify(depEntry.id) + ') })')
        row.deps[depEntry.id] = depEntry.id
        row.indexDeps[depEntry.id] = depEntry.index
        return
      }
      var depRows = gatherDependencyIds(depEntry).filter(function (id) {
        // If a row required by this dynamic bundle also already exists in the main bundle,
        // expose it from the main bundle and use it from there instead of including it in
        // both the main and the dynamic bundles.
        if (mainRows.includes(id)) {
          getRow(id).expose = true
          return false
        }
        return true
      })

      dynamicBundles[depEntry.index] = depRows
    })

    // No more source transforms after this point, save transformed source code
    rows.forEach(function (row) {
      if (row.transformable) {
        row.source = row.transformable.toString()
      }
    })

    var pipelines = Object.keys(dynamicBundles).map(function (entry) {
      return createPipeline.bind(null, entry, dynamicBundles[entry])
    })

    runParallel(pipelines, function (err, mappings) {
      if (err) return cb(err)
      mappings = mappings.reduce(function (obj, x) {
        obj[x.entry] = path.join(publicPath, x.filename)
        return obj
      }, {})

      var helperRow = rows.find(function (r) { return r.file === helperPath })
      helperRow.source = helperRow.source
        .replace('MAPPINGS', JSON.stringify(mappings))
        .replace('PREFIX', JSON.stringify(receiverPrefix))

      new Set(mainRows).forEach(function (id) {
        self.push(getRow(id))
      })

      cb(null)
    })
  }

  function createPipeline (entryId, depRows, cb) {
    var entry = getRow(entryId)
    var pipeline = splicer.obj([
      'pack', [ pack({ raw: true }) ],
      'wrap', []
    ])

    b.emit('import.pipeline', pipeline)

    var tempname = path.join(outputDir, '.browserify-dynamic-chunk-' + entry.id + '-' + Date.now())
    var writer = pipeline.pipe(fs.createWriteStream(tempname))

    pipeline.write(makeDynamicEntryRow(entry))
    pipeline.write(entry)
    depRows.forEach(function (depId) {
      var dep = getRow(depId)
      pipeline.write(dep)
    })
    pipeline.end()

    pipeline.on('error', cb)

    runParallel([
      function (cb) {
        var basename = outname(entry, pipeline, cb)
        if (basename) cb(null, basename)
      },
      function (cb) {
        writer.on('error', cb)
        writer.on('close', function () { cb(null) })
      }
    ], function (err, results) {
      if (err) return cb(err)
      var name = results[0]
      var finalname = path.join(outputDir, name)
      fs.rename(writer.path, finalname, function (err) {
        if (err) return cb(err)
        cb(null, { entry: entryId, filename: name })
      })
    })
  }

  function values (object) {
    return Object.keys(object).map(function (k) { return object[k] })
  }
  function gatherDependencyIds (row, arr) {
    var deps = values(row.indexDeps)
    arr = arr || []
    arr.push.apply(arr, deps)

    deps.forEach(function (id) {
      var dep = rowsById[id]
      // not sure why this is needed yet,
      // sometimes `id` is the helper path and that doesnt exist at this point
      // in the rowsById map
      if (dep) {
        gatherDependencyIds(dep, arr)
      }
    })

    return arr
  }

  function queueDynamicImport (row, dep, node) {
    imports.push({
      row: row,
      dep: dep,
      node: node
    })
  }

  function processDynamicImport (row, node) {
    var importPath = node.arguments[0].arguments[0].value
    var resolved = row.indexDeps[importPath]
    node.edit.update(importFunction + '(' + JSON.stringify(resolved) + ')')

    queueDynamicImport(row.index, resolved, node)
  }

  function getRow (id) {
    return rowsById[id]
  }

  // Create a proxy module that will call the dynamic bundle receiver function
  // with the dynamic entry point's exports.
  function makeDynamicEntryRow (entry) {
    return {
      id: 'entry' + entry.index,
      source: receiverPrefix + entry.index + '( require("a") )',
      entry: true,
      deps: { a: entry.id },
      indexDeps: { a: entry.index }
    }
  }
}

function deleteValue (obj, val) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (obj[i] === val) delete obj[i]
    }
  }
}
