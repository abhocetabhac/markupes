'use strict';

const
  markupjs = require('./markupjs'),
  OptionParser = require('./optparse').OptionParser,
  thunkify = require('./thunkify'),
  fs = require('fs'),
  path = require('path');

// Some ANSI terminal colors
const 
  RST = '\x1b[0m',  // reset
  RED = '\x1b[31m',
  GRE = '\x1b[32m',
  YEL = '\x1b[33m',
  BLU = '\x1b[34m',
  MAG = '\x1b[35m',
  CYA = '\x1b[36m';

// The elements of the array "argv" will be the space-separated tokens (words)
// following "node bin/markupjs" in the command-line .
const argv = process.argv.slice(2);

let usage = `  Usage:
    markupjs [options] path/to/template.js`;
let switches = [
  ['-v', '--version', 'display markupjs version.'],
  ['-h', '--help', 'display this help message.'],
  ['-o', '--output [dir]', 'set the directory for compiled html.'],
  ['-e', '--extension [ext]', 'set the output file extension (e.g. ".md")\n\t\t  (default: ".html").'],
  ['-j', '--js', 'compile template into a js script (template + embedded\n\t\t  renderer).'],
  ['-x', '--autoexec', 'compile template into a js batch file (template + embedded\n\t\t  renderer). (Implies "-j".) (Running in command line\n\t\t  "node [output file]" prints out the rendered document to\n\t\t  the console.)'],
  //['-b', '--bare', 'use with -j to compile template to js (template only)' ],
  //['-c', '--core', 'use with -j to compile renderer to js (renderer only)' ],
  ['-n', '--namespace [name]', 'global object holding the templates\n\t\t  (default: "templates").'],
  ['-w', '--watch', 'watch templates for changes and recompile.'],
  ['-p', '--print', 'print the output file to stdout.'],
  ['-f', '--format', 'apply line breaks and indentation to html output.'],
  ['-u', '--utils', 'add helper locals (currently only "render").'],
  //['-z', '--optimize', 'optimize resulting JS'],
  ['-k', '--package', 'use with -j to include all templates in a single\n\t\t  "[namespace].js".'],
  ['-d', '--debug', 'displays debug information ("cli.js", "markupjs.js").'],
  ['-D', '--Debug', 'displays futher debug information ("thunkify.js").']
];

this.options = { // module.exports.options
  'output [dir]': process.cwd(),
  'extension [ext]': '.html',
  'namespace [name]': 'templates'
}; 

//exports.run = () => { // Alternative way to export.
//module.exports.run = () => { // Second alternative to export.
//export const run = () => { // ES6 form requires nodejs's module "import-export" in the parent module.
this.run = () => {
  let optParser = new OptionParser(switches, usage);
  try {
    Object.assign(this.options, optParser.parse(argv)); 
  } catch (err) {
    process.exitCode = 1;
    throw err; 
  }
  let o = this.options;
  if (o.debug) { markupjs.debug(true); debug(true); }
  if (o.Debug) { thunkify.debug(true); }
  de&&bug(BLU+'Command-line options = '+RST, o);
  if (o.version) { console.log('markupjs v.', markupjs.version); }
  if (o.help || argv.length === 0) {
    console.log(optParser.help());
    return;
  }
  if (o.utils) {
    o.locals = o.locals || {};
    o.locals.render = (file) => { // this === module.exports
      let contents;
      try {
        contents = fs.readFileSync(file, 'utf-8');
      } catch (err) {
        console.error('Error processing option "--util": ', err.message);
      }
      return markupjs.render(contents, this.options); 
    };
  }
  if (o.arguments.length > 0) {
    let files = o.arguments;//.slice(0);
    let proc = o.js || o.autoexec ? compile : render;
    let results = [];
    try {
      for (let i = 0, leni = files.length; i < leni; i++) 
        results.push(proc(files[i], o['output [dir]'], o['extension [ext]'],thunkify.osculate(fnWrite, fnEnd)));
    } catch (err) {
      throw err;
    }
    return results;
    // if (o.watch) {
    //   watch(files, (file) => { // this === module.exports
    //     let o = this.options;  // Assignment just for notation brevity below. 
    //     console.log('Watching file', file);
    //     if (o.js && o.package) {
    //       return compile(o.arguments, o.output, o.js, o.namespace);
    //     } else {
    //       return compile(file, o.output, o.js, o.namespace);
    //     }
    //   });
    // }
    // if (o.js && o.package) {
    //   // return compile(files, o.output, o.js, o.namespace);
    // } else {
    //   let results = [];
    //   for (let i = 0, leni = files.length; i < leni; i++) {
    //     let file = files[i];
    //     results.push(compile(file, o.output, o.js, o.namespace));
    //   }
    //   return results;
    // }
  }
};


