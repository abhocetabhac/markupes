/*
optparse.js
   
The command-line argument parser used by "cli.js".
Based on the homonymous module from coffeescript.
  parser  = new OptionParser(switches, helpBanner);
  options = parser.parse(process.argv);
*/

/*
In-module helpers to class "OptionParser".
NOTE: The helpers must be declared before the class declaration itself,
      and possibly in specific order, due to the temporal dead zone
      of "const" and "let" keywords, as opposed to the "var", which
      hoists the declared variables and functions.
*/

'use strict';

// Regex matchers for option flags.
const
  LONG_FLAG = /^(--\w[\w\-]*)/,
  SHORT_FLAG = /^(-\w)$/,
  MULTI_FLAG = /^-(\w{2,})/,
  COMPLEMENT = /\[(\w+(\*?))\]/;

// Build a rule from a `-o` short flag, a `--output [DIR]` long flag and
// the description of what the option does.
const buildRule = (shortFlag, longFlag, description) => {
  let match = longFlag.match(COMPLEMENT); // Not null if "longFlag" has a complement of form "[complement]" or "[complement*]"
  return {
    name: longFlag.substr(2),
    shortFlag: shortFlag,
    longFlag: longFlag.match(LONG_FLAG)[1],
    description: description,
    hasComplement: !!(match && match[1]), // "!!" is equivalent to casting "Boolean(...)". If it was falsey (i.e. +-0, null, undefined, NaN, '' or false), it will be false, otherwise, true.
    isMultiComplement: !!(match && match[2]) // True only if "longFlag" has the form "longflag [complement*]". The "*" is the second remembered match.
  };
};

// Build and return the list of option rules. If the optional "short-flag" is
// unspecified, leave it out by padding the 3-tuple with "null".
const buildRules = (rules) => {
  let results = [];
  for (let j = 0, len = rules.length; j < len; j++) {
    let tuple = rules[j];
    if (tuple.length < 3) {
      tuple.unshift(null);
    }
    results.push(buildRule(...tuple)); // The spread operator is equivalent here to old "buildRule.apply(null, tuple)".
  }
  return results;
};

// Normalize arguments by expanding merged flags into multiple flags. 
// This allows accepting "-wl" as "--watch --lint".
const normalizeArguments = (args) => {
  let result = [];
  //let args = args.slice(0); // It is unnecessary to create a copy of "args" since the referenced original is unaltered.
  for (let j = 0, lenj = args.length; j < lenj; j++) {
    let match = args[j].match(MULTI_FLAG);
    if (match) {
      match = match[1].split('');
      for (let k = 0, lenk = match.length; k < lenk; k++) {
        result.push('-' + match[k]);
      }
    } else {
      result.push(args[j]);
    }
  }
  return result;
};


