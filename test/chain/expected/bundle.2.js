(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"entry2":[function(require,module,exports){
__browserifyDynamicImport__2( require("a") )
},{"a":2}],2:[function(require,module,exports){
var _$browserifyDynamicImport = require("../../helper.js");
_$browserifyDynamicImport(5).then(function (exports) {
  return exports()
}).then(function (result) {
  console.log('c', result)
})
module.exports = 'hello from a'

},{"../../helper.js":1}]},{},["entry2"]);