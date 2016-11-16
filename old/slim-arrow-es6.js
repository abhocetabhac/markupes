/*
  Slim-arrow-script

  -Allows for the use of coffee-script like function expression "->"
   in the child modules; 
  -Defines the new token "*->" for function generators ("function*");
  -Adds the syntatic sugar " .variable" --> " this.variable";
  -Allows for the use of ECMAscript6 import/export syntax in child modules.

  Files with extension ".js-" are fully translated.
  Files with extension ".js" undergoes just the import/export translation.
*/
'use strict';

const hook = require('node-hook').hook;

// Slim-arrow function substitution.
const slimArrows = (src) => {
  src = src.replace(/\((.*?)\)\s*?(\*?)->\s*?/g, 'function$2($1) ');
  src = src.replace(/(\s*?)(\*?)->\s*?/g, '$1function$2() ');
  src = src.replace(/([\s\W]+?)\.(\w+?)/g, '$1this.$2');
  return src;
};

// The following is based on the brilliant npm module "import-export".
const es6ImportExport = (src) => {
  src = src.replace(/export default ([^ ]*?)/g, 'module.exports = $1');
  src = src.replace(/export (var|let|const) ([a-zA-Z0-9_$]*)/g, '$1 $2 = module.exports.$2');
  src = src.replace(/export function ([a-zA-Z0-9_$]*)/g, 'var $1 = module.exports.$1 = function $1');
  src = src.replace(/export class ([a-zA-Z0-9_$]*)/g, 'let $1 = module.exports.$1 = class $1');
  src = src.replace(/import ([^{]*?) from '(.*?)'/g, 'const $1 = require("$2")');
  src = src.replace(/import {(.*?)} from '(.*?)'/g, (all, $1, $2) => {
    return $1.split(",")
      .map(part => 'var ' + part + '= require("' + $2 + '").' + part.trim() + ';')
      .join('');
  });
  return src;
};

hook('.js-', (source, filename) => {
  return es6ImportExport(slimArrows(source));
});

hook('.js', (source, filename) => {
  return es6ImportExport(source);
});
