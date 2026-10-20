export interface ASTNode {
  id: string;
  type: string;
  value?: string;
  children: ASTNode[];
  line?: number;
  column?: number;
}
