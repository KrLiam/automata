<template>
    <div class="sidebar">
        <div class="menu" v-if="selected_path.length">
            <div class="menu-top">
                <button class="return green" @click="unselect">&lt;</button>
                <div>
                    <span class="type green text-small">{{ selectedType }}</span>
                    <span class="name">{{ selectedName }}</span>
                    <span class="modifier green" v-if="selectedModifier">
                        #{{ selectedModifier }}
                    </span>
                </div>
            </div>
            <button v-if="showViewDeterministic" @click="view_deterministic">
                View Deterministic
            </button>

            <button @click="test_grammar" v-if="isSelectedGrammar && show_test_button">Test Grammar</button>
            <TestInputButton @submit="start_test" v-if="isSelectedAutomaton && show_test_button"/>
        </div>
        <p class="green text-small" v-if="selected_path.length && elements.length">
            Children
        </p>
        <SelectMenu
            :elements="elements"
            :selected="null"
            @select="select($event.element.name)"
            @unselect="unselect"
        ></SelectMenu>
    </div>
</template>

<script lang="ts" setup>
defineProps<{
    selected: LangObject | null
    show_test_button: boolean
}>()
defineEmits<{
    (e: "selected", path: string[]): void
    (e: "test", input: string): void
    (e: "test_grammar"): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import SelectMenu, { type SelectElement } from "./SelectMenu.vue"
import TestInputButton from "./TestInputButton.vue"
import { GrammarObject, LangObject, type_name } from "@/lib/evaluator"
import { FiniteAutomaton, StateMachine } from "@/lib/automaton"
import { Grammar } from "@/lib/grammar"

export default defineComponent({
    components: {
        SelectMenu,
        TestInputButton,
    },
    data: () => ({
        selected_path: [] as string[],
        inserting_test_input: false as boolean,
        test_input: "" as string,
    }),
    watch: {},
    computed: {
        selectedType(): string {
            const obj = this.selected
            if (!obj) return ""

            let name = type_name(obj)

            if (obj.value instanceof StateMachine) {
                const det_trait = obj.value.is_deterministic()
                    ? "Deterministic"
                    : "Non-Deterministic"
                name = det_trait + " " + name
            }

            if (obj.value instanceof Grammar) {
                const type = obj.value.get_type()
                const type_trait =
                    type === 3 ? "Regular" :
                    type === 2 ? "Context-free" :
                    type === 1 ? "Context-sensitive" :
                    "Irrestricted"
                name = type_trait + " " + name
            }

            return name
        },
        selectedName(): string {
            if (!this.selected_path.length) return ""

            let path = this.selected_path

            const last = path.slice(-1)[0]
            if (last.startsWith("#")) {
                path = path.slice(0, -1)
            }

            return path.join("/")
        },
        selectedModifier(): string {
            if (!this.selected_path.length) return ""

            let path = this.selected_path
            const last = path.slice(-1)[0]

            if (last.startsWith("#")) {
                return last.substring(1)
            }

            return ""
        },

        isSelectedGrammar() {
            return this.selected instanceof GrammarObject
        },
        isSelectedAutomaton() {
            return this.selected && this.selected.value instanceof StateMachine
        },

        showViewDeterministic(): boolean {
            const obj = this.selected
            if (!obj || !(obj.value instanceof FiniteAutomaton)) return false

            return !obj.value.is_deterministic()
        },
        elements(): SelectElement[] {
            if (!this.selected) return []

            const scope = this.selected.scope
            if (!scope) return []

            const entries = scope.entries()
            return entries.map(([name]) => ({ name }))
        },
    },
    methods: {
        select(name: string) {
            this.selected_path.push(name)
            this.$emit("selected", [...this.selected_path])
        },
        unselect() {
            this.selected_path.pop()
            this.$emit("selected", [...this.selected_path])
        },

        view_deterministic() {
            const obj = this.selected
            if (!obj || !(obj.value instanceof FiniteAutomaton)) return

            this.select("#det")
        },

        start_test(input: string) {
            this.$emit("test", input)
        },

        test_grammar() {
            this.$emit("test_grammar")
        }
    },
})
</script>

<style scoped>
.sidebar {
    width: 100%;
    background: var(--background-15);
    height: 100%;
    color: var(--white);

    max-height: 100%;
    overflow-y: scroll;
    word-wrap: break-word;
}
.menu {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 0.25rem;
    padding-bottom: 1em;
}

.menu-top {
    display: flex;
    width: 100%;
    align-items: center;
    overflow: hidden;
    margin-bottom: 1em;
}

.menu-top > div {
    flex-grow: 1;
    margin-left: 1em;
    width: calc(100% - 4.5em);
    word-wrap: break-word;
}
.menu-top .type {
    color: var(--detail-green);
    display: block;
    margin: 0;
    padding: 0;
}

.menu-top > .return {
    padding: 0.5em 1.25em;
    font-weight: 800;
}
</style>
