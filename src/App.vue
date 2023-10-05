<script lang="ts">
import { defineComponent } from 'vue';
import EditorArea from './components/EditorArea.vue'
import EditorSeparator from './components/EditorSeparator.vue'

import {InvalidSyntax, TokenStream} from './lib/tokenstream';
import { get_default_parsers, delegate, Patterns } from './lib/parser';
import { Transition, FiniteAutomaton, format_transition_table} from './lib/automaton';
import { Compiler } from './lib/compiler';
import {AstRoot, AstIdentifier} from './lib/ast'

export default defineComponent({
  components: {
    EditorArea,
    EditorSeparator
  },
  data() {return {
    compiler: new Compiler()
  }},
  setup() {
    const expose = {
      TokenStream,
      get_default_parsers,
      delegate,
      Transition,
      FiniteAutomaton,
      format_transition_table,
      Compiler,
      Patterns,
      AstRoot,
      AstIdentifier,
    };
    for (let [key, value] of Object.entries(expose)) {
      // @ts-ignore
      window[key] = value;
    }
  },
  methods: {
    sourceChanged(source: string) {
      const element = this.$refs.output as HTMLDivElement;

      try {
        const {ast} = this.compiler.compile(source);
        const text = JSON.stringify(ast.toObject(), null, 4);
  
        element.innerText = text;
      } catch (err) {
        if (err instanceof InvalidSyntax) {
          element.innerText = err.message
        }
      }
    }
  }
})

</script>

<template>
  <main>
    <EditorArea
      @sourceChanged="sourceChanged"
    ></EditorArea>
    <EditorSeparator/>
    <div class="output" ref="output"></div>
  </main>
</template>

<style>
:root {
  --white: #f0f0ff;
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
main .code {
  flex-grow: 1;
}
main .output {
  flex-grow: 1;
}

.output {
  white-space: pre;
  padding: 1em;
  overflow: scroll;
  max-height: 100vh;
  background: var(--white);
}
</style>
