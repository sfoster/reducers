/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false globalstrict: true */

'use strict';

var create = Object.create

var Method = require('method')
var Box = require('./box')

// Define a shortcut for `Array.prototype.slice.call`.
var unbind = Function.call.bind(Function.bind, Function.call)
var slice = Array.slice || unbind(Array.prototype.slice)

var end = Box('end of the sequence')
exports.end = end

var accumulated = Box('Indicator that source has being accumulateed')
exports.accumulated = accumulated

var error = Box('error')
exports.error = error

var accumulate = Method(function(self, next, start) {
  next(end(), next(self, start))
})
exports.accumulate = accumulate

function accumulateEmpty(_, f, start) { f(end(), start) }

accumulate.define(undefined, accumulateEmpty)
accumulate.define(null, accumulateEmpty)

accumulate.define(Array, function(array, next, initial) {
  var state = initial, index = 0, count = array.length
  while (index < count) {
    state = next(array[index++], state)
    if (state && state.is === accumulated) break
  }
  next(end(), state)
})

function transformer(source, transform) {
  return convert(source, function(self, next, initial) {
    return accumulate(transform(source), next, initial)
  })
}
exports.transformer = transformer

function convert(source, method) {
  return accumulate.implement(create(source), method)
}
exports.convert = convert

function transform(source, f) {
  return convert(source, function(self, next, initial) {
    accumulate(source, function(value, result) {
      return value && value.isBoxed ? next(value, result)
                                    : f(next, value, result)
    }, initial)
  })
}
exports.transform = transform

function filter(source, predicate) {
  /**
  Composes filtered version of given `source`, such that only items contained
  will be once on which `f(item)` was `true`.
  **/
  return transform(source, function(next, value, accumulated) {
    return predicate(value) ? next(value, accumulated) : accumulated
  })
}
exports.filter = filter

function map(source, f) {
  /**
  Composes version of given `source` where each item of source is mapped using `f`.
  **/
  return transform(source, function(next, value, accumulated) {
    return next(f(value), accumulated)
  })
}
exports.map = map

function take(source, n) {
  /**
  Composes version of given `source` containing only element up until `f(item)`
  was true.
  **/
  return transformer(source, function(source) {
    var count = n >= 0 ? n : Infinity
    return transform(source, function(next, value, result) {
      count = count - 1
      return count === 0 ? next(accumulated(), next(value, result)) :
             count > 0 ? next(value, result) :
                         next(accumulated(), result)
    })
  })
}
exports.take = take

function drop(source, n) {
  /**
  Reduces given `reducible` to a firs `n` items.
  **/
  return transformer(source, function(source) {
    var count = n >= 0 ? n : 1
    return transform(source, function(next, value, result) {
      return count -- > 0 ? result :
                            next(value, result)
    })
  })
}
exports.drop = drop

function takeWhile(source, predicate) {
  /**
  Composes version of given `source` containing only firs `n` items of it.
  **/
  return transform(source, function(next, value, state) {
    return predicate(value) ? next(value, state) :
                              next(accumulated(), state)
  })
}
exports.takeWhile = takeWhile

function dropWhile(source, predicate) {
  /**
  Reduces `reducible` further by dropping first `n`
  items to on which `f(item)` ruturns `true`
  **/
  return transformer(source, function(source) {
    var active = true
    return transform(source, function(next, value, result) {
      return active && (active = predicate(value)) ? result :
                                                     next(value, result)
    })
  })
}
exports.dropWhile = dropWhile

function tail(source) {
  return drop(source, 1)
}
exports.tail = tail


//console.log(into(skip(2, [ 1, 2, 3, 4, 5, 6 ])))
//

function append1(left, right) {
  return convert({}, function(self, next, initial) {
    accumulate(left, function(value, result) {
      return value && value.is === end ? accumulate(right, next, result) :
                                         next(value, result)
    }, initial)
  })
}
function append(left, right, rest) {
  /**
  Joins given `reducible`s into `reducible` of items
  of all the `reducibles` preserving an order of items.
  **/
  return rest ? slice(arguments, 1).reduce(append1, left) :
                append1(left, right)
}
exports.append = append

function capture(source, recover) {
  return convert(source, function(self, next, initial) {
    accumulate(source, function(value, result) {
      if (value && value.is === error) {
        accumulate(recover(value.value, result), next, result)
      } else {
        next(value, result)
      }
    }, initial)
  })
}
exports.capture = capture

function reductions(source, f, initial) {
  /**
  Returns `reducible` collection of the intermediate values of the reduction
  (as per reduce) of coll by `f`, starting with `initial` value.

  ## Example

  reductions([1 1 1 1], function(x, y) { return x + y }, 0)
  // => [ 1, 2, 3, 4 ]
  **/
  return convert(source, function(self, next, result) {
    var state = initial
    accumulate(source, function(value, result) {
      state = value && value.isBoxed ? next(value, result) : f(state, value)
      return next(state, result)
    }, result)
  })
}
exports.reductions = reductions


function adjust(source, f, initial) {
  /**
  Function takes reducible `source`, `f` transformer function and `initial`
  state. Adapted version of `source` is returned in result. `f` is called with
  each item of the source and curried state and is expected to return array
  of adjusted item and new state (which will be curried to next call) pair.

  ## Example

  var delimiterChar = ' '
  var data = [ 'Bite my', ' shiny, metal ', 'ass!' ]
  var chunks = adjust(data, function(chunk, prefix) {
    var text = prefix + chunk
    var delimiterIndex = text.lastIndexOf(delimiterChar)
    var splitIndex = delimiterIndex >= 0 ? delimiterIndex : text.length
    var capturedChunk = text.substr(0, splitIndex)
    var curriedChunk = text.substr(splitIndex + 1)
    return [ capturedChunk, curriedChunk ]
  }, '')
  var words = expand(chunks, function(chunk) {
    return chunk.split(delimiterChar)
  })

  // => [ 'Bite', 'my', 'shiny', 'metal', 'ass!' ]
  **/
  return convert(source, function(self, next, result) {
    var state = initial
    accumulate(source, function(value, result) {
      if (value && value.isBoxed) return next(value, result)
      var pair = f(value, state)
      state = pair[1]
      return next(pair[0], result)
    }, result)
  })
}
exports.adjust = adjust
