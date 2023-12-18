<template>
    <SplitView class="main-content" :direction="'vertical'" :separator_size="20">
        <template v-slot:left>
            <SplitView
                class="main-top"
                :direction="'horizontal'"
                :pixels="true"
                :min_left="300"
                :initial="300"
                :separator_size="15"
            >
                <template v-slot:left>
                    <SelectMenu
                        class="select-menu"
                        :elements="menuElements"
                        @select="select"
                        @unselect="unselect"
                    ></SelectMenu>
                </template>
                <template v-slot:right>
                    <div class="view"></div>
                </template>
            </SplitView>
        </template>
        <template v-slot:right>
            <OutputMessages class="output" :messages="messages"></OutputMessages>
        </template>
    </SplitView>
</template>

<script lang="ts" setup>
type Message = { level: string; message: string }

defineProps<{
    messages: Message[]
    objects: { [name: string]: LangObject }
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import OutputMessages from "./OutputMessages.vue"
import SplitView from "./SplitView.vue"
import SelectMenu, { type SelectElement, type SelectEvent } from "./SelectMenu.vue"
import { LangObject } from "../lib/evaluator"
import { TuringMachine } from "../lib/automaton"
import { convert_turing_xml } from "../lib/export"

export default defineComponent({
    components: {
        OutputMessages,
        SplitView,
    },
    computed: {
        menuElements(): SelectElement<LangObject>[] {
            return Object.entries(this.objects).map(([name, value]) => ({
                name,
                value,
            }))
        },
    },
    data: () => ({
        selected: null as SelectElement<LangObject> | null,
    }),
    methods: {
        download(filename: string, text: string) {
            const element = document.createElement("a")
            element.setAttribute(
                "href",
                "data:text/plain;charset=utf-8," + encodeURIComponent(text),
            )
            element.setAttribute("download", filename)

            element.style.display = "none"
            document.body.appendChild(element)

            element.click()

            document.body.removeChild(element)
        },

        export_jflap(name: string, value: any) {
            if (value instanceof TuringMachine) {
                const str = convert_turing_xml(value)
                this.download(`${name}.jff`, str)
            }
        },

        select(event: SelectEvent) {
            this.selected = event.element
        },
        unselect() {
            this.selected = null
        },
    },
})
</script>

<style>
.main-content {
    flex-grow: 1;
    max-height: 100vh;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.main-top > .separator {
    background: var(--background-15);
}

.main-content > .separator {
    background: var(--background-13);
}

.select-menu {
    padding: 15px 0 0 15px;
}

.output {
    height: 100%;
}
</style>
