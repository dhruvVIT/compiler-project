/**
 * Shared compiler types for CompilerViz.
 *
 * Every compiler stage imports its data structures from this file so that the
 * whole application speaks one language. In this phase only lexical analysis
 * exists, so only token-related types live here.
 */

/** The categories of token our controlled C++ subset supports. */
export const TokenType = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  INTEGER_LITERAL: 'INTEGER_LITERAL',
  FLOAT_LITERAL: 'FLOAT_LITERAL',
  CHAR_LITERAL: 'CHAR_LITERAL',
  OPERATOR: 'OPERATOR',
  DELIMITER: 'DELIMITER',
} as const;

/** Union of the token type strings, e.g. "KEYWORD" | "IDENTIFIER" | ... */
export type TokenTypeName = (typeof TokenType)[keyof typeof TokenType];

/**
 * A single token produced by the lexer.
 *
 * `line` and `column` are 1-based and point at the FIRST character of the
 * token, which is what a compiler error message would report.
 */
export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}
