import type monaco from 'monaco-editor';
import type {MonacoEditor} from '@guolao/vue-monaco-editor'


const keywords = ["finite", "turing", "initial", "final", "print", "test", "tapes"]

const languageConfiguration: monaco.languages.LanguageConfiguration = {
    comments: {
      lineComment: "//",
      blockComment: [ "/*", "*/" ]
    }
}

const languageDef: monaco.languages.IMonarchLanguage = {
    keywords,
    tokenizer: {
        root: [
            [`@?[a-zA-Z][\\w$]*`, {
                cases: {
                    "@keywords": "keyword",
                    "@default": "variable",
                }
            }],
            ["//.*", "comment"],
            
            ["[+-]?\\d+", "integer"],

            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', next: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', next: '@singlequote_string' } ],

            // multiline comments
            ["/\\*", {token: "comment", bracket: '@open', next: "multiline_comment"}],

        ],

        doublequote_string: [
            [/[^\\"]+/,  'string'],
            [/\\[\\n"]/, 'string.escape'],
            [/\\./,      'string.escape.invalid'],
            [/"/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
        ],
        singlequote_string: [
            [/[^\\']+/,  'string'],
            [/\\[\\n']/, 'string.escape'],
            [/\\./,      'string.escape.invalid'],
            [/'/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
        ],

        multiline_comment: [
            ["(?:(?!\\*/).)+", "comment"],
            ["\\*/", {token: "comment", bracket: "@close", next: "@pop"}]
        ],
    }
}

const langTheme: monaco.editor.IStandaloneThemeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "keyword", foreground: "#569cd6" },
        { token: "variable", foreground: "#a0bfff" },
        { token: "string", foreground: "#ce9178" },
        { token: "string.escape", foreground: "#f7cbba" },
        { token: "comment", foreground: "#6A9955" },
    ],
    colors: {},
}

export function mount(editor: monaco.editor.IStandaloneCodeEditor, monaco: MonacoEditor) {
    monaco.languages.register({ id: "automata" })
    monaco.languages.setLanguageConfiguration("automata", languageConfiguration)
    monaco.languages.setMonarchTokensProvider("automata", languageDef)
    monaco.editor.defineTheme("automata-theme", langTheme)
    monaco.editor.setTheme("automata-theme")
}