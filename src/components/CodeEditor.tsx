import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/cpp/register';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import Editor, { loader } from '@monaco-editor/react';

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
