export type ActiveStage = 'source' | 'tokens' | 'ast' | 'semantic' | 'ir' | 'optimization';

interface Stage {
  id: ActiveStage;
  label: string;
}

const STAGES: Stage[] = [
  { id: 'source', label: 'Source' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'ast', label: 'AST' },
  { id: 'semantic', label: 'Semantic Analysis' },
  { id: 'ir', label: 'IR' },
  { id: 'optimization', label: 'Optimization' },
];

interface StageTabsProps {
  activeStage: ActiveStage;
  onSelect: (stage: ActiveStage) => void;
}

export function StageTabs({ activeStage, onSelect }: StageTabsProps) {
  return (
    <nav className="stage-tabs">
      {STAGES.map((stage) => (
        <button
          key={stage.id}
          type="button"
          className={`stage-tab${stage.id === activeStage ? ' is-active' : ''}`}
          onClick={() => onSelect(stage.id)}
        >
          {stage.label}
        </button>
      ))}
    </nav>
  );
}
