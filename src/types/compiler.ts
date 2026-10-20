export const TokenType = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  INTEGER_LITERAL: 'INTEGER_LITERAL',
  FLOAT_LITERAL: 'FLOAT_LITERAL',
  CHAR_LITERAL: 'CHAR_LITERAL',
  OPERATOR: 'OPERATOR',
  DELIMITER: 'DELIMITER',
} as const;

export type TokenTypeName = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}
