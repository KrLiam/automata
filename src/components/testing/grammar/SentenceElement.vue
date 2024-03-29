<template>
    <span class="sentence">
        <span
            v-for="(range, range_i) in symbol_ranges"
            :key="range_i"
            :class="[range.highlight ? 'highlight' : null]"
        >
            <span
                v-for="(symbol, i) in range.symbols"
                :class="[is_nonterminal(symbol) ? 'nonterminal' : null]"
                :key="i"
            >
                {{ symbol.value }}
            </span>
        </span>
    </span>
</template>

<script lang="ts" setup>
withDefaults(
    defineProps<{
        value: SentencialSequence
        highlight_range?: [number, number] | null
    }>(),
    {
        highlight_range: null
    }
)
</script>

<script lang="ts">
import { defineComponent, defineProps } from 'vue';
import { type SentencialSequence, is_nonterminal, is_terminal, merge_terminals, sequence_symbols, Terminal } from "@/lib/grammar"

export interface SequenceRange {
    highlight: boolean,
    symbols: SentencialSequence
}

export default defineComponent({
    computed: {
        symbol_ranges(): SequenceRange[] {
            if (this.highlight_range === null) return [
                {highlight:false, symbols: this.format_sequence(this.value)}
            ]

            const symbols = sequence_symbols(this.value)
            const [start_i, end_i] = this.highlight_range
            
            const ranges: SequenceRange[] = [
                {highlight:false, symbols: symbols.slice(0, start_i)},
                {highlight:true, symbols: symbols.slice(start_i, end_i)},
                {highlight:false, symbols: symbols.slice(end_i)}
            ]

            return ranges
                .filter(range => range.symbols.length)
                .map(({highlight, symbols}) => ({
                    highlight,
                    symbols: this.format_sequence(symbols)
                }))
        }
    },
    methods: {
        format_sequence(value: SentencialSequence): SentencialSequence {
            const sequence = merge_terminals(value)

            return sequence.map(
                symbol => is_terminal(symbol, "") ? new Terminal("ε") : symbol
            )
        }
    }
})
</script>

<style scoped>
.sentence * {
    font-size: 1em;
    font-weight: 600;
    line-height: 0;
}
.sentence .nonterminal {
    background-color: var(--background-20);
    border-radius: 0.25rem;
    padding: 0 0.25rem;
    margin: 0 0.1rem;
}
.sentence .highlight {
    background-color: color-mix(in srgb, var(--detail-green) 30%, transparent);
    border-radius: 0.25rem;
    padding: 0.25rem 0;
}
</style>