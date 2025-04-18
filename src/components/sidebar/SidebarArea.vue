<template>
    <div class="sidebar">
        <div class="menu" v-if="selected_path.length">
            <div class="menu-top">
                <button class="return green" @click="unselect">&lt;</button>
                <div>
                    <span class="type green text-small">{{ selectedType }}</span>
                    <span
                        v-for="(fragment, i) in pathFragments"
                        :key="`${i}-${fragment.text}`"
                        :class="['name', fragment.modifier ? 'modifier' : null]"
                    >
                        {{ fragment.text }}
                    </span>
                </div>
            </div>
            <button v-if="isSelectedAutomaton" @click="copy_json">
                Copy Json
            </button>
            
            <button v-if="showViewDeterministic" @click="view_deterministic">
                View Deterministic
            </button>
            <button v-if="showViewMinimized" @click="view_minimized">
                View Minimized
            </button>

            <button @click="test_grammar" v-if="isSelectedGrammar && show_test_button">Test Grammar</button>
            <button @click="enumerate_grammar" v-if="isSelectedGrammar && show_test_button">Enumerate Sentences</button>
            <TestInputButton @submit="test_automaton" v-if="isSelectedAutomaton && show_test_button"/>
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
    (e: "test_automaton", input: string): void
    (e: "test_grammar"): void
    (e: "enumerate_grammar"): void
    (e: "log", ev: [string, string, boolean]): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import SelectMenu, { type SelectElement } from "./SelectMenu.vue"
import TestInputButton from "./TestInputButton.vue"
import { GrammarObject, LangObject, type_name } from "@/lib/evaluator"
import { FiniteAutomaton, StateMachine } from "@/lib/automaton"
import { Grammar } from "@/lib/grammar"

export type PathFragment = {
    text: string
    modifier: boolean
}

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
        pathFragments(): PathFragment[] {
            if (!this.selected_path.length) return []

            let path = [...this.selected_path]
            let fragments: PathFragment[] = []

            while (path.length) {
                const i = path.findIndex(v => v.startsWith("#"))
                const slice = i >= 0 ? path.slice(0, i) : path

                if (slice.length) {
                    const text = slice.join("/")
                    fragments.push({
                        text: fragments.length ? "/" + text : text,
                        modifier: false
                    })
                    path.splice(0, slice.length)
                }

                if (i >= 0) {
                    fragments.push({text: path[0], modifier: true})
                    path.splice(0, 1)
                }
            }
            console.log(fragments)
            return fragments
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
        showViewMinimized(): boolean {
            const obj = this.selected
            if (!obj || !(obj.value instanceof FiniteAutomaton)) return false

            return !obj.value.is_minimum()
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
        view_minimized() {
            const obj = this.selected
            if (!obj || !(obj.value instanceof FiniteAutomaton)) return

            this.select("#min")
        },
        copy_json() {
            if (!this.isSelectedAutomaton) return
            const automaton = this.selected?.value as FiniteAutomaton
            const json = JSON.stringify(automaton.to_json(), null, 2)
            navigator.clipboard.writeText(json)

            let name = this.pathFragments.map(f => f.text).join("")
            this.$emit("log", ["info", `Copied ${name} to clipboard!`, false])
        },

        test_automaton(input: string) {
            this.$emit("test_automaton", input)
        },

        test_grammar() {
            this.$emit("test_grammar")
        },

        enumerate_grammar() {
            this.$emit("enumerate_grammar")
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

.menu-top .modifier {
    display: inline-block;
    color: var(--detail-green);
    text-wrap: nowrap;
}
</style>
