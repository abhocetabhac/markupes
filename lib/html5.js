'use strict';

const html5 = {};

html5.doctypes = {
  'default': '<!DOCTYPE html>',
  '5': '<!DOCTYPE html>',
  'xml': '<?xml version="1.0" encoding="utf-8" ?>',
  'transitional': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  'strict': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">',
  'frameset': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">',
  '1.1': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">',
  'basic': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd">',
  'mobile': '<!DOCTYPE html PUBLIC "-//WAPFORUM//DTD XHTML Mobile 1.2//EN" "http://www.openmobilealliance.org/tech/DTD/xhtml-mobile12.dtd">',
  'ce': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "ce-html-1.0-transitional.dtd">'
};

// Mind the gap (one space at the beginning of each subsequent line).
html5.keywords = {
  // HTML 5 keywords requiring a closing tag
  // Note: the "var" element is out for obvious reasons. Please use "tag `var`".
  normal: 'a abbr address article aside audio b bdi bdo blockquote body button\
 canvas caption cite code colgroup datalist dd del details dfn div dl dt em\
 fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup\
 html i iframe ins kbd label legend li main map mark menu meter nav noscript\
 object ol optgroup option output p pre progress q rp rt ruby s samp script\
 section select small span strong style sub summary sup table tbody td textarea\
 tfoot th thead time title tr u ul video',
  // Self-closing (empty) HTML 5 elements
  void: 'area base br col embed hr img input link menuitem meta\
 param source track wbr',
  // Support for SVG 1.1 tags
  svg: 'a altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion\
 animateTransform circle clipPath color-profile cursor defs desc ellipse\
 feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix\
 feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB\
 feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology\
 feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence\
 filter font font-face font-face-format font-face-name font-face-src\
 font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient\
 marker mask metadata missing-glyph mpath path pattern polygon polyline\
 radialGradient rect script set stop style svg symbol text textPath\
 title tref tspan use view vkern',
  // Support for xml sitemap elements 
  xml: 'urlset url loc lastmod changefreq priority',
  //
  obsolete: 'applet acronym bgsound dir frameset noframes isindex\
 listing nextid noembed plaintext rb strike xmp big blink center font\
 marquee multicol nobr spacer tt',
  obsolete_void: 'basefont command frame keygen',
  special: 'tag txt doctype comment custom_tags' 
};

// Create an array filled with chosen keyword sets.
const merge = function merge(...keywordSets) {
  let result = [];
  for (let t = 0, lent = keywordSets.length; t < lent; t++) {
    let keywords = html5.keywords[keywordSets[t]].split(' ');
    result = result.concat(keywords);
  }
  return result;
};

// Customizable array of HTML5 keywords.
// For each keyword in this list that is also present in the input template
// code, a function with the same name will be added to the compiled template.
//html5.tags = merge(...Object.keys(html5.keywords));

html5.regularTags = merge('normal', 'svg', 'xml', 'obsolete');

// Customizable array of HTML5 keywords that should be rendered self-closed.
html5.irregularTags = merge('void', 'obsolete_void');

html5.specialTags = merge('special');

module.exports = html5;

