'use strict';

const html5 = require('./html5');

// Some ANSI terminal colors
const 
  RST = '\x1b[0m',  // reset
  RED = '\x1b[31m',
  GRE = '\x1b[32m',
  YEL = '\x1b[33m',
  BLU = '\x1b[34m',
  MAG = '\x1b[35m',
  CYA = '\x1b[36m';

const version = module.exports.version = require('../package.json').version;

const render = module.exports.render = 
  function render(contents = '', context = {}) {
    //require('./slim-arrow-es6'); 
    //const renderer = require('./renderer.js-');
    //let document = renderer(compiled, options);
    let compiled = compile(contents);
    let document = engage(compiled)(context);
    return document;
  };

// Accepts a previously compiled template.
// Returns a ready to run function that when called will execute the
// template contained therein to render the correspondent HTML document.
const engage = module.exports.engage = 
  function engage(compiled = '') {
    let engaging = new Function(compiled);
    return engaging(); 
  };

const compile = module.exports.compile =
  function compile(contents = '') {
    let [output, template] = c1Parser(contents);
    let tags;
    [output, tags] = c2Resolver(output, template);
    output = c3Linker(output, tags);
    output = c4Loader(output, tags);
  
    //let engage = new Function(output);
    //console.log(engage()());

    de&&bug(BLU+'(markupjs.js compile) output ='+RST, output);
    return output;
  };

const c1Parser = function c1Parser(input) {
  let metadata = {};
  let output = '';
  let template;

  //const EXTRACT_YAML_HEADER = /^[^]*([^\w\s])\1{2,}.*\n+([^]*\n)\1{3,}.*\n+/; // Might have used "[/s/S]" instead of the javascript only "[^]". Both are a makeshift due to the missing of a "dotall" modifier (/.../s) in javascript ("." means everything except newline).
  const EXTRACT_YAML_HEADER = /([^\w\s]{3}).*\n+([^]*?\n)\1.*/; // Might have used "[/s/S]" instead of the javascript only "[^]". Both are a makeshift due to the missing of a "dotall" modifier (/.../s) in javascript ("." means everything except newline).
  let yamlMatch = EXTRACT_YAML_HEADER.exec(input);
  de&&bug(BLU+'(markupjs.js c1Parser) yamlMatch ='+RST, yamlMatch);
  if (yamlMatch) { 
    let yamlHeader = yamlMatch[2];    
    de&&bug(BLU+'(markupjs.js c1Parser) yamlHeader ='+RST, yamlHeader);
    const yaml = require('js-yaml');
    try {
      Object.assign(metadata, yaml.load(yamlHeader));
      de&&bug(BLU+'(markupjs.js c1Parser) metadata ='+RST, metadata);
    } catch(err) {
      throw err;
    }
    //const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))?[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4(?:(?:.*\n)(?!\3\2)|[^(?:\*\/)]*?(?=\3\2)(?:\3\2))/; // Might have used "[/s/S]" instead of the javascript only "[^]". Both are a makeshift due to the missing of a "dotall" modifier (/.../s) in javascript ("." means everything except newline).
    const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4[^(?:\*\/)]*\3\2/; 
    let yamlComment = EXTRACT_YAML_HEADER_AS_COMMENT.exec(input);
    de&&bug(BLU+'(markupjs.js c1Parser) yamlComment ='+RST, yamlComment);
    if (yamlComment) {
      output = yamlComment[0] + '\n\n';
      template = input.substr(0, yamlComment.index);
      yamlMatch = yamlComment;
    } else { 
      output = '/*\n' + yamlMatch[0] + '\n*/\n\n'; 
      template = input.substr(0, yamlMatch.index);
    }
    output += 'const metadata = ' + JSON.stringify(metadata) + ';\n\n';
    template += input.slice(yamlMatch[0].length + yamlMatch.index);
  } else {
    template = input;
  }
  return [template, output];
};

