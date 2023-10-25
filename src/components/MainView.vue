<template>
  <div class="content">
    <div class="top">
      <div class="menu">

        <ul class="objects">
          <li
            class="element"
            v-for="[name, value] in Object.entries(objects)"
            :key="name"
          >
            <span>{{name}}</span>
            <button
              @click="export_jflap(name, value.value)"
            >
              Export
            </button>
         </li>
        </ul>

      </div>
      <div class="view"></div>
    </div>
    <div class="output">
      {{output}}
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  output: string,
  objects: {[name: string]: LangObject}
}>();
</script>

<script lang="ts">
import { defineComponent, defineProps } from 'vue';
import { LangObject } from '../lib/evaluator';
import { TuringMachine } from '../lib/automaton';
import { convert_turing_xml } from '../lib/export';

export default defineComponent({
  data() { return {
    name: "",
    values: [1,2,3]
  }},
  watch: {
    objects(new_value) {
      console.log("Console changed.", new_value);
    }
  },
  methods: {
    download(filename, text) {
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
    },

    export_jflap(name: string, value: any) {
      console.log("exporting", name);

      if (value instanceof TuringMachine) {
        const str = convert_turing_xml(value);
        this.download(`${name}.jff`, str);
      }
    }
  }
})

</script>

<style scoped>
.content {
  flex-grow: 1;
  max-height: 100vh;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;  
  font-family: "Droid Sans Mono", "monospace";
}
.output {
  padding: 1em;
  height: 20em;
  
  white-space: pre-wrap;
  overflow: scroll;
  
  color: var(--error);
  background: var(--background);
}
.view.error {
  color: var(--error);
}

.content .top {
  flex-grow: 1;
}

.top .menu {
  width: 15em;
  background: var(--background-lighter);
  height: 100%;
  color: var(--white);

  max-height: 100%;
  overflow-y: scroll;
}

.menu .objects {
  list-style-type: none;

  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
.menu .objects > *{
  padding: 0.5em 0.1em;
}
.menu .objects .element {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
</style>
