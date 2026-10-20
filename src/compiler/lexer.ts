import { TokenType } from '../types/compiler';
import type { Token, TokenTypeName } from '../types/compiler';

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

const TWO_CHAR_OPERATORS: readonly string[] = ['>=', '<=', '==', '!=', '&&', '||', '++', '--'];

const ONE_CHAR_OPERATORS: readonly string[] = ['+', '-', '*', '/', '%', '>', '<', '!', '='];

const DELIMITERS: readonly string[] = ['(', ')', '{', '}', '[', ']', ';', ','];

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentifierStart(ch: string): boolean {
  return isLetter(ch) || ch === '_';
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];

  let index = 0;
  let line = 1;
  let column = 1;

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

  function peek(offset = 0): string {
    return source[index + offset] ?? '';
  }

  function addToken(type: TokenTypeName, value: string, tokenLine: number, tokenColumn: number) {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  }

  while (index < source.length) {
    const startLine = line;
    const startColumn = column;
    const ch = peek();

    if (isWhitespace(ch)) {
      advance();
      continue;
    }

    if (ch === '/' && peek(1) === '/') {
      while (index < source.length && peek() !== '\n') {
        advance();
      }
      continue;
    }

    if (ch === '/' && peek(1) === '*') {
      advance();
      advance();
      while (index < source.length) {
        if (peek() === '*' && peek(1) === '/') {
          advance();
          advance();
          break;
        }
        advance();
      }
      continue;
    }

    if (isIdentifierStart(ch)) {
      let value = '';
      while (index < source.length && isIdentifierPart(peek())) {
        value += advance();
      }
      const type = KEYWORDS.includes(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
      addToken(type, value, startLine, startColumn);
      continue;
    }

    if (isDigit(ch)) {
      let value = '';
      while (index < source.length && isDigit(peek())) {
        value += advance();
      }
      let isFloat = false;
      if (peek() === '.' && isDigit(peek(1))) {
        isFloat = true;
        value += advance();
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

    if (ch === "'" && peek(2) === "'") {
      advance();
      const charValue = advance();
      advance();
      addToken(TokenType.CHAR_LITERAL, `'${charValue}'`, startLine, startColumn);
      continue;
    }

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

    if (DELIMITERS.includes(ch)) {
      advance();
      addToken(TokenType.DELIMITER, ch, startLine, startColumn);
      continue;
    }

    advance();
  }

  return tokens;
}
