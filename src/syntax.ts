// Based on Prism Bash syntax
import { Grammar, GrammarValue } from 'prismjs';

const varValue: GrammarValue = [
  // Brace expansion
  {
    pattern: /\$\{[^}]+\}/,
    greedy: true,
    inside: {
      // Format spec
      operator: /:/,
    },
  },
  /\$(?:\w+)/,
];

const syntax: Grammar = {
  string: {
    pattern: /(["'])(?:\\[\s\S]|\$\([^)]+\)|`[^`]+`|(?!\1)[^\\])*\1/,
    greedy: true,
    inside: {
      variable: varValue,
    },
  },
  regex: {
    pattern: /(^|\s)\/(?:\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/(?=$|\s)/,
    lookbehind: true,
    greedy: true,
  },
  variable: varValue,
  builtin: {
    pattern: /(^|\s)(mget|calc|mcalc|series|cseries|top)(?=$|\s)/,
    lookbehind: true,
  },
  'attr-name': {
    pattern: /(^|\s)(attribute|child|counter|device|enum|gauge|ifutil|integer|interface|ipsla|memory|parent|processor|report|rtt|storage|system|temperature|text|timestamp|uptime|user|vnutil|vutil)(?=$|\s)/,
    lookbehind: true,
  },
  constant: [
    // Time value
    {
      pattern: /(^|\s)(\d{4}-\d\d|\d{4}-\d\d-\d\d|\d{4}-\d\d-\d\d\s\d\d:\d\d)(?=$|\s)/,
      lookbehind: true,
    },
    // Point in time
    {
      pattern: /(^|\s)(startof|endof)?(this|last)?(hour|minute|today|yesterday|week|month|year)(?=$|\s)/i,
      lookbehind: true,
    },
    // Day of week
    {
      pattern: /(^|\s)(sun(day)?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?)(?=$|\s)/i,
    },
    // Duration
    {
      pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?[mhdwMy](?=$|\s)/,
      lookbehind: true,
    },
  ],
  keyword: {
    pattern: /(^|\s)(from|to|not|for|any|all|group|value|profile|reverse|interval|avg|total|median|max|nonzero|above|below|time)(?=$|\s)/,
    lookbehind: true,
  },
  punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
  number: {
    pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
    lookbehind: true,
  },
};

export default syntax;