const fnReadFilePre = (args) => { 
  de&&bug(CYA+'fnReadFilePre:'+RST, args[0]);
  if (args[1] != 'utf-8')
    args.splice(1, 0, 'utf-8'); // array.splice(index, delete, item);
  return args;
};
const fnReadFile = (err = null, input = null, args) => {
  de&&bug(CYA+'fnReadFile:'+RST, args);
  if (err) { // Errors from "fs.readFile" arrive here.
    if (err.code === "ENOENT") {
      process.exitCode = 2;
      err.message = `Failed to find file "${err.path}".`;
    }
    throw err; // Signal an unrecoverable error and stop any post-processing for that file, but will not abort the program continuing on the processing of other files.
  }
  return input;
};
const fnTrimLfEof = (err = null, input = null, args) => {
  de&&bug(CYA+'fnTrimLfEof:'+RST, args[0]);
  if (Object.prototype.toString.call(input) === '[object String]') {
    let output = input.replace(/[\r\n]+$/, "");
    if (input.match(/[\r\n]{2,}$/)) {
      let exception = new Error(YEL+'Warning:'+RST+' extra "\\r" or "\\n" have been trimmed from the EOF.');
      console.error(exception.message);
      exception.recoverable = output; // Signal a recoverable error to the generator function
      throw exception;                // and pass on the output embedded in the error object.
    }
    return output; 
  } else {
    let exception = new Error(`${YEL}Warning:${RST} post-processing function "${fnTrimLfEof.name}" expects a "${typeof ''}",\n\t but recieved "${Object.prototype.toString.call(input).match(/\s(.+)\]$/)[1]}".`);
    console.error(exception.message);
    exception.recoverable = input; // Signal a recoverable error to the generator function
    throw exception;               // and return the input untouched.
  }
};
const gnReadFile = thunkify.generatorFactory(fs.readFile, fnReadFile, fnTrimLfEof); 
const readFile = thunkify.factory(gnReadFile, fnReadFilePre);

const fnWriteFilePre = (args) => { 
  de&&bug(CYA+'fnWriteFilePre:'+RST, args[0]);
  if (args[2] != 'utf-8')
    args.splice(2, 0, 'utf-8'); // array.splice(index, delete, item);
  return args;
};
const fnWriteFile = (err = null, contents = null, args) => {
  de&&bug(CYA+'fnWriteFile:'+RST, args[0]+'\n'+args[1].substr(0, 10)+"..."+args[1].substr(-10, 10));
  if (err) {
    process.exitCode = 3;
    err.message = `Failed to write to file "${err.path}".`;
    throw err;
  }
  console.log(`${GRE}Wrote to file ${RST}"${args[0]}"${GRE}.${RST}`); 
  return contents;
};
const gnWriteFile = thunkify.generatorFactory(fs.writeFile, fnWriteFile); 
const writeFile = thunkify.factory(gnWriteFile, fnWriteFilePre);

const fnPrint = (err = null, input = null, args) => {
  de&&bug(CYA+'fnPrint:'+RST, args[0]);
  if (this.options.print)
    console.log(input);
  return input;
};

