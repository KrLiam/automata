<template>
  <div
    class="separator"
  ></div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  data() { return {
  }},
  methods: {
  }
})

</script>

<style>
.separator {
  width: 1.5em;
  height: 100%;
  background: var(--white);
  cursor:ew-resize;
  box-shadow: 0 0 2rem rgba(0, 0, 0, 0.15);
}
</style>
