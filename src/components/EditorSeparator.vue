<template>
    <div class="separator"></div>
</template>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    data() {
        return {}
    },
    methods: {},
})
</script>

<style>
.separator {
    flex-grow: 0;
    width: 1em;
    height: 100%;
    background: var(--separator-background);
    cursor: ew-resize;
    box-shadow: -0.25rem 0 1rem 0 rgba(0, 0, 0, 0.1);
}
</style>
