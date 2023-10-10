<script lang="ts">
import { defineComponent } from 'vue';
import EditorArea from './components/EditorArea.vue'

import {InvalidSyntax, TokenStream} from './lib/tokenstream';
import { get_default_parsers, delegate, Patterns } from './lib/parser';
import { FiniteAutomaton, TuringMachine, format_transition_table, TuringTransitionMap} from './lib/automaton';
import { Compiler } from './lib/compiler';
import {AstRoot, AstIdentifier} from './lib/ast'
import {get_class_hierarchy, Visitor, Rule, rule} from './lib/visitor';
import {Scope, Evaluator, EvaluationError} from './lib/evaluator';

export default defineComponent({
  components: {
    EditorArea
  },
  data() {return {
    compiler: new Compiler()
  }},
  setup() {
    const expose = {
      TokenStream,
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
    };
    for (let [key, value] of Object.entries(expose)) {
      // @ts-ignore
      window[key] = value;
    }
  },
  methods: {
    async sourceChanged(source: string) {
      const element = this.$refs.output as HTMLDivElement;

      const start = Date.now();

      try {
        const {ast, tokens, scope} = this.compiler.compile(source);
        const text = JSON.stringify(ast.toObject(), null, 4);
  
        element.innerText = text;

        // @ts-ignore
        window.$ast = ast;
        // @ts-ignore
        window.$tokens = tokens;
        // @ts-ignore
        window.$scope = scope;

        console.log(`Took ${Date.now() - start}ms to compile.`);
      } catch (err) {
        if (err instanceof InvalidSyntax) {
          element.innerText = err.message
        }
        else if (err instanceof EvaluationError) {
          console.log(`Error: ${err.message}`);
        }
        else throw err;
      }
    }
  }
})

</script>

<template>
  <main>
    <EditorArea
      @sourceChanged="sourceChanged"
      :width="'30em'"
    ></EditorArea>
    <div class="output" ref="output"></div>
  </main>
</template>

<style>
:root {
  --white: #f0f0ff;
  --lighter-white: #f0f8ff;
  --light-gray: #e9e9f5;

  --black: #181818;
  --text-dark: rgba(235, 235, 235, 0.64);
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
  height: 100%;
  max-height: 100%;
}

main {
  display: flex;
  width: 100vw;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
main .output {
  flex-grow: 1;
}


.output {
  max-height: 100vh;
  height: 100%;
  padding: 1em;

  white-space: pre;
  overflow: scroll;

  color: var(--text-dark);
  background: var(--black);
}
</style>
