<template>
    <div
        class="container"
        ref="container"
        tabindex="1"
    >
        <div class="top">
            <div class="control">
                <button @click="start">Restart</button>
                <button
                    @click="undo_step"
                    @mouseenter="highlight_undo_subsequence"
                    @mouseleave="clear_highlight()"
                >Undo</button>
            </div>
            <button class="close green" @click="close">X</button>
        </div>

        <div data-observer-intercept ref="sticky_intercept"></div>
        <div class="sequence-container" ref="sticky_container">
            <SentenceElement :value="selected_sequence" :highlight_range="highlight_range"/>
        </div>

        <ul class="rules">
            <li
                class="rule"
                v-for="([pos, rule], i) in selected_matched_rules"
                :key="`${step_num}-${i}`"
            >
                <SentenceElement :value="rule.head"/>
                <span class="rule-arrow">➜</span>
                <span class="rule-options">
                    <SentenceElement
                        v-for="(result, result_i) in rule.results"
                        :key="result_i"
                        :value="result"
                        @click="apply_rule([pos, rule.head.length, result])"
                        @mouseenter="highlight_subsequence(pos, rule.head.length)"
                        @mouseleave="clear_highlight()"
                        class="rule-option"
                    />
                </span>
            </li>
        </ul>
    </div>
</template>

<script lang="ts" setup>
defineProps<{
    grammar: Grammar
}>()
defineEmits<{
    (e: "close", event: void): void
}>()
</script>

<script lang="ts">
import { apply_substitution, Grammar, sequence_symbols, type RuleMatch, type SentencialSequence, type SequenceSubstitution } from "@/lib/grammar"
import { defineComponent } from "vue"
import SentenceElement from "./SentenceElement.vue"

export interface ProductionInstance {
    sequence: SentencialSequence
    substitutions: SequenceSubstitution[]
    selected: boolean
}

export default defineComponent({
    components: {
        SentenceElement,
    },
    data: () => ({
        instances: [] as ProductionInstance[],
        highlight_range: null as [number, number] | null
    }),
    mounted() {
        const container = this.$refs["sticky_container"] as HTMLDivElement
        const intercept = this.$refs["sticky_intercept"] as HTMLDivElement
        const observer = new IntersectionObserver(([entry]) => {
            container.classList.toggle("shadow", !entry.isIntersecting);
        });
        observer.observe(intercept);

        this.start()
    },
    computed: {
        selected_instance(): ProductionInstance | null {
            const instances = this.instances.filter(instance => instance.selected)
            if (instances.length !== 1) return null
            return instances[0]
        },
        selected_sequence(): SentencialSequence {
            const instance = this.selected_instance
            if (!instance) return []
            
            return instance.sequence
        },
        selected_matched_rules(): RuleMatch[] {
            const instance = this.selected_instance
            if (!instance) return []

            const matches = this.grammar.match_rules(instance.sequence)
            return matches
        },
        step_num() {
            const instance = this.selected_instance
            if (!instance) return []

            return instance.substitutions.length + 1
        },
    },
    methods: {
        start() {
            this.instances = []

            this.instances.push({
                sequence: this.grammar.start_sequence(),
                substitutions: [],
                selected: true
            })
        },

        get_steps(instance: ProductionInstance): SentencialSequence[] {
            let sequence = this.grammar.start_sequence()

            const result = [sequence]
            
            for (const substitution of instance.substitutions) {
                sequence = apply_substitution(sequence, substitution)
                result.push(sequence)
            }

            return result
        },
        apply_rule(value: SequenceSubstitution) {
            const instance = this.selected_instance
            if (!instance) return null

            const sequence = apply_substitution([...instance.sequence], value)
            
            instance.sequence = sequence
            instance.substitutions.push(value)

            this.clear_highlight()
        },
        undo_step() {
            const instance = this.selected_instance
            if (!instance) return null
  
            instance.substitutions.pop()
            instance.sequence = apply_substitution(this.grammar.start_sequence(), ...instance.substitutions)

            if (this.highlight_range !== null) this.highlight_undo_subsequence()
        },

        highlight_subsequence(pos: number, length: number) {
            this.highlight_range = [pos, pos + length]
        },
        clear_highlight() {
            this.highlight_range = null
        },

        highlight_undo_subsequence() {
            const instance = this.selected_instance
            if (!instance) return null

            if (!instance.substitutions.length) return null

            const [pos, _, symbols] = instance.substitutions[instance.substitutions.length - 1]
            this.highlight_subsequence(pos, sequence_symbols(symbols).length)
        },

        close() {
            this.$emit("close")
        },
        container_keydown(ev: KeyboardEvent) {
        }
    },
})
</script>

<style scoped>
.container {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    position: relative;
    
    color: var(--white);
    background: var(--background-13);
}
.container:focus {
    outline: none;
}
.container > .top {
    display: flex;
    flex-direction: row;
    padding: 0 1rem;
    justify-content: space-between;
}
.container > .top > .control {
    display: flex;
    gap: 0.5rem;
}

.container > .top button {
    font-weight: 500;
}
.container > .top button.close {
    font-weight: 800;
}

.sequence-container {
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: center;
    padding: 1rem 0.75rem 0.5rem;
    overflow: scroll;
    background: var(--background-13);
    user-select: none;
}
.sequence-container.shadow {
    box-shadow: 0 0.1rem 0.5rem rgba(0, 0, 0, 0.2);
}

.rules {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    user-select: none;
    gap: 0.5rem;
}
.rule {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.rule-options {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

.rule-option {
    padding: 0.5rem 0.5rem;
    position: relative;
}
.rule-option:not(:last-child)::after {
    content: '|';
    pointer-events : none;
    position: absolute;
    right: -1rem;
    bottom: 0.3rem;

    color: var(--detail-green);
    font-size: 1.5rem;
    font-weight: 600;
}
.rule-option:hover {
    background-color: color-mix(in srgb, var(--detail-green) 30%, transparent);
    border-radius: 0.25rem;
    cursor: pointer;
}

.rule-arrow {
    color: var(--detail-green);
    font-size: 1.5rem;
    font-weight: 600;
}
</style>
