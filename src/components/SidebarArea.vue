<template>
    <div class="sidebar">
        <div class="menu" v-if="selected_path.length">
            <div class="menu-top">
                <button class="return green" @click="unselect">&lt;</button>
                <div>
                    <span class="type green text-small">{{ selectedType }}</span>
                    <span class="name">{{ selectedName }}</span>
                    <span class="modifier green" v-if="selectedModifier"
                        >#{{ selectedModifier }}</span
                    >
                </div>
            </div>
            <button v-if="showViewDeterministic" @click="view_deterministic">
                View Deterministic
            </button>

            <form
                class="test-input"
                @submit="start_test"
                v-if="inserting_test_input"
            >
                <input
                    type="text"
                    placeholder="Input"
                    v-model="test_input"
                    v-focus
                />
                <button type="submit">Go</button>
            </form>
            <button @click="insert_test_input" v-else-if="show_test_input">
                Test
            </button>
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
    show_test_input: boolean
}>()
defineEmits<{
    (e: "selected", path: string[]): void
    (e: "test", input: string): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import SelectMenu, { type SelectElement, type SelectEvent } from "./SelectMenu.vue"
import { LangObject, type Scope } from "../lib/evaluator"
import { FiniteAutomaton, StateMachine, TuringMachine } from "@/lib/automaton"

export default defineComponent({
    components: {
        SelectMenu,
    },
    directives: {
        focus(el) {
            el?.focus()
        },
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
            if (!obj || !(obj.value instanceof StateMachine)) return ""
            const value = obj.value

            const det_trait = value.is_deterministic()
                ? "Deterministic"
                : "Non-Deterministic"

            if (value instanceof FiniteAutomaton) {
                return `${det_trait} Finite Automaton`
            }
            if (value instanceof TuringMachine) {
                return `${det_trait} Turing Machine`
            }

            return ""
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
            this.clear_test_input()

            this.selected_path.push(name)
            this.$emit("selected", [...this.selected_path])
        },
        unselect() {
            this.clear_test_input()

            this.selected_path.pop()
            this.$emit("selected", [...this.selected_path])
        },

        view_deterministic() {
            const obj = this.selected
            if (!obj || !(obj.value instanceof FiniteAutomaton)) return

            this.select("#det")
        },

        insert_test_input() {
            this.inserting_test_input = true
        },
        clear_test_input() {
            this.inserting_test_input = false
            this.test_input = ""
        },
        start_test() {
            this.$emit("test", this.test_input)
            this.clear_test_input()
        },
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

.test-input {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    height: 2.33rem;
}
.test-input > button {
    flex-shrink: 0;
    width: 4rem;
    padding: 0;
    text-align: center;
    line-height: 50%;
}
.test-input > input {
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;

    outline: none;
    border: none;
    border-radius: 0.2rem;
    background: var(--light-gray);
}
.test-input > input:focus {
    outline: 0.15rem solid var(--detail-green);
}
</style>
