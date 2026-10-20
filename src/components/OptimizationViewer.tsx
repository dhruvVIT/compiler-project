import type { OptimizationResult } from '../optimizer/optimizer';
import { IRCodeList } from './IRCodeList';

interface OptimizationViewerProps {
  result: OptimizationResult | null;
  astError: string | null;
}

export function OptimizationViewer({ result, astError }: OptimizationViewerProps) {
  if (astError !== null) {
    return (
      <div className="errors">
        <strong>Cannot optimize.</strong>
        <p>The code must build an AST first. {astError}</p>
      </div>
    );
  }

  if (result === null || result.original.length === 0) {
    return <p className="empty-note">No IR to optimize.</p>;
  }

  const { original, optimized, applied } = result;

  return (
    <div className="opt-view">
      <div className="opt-columns">
        <div className="opt-column">
          <h3>Original IR</h3>
          <IRCodeList instructions={original} />
        </div>
        <div className="opt-column">
          <h3>Optimized IR</h3>
          <IRCodeList instructions={optimized} />
        </div>
      </div>

      <h3>Optimizations Applied</h3>

      {applied.length === 0 ? (
        <p className="empty-note">None. The IR could not be optimized any further.</p>
      ) : (
        <ul className="opt-applied">
          {applied.map((optimization) => (
            <li key={optimization.name}>
              {'✓'} {optimization.name} &mdash; Lines: {optimization.lines.join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
