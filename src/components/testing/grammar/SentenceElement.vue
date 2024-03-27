<template>
    <span class="sentence">
        <span
            v-for="(symbol, i) in symbol_sequence"
            :class="[is_nonterminal(symbol) ? 'nonterminal' : null]"
            :key="i"
        >
            {{ symbol.value }}
        </span>
    </span>
</template>

<script lang="ts" setup>
defineProps<{
    value: SentencialSequence
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from 'vue';
import { type SentencialSequence, is_empty_terminal, is_nonterminal, merge_terminals, Terminal } from "@/lib/grammar"

export default defineComponent({
    computed: {
        symbol_sequence() {
            const sequence = merge_terminals(this.value)

            return sequence.map(
                symbol => is_empty_terminal(symbol) ? new Terminal("ε") : symbol
            )
        },
    }
})
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