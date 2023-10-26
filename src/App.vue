<script lang="ts" setup>
import { ref, shallowRef } from 'vue'

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
}

const expose = {
  TokenStream,
  SourceLocation,
  get_default_parsers,
  delegate,
  FiniteAutomaton,
  format_transition_table,
  TuringMachine,
  TuringTransitionMap,
  Compiler,
  Patterns,
  AstRoot,
  AstIdentifier,
  get_class_hierarchy,
  Evaluator,
  Scope,
  Visitor,
  rule,
  Rule,
  underline_code,
  XMLParser,
  convert_turing_xml,
};
for (let [key, value] of Object.entries(expose)) {
  // @ts-ignore
  window[key] = value;
}

</script>

<script lang="ts">
import { defineComponent } from 'vue';
// import EditorArea from './components/EditorArea.vue'
import EditorSeparator from './components/EditorSeparator.vue'
import MainView from './components/MainView.vue'

import {InvalidSyntax, TokenStream, SourceLocation} from './lib/tokenstream';
import { get_default_parsers, delegate, Patterns } from './lib/parser';
import { FiniteAutomaton, TuringMachine, format_transition_table, TuringTransitionMap} from './lib/automaton';
import { Compiler, CompilationError, underline_code } from './lib/compiler';
import {AstRoot, AstIdentifier} from './lib/ast'
import {get_class_hierarchy, Visitor, Rule, rule} from './lib/visitor';
import {Scope, Evaluator, EvaluationError} from './lib/evaluator';
import {convert_turing_xml} from './lib/export';
import { XMLParser } from "fast-xml-parser";

export default defineComponent({
  components: {
    // EditorArea
    EditorSeparator,
    MainView,
  },
  data() {
    const source = localStorage.editorSource;
    return {
      compiler: new Compiler(),
      editorWidth: "50%",
      editorHeight: "100%",
      timeout: null as number | null,
      changeInterval: 500,
      code: source ? source : "",
      output: "",
      objects: {},
    }
  },
  mounted() {
    setTimeout(() => this.compile(this.code), 1000);
  },
  methods: {
    async editorChange(source: string) {
      if (this.timeout) clearInterval(this.timeout);
      this.timeout = setTimeout(() => {
        this.timeout = null;
        this.compile(source);
      }, this.changeInterval);

      localStorage.editorSource = source;
    },

    async compile(source: string) {
      const start = Date.now();

      try {
        const {ast, tokens, scope} = this.compiler.compile(source);
        console.log(`Took ${Date.now() - start}ms to compile.`);

        const text = JSON.stringify(ast.toObject(), null, 4);
  
        this.output = text;
        this.objects = {};
        for (const [name, value] of scope) {
          this.objects[name] = value;
        }

        // @ts-ignore
        window.$ast = ast;
        // @ts-ignore
        window.$tokens = tokens;
        // @ts-ignore
        window.$scope = scope;

      } catch (err) {
        if (err instanceof CompilationError) {
          this.output = err.message;
        }
        else throw err;
      }
    }
  }
})

</script>

<template>
  <main>
    <vue-monaco-editor
      v-model:value="code"
      theme="vs-dark"
      :options="MONACO_EDITOR_OPTIONS"
      :class="['editor']"
      :width="editorWidth"
      :height="editorHeight"
      @change="editorChange"
    />
    <EditorSeparator/>
    <MainView
      :output="output"
      :objects="objects"
    ></MainView>
  </main>
</template>

<style>
:root {
  --white: #f0f0ff;
  --lighter-white: #f0f8ff;
  --light-gray: #e9e9f5;

  --black: #181818;
  --text: rgba(235, 235, 235, 0.64);

  --error: #f48771;
  --background-lighter: rgba(127, 127, 127, 0.1);
  --background: rgba(255, 255, 255, 0.04);
  --separator-background: #252526;
}

body {
  font-size: 16px;
  color: black;
}

main,
#app {
  padding: 0;
  margin: 0;

  width: 100%;
  max-width: 100%;
  height: 100vh;
  max-height: 100%;
}

.editor {
  font-family: "Droid Sans Mono", "monospace";
  color: var(--light-gray);
}

main {
  display: flex;
  width: 100vw;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
</style>