const c2Resolver = function c2Resolver(template, input) {
  const TAGGED_TEMPLATE1 = /\b(\w+)[^]*?`[^]*?`/g;
  const TAGGED_TEMPLATE2 = /\b(\w+)(?=[^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]*?`[^]*?`)/g; // ([^\S\n] = "\s and not \n")
  let tags = [];
  let match, match1, match2;
  while ((match1 = TAGGED_TEMPLATE1.exec(template)) !== null) {
    match = (match2 = TAGGED_TEMPLATE2.exec(match1[0])) ? match2[1] : match1[1];
    // if ((match2 = TAGGED_TEMPLATE2.exec(match1[0])) !== null) {
    //   tags.push(match2[1]);
    // } else {
    //   tags.push(match1[1]);
    // }  
    de&&bug(BLU+'c2Resolver match1: '+RST, match1, ', lastIndex =', TAGGED_TEMPLATE1.lastIndex);
    de&&bug(BLU+'c2Resolver match2: '+RST, match2, ', lastIndex =', TAGGED_TEMPLATE2.lastIndex);
    if (tags.indexOf(match) === -1)
      tags.push(match);
  }
  for (let i = 0, leni = tags.length; i < leni; i++) {
    if (html5.tags.indexOf(tags[i]) === -1)
      tags.splice(i,1);
  }
  let output = input + 'const tags = ' +
    JSON.stringify(tags).replace(/"(\w*?)"/g, '$1') + ';\n\n';
  output += 'const template = `' +
    template.replace(/`/g, '\\`').replace(/(\$)(?={.*})/g, '\\$1') + '`;\n\n';
  bug(BLU+'c2Resolver tags: '+RST, tags);
  return [output, tags];
};

const c3Linker = function c3Linker(input, tags) {
  const _scafoldRegularTaggedTemplate = function _scafoldRegularTaggedTemplate() {
    function _regularTaggedTemplate(literals, ...substitutions) {
      let keyword = '_regularTaggedTemplate';
      buffer += `<${keyword}`;
      let attributes = {};
      let i = 0, len = substitutions.length, subst;
      for (; i < len; i++) { 
        subst = substitutions[i];
        if (Object.prototype.toString.call(subst) === `[object Object]`) {
          Object.assign(attributes, subst);
          substitutions[i] = '';
        }
      }
      subst = Object.keys(attributes);
      i = 0, len = subst.length;
      for (; i < len; i++) {
        buffer += ` ${subst[i]}=${JSON.stringify(attributes[subst[i]])}`;
      }  
      buffer += `>`;
      i = 0, len = substitutions.length;
      for (; i < len; i++) {
        buffer += literals[i]; 
        subst = substitutions[i];
        if (Object.prototype.toString.call(subst) === `[object Function]`) {
          subst();
        }
        else
          buffer += subst;
      }
      buffer += literals[i]; 
      buffer += `</${keyword}>\n`;
      return ''; // 
      //_regularTag(keyword, attributes, contents);
    }
  };
  const _scafoldRegularTag = function _scafoldRegularTag() {  
    function _regularTag(keyword, attributes, contents) {
      let output = `<${keyword}`;
      if (Object.keys(attributes).length !== 0 || attributes.constructor !== Object) {
        attributes = JSON.stringify(attributes)
          .replace(/[{}]/g, '').replace(/\s*?:\s*?/g, '=')
          .replace(/","/g, '" "')
          .replace(/(?:"(\w*?)")(?==)/g, '$1');
        output += ` ${attributes}`;
      }
      output += `>\n${contents}\n</${keyword}>\n`;
      buffer += output;
    }
  };  
  const _scafold = function _scafold() {    
    function text(literals, ...substitutions) {
      let output = [];
      let i = 0, leni = literals.length;
      for (; i < leni - 1; i++) {
        output.push(literals[i]);  
        output.push(substitutions[i]);
      }
      output.push(literals[i]);
      output = output.join('');
      buffer += output;
      //console.log(buffer);
      //return output;
    }
  };
  let output = input;
  for (let i = 0, leni = tags.length; i < leni; i++) {
    output += /(?:function _scafoldRegularTaggedTemplate\(\) {)([^]*)}/
      .exec(_scafoldRegularTaggedTemplate.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
      .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, '') // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
      .replace(/_regularTaggedTemplate/g, tags[i]);
  }
  // output += /(?:function _scafoldRegularTag\(\) {)([^]*)}/
  //   .exec(_scafoldRegularTag.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
  //   .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").

  // let output = input + /(?:function _scafold\(\) {)([^]*)}/
  //   .exec(_scafold.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
  //   .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  return output;
};

const c4Loader = function c4Loader(input, tags) {
  const _scafold = function _scafold() {
    function run(context = {}) {
      if (typeof new.target !== "undefined") // Make sure wasn't called with keyword "new".
        throw new Error('\\x1b[31mDevError:\\x1b[0m function "run" should not be called as a constructor (with keyword "new").');
      Object.assign(this, context);
      return run.template.call(this);
    }

    let _template = '\nlet buffer = "";\n'; 
    for (let i = 0, len = tags.length; i < len; i++) 
      _template += tags[i].prototype.constructor + '\n';
    //_template += _regularTag.prototype.constructor + '\n';
    _template += template.replace(/\\`/g, '`').replace(/(\\)(\$)(?={.*})/g, '$2');
    _template += '\nreturn buffer;\n';
    console.log('_template =', _template);
    run.template = new Function(_template); // Static method.
    
    return run.bind(metadata);
  };
  let output = input + /(?:function _scafold\(\) {)([^]*)}/
    .exec(_scafold.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").

 //bug(BLU+'output'+RST, output);

  return output; 
};

let de = false;
const bug = console.log;

const debug = module.exports.debug = (toggle) => {
  if (Object.prototype.toString.call(toggle) === `[object Boolean]`)
    de = toggle;
  return de;
};

