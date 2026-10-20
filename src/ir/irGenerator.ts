import type { ASTNode } from '../ast/astTypes';
import type { IRInstruction } from './irTypes';

let instructions: IRInstruction[] = [];

let tempCount = 0;

let labelCount = 0;

function emit(instruction: IRInstruction) {
  instructions.push(instruction);
}

function newTemp(): string {
  tempCount++;
  return `t${tempCount}`;
}

function newLabel(): string {
  labelCount++;
  return `L${labelCount}`;
}

function emitCopy(name: string, value: string) {
  emit({ op: '=', arg1: value, result: name });
}

function emitLabel(label: string) {
  emit({ op: 'label', result: label });
}

function emitGoto(label: string) {
  emit({ op: 'goto', result: label });
}

function nameOf(node: ASTNode): string {
  return node.value ?? '';
}

export function generateIR(ast: ASTNode | null): IRInstruction[] {
  instructions = [];
  tempCount = 0;
  labelCount = 0;

  if (ast === null) {
    return [];
  }

  generateStatement(ast);
  return instructions;
}

function generateStatement(node: ASTNode) {
  switch (node.type) {
    case 'Program':
    case 'MainFunction':
    case 'Block':
      for (const child of node.children) {
        generateStatement(child);
      }
      break;

    case 'VariableDeclaration':
      generateDeclaration(node);
      break;

    case 'Assignment':
      generateAssignment(node);
      break;

    case 'IfStatement':
      generateIfStatement(node);
      break;

    case 'ReturnStatement':
      emit({ op: 'return', arg1: translateExpression(node.children[0]) });
      break;

    default:
      translateExpression(node);
      break;
  }
}

function generateDeclaration(node: ASTNode) {
  if (node.children.length < 2) {
    return;
  }
  const name = nameOf(node.children[0]);
  const value = translateExpression(node.children[1]);
  emitCopy(name, value);
}

function generateAssignment(node: ASTNode) {
  const name = nameOf(node.children[0]);
  const value = translateExpression(node.children[1]);
  emitCopy(name, value);
}

function generateIfStatement(node: ASTNode) {
  const [conditionNode, thenBranch] = node.children;
  const elseBranch = node.children[2];
  const hasElse = elseBranch !== undefined;

  const thenLabel = newLabel();
  const elseLabel = newLabel();
  const endLabel = hasElse ? newLabel() : elseLabel;

  const condition = translateExpression(conditionNode);
  emit({ op: 'if', arg1: condition, result: thenLabel });
  emitGoto(elseLabel);

  emitLabel(thenLabel);
  generateStatement(thenBranch);

  if (hasElse) {
    emitGoto(endLabel);
    emitLabel(elseLabel);
    generateStatement(elseBranch);
  }

  emitLabel(endLabel);
}

function translateExpression(node: ASTNode): string {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      return nameOf(node);

    case 'BinaryExpression': {
      const left = translateExpression(node.children[0]);
      const right = translateExpression(node.children[1]);
      const target = newTemp();
      emit({ op: nameOf(node), arg1: left, arg2: right, result: target });
      return target;
    }

    case 'UnaryExpression':
      return translateUnary(node);

    default:
      return nameOf(node);
  }
}

function translateUnary(node: ASTNode): string {
  const operator = nameOf(node);
  const operand = node.children[0];

  if (operator === '++' || operator === '--') {
    if (operand.type !== 'Identifier') {
      return translateExpression(operand);
    }
    const name = nameOf(operand);
    emit({ op: operator === '++' ? '+' : '-', arg1: name, arg2: '1', result: name });
    return name;
  }

  const value = translateExpression(operand);
  const target = newTemp();

  if (operator === '!') {
    emit({ op: 'not', arg1: value, result: target });
  } else if (operator === '-') {
    emit({ op: 'neg', arg1: value, result: target });
  } else {
    emit({ op: 'pos', arg1: value, result: target });
  }

  return target;
}
