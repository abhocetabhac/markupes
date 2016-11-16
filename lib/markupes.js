'use strict';

const
  yaml = require('js-yaml'),
  acorn = require('../node_modules/acorn/dist/acorn'),
  awalk = require('../node_modules/acorn/dist/walk'),
  html5 = require('./html5'),
  beautify = require('./beautify');

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
    let compiled = compile(contents);
    let document = engage(compiled)(context);
    document = beautify(document);
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

// Output the body of a javascript function (a string) that is self-suficient 
// to produce the entire final document.
const compile = module.exports.compile =
  function compile(contents = '') {
    let [output, template] = c1Parser(contents);
    let tags;
    [output, tags] = c2Resolver(output, template);
    output = c3Linker(output, tags);
    output = c4Loader(output, tags);
    de&&bug(BLU+'(markupes.js compile) output ='+RST, output);
    return output;
  };

const c1Parser = function c1Parser(input) {
  let metadata = {};
  let output = '\'use strict\';\n';
  let template;

  //const EXTRACT_YAML_HEADER = /^[^]*([^\w\s])\1{2,}.*\n+([^]*\n)\1{3,}.*\n+/; 
  const EXTRACT_YAML_HEADER = /([^\w\s]{3}).*\n+([^]*?\n)\1.*/; // Might have used "[/s/S]" instead of the javascript only "[^]". Both are a makeshift due to the missing of a "dotall" modifier (/.../s) in javascript ("." means everything except newline).
  let yamlMatch = EXTRACT_YAML_HEADER.exec(input);
  de&&bug(BLU+'(markupes.js c1Parser) yamlMatch ='+RST, yamlMatch);
  if (yamlMatch) { 
    let yamlHeader = yamlMatch[2];    
    de&&bug(BLU+'(markupes.js c1Parser) yamlHeader ='+RST, yamlHeader);
    try {
      Object.assign(metadata, yaml.load(yamlHeader));
      de&&bug(BLU+'(markupes.js c1Parser) metadata ='+RST, metadata);
    } catch(err) {
      throw err;
    }
    //const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))?[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4(?:(?:.*\n)(?!\3\2)|[^(?:\*\/)]*?(?=\3\2)(?:\3\2))/; 
    const EXTRACT_YAML_HEADER_AS_COMMENT = /((?:(\/)(\*)))[^]*?([^\w\s]{3}).*\n+([^]*?\n)\4[^(?:\*\/)]*\3\2/; 
    let yamlComment = EXTRACT_YAML_HEADER_AS_COMMENT.exec(input);
    de&&bug(BLU+'(markupes.js c1Parser) yamlComment ='+RST, yamlComment);
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
    console.log(YEL+'Parsing the template failed at the line:'+RST);
    let templateUpToError = template.slice(0, err.pos - 1) +
      RED+template.substr(err.pos - 1, 1)+RST + 
      (template.slice(err.pos).match(/^.*(?:(?:\r\n?)|\n|\u2028|\u2029)?/) || [''])[0];
    let errorLine = // The line with error is the last of "templateUpToError".
      (templateUpToError.match(/.*(?:(?:\r\n?)|\n|\u2028|\u2029)?$/) || [templateUpToError])[0];
    console.log(errorLine);
    if (errorLine !== templateUpToError)
      console.log(" ".repeat(errorLine.indexOf(RED)) + '^');
    throw err;
  }
  let tags = [[], [], [], []]; // [[regular], [irregular], [special], [alien to HTML format]]
  const tagNode = function tagNode(node) {
    let tag = node.tag.name;
    if (html5.regularTags.includes(tag) && !tags[0].includes(tag))
      tags[0].push(tag);
    else if (html5.irregularTags.includes(tag) && !tags[1].includes(tag)) 
      tags[1].push(tag);
    else if (html5.specialTags.includes(tag) && !tags[2].includes(tag)) 
      tags[2].push(tag);  
    if (tag === 'custom_tags') {
      let tagSetIndex = 0; // 0->regular (normal) tags, 1->irregular (void) tags
      let customTagSet = '';
      let i = 0, leni = node.quasi.expressions.length;
      for (; i < leni; i++) {
        if (Object.prototype.toString.call(node.quasi.expressions[i].value) === `[object Boolean]`) 
          tagSetIndex = node.quasi.expressions[i].value ? 1 : 0; 
        else if (Object.prototype.toString.call(node.quasi.expressions[i].properties) === `[object Array]`) {
          for (let j = 0, lenj = node.quasi.expressions[i].properties.length; j < lenj; j++) {
            if (Object.prototype.toString.call(node.quasi.expressions[i].properties[j].key.name) === `[object String]`
              && node.quasi.expressions[i].properties[j].key.name === 'startstart')
              tagSetIndex = 3; // Alien custom tag definition identified.
          }
        }
      }
      for (i = 0, leni = node.quasi.quasis.length; i < leni; i++) {
        if (Object.prototype.toString.call(node.quasi.quasis[i].value.raw) === `[object String]`) 
          customTagSet += node.quasi.quasis[i].value.raw + ' ';
      } 
      customTagSet = customTagSet.match(/\b(\w+?)\b/g);
      for (i = 0, leni = customTagSet.length; i < leni; i++) {
        if (!tags[tagSetIndex].includes(customTagSet[i])) 
          tags[tagSetIndex].push(customTagSet[i]);
      }   
    } else if (tag === 'doctype') {
      let doctype = html5.doctypes.default;
      if (Object.prototype.toString.call(node.quasi.quasis[0].value.raw) === `[object String]`) {
        let match = /^\w+?\b/.exec(node.quasi.quasis[0].value.raw);
        if (match && match[0] in html5.doctypes) 
          doctype = html5.doctypes[match[0]]; 
      }
      template = template.slice(0, node.quasi.start + 1) +
        doctype + template.slice(node.quasi.end - 1);
    }
  };  
  awalk.simple(ast, {TaggedTemplateExpression: tagNode});
  let output = input + 'const tags = ' + // "tags" will be an array of functions, not strings, so remove the quotes.
    JSON.stringify(tags).replace(/"(\w*?)"/g, '$1') + ';\n\n'; 
  output += 'const template = `' +
    template.replace(/`/g, '\\`').replace(/(\${)/g, '\\$1') + '\n`;\n\n';
  de&&bug(BLU+'c2Resolver tags: '+RST, tags);
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
      let messageIntoComment = '';
      let i = 0, len = substitutions.length;
      if (keyword === 'tag') {
        let lits = literals.slice(0); // "literals" is not writable for unclear reason. Bug or specification?
        let match = /^\w+?\b/.exec(lits[0]);
        if (match) {
          let isVoidTag = false;
          for (; i < len; i++) { 
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
        messageIntoComment = 'Error - empty first literal in "tag": ';
      }
      if (keyword === 'custom_tags') { // Look for custom tags alien to HTML format. Custom tags of HTML format are treat further below.
        let
          alienTagSet = '',
          alienTokens = null;
        for (i = 0; i < len; i++) {
          alienTagSet += literals[i] + ' ';
          if (Object.prototype.toString.call(substitutions[i]) === `[object Object]` 
            && Object.keys(substitutions[i]).includes('startstart')) 
            alienTokens = substitutions[i]; // "custom_tag" contains alien tags definition.
        }
        alienTagSet += literals[i];
        if (alienTokens) { // Alien tags definition was identified.
          if (alienTagSet = alienTagSet.match(/\b(\w+?)\b/g)) { 
            for (let j = 0, lenj = alienTagSet.length; j < lenj; j++) {
              if (!Object.keys(_alienTagTokens).includes(alienTagSet[j])) 
                _alienTagTokens[alienTagSet[j]] = alienTokens;
            } 
          }       
          return ''; // For alien custom tags, do not output their definitions as HTML comments.
        } 
      }
      for (i = 0; i < len; i++) { 
        if (Object.prototype.toString.call(substitutions[i]) === `[object Object]`) 
          substitutions[i] = JSON.stringify(substitutions[i]);
      }
      let output = '';
      switch(keyword) {
        case 'txt':
          output += _parseContent(literals, substitutions, true); // Side-effect: additions to  "_document".
          break; 
        case 'custom_tags': // Output native custom tag definitions as HTML comments.
          messageIntoComment = 'custom_tags: ';
        case 'comment':
          output += `<!--${messageIntoComment}`;
          _document += output;
          output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
          output += '-->';
          _document += '-->';
          break;
        case 'doctype': // Mostly already processed in "c2Resolver".
          output += literals[0];
          _document += output;
      } 
      return output;
    }
  };

  const _scafoldAlienTag = function _scafoldAlienTag() {  
    function _alienTag(literals, ...substitutions) {
      return _alienTaggedTemplate('_alienTag', literals, substitutions);
    }
  };  
  const _scafoldAlienTaggedTemplate = function _scafoldAlienTaggedTemplate() {
    function _alienTaggedTemplate(keyword, literals, substitutions) {
      let tk = _alienTagTokens[keyword];
      let output = `${tk.startstart}`;
      if (tk.startend)
        output += `${keyword}`;
      output += _parseAttributes(substitutions); // Side-effect: object elements in "substitutions" array are replaced with empty strings "".
      if (tk.startend)
        output += `${tk.startend}`;
      _document += output;
      output += _parseContent(literals, substitutions); // Side-effect: additions to  "_document".
      if (tk.endstart) {
        output += `${tk.endstart}${keyword}`;
        _document += `${tk.endstart}${keyword}`;
      }
      if (tk.endend) {
        output += `${tk.endend}`;
        _document += `${tk.endend}`;
      }
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
  const FOUR_SPACES_INDENT = /^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg; // Matches four leading spaces (that are not a newline character) for each line.
  for (let i = 0, leni = tags[0].length; i < leni; i++) {
    output += /(?:function _scafoldRegularTag\(\) {)([^]*)}/
      .exec(_scafoldRegularTag.prototype.constructor)[1] // Exclude the first and last lines of "_scafold.prototype.constructor".
      .replace(FOUR_SPACES_INDENT, '') // Remove the four spaces at each line beginning ([^\S\n] = "\s and not \n").
      .replace(/\b_regularTag\b/g, tags[0][i]);
  }
  for (let i = 0, leni = tags[1].length; i < leni; i++) {
    output += /(?:function _scafoldIrregularTag\(\) {)([^]*)}/
      .exec(_scafoldIrregularTag.prototype.constructor)[1] 
      .replace(FOUR_SPACES_INDENT, '') 
      .replace(/\b_irregularTag\b/g, tags[1][i]);
  }
  for (let i = 0, leni = tags[2].length; i < leni; i++) {
    output += /(?:function _scafoldSpecialTag\(\) {)([^]*)}/
      .exec(_scafoldSpecialTag.prototype.constructor)[1] 
      .replace(FOUR_SPACES_INDENT, '') 
      .replace(/\b_specialTag\b/g, tags[2][i]);
  } 
  for (let i = 0, leni = tags[3].length; i < leni; i++) {
    output += /(?:function _scafoldAlienTag\(\) {)([^]*)}/
      .exec(_scafoldAlienTag.prototype.constructor)[1] 
      .replace(FOUR_SPACES_INDENT, '') 
      .replace(/\b_alienTag\b/g, tags[3][i]);
  }
  output += /(?:function _scafoldRegularTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldRegularTaggedTemplate.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, ''); 
  output += /(?:function _scafoldIrregularTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldIrregularTaggedTemplate.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, ''); 
  output += /(?:function _scafoldSpecialTaggedTemplate\(\) {)([^]*)}/
    .exec(_scafoldSpecialTaggedTemplate.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, '');
  if (tags[3].length > 0) {   
    output += /(?:function _scafoldAlienTaggedTemplate\(\) {)([^]*)}/
      .exec(_scafoldAlienTaggedTemplate.prototype.constructor)[1] 
      .replace(FOUR_SPACES_INDENT, ''); 
  }
  output += /(?:function _scafoldParseAttributes\(\) {)([^]*)}/
    .exec(_scafoldParseAttributes.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, ''); 
  output += /(?:function _scafoldParseContent\(\) {)([^]*)}/
    .exec(_scafoldParseContent.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, ''); 
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
    if (tags[3].length > 0) {
      _template += `let _alienTagTokens = {};\n`;
      _template += _alienTaggedTemplate.prototype.constructor + '\n';
    }
    _template += _parseAttributes.prototype.constructor + '\n';
    _template += _parseContent.prototype.constructor + '\n';
    _template += template.replace(/\\`/g, '`').replace(/(\\)(\$)(?={.*})/g, '$2');
    _template += '\nreturn _document;\n';
    run.template = new Function(_template); // Static method.
    
    return run.bind(metadata);
  };
  const FOUR_SPACES_INDENT = /^([^\S(?:(?:\r\n?)|\n|\u2028|\u2029))]){4}/mg; // Matches four leading spaces (that are not a newline character) for each line.
  let output = input + /(?:function _scafoldRun\(\) {)([^]*)}/
    .exec(_scafoldRun.prototype.constructor)[1] 
    .replace(FOUR_SPACES_INDENT, ''); 
  return output; 
};

let de = false;
const bug = console.log;

const debug = module.exports.debug = (toggle) => {
  if (Object.prototype.toString.call(toggle) === `[object Boolean]`)
    de = toggle;
  return de;
};