const fnWrite = (err = null, input = null, args, errLog) => {
  de&&bug(CYA+'fnWrite:'+RST, args[0]);
  const write = (inPath, outDir, outFileExt, itEnd) => {
    let name = path.basename(inPath, path.extname(inPath));
    let outFile = path.join(outDir, name+outFileExt);
    de&&bug(BLU+'outFile = '+outFile+RST);
    writeFile(outFile, input, itEnd); // Add iterator "itEnd" as last post-processing of the generator function associated to thunk wrapper "writeFile".
  };
  write(...args);
  return input;
};
const fnEnd = (err = null, input = null, args, errLog) => {
  de&&bug(CYA+'fnEnd:'+RST, args[0]);
  if (errLog.length === 0) 
    console.log(GRE+'Done successfully.'+RST); 
  else {
    console.log(MAG+'Done, but stumbled upon recoverable errors. See the '+YEL+'warnings'+MAG+'.'+RST); 
    if (debug()) {
      for (let e of errLog) {
        console.log(BLU+'errLog ='+RST, e.fn, e.args, '\n '+RST, e.error.message);
        const SECOND_LINE = /(?:(?:\r\n?)|\n|\u2028|\u2029)(?:(.*)(?:(?:\r\n?)|\n|\u2028|\u2029))/;
         bug((SECOND_LINE.exec(e.error.stack) || [e.error.stack])[0].trim(), '...'); 
      }
    }
  }
  return input;
};

const fnCompile = (err = null, input = null, args) => {
  de&&bug(CYA+'fnCompile:'+RST, args[0]);
  let output;
  try {
    output = markupjs.compile(input, this.options);
  } catch (err) {
    process.exitCode = 4;
    err.message = `Failed to compile file "${args[0]}" -\n` + err.message;
    throw err; // Signal an unrecoverable error and stop any post-processing for that file, but will not abort the program continuing on the processing of other files.
  } 
  if (this.options.autoexec) {
    output = '#!/usr/bin/env node\n(function() {\n' + 
      output.replace(/(?:return\srun\.bind\(metadata\);)[^]*?$/, 
        'console.log(run.bind(metadata)());\n}());');
  }
  return output;
};

const gnCompile = thunkify.generatorFactory(readFile, fnCompile, fnPrint);
const compile = thunkify.factory(gnCompile);

const fnRender = (err = null, input = null, args) => {
  de&&bug(CYA+'fnRender:'+RST, args[0]);
  let output;
  try {
    output = markupjs.render(input, this.options);
  } catch (err) {
    process.exitCode = 5;
    err.message = `Failed to render file "${args[0]}" -\n` + err.message;
    throw err; // Signal an unrecoverable error and stop any post-processing for that file, but will not abort the program continuing on the processing of other files.
  }
  return output;
};

const gnRender = thunkify.generatorFactory(readFile, fnRender, fnPrint);
const render = thunkify.factory(gnRender);

const watch = (files, fn) => {
  fn('watch');
};

// const compile = (inPath, outDir, js, namespace = 'templates') => {
//   const cbReadFile = (err, contents) => {
//     let ext, output;
//     handleErrors(err);
//     let name = path.basename(inPath, path.extname(inPath));
//     if (!js) {
//       output = markupjs.render(contents, this.options);
//       ext = '.html';
//     } else {
//       let func = markupjs.compile(contents, this.options);
//       output = `(function() {
//           this.${namespace} || (this.${namespace} = {});
//           this.${namespace}[${JSON.stringify(name)}] = ${func};
//         }.call(this));`;
//       ext = '.js';
//     }
//     return write(inPath, name, output, outDir, ext);
//   };
//   return fs.readFile(inPath, 'utf-8', cbReadFile);
// };

