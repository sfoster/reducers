/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false globalstrict: true*/
'use strict';

var into = require('../accumulator').into

exports['test into'] = function(assert) {
  var source = [ 1, 2, 3 ]
  assert.deepEqual(into(source), [ 1, 2, 3 ],
                   'returns identical')
  assert.notEqual(into(source), source,
                  'but different one')
}

exports['test into buffer'] = function(assert) {
  var buffer = [ 0 ]
  assert.equal(into([ 1, 2, 3 ], buffer), buffer,
               'reduces into buffer if provided')
  assert.deepEqual(buffer, [ 0, 1, 2, 3 ],
                   'pre-existing items in buffer are kept')
}

if (module == require.main)
  require('test').run(exports)
