<template>
  <div
    class="editor"
    :style="{width: width}"
  >
    <div
      contenteditable
      class="code"
      spellcheck="false"
      ref="code"
      @input="changed()"
      @paste="paste($event)"
      @keydown="keydown($event)"
    ></div>
    <EditorSeparator/>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import EditorSeparator from './EditorSeparator.vue'

export default defineComponent({
  components: {
    EditorSeparator,
  },
  props: {
    changeInterval: {
      type: Number,
      default: 500
    },
    width: {
      type: String,
      default: "10em"
    }
  },
  data() { return {
    timeout: null as number | null,
  }},
  methods: {
    changed() {
      const element = this.$refs.code as HTMLDivElement
      const source = element.innerText;

      if (this.timeout) clearInterval(this.timeout);
      this.timeout = setTimeout(() => {
        this.timeout = null;
        this.$emit("sourceChanged", source);
      }, this.changeInterval);
    },

    paste(event: ClipboardEvent) {
      event.preventDefault();

      let paste = event.clipboardData?.getData("text");
      if (!paste) return;

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(paste));
      selection.collapseToEnd();
    },

    keydown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        event.preventDefault();
        this.indent();
      }
    },

    indent() {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const indentation = "  ";
      const indentationNode = document.createTextNode(indentation);
      
      const caret = selection.type === "Caret";
      
      const node = selection.anchorNode
      if (node) {
        selection.getRangeAt(0).insertNode(indentationNode);
      }

      if (caret) {
        selection.collapseToEnd();
      }
    }
  }
})

</script>

<style>
.editor {
  display: flex;
  flex-direction: row;
  height: 100%;
}

.code {
  flex-grow: 1;

  font-family: monospace;
  color:black;
  max-width: 50vw;
  height: 100vh;

  background-color:var(--white);
  padding: 1em;

  white-space: pre;
  overflow-wrap: normal;
  overflow-x: scroll;
  overflow-y: scroll;
  resize: none;
}
</style>
