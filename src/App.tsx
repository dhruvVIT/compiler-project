/**
 * CompilerViz - application shell.
 *
 * The pipeline implemented so far:
 *
 *   source -> tokenize(source) -> Token[] -> buildAST(tokens) -> ASTNode
 *          -> analyzeSemantics(ast) -> SemanticResult
 *          -> generateIR(ast) -> IRInstruction[]
 *          -> optimizeIR(ir) -> OptimizationResult
 *
 * The optimized IR is the final output: there is no code-generation stage.
 *
 * Each stage has its own view. Everything is recalculated whenever the source
 * code changes, so switching to a stage always shows the current code.
 */

import { useMemo, useState } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { StageTabs } from './components/StageTabs';
import type { ActiveStage } from './components/StageTabs';
import { TokenTable } from './components/TokenTable';
import { ASTViewer } from './components/ASTViewer';
import { SemanticView } from './components/SemanticView';
import { IRViewer } from './components/IRViewer';
import { OptimizationViewer } from './components/OptimizationViewer';
import { tokenize } from './compiler/lexer';
import { buildAST } from './ast/astBuilder';
import type { ASTNode } from './ast/astTypes';
import { analyzeSemantics } from './semantic/analyzer';
import { generateIR } from './ir/irGenerator';
import { optimizeIR } from './optimizer/optimizer';

const DEFAULT_SOURCE = `int main() {
    int a = 10;
    int b = 20;
    int c = a + b;

    if (c > 20) {
        c = c + 1;
    } else {
        c = c - 1;
    }

    return c;
}`;

/** The heading shown above the output panel for each stage. */
const PANEL_TITLES: Record<ActiveStage, string> = {
  source: 'Tokens',
  tokens: 'Tokens',
  ast: 'AST',
  semantic: 'Semantic Analysis',
  ir: 'Intermediate Representation',
  optimization: 'Optimization',
};

export default function App() {
  const [source, setSource] = useState<string>(DEFAULT_SOURCE);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [activeStage, setActiveStage] = useState<ActiveStage>('source');

  // Stage 1: source code -> tokens.
  const tokens = useMemo(() => tokenize(source), [source]);

  // Stage 2: tokens -> AST. buildAST throws when the code is not valid, so we
  // keep either the tree or the message, never both.
  const { ast, astError } = useMemo(() => {
    try {
      return { ast: buildAST(tokens) as ASTNode | null, astError: null as string | null };
    } catch (error) {
      return { ast: null, astError: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [tokens]);

  function handleAnalyze() {
    setHasAnalyzed(true);
    if (activeStage === 'source') {
      setActiveStage('tokens');
    }
  }

  // Picking a stage shows its output straight away - no extra button needed.
  function handleSelectStage(stage: ActiveStage) {
    setActiveStage(stage);
    if (stage !== 'source') {
      setHasAnalyzed(true);
    }
  }

  // Stage 3: AST -> symbol table + semantic errors.
  const semanticResult = useMemo(() => (ast === null ? null : analyzeSemantics(ast)), [ast]);

  // Stage 4: AST -> three-address code. The IR is generated from the same AST
  // the earlier stages used, never from the source or the tokens.
  const irInstructions = useMemo(() => generateIR(ast), [ast]);

  // Stage 5: IR -> optimized IR. The optimizer is handed the instructions the
  // IR stage already produced; it never goes back to the AST.
  const optimizationResult = useMemo(() => optimizeIR(irInstructions), [irInstructions]);

  // The "Source" tab shows the token table as well, so those two stages share
  // one view and the token count belongs to both of them.
  const showingTokens = activeStage === 'source' || activeStage === 'tokens';

  // The AST diagram and the two side-by-side IR listings both need a wider
  // output panel than the token table does.
  const needsWideOutput = activeStage === 'ast' || activeStage === 'optimization';

  /** Picks the view for the stage the user has selected. */
  function renderOutput() {
    if (activeStage === 'ast') {
      return <ASTViewer ast={ast} error={astError} />;
    }
    if (activeStage === 'semantic') {
      return <SemanticView result={semanticResult} astError={astError} />;
    }
    if (activeStage === 'ir') {
      return (
        <IRViewer
          instructions={irInstructions}
          astError={astError}
          semanticErrorCount={semanticResult?.errors.length ?? 0}
        />
      );
    }
    if (activeStage === 'optimization') {
      return <OptimizationViewer result={optimizationResult} astError={astError} />;
    }
    return <TokenTable tokens={tokens} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>CompilerViz</h1>
        <p className="subtitle">Interactive Compiler Visualization Tool</p>
      </header>

      <StageTabs activeStage={activeStage} onSelect={handleSelectStage} />

      <main className={needsWideOutput ? 'panels panels-wide-output' : 'panels'}>
        <section className="panel">
          <div className="panel-head">
            <h2>Source Code</h2>
            <button type="button" className="analyze-btn" onClick={handleAnalyze}>
              Analyze Code
            </button>
          </div>
          <CodeEditor value={source} onChange={setSource} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{PANEL_TITLES[activeStage]}</h2>
            {hasAnalyzed && showingTokens && <span className="count">{tokens.length} tokens</span>}
          </div>

          <div className="panel-body">
            {hasAnalyzed ? (
              renderOutput()
            ) : (
              <p className="empty-note">No tokens generated yet.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        Pipeline: source &rarr; tokens &rarr; AST &rarr; semantic analysis &rarr; IR &rarr; optimized IR.
      </footer>
    </div>
  );
}
