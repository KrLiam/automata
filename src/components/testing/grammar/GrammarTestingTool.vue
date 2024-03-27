<template>
    <div
        class="container"
        ref="container"
        tabindex="1"
    >
        <div class="top">
            <button class="close green" @click="close">X</button>
            <div class="control"></div>
        </div>

        <ul class="steps" v-if=selected_instance>
            <li class="step" v-for="(sequence, i) in selected_steps" :key="i">
                <SentenceElement :value="sequence" :highlight_range="highlight_range"/>
            </li>
        </ul>

        <ul class="rules">
            <li
                class="rule"
                v-for="([pos, rule], i) in selected_matched_rules"
                :key="`${step_num}-${i}`"
                @mouseenter="highlight_subsequence(pos, rule.head.length)"
                @mouseleave="clear_highlight()"
            >
                <SentenceElement :value="rule.head"/>
                <span class="rule-arrow">➜</span>
                <span>
                    <SentenceElement
                        v-for="(result, result_i) in rule.results"
                        :key="result_i"
                        :value="result"
                        @click="apply_rule([pos, rule.head.length, result])"
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
import { apply_substitution, Grammar, type RuleMatch, type SentencialSequence, type SequenceSubstitution } from "@/lib/grammar"
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
    watch: {
    },
    data: () => ({
        instances: [] as ProductionInstance[],
        highlight_range: null as [number, number] | null
    }),
    mounted() {
        this.start()
    },
    computed: {
        selected_instance(): ProductionInstance | null {
            const instances = this.instances.filter(instance => instance.selected)
            if (instances.length !== 1) return null
            return instances[0]
        },
        selected_steps(): SentencialSequence[] {
            const instance = this.selected_instance
            if (!instance) return []
            
            const steps = this.get_steps(instance)
            return steps.slice(-1)
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

        highlight_subsequence(pos: number, length: number) {
            this.highlight_range = [pos, pos + length]
        },
        clear_highlight() {
            this.highlight_range = null
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

    color: var(--white);
    background: var(--background-13);
}
.container:focus {
    outline: none;
}
.container > * {
    flex-shrink: 0;
}
.container > .top {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 1rem;
}

button.close {
    font-weight: 800;
}

.steps {
    display: flex;
    flex-direction: column;
}
.step {
    display: flex;
    justify-content: center;
    width: 100%;
}

.rules {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    padding-top: 2rem;
    user-select: none;
}

.rule-option {
    padding: 0.5rem 0.5rem;
}
.rule-option:not(:last-child) {
    margin-right: 1rem;
    position: relative;
}
.rule-option:not(:last-child)::after {
    content: '|';
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
    padding: 0 0.5rem;
}
</style>
