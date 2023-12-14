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
            // solo named char
            [/\w+(?=\s*:)/, {token: "variable.key", next: "@single_list_pair"}],

            // single char
            [/\b[a-zA-Z0-9^$_]\b/, "string"],

            // literals and variables
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

            // list
            ["\\[", {token: "punctuation", bracket: "@open", next: "@list"}],
        ],

        single_list_pair: [
            [/:/, "punctuation.key"],
            // single char
            [/\b[a-zA-Z0-9^$_]\b/, {token: "string", next: "@pop"}],
            // strings
            [/"([^"\\]|\\.)*$/, {token: 'string.invalid', next: "@pop"}],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', switchTo: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', switchTo: '@singlequote_string' } ],
            //variable
            [/[a-zA-Z][\w$]*/, {
                cases: {
                    "@keywords": "keyword",
                    "@default": "variable.element",
                },
                next: "@pop"
            }],
            [/>|<|-/, {token: "punctuation.shift", next: "@pop"}],
        ],

        list: [
            // key
            [/\w+(?=\s*:)/, "variable.key"],
            [/:/, "punctuation.key"],
            // single char
            [/[a-zA-Z0-9^$_]/, "string"],
            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/"/,  { token: 'string.quote', bracket: '@open', next: '@doublequote_string' } ],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/'/,  { token: 'string.quote', bracket: '@open', next: '@singlequote_string' } ],
            // //variable
            // [/[a-zA-Z][\w$]*/, {
            //     cases: {
            //         "@keywords": "keyword",
            //         "@default": "variable.element",
            //     },
            // }],
            [/>|<|-/, "punctuation.shift"],
            //comma
            [/,/, "punctuation.separator"],
            // close
            [/\]/, {token: "punctuation", bracket: "@close", next: "@pop"}],
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
        { token: "variable.key", foreground: "#fabc75" },
        { token: "variable.element", foreground: "#bcd3e3" },
        { token: "string", foreground: "#ce9178" },
        { token: "string.escape", foreground: "#f7cbba" },
        { token: "comment", foreground: "#6A9955" },
        { token: "punctuation", foreground: "#D4D4D4" },
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

        console.log("providing semantic tokens")
        // const start = Date.now()
        // while (Date.now() - start < 2000) {}

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

    setTimeout(() => {
        const selection = editor.getSelection()
        if (selection) {
            // const op = {identifier: {}, range: selection, text: ".", foceMoveMarkers: true}
            // editor.executeEdits(null, [op])
            // editor.popUndoStop()
            // editor.render(true)
        }
    }, 2000)
    // const model = editor.getModel()
    // if (model) {
    //     model as monaco.editor.ITextModel
    //     // console.log(model.tokenization)
    //     // setTimeout(() => model.tokenization.resetTokenization(), 3000)
    // }
    
}