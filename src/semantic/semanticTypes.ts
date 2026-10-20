export type DataType = 'int' | 'float' | 'bool' | 'char';

export type ExpressionType = DataType | 'unknown';

export interface Symbol {
  name: string;
  type: DataType;
  scope: string;
}

export interface SemanticError {
  message: string;
  line?: number;
  column?: number;
}

export interface SemanticResult {
  symbols: Symbol[];
  errors: SemanticError[];
}