const compileMany = (inPath, outDir, js, namespace = 'templates') => {
  if (Array.isArray(inPath)) {
    const appendTemplate = () => {
      let
        body = '',
        i = 0,  
        output;
      if (i >= inPath.length || !(this.options.package)) {
        output = '(function(){ \n  this.' + namespace + ' || (this.' + namespace + ' = {});\n  ' + body + '\n}).call(this);';
        return write(inPath[0], namespace, output, outDir, '.js');
      } else {
        return fs.readFile(inPath[i], 'utf-8', function(err, contents) {
          var func, name;
          handleErrors(err);
          name = path.basename(inPath[i], path.extname(inPath[i]));
          func = markupjs.compile(contents, this.options);
          body += 'this.' + namespace + '[' + (JSON.stringify(name)) + '] = ' + func + ';\n';
          i += 1;
          return appendTemplate();
        });
      }
    };
    return appendTemplate();
  }
};


let de = false;
const bug = console.log;

const debug = (toggle) => { 
  if (Object.prototype.toString.call(toggle) === `[object Boolean]`)
    de = toggle;
  return de;
};


//console.log(module);
//console.log(this);
//console.log(module.exports);
//console.log(module.exports === this);
//console.log(global);

// const fnEnd = (err = null, input = null, args, errLog) => {
//   de&&bug(CYA+'fnEnd:'+RST, args);
//   const write = (inPath, outDir, outFileExt) => {
//     let name = path.basename(inPath, path.extname(inPath));
//     let outFile = path.join(outDir, name+outFileExt);
//     de&&bug(BLU+'outFile='+outFile+RST);
//     writeFile(outFile, input);
//   };
//   write(...args);
//   errLog.concat(errLogWrite);
//   if (errLog.length === 0) 
//     console.log(GRE+'Rendered successfully.'+RST); 
//   else {
//     console.log(MAG+'Rendered, but stumbled upon recoverable errors. See the '+YEL+'warnings'+MAG+'.'+RST); 
//     if (thunkify.debug()) {
//       for (let e of errLog)
//         console.log(MAG, e.fn, e.args, '\n'+RST, e.error.message);
//     }
//   }
//   return input;
// };
// const gnRender = thunkify.generatorFactory(readFile, fnRender, fnPrint, fnEnd);
// const render = thunkify.factory(gnRender);

// const gnEnd = function* gnEnd(){
//   let itSelf = yield;
//   let [err, io, args, errLog] = yield;
//   const write = (inPath, outDir, outFileExt) => {
//     let name = path.basename(inPath, path.extname(inPath));
//     let outFile = path.join(outDir, name+outFileExt);
//     de&&bug(BLU+'outFile='+outFile+RST);
//     writeFile(outFile, io, itSelf); // Add iterator "itSelf" as last post-processing of the generator function associated to thunk wrapper "writeFile".
//   };
//   write(...args);
//   let errLogWrite;
//   [err, io, args, errLogWrite] = yield io; // This "yield" actually finishes the execution of post-processing by the generator function associated to the thunk wrapper "render".
//   errLog = errLog.concat(errLogWrite); // Excution is resumed as the last post-processing of the generator function associated to the thunk wrapper "writeFile".
//   if (errLog.length === 0) 
//     console.log(GRE+'Done successfully.'+RST); 
//   else {
//     console.log(MAG+'Done, but stumbled upon recoverable errors. See the '+YEL+'warnings'+MAG+'.'+RST); 
//     if (thunkify.debug()) {
//       for (let e of errLog)
//         console.log(MAG, e.fn, e.args, '\n'+RST, e.error.message);
//     }
//   }
//   return io;
// };
// const itEnd = gnEnd();
// itEnd.next();
// itEnd.next(itEnd);
// const gnRender = thunkify.generatorFactory(readFile, fnRender, fnPrint, itEnd);
// const render = thunkify.factory(gnRender);

// CAVEAT: this construction fails processing multiple files because there
//         is only one instance of "itEnd".
//const itEnd = thunkify.osculate(fnWrite, fnEnd);
//const gnRender = thunkify.generatorFactory(readFile, fnRender, fnPrint, itEnd);
//const render = thunkify.factory(gnRender);

