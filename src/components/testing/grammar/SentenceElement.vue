<template>
    <span class="sentence">
        <span
            v-for="(symbol, i) in value"
            :class="[is_nonterminal(symbol) ? 'nonterminal' : null]"
            :key="i"
        >
            {{ symbol.value }}
        </span>
    </span>
</template>

<script lang="ts" setup>
import { defineProps } from 'vue';
import { type SentencialSequence, is_nonterminal } from "@/lib/grammar"

defineProps<{
    value: SentencialSequence
}>()
</script>

<style scoped>
.sentence > * {
    font-size: 1.5em;
    font-weight: 600;
    line-height: 0;
}
.sentence > .nonterminal {
    background-color: var(--background-20);
    border-radius: 0.25rem;
    padding: 0 0.25rem;
    margin: 0 0.1rem;
}
</style>