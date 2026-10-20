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

  const tokens = useMemo(() => tokenize(source), [source]);

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

  function handleSelectStage(stage: ActiveStage) {
    setActiveStage(stage);
    if (stage !== 'source') {
      setHasAnalyzed(true);
    }
  }

  const semanticResult = useMemo(() => (ast === null ? null : analyzeSemantics(ast)), [ast]);

  const irInstructions = useMemo(() => generateIR(ast), [ast]);

  const optimizationResult = useMemo(() => optimizeIR(irInstructions), [irInstructions]);

  const showingTokens = activeStage === 'source' || activeStage === 'tokens';

  const needsWideOutput = activeStage === 'ast' || activeStage === 'optimization';

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
