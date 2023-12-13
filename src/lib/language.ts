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
            // [String.raw`/\*[\s\S]*?\*/`, "comment"],
            ["//.*", "comment"],
            [String.raw`((?<![\\])['"])((?:.(?!(?<![\\])\1))*.?)\1`, "string"],

            ["/\\*", {token: "comment", next: "multiline_comment"}],
        ],
        multiline_comment: [
            ["(?:(?!\\*/).)+", "comment"],
            ["\\*/", {token: "comment", next: "@pop"}]
        ],
    }
}

export function mount(editor: monaco.editor.IStandaloneCodeEditor, monaco: MonacoEditor) {
    monaco.languages.register({ id: "automata" })
    monaco.languages.setLanguageConfiguration("automata", languageConfiguration)
    monaco.languages.setMonarchTokensProvider("automata", languageDef)
}