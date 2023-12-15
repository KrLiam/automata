import type monaco from 'monaco-editor';
import type {MonacoEditor} from '@guolao/vue-monaco-editor'
import { keywords } from './parser';

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
            // number literal
            [/[+-]?\d+/, "number"],

            // list key
            [/\w+(?=\s*:)/, {token: "variable.key", next: "@list_pair"}],

            // single char
            [/\b[a-zA-Z]\b/, "string"],       

            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', next: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', next: '@singlequote_string' } ],

            // list literal
            [/\[/, {token: "punctuation", bracket: "@open", next: "@list"}],

            // comment
            [/\/\/.*/, "comment"],
            // multiline comments
            [/\/\*/, {token: "comment", bracket: '@open', next: "multiline_comment"}],


            [/tapes\b/, {token: "keyword", next: "@tape_list"}],


            // literals and variables
            [/[a-zA-Z][\w]*/, {
                cases: {
                    "@keywords": "keyword",
                    "@default": "variable",
                }
            }],
        ],

        list_pair: [
            [/:/, "punctuation.key"],

            // single char
            [/\b[a-zA-Z]\b/, {token: "string", next: "@pop"}],

            // strings
            [/"([^"\\]|\\.)*$/, {token: 'string.invalid', next: "@pop"}],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', switchTo: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', switchTo: '@singlequote_string' } ],

            // shift literal
            [/>|<|-/, {token: "punctuation.shift", next: "@pop"}],

            // number literal
            [/[+-]?\d+/, {token: "number", next: "@pop"}],

            //variable
            [/[a-zA-Z][\w$]*/, {
                cases: {
                    "@keywords": "keyword",
                    "@default": "variable.element",
                },
                next: "@pop"
            }],
        ],

        list: [
            //comma
            [/,/, "punctuation.separator"],
            // close
            [/\]/, {token: "punctuation", bracket: "@close", next: "@pop"}],

            // key
            [/\w+(?=\s*:)/, "variable.key"],

            // single char
            [/\b[a-zA-Z]\b/, "string"],

            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', next: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', next: '@singlequote_string' } ],

            // shift literal
            [/>|<|-/, "punctuation.shift"],

            // number literal
            [/[+-]?\d+/, "number"],

            //variable
            [/[a-zA-Z][\w$]*/, {
                cases: {
                    "@keywords": "keyword",
                    "@default": "variable.element",
                }
            }],
        ],

        tape_list: [
            //comma
            [/,/, "punctuation.separator"],
            // close
            [/\]/, {token: "punctuation", bracket: "@close", next: "@pop"}],

            // element
            [/\w+/, "variable.key"],
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
        { token: "variable", foreground: "#bcd3e3" },
        { token: "variable.key", foreground: "#fabc75" },
        { token: "variable.element", foreground: "#bcd3e3" },
        { token: "string", foreground: "#ce9178" },
        { token: "string.escape", foreground: "#f7cbba" },
        { token: "comment", foreground: "#6A9955" },
        { token: "punctuation", foreground: "#D4D4D4" },
        // { token: "numberLiteral", foreground: "#b5cea8" },
    ],
    colors: {},
}

const langProvider: monaco.languages.DocumentSemanticTokensProvider = {
    getLegend: function (): monaco.languages.SemanticTokensLegend {
        return {
            tokenTypes: [],
            tokenModifiers: []
        };
    },
    async provideDocumentSemanticTokens(
        model: monaco.editor.ITextModel,
        lastResultId: string | null,
        token: monaco.CancellationToken
    ) {
        const text = model.getValue()

        return {
            data: new Uint32Array()
        }
    },
    releaseDocumentSemanticTokens() {},
}

export function mount(editor: monaco.editor.IStandaloneCodeEditor, monaco: MonacoEditor) {
    monaco.languages.register({ id: "automata" })
    monaco.languages.setLanguageConfiguration("automata", languageConfiguration)
    monaco.languages.setMonarchTokensProvider("automata", languageDef)
    monaco.editor.defineTheme("automata-theme", langTheme)
    monaco.editor.setTheme("automata-theme")
    monaco.languages.registerDocumentSemanticTokensProvider("automata", langProvider)    
}