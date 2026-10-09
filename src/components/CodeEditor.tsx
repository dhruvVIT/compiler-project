/**
 * Monaco-based C++ source editor.
 *
 * The Monaco files are bundled with the app (rather than loaded from a CDN),
 * so the project also works without an internet connection.
 */

// Import only the editor core plus the C++ language definition, instead of the
// full `monaco-editor` bundle which would pull in every language it supports.
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/cpp/register';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import Editor, { loader } from '@monaco-editor/react';

// Monaco runs its language services in a web worker; tell it how to make one.
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="editor-shell">
      <Editor
        height="100%"
        language="cpp"
        theme="vs"
        value={value}
        onChange={(newValue) => onChange(newValue ?? '')}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
