'use strict';

const
  yaml = require('js-yaml'),
  acorn = require('../node_modules/acorn/dist/acorn'),
  awalk = require('../node_modules/acorn/dist/walk'),
  html5 = require('./html5');

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
  let output = '\'use strict\';\n';
  let template;

  //const EXTRACT_YAML_HEADER = /^[^]*([^\w\s])\1{2,}.*\n+([^]*\n)\1{3,}.*\n+/; 
  const EXTRACT_YAML_HEADER = /([^\w\s]{3}).*\n+([^]*?\n)\1.*/; // Might have used "[/s/S]" instead of the javascript only "[^]". Both are a makeshift due to the missing of a "dotall" modifier (/.../s) in javascript ("." means everything except newline).
  let yamlMatch = EXTRACT_YAML_HEADER.exec(input);
  de&&bug(BLU+'(markupjs.js c1Parser) yamlMatch ='+RST, yamlMatch);
  if (yamlMatch) { 
    let yamlHeader = yamlMatch[2];    
    de&&bug(BLU+'(markupjs.js c1Parser) yamlHeader ='+RST, yamlHeader);
    try {
      Object.assign(metadata, yaml.load(yamlHeader));
      de&&bug(BLU+'(markupjs.js c1Parser) metadata ='+RST, metadata);
    } catch(err) {
      throw err;
    }
    //const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))?[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4(?:(?:.*\n)(?!\3\2)|[^(?:\*\/)]*?(?=\3\2)(?:\3\2))/; 
    const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4[^(?:\*\/)]*\3\2/; 
    let yamlComment = EXTRACT_YAML_HEADER_AS_COMMENT.exec(input);
    de&&bug(BLU+'(markupjs.js c1Parser) yamlComment ='+RST, yamlComment);
    if (yamlComment) {
      output += yamlComment[0] + '\n\n';
      template = input.substr(0, yamlComment.index);
      yamlMatch = yamlComment;
    } else { 
      output += '/*\n' + yamlMatch[0] + '\n*/\n\n'; 
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
  let ast;
  try {
    ast = acorn.parse(template, {allowReturnOutsideFunction: true}); // In normal templates, a "return" outside function shall not occur, but this relax parsing option is here to allow for unusual expert cases.
  } catch (err) {
    console.log(YEL+'The end of the excerpt below marks where parsing the template failed:'+RST);
    let x = err.pos - 320;
    if (x > 0)
      console.log('...\n' + template.slice(x, err.pos) + '\n...');
    else
      console.log(template.slice(0, err.pos) + '\n...');
    throw err;
  }
  let tags = [[],[],[]];
  const tagNode = function tagNode(node) {
    if (tags[0].indexOf(node.tag.name) === -1)
      tags[0].push(node.tag.name);
    if (node.tag.name === 'custom_tags') {
      //console.log(node);
      let tagSetIndex = 0; // 0->regular (normal) tags, 1->irregular (void) tags
      let customTagSet = '';
      let i = 0, leni = node.quasi.expressions.length;
      for (; i < leni; i++) {
        if (Object.prototype.toString.call(node.quasi.expressions[i].value) === `[object Boolean]`) 
          tagSetIndex = node.quasi.expressions[i].value ? 1 : 0; 
      }
      for (i = 0, leni = node.quasi.quasis.length; i < leni; i++) {
        if (Object.prototype.toString.call(node.quasi.quasis[i].value.raw) === `[object String]`) 
          customTagSet += node.quasi.quasis[i].value.raw + ' ';
      } 
      //tagSet = tagSet.trim().split(' ');
      customTagSet = customTagSet.match(/\b(\w+?)\b/g);
      console.log('customTagSet =', customTagSet, tagSetIndex); 
      for (i = 0, leni = customTagSet.length; i < leni; i++) {
        if (tags[tagSetIndex].indexOf(customTagSet[i]) === -1) {
          tags[tagSetIndex].push(customTagSet[i]);
          console.log('tags[tagSetIndex] =', tags);
        }
      }   
    } 
  };  
  awalk.simple(ast, {TaggedTemplateExpression: tagNode});
  for (let i = 0; i < tags[0].length;) {
    let tag = tags[0][i];
    if (html5.irregularTags.indexOf(tag) !== -1) 
      tags[1].push(tag);
    else if (html5.specialTags.indexOf(tag) !== -1) 
      tags[2].push(tag);
    if (html5.regularTags.indexOf(tag) === -1)
      tags[0].splice(i,1); // Side-effect: decrements "tags[0].length".
    else
      i++;
  }
  let output = input + 'const tags = ' +
    JSON.stringify(tags).replace(/"(\w*?)"/g, '$1') + ';\n\n';
  output += 'const template = `' +
    template.replace(/`/g, '\\`').replace(/(\${)/g, '\\$1') + '\n`;\n\n';
  bug(BLU+'c2Resolver tags: '+RST, tags);
  return [output, tags];
};

const c3Linker = function c3Linker(input, tags) {

  const _scafoldRegularTag = function _scafoldRegularTag() {  
    function _regularTag(literals, ...substitutions) {
      return _regularTaggedTemplate('_regularTag', literals, substitutions);
    }
  }; 
  const _scafoldRegularTaggedTemplate = function _scafoldRegularTaggedTemplate() {
    function _regularTaggedTemplate(keyword, literals, substitutions) {
      let output = `<${keyword}`;
      output += _parseAttributes(substitutions); // Side-effect: object elements in "substitutions" array are replaced with empty strings "".
      output += '>';
      _document += output;
      output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
      output += `</${keyword}>`;
      _document += `</${keyword}>`;
      return output;
    }
  };

  const _scafoldIrregularTag = function _scafoldIrregularTag() {  
    function _irregularTag(literals, ...substitutions) {
      return _irregularTaggedTemplate('_irregularTag', literals, substitutions);
    }
  };  
  const _scafoldIrregularTaggedTemplate = function _scafoldIrregularTaggedTemplate() {
    function _irregularTaggedTemplate(keyword, literals, substitutions) {
      let output = `<${keyword}`;
      output += _parseAttributes(substitutions); // Side-effect: object elements in "substitutions" array are replaced with empty strings "".
      output += ' ';
      _document += output;
      output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
      output += '/>';
      _document += '/>';
      return output;
    }
  };

  const _scafoldSpecialTag = function _scafoldSpecialTag() {  
    function _specialTag(literals, ...substitutions) {
      return _specialTaggedTemplate('_specialTag', literals, substitutions);
    }
  };  
  const _scafoldSpecialTaggedTemplate = function _scafoldSpecialTaggedTemplate() {
    function _specialTaggedTemplate(keyword, literals, substitutions) {
      let i = 0, len = substitutions.length;
      if (keyword === 'tag') {
        let lits = literals.slice(0); // "literals" is read-only for unclear reason. Bug or specification?
        let match = /^\w+?\b/.exec(lits[0]);
        if (match) {
          let isVoidTag = false;
          for (i = 0; i < len; i++) { 
            if (Object.prototype.toString.call(substitutions[i]) === `[object Boolean]`) {
              isVoidTag = substitutions[i];
              substitutions[i] = '';
              break;
            }
          }
          keyword = match[0];     
          lits[0] = lits[0].slice(keyword.length + 1);
          return isVoidTag ? 
            _irregularTaggedTemplate(keyword, lits, substitutions) :
            _regularTaggedTemplate(keyword, lits, substitutions);
        }
        keyword = 'comment';
        lits[0] = 'Error in "tag": ' + lits[0]; 
        lits.raw = literals.raw; 
        literals = lits;
      }
      for (i = 0; i < len; i++) { 
        if (Object.prototype.toString.call(substitutions[i]) === `[object Object]`) 
          substitutions[i] = JSON.stringify(substitutions[i]);
      }
      let output = '';
      //output += _parseAttributes(substitutions); // Side-effect: object elements in "substitutions" array are replaced with empty strings "".
      //_document += output; 
      switch(keyword) {
        case 'txt':
          output += _parseContent(literals, substitutions, true); // Side-effect: additions to  "_document".
          break; 
        case 'comment':
        case 'custom_tags': // Indeed already processed in "c2Resolver".
          output += '<!--';
          _document += output;
          output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
          output += '-->';
          _document += '-->';
          break;
        case 'doctype':
      } 
      // output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
      // output += '';
      // _document += '';
      return output;
    }
  };

  const _scafoldParseAttributes = function _scafoldParseAttributes() {  
    function _parseAttributes(substitutions) {
      let output = '';
      let attributes = {};
      let i = 0, len = substitutions.length;
      let subst;
      for (; i < len; i++) { 
        subst = substitutions[i];
        if (Object.prototype.toString.call(subst) === `[object Object]`) {
          Object.assign(attributes, subst);
          substitutions[i] = ''; // Side-effect in the caller's array.
        }
      }
      subst = Object.keys(attributes);
      i = 0, len = subst.length;
      for (; i < len; i++) 
        output += ` ${subst[i]}=${JSON.stringify(attributes[subst[i]])}`;
      return output;
    }
  }; 
  const _scafoldParseContent = function _scafoldParseContent() {
    function _parseContent(literals, substitutions, isRaw = false) {
      let output = '';
      let i = 0, len = substitutions.length; // "substitutions.length === literals.length - 1"
      for (; i < len; i++) {
        output += isRaw ? literals.raw[i] : literals[i];
        _document += isRaw ? literals.raw[i] : literals[i];
        let subst = substitutions[i];
        if (Object.prototype.toString.call(subst) === `[object Function]`) {
          output += subst();
        } else {
          output += subst;
          _document += subst;
        }
      }
      output += isRaw ? literals.raw[i] : literals[i]; 
      _document += isRaw ? literals.raw[i] : literals[i];
      return output;
    }
  }; 

  let output = input;
  for (let i = 0, leni = tags[0].length; i < leni; i++) {
    output += /(?:function _scafoldRegularTag\(\) {)([^]*)}/
      .exec(_scafoldRegularTag.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
      .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, '') // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
      .replace(/\b_regularTag\b/g, tags[0][i]);
  }
  for (let i = 0, leni = tags[1].length; i < leni; i++) {
    output += /(?:function _scafoldIrregularTag\(\) {)([^]*)}/
      .exec(_scafoldIrregularTag.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
      .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, '') // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
      .replace(/\b_irregularTag\b/g, tags[1][i]);
  }
  for (let i = 0, leni = tags[2].length; i < leni; i++) {
    output += /(?:function _scafoldSpecialTag\(\) {)([^]*)}/
      .exec(_scafoldSpecialTag.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
      .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, '') // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
      .replace(/\b_specialTag\b/g, tags[2][i]);
  }
  output += /(?:function _scafoldRegularTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldRegularTaggedTemplate.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  output += /(?:function _scafoldIrregularTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldIrregularTaggedTemplate.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  output += /(?:function _scafoldSpecialTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldSpecialTaggedTemplate.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  output += /(?:function _scafoldParseAttributes\(\) {)([^]*)}/
    .exec(_scafoldParseAttributes.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  output += /(?:function _scafoldParseContent\(\) {)([^]*)}/
    .exec(_scafoldParseContent.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
  return output;
};

const c4Loader = function c4Loader(input, tags) {
  const _scafoldRun = function _scafoldRun() {
    function run(context = {}) {
      if (typeof new.target !== "undefined") // Make sure wasn't called with keyword "new".
        throw new Error('\x1b[31mDevError:\x1b[0m function "run" should not be called as a constructor (with keyword "new").');
      Object.assign(this, context);
      return run.template.call(this);
    }

    let _template = '\nlet _document = "";\n'; 
    for (let i = 0, leni = tags.length; i < leni; i++) {
      for (let j = 0, lenj = tags[i].length; j < lenj; j++) 
        _template += tags[i][j].prototype.constructor + '\n';
    }
    _template += _regularTaggedTemplate.prototype.constructor + '\n'; 
    _template += _irregularTaggedTemplate.prototype.constructor + '\n';  
    _template += _specialTaggedTemplate.prototype.constructor + '\n';
    _template += _parseAttributes.prototype.constructor + '\n';
    _template += _parseContent.prototype.constructor + '\n';
    _template += template.replace(/\\`/g, '`').replace(/(\\)(\$)(?={.*})/g, '$2');
    _template += '\nreturn _document;\n';
    run.template = new Function(_template); // Static method.
    
    return run.bind(metadata);
  };
  let output = input + /(?:function _scafoldRun\(\) {)([^]*)}/
    .exec(_scafoldRun.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
    .replace(/^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg, ''); // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").

 //bug(BLU+'output ='+RST, output);

  return output; 
};

let de = false;
const bug = console.log;

const debug = module.exports.debug = (toggle) => {
  if (Object.prototype.toString.call(toggle) === `[object Boolean]`)
    de = toggle;
  return de;
};

