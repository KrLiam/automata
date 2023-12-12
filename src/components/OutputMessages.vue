<template>
    <ul
    class="output"
    ref="messages"
    >
        <li
        :class="['output-message', level]"
        :key="message"
        v-for="{level, message} in messages"
        @scroll="scrolled"
        >
            {{message}}
        </li>
    </ul>
  </template>
  
  <script lang="ts" setup>
  type Message = {level: string, message: string};
  
  defineProps<{
    messages: Message[]
  }>();
  </script>
  
  <script lang="ts">
  import { defineComponent, defineProps } from 'vue';
  
  export default defineComponent({
    data() { return {
        autoScroll: true,
    }},
    updated() {
        console.log("autoscrolled", this.autoScroll);
        if (this.autoScroll) this.scrollToBottom();
    },
    methods: {
        scrolled() {
            const ul = this.$refs.messages;
            const scrollPos = ul.scrollHeight - ul.offsetHeight;
            this.autoScroll = Math.abs(ul.scrollTop - scrollPos) < 1;
        },
        scrollToBottom() {
            const ul = this.$refs.messages;
            ul.scrollTop = ul.scrollHeight;
        }
    }
  })
  
  </script>
  
  <style scoped>
  .output {
    padding: 1em;
    height: 15em;
    
    white-space: pre-wrap;
    overflow: scroll;
  
    list-style-type: none;
  
    display: flex;
    flex-direction: column;
    
    color: var(--white);
    background: var(--area-background);
  }
  .output-message.error {
    color: var(--error);
  }
  .output-message.success {
    color: var(--success);
  }
  </style>
  