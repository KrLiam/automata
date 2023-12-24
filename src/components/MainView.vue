<template>
    <SplitView class="main-content" :direction="'vertical'" :separator_size="20">
        <template v-slot:left>
            <SplitView
                class="main-top"
                :direction="'horizontal'"
                :pixels="true"
                :min_left="250"
                :initial="250"
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
                    <GraphVisualizer
                        :value="graph"
                        @mounted="canvas = $event.canvas"
                        @updated-graph="
                            selected ? save_graph(selected.name, graph) : null
                        "
                    ></GraphVisualizer>
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
import GraphVisualizer from "./GraphVisualizer.vue"
import SelectMenu, { type SelectElement, type SelectEvent } from "./SelectMenu.vue"
import { LangObject } from "../lib/evaluator"
import { TuringMachine } from "../lib/automaton"
import { convert_turing_xml } from "../lib/export"
import {
    make_graph,
    random_position,
    type GraphData,
    Canvas,
    type Vector2,
} from "../lib/graph"

export default defineComponent({
    components: {
        OutputMessages,
        GraphVisualizer,
        SelectMenu,
        SplitView,
    },
    computed: {
        menuElements(): SelectElement[] {
            return Object.entries(this.objects).map(([name, value]) => ({
                name,
                value,
            }))
        },
    },
    data: () => ({
        selected: null as SelectElement | null,
        graph: make_graph(),
        canvas: null as Canvas | null,
    }),
    mounted() {},
    watch: {
        objects() {
            this.update_graph()
        },
        selected() {
            this.update_graph()
        },
    },
    methods: {
        get_graph(name: string): GraphData {
            let graphs: { [name: string]: GraphData } = JSON.parse(
                localStorage.saved_graphs ?? "{}",
            )
            return {...make_graph(), ...(graphs[name] ?? {})}
        },
        save_graph(name: string, graph: GraphData) {
            console.log("updated", graph)
            let graphs: { [name: string]: GraphData } = JSON.parse(
                localStorage.saved_graphs ?? "{}",
            )
            graphs[name] = graph
            localStorage.saved_graphs = JSON.stringify(graphs)
        },
        update_graph() {
            if (!this.selected) {
                this.graph = make_graph()
                return
            }

            const name = this.selected.name
            const obj = this.objects[name]
            if (!obj) return

            const saved = this.get_graph(this.selected.name)
            this.graph = make_graph(
                obj.value,
                saved,
                node => this.generate_node_pos(),
            )

            this.save_graph(this.selected.name, this.graph)
        },
        generate_node_pos(): Vector2 {
            const rect = this.canvas?.rect ?? { width: 500, height: 500 }
            return random_position([0, 0], [rect.width, rect.height])
        },

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
