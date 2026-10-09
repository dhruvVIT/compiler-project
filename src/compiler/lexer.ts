/**
 * CompilerViz - Lexical Analyzer (Phase 1)
 * ----------------------------------------
 * Turns a C++ source string into a flat list of tokens.
 *
 * The algorithm is a straightforward single pass over the characters:
 *
 *   while there are characters left:
 *     skip whitespace and comments
 *     look at the current character and decide what kind of token starts here
 *     read the whole token, record its line/column, move on
 *
 * There is no lookahead beyond the next one or two characters, which keeps the
 * code easy to read and easy to explain.
 */

import { TokenType } from '../types/compiler';
import type { Token, TokenTypeName } from '../types/compiler';

/** Reserved words of our controlled C++ subset. Anything else is an identifier. */
const KEYWORDS: readonly string[] = [
  'int',
  'float',
  'bool',
  'char',
  'if',
  'else',
  'return',
  'true',
  'false',
];

/**
 * Two-character operators. These are checked BEFORE the single-character ones,
 * otherwise ">=" would be read as ">" followed by "=".
 */
const TWO_CHAR_OPERATORS: readonly string[] = ['>=', '<=', '==', '!=', '&&', '||', '++', '--'];

/** Single-character operators. */
const ONE_CHAR_OPERATORS: readonly string[] = ['+', '-', '*', '/', '%', '>', '<', '!', '='];

/** Punctuation that separates or groups code. */
const DELIMITERS: readonly string[] = ['(', ')', '{', '}', '[', ']', ';', ','];

/* ------------------------------------------------------------------ */
/* Small character helpers - named so the main loop reads like English */
/* ------------------------------------------------------------------ */

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** An identifier may start with a letter or an underscore. */
function isIdentifierStart(ch: string): boolean {
  return isLetter(ch) || ch === '_';
}

/** After the first character an identifier may also contain digits. */
function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

/**
 * Scans the source code and returns the list of tokens it contains.
 *
 * Characters that are not part of our language subset are simply skipped;
 * reporting them is a job for a later phase.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];

  let index = 0; // position in the source string
  let line = 1; // current line   (1-based)
  let column = 1; // current column (1-based)

  /** Consumes one character, keeping line/column counters correct. */
  function advance(): string {
    const ch = source[index];
    index++;
    if (ch === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return ch;
  }

  /** Looks at a character without consuming it. */
  function peek(offset = 0): string {
    return source[index + offset] ?? '';
  }

  function addToken(type: TokenTypeName, value: string, tokenLine: number, tokenColumn: number) {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  }

  while (index < source.length) {
    // Remember where this token starts, before we consume anything.
    const startLine = line;
    const startColumn = column;
    const ch = peek();

    /* --- 1. Whitespace: skip it, but keep counting lines --- */
    if (isWhitespace(ch)) {
      advance();
      continue;
    }

    /* --- 2. Single-line comment: // ... up to end of line --- */
    if (ch === '/' && peek(1) === '/') {
      while (index < source.length && peek() !== '\n') {
        advance();
      }
      continue; // the newline itself is handled by the whitespace branch
    }

    /* --- 3. Multi-line comment, which may span several lines --- */
    if (ch === '/' && peek(1) === '*') {
      advance(); // '/'
      advance(); // '*'
      while (index < source.length) {
        if (peek() === '*' && peek(1) === '/') {
          advance(); // '*'
          advance(); // '/'
          break;
        }
        advance(); // any character, including newlines, keeps the counters right
      }
      continue;
    }

    /* --- 4. Identifier or keyword --- */
    if (isIdentifierStart(ch)) {
      let value = '';
      while (index < source.length && isIdentifierPart(peek())) {
        value += advance();
      }
      const type = KEYWORDS.includes(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
      addToken(type, value, startLine, startColumn);
      continue;
    }

    /* --- 5. Number: integer or floating point --- */
    if (isDigit(ch)) {
      let value = '';
      while (index < source.length && isDigit(peek())) {
        value += advance();
      }
      // A '.' followed by a digit means this is a float, e.g. 10.5
      let isFloat = false;
      if (peek() === '.' && isDigit(peek(1))) {
        isFloat = true;
        value += advance(); // '.'
        while (index < source.length && isDigit(peek())) {
          value += advance();
        }
      }
      addToken(
        isFloat ? TokenType.FLOAT_LITERAL : TokenType.INTEGER_LITERAL,
        value,
        startLine,
        startColumn,
      );
      continue;
    }

    /* --- 6. Character literal: 'a' --- */
    if (ch === "'" && peek(2) === "'") {
      advance(); // opening quote
      const charValue = advance(); // the character itself
      advance(); // closing quote
      addToken(TokenType.CHAR_LITERAL, `'${charValue}'`, startLine, startColumn);
      continue;
    }

    /* --- 7. Operators: two-character ones FIRST --- */
    const twoChars = ch + peek(1);
    if (TWO_CHAR_OPERATORS.includes(twoChars)) {
      advance();
      advance();
      addToken(TokenType.OPERATOR, twoChars, startLine, startColumn);
      continue;
    }

    if (ONE_CHAR_OPERATORS.includes(ch)) {
      advance();
      addToken(TokenType.OPERATOR, ch, startLine, startColumn);
      continue;
    }

    /* --- 8. Delimiters --- */
    if (DELIMITERS.includes(ch)) {
      advance();
      addToken(TokenType.DELIMITER, ch, startLine, startColumn);
      continue;
    }

    /* --- 9. Anything else is not part of our subset: skip it --- */
    advance();
  }

  return tokens;
}