//export class OptionParser { // let OptionParser = module.exports.OptionParser = function(rules, banner) {...}
module.exports.OptionParser = class OptionParser {
  // Initialize from an array of two or three element arrays of form:
  //   [[optional short-flag, long-flag, description], ...].
  // Flags may be boolean or require at least one string complement.
  // Flags with single complement are declared passing:
  //   "long-flag-name [complement-type]".
  // Flags with multiple complements are declared passing:
  //   "long-flag-name [complement-type*]".
  // The banner message is optional.
  constructor (rules, banner = null) { // OptionParser.prototype.constructor
    this.banner = banner;
    this.rules = buildRules(rules); // Closure to an in-module function.
  }

  /*
  Parse command-line arguments. Populate an "options" object with the
  recognizable specified options. Boolean flags are insert as
  "options.[long_flag]: true". String flags are insert as 
  "options.[long_flag]: 'complement'" or as 
  "options.[long_flag]: ['complement 1', ...]" if admitting multiple
  complements. Anything not identified as a flag
  is considered further arguments - e.g. filenames - and spliced word
  by word into the array "options.arguments". 
      parse(args)
      - "args" should be an array string tokens from the command-line.
  */
  parse(args) { // OptionParser.prototype.parse
    let options = {'arguments': []};
    let nArgs = normalizeArguments(args);
    let ruleExpectingCompl = null; // Temporarily store a rule while processing its complements.
    const errMsg = () => {return `malformed option "--${ruleExpectingCompl.name}". Expecting complement.`;};
    //const errMsg = '`malformed option "--${ruleExpectingCompl.name}". Expecting complement.`;';
    for (let i = 0, leni = nArgs.length; i < leni; i++) {
      let arg = nArgs[i];
      let rule = this.getRule(arg); // Retrieve the rule correspondent to "arg" if it is a valid command-line option.
      if (rule) { // "arg" was identified as a valid flag.
        if (ruleExpectingCompl) { // Cease looking for complements to the previous flag.
          if (ruleExpectingCompl.isMultiComplement
            && options[ruleExpectingCompl.name]) { // Ok if already found at least one complement to multi-complement flag.
            ruleExpectingCompl = null;
          } else { // Catch error if expecting a complement and got a flag, even if the last "arg" is a new flag immediately after a multi-complement flag with no given complement. 
            throw new Error(errMsg());
            //throw new Error(eval(errMsg));
          }
        }
        if (rule.hasComplement) { // "arg" is flag that requires at least one complement.
          ruleExpectingCompl = rule;
          if (i === leni - 1) { // Catch error if the last "arg" is a flag requiring a single complement.
            throw new Error(errMsg());
            //throw new Error(eval(errMsg));
          }
        } else { // "arg" is a boolean flag, not requiring any complement.
          options[rule.name] = true;
        }
      } else { // "arg" was not identified as a valid flag.
        if (ruleExpectingCompl) { // "arg" is a complement to a flag.
          if (ruleExpectingCompl.isMultiComplement) { // "arg" is a complement to a flag that admits multiple complements.
            (options[ruleExpectingCompl.name] =
              (options[ruleExpectingCompl.name] || [])).push(arg);
          } else { // "arg" is the complement to a flag that admits a single complement.
            options[ruleExpectingCompl.name] = arg;
            ruleExpectingCompl = null;
          }
        } else { // "arg" is neither a flag nor a complement to it.
          options.arguments.push(arg);
        }
      }
    }
    return options;
  }

  /*
  Test the validity of a flag token (e.g. "-j") and retrieve its associated
  rule. Return "null" if the token does not seem to be a flag, but a simple
  string.
  */
  getRule(flag) { // OptionParser.prototype.getRule
    if (flag.match(LONG_FLAG) || flag.match(SHORT_FLAG)) { // Test if token seems to be a flag.
      for (let j = 0, lenj = this.rules.length; j < lenj; j++) {
        let rule = this.rules[j];
        if (rule.shortFlag === flag || rule.longFlag === flag) {return rule;}
      } 
      throw new Error(`unrecognized option: "${flag}".`); // The token looks like a flag, but does not have a correspondent known rule.
    }
    let notAlphanumeric = flag.match(/^-+\w*(\W+)/);
    if (notAlphanumeric) { // Impedes rogue tokens like "--=a" to pass as if they were a normal non-flag argument.
      throw new Error(`malformed option: "${flag}". Extraneous token "${notAlphanumeric[1]}".`);
    }
    return null; // Not a flag.
  }

  help() { // OptionParser.prototype.help
    let lines = [];
    if (this.banner) { lines.push(this.banner + '\n'); }
    for (let j = 0, lenj = this.rules.length; j < lenj; j++) {
      let rule = this.rules[j];
      let line = rule.shortFlag ? (rule.shortFlag + ', ') : '    ';
      let spaces = 8 - rule.name.length;
      //spaces = spaces > 0 ? repeat(' ', spaces) : ''; // Polyfill version.
      spaces = spaces > 0 ? ' '.repeat(spaces) : ''; // ES6 version.
      lines.push(
        '  ' + line + '--' + rule.name + ', ' + spaces + rule.description);
    }
    return `\n${lines.join('\n')}\n`;
  }
}

// Helper function "repeat" is no longer necessary.
// "String.prototype.repeat" method is provided in ES6.
// const repeat = (str, n) => {
//   let res = '';
//   while (n > 0) {
//     if (n & 1) { // Each time n is odd, add one "str".
//       res += str;
//     }
//     n >>>= 1;
//     str += str;
//   }
//   return res;
// };

//console.log(module);
//console.log(OptionParser.constructor.toString());
//console.log(OptionParser.__proto__.constructor.toString());
//console.log(OptionParser.__proto__.__proto__.constructor.toString());
//console.log(OptionParser.toString());
//console.log(OptionParser.prototype.constructor.toString());
//console.log(OptionParser.prototype.help.toString());
//console.log(repeat.toString());
