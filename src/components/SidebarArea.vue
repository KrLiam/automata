<template>
    <div class="sidebar">
        <div class="menu" v-if="selected_path.length">
            <div class="menu-top">
                <button class="return green" @click="unselect">&lt;</button>
                <div>
                    <span class="type green text-small">{{selectedType}}</span>
                    <span class="name">{{selectedName}}</span>
                    <span class="modifier green" v-if="selectedModifier">#{{selectedModifier}}</span>
                </div>
            </div>
            <button
                v-if="showViewDeterministic"
                @click="view_deterministic"
            >View Deterministic</button>
        </div>
        <p class="green text-small" v-if="selected_path.length && elements.length">Children</p>
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
}>()
defineEmits<{
    (e: "selected", path: string[]): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import SelectMenu, { type SelectElement, type SelectEvent } from "./SelectMenu.vue"
import { LangObject, type Scope } from "../lib/evaluator";
import { FiniteAutomaton, StateMachine, TuringMachine } from "@/lib/automaton";

export default defineComponent({
    components: {
        SelectMenu
    },
    data: () => ({
        selected_path: [] as string[],
    }),
    watch: {
    },
    computed: {
        selectedType(): string {
            const obj = this.selected
            if (!obj || !(obj.value instanceof StateMachine)) return ""
            const value = obj.value

            const det_trait = value.is_deterministic() ? "Deterministic" : "Non-Deterministic"

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
            return entries.map(([name]) => ({name}))
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
.menu button {
    font-size: 1em;
    position: relative;
    padding: 0.5em 1.25em;
    cursor: pointer;
    background: none;
    border: none;
    color: inherit;
}
.menu button:hover::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    background: color-mix(in srgb, currentColor 40%, transparent);
}
.menu button.green:hover::before {
    background: color-mix(in srgb, var(--detail-green) 30%, transparent);
}

.green {
color: var(--detail-green);
}
.text-small {
    font-size: 0.75em;
}

.menu-top > .return {
    padding: 0.5em 1.25em;
    font-weight: 800;
}
</style>
