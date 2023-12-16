<template>
    <SplitView class="content" :direction="'vertical'">
        <template v-slot:left>
            <SplitView :direction="'horizontal'" class="top" :pixels="true" :min_left="300">
                <template v-slot:left>
                    <div class="menu">
                        <ul class="objects">
                            <li
                                class="element"
                                v-for="[name, value] in Object.entries(objects)"
                                :key="name"
                            >
                                <span>{{ name }}</span>
                                <button @click="export_jflap(name, value.value)">
                                    Export
                                </button>
                            </li>
                        </ul>
                    </div>
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
import OutputMessages from "../components/OutputMessages.vue"
import SplitView from "../components/SplitView.vue"
import { LangObject } from "../lib/evaluator"
import { TuringMachine } from "../lib/automaton"
import { convert_turing_xml } from "../lib/export"

export default defineComponent({
    components: {
        OutputMessages,
        SplitView,
    },
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
    },
})
</script>

<style scoped>
.content {
    flex-grow: 1;
    max-height: 100vh;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: "Droid Sans Mono", "monospace";
}

.content .top {
    flex-grow: 1;
}

.top .menu {
    width: 100%;
    background: var(--background-lighter);
    height: 100%;
    color: var(--white);

    max-height: 100%;
    overflow-y: scroll;
}

.menu .objects {
    list-style-type: none;

    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
}
.menu .objects > * {
    padding: 0.5em 0.1em;
}
.menu .objects .element {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.output {
    height: 100%;
}
</style>
