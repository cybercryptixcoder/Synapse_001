import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './CodeViewer.css';

export interface CodeViewerData {
  language: string;
  code: string;
}

export function CodeViewer({ data }: { data: CodeViewerData }) {
  return (
    <div className="code-viewer">
      <div className="code-viewer-header">
        <span className="code-viewer-lang">{data.language}</span>
      </div>
      <div className="code-viewer-body">
        <SyntaxHighlighter
          language={data.language}
          style={atomOneDark}
          customStyle={{
            margin: 0,
            padding: '12px 16px',
            height: '100%',
            borderRadius: '0 0 8px 8px',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            overflowY: 'auto',
          }}
          wrapLongLines={false}
        >
          {data.code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
