(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({"entry4":[function(require,module,exports){
require("split-require").l(4, require("a"));
},{"a":4,"split-require":"split-require"}],4:[function(require,module,exports){
var splitRequire = require('split-require')

module.exports = function (cb) {
  splitRequire(5, function (err, exports) {
    if (err) cb(err)
    else cb(null, 'hello from c: ' + exports)
  })
}

},{"split-require":"split-require"}]},{},["entry4"]);
