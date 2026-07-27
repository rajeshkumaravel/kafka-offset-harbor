import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import { loader } from '@monaco-editor/react'

// Bundle monaco locally (no CDN) — required for a desktop app with strict CSP.
self.MonacoEnvironment = {
  getWorker: (_moduleId: string, label: string) =>
    label === 'json' ? new jsonWorker() : new editorWorker()
}

loader.config({ monaco })

const geistDark: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '52a8ff' },
    { token: 'string.value.json', foreground: '50e3c2' },
    { token: 'string', foreground: '50e3c2' },
    { token: 'number', foreground: 'f5a623' },
    { token: 'keyword.json', foreground: 'ff79c6' },
    { token: 'keyword', foreground: 'f081bd' },
    { token: 'comment', foreground: '666666', fontStyle: 'italic' },
    { token: 'tag', foreground: 'f081bd' },
    { token: 'attribute.name', foreground: '52a8ff' },
    { token: 'attribute.value', foreground: '50e3c2' }
  ],
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#ededed',
    'editor.lineHighlightBackground': '#111111',
    'editorLineNumber.foreground': '#444444',
    'editorLineNumber.activeForeground': '#888888',
    'editorCursor.foreground': '#ededed',
    'editor.selectionBackground': '#0b3d6f',
    'editorIndentGuide.background1': '#1c1c1c',
    'editorWidget.background': '#161616',
    'editorWidget.border': '#333333',
    'scrollbarSlider.background': '#33333380',
    'scrollbarSlider.hoverBackground': '#44444480'
  }
}

const geistLight: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '0068d6' },
    { token: 'string.value.json', foreground: '028265' },
    { token: 'string', foreground: '028265' },
    { token: 'number', foreground: 'a35200' },
    { token: 'keyword.json', foreground: 'c41d7f' },
    { token: 'comment', foreground: '999999', fontStyle: 'italic' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#171717',
    'editor.lineHighlightBackground': '#fafafa',
    'editorLineNumber.foreground': '#cccccc',
    'editorLineNumber.activeForeground': '#888888',
    'editor.selectionBackground': '#cde3ff',
    'editorIndentGuide.background1': '#f0f0f0'
  }
}

monaco.editor.defineTheme('koe-dark', geistDark)
monaco.editor.defineTheme('koe-light', geistLight)

export { monaco }
