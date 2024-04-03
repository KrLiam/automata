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
                    <SidebarArea
                        class="main-sidebar"
                        :show_test_button="isIdle"
                        :selected="get_selected_object()"
                        @selected="update_selected"
                        @test_automaton="test_automaton"
                        @test_grammar="test_grammar"
                        @enumerate_grammar="enumerate_grammar"
                    ></SidebarArea>
                </template>
                <template v-slot:right>
                    <GraphVisualizer
                        :value="graph"
                        :style="graph_style ?? {nodes:{},arcs:{}}"
                        @mounted="visualizer = $event"
                        @updated-graph="
                            selected ? save_graph(selectedName, graph) : null
                        "
                    ></GraphVisualizer>
                </template>
            </SplitView>
        </template>
        <template v-slot:right>
            <TestingTool
                v-if="isTestingAutomaton"
                :input="test_input"
                :automaton="get_selected_automaton()"
                @close="close_test"
                @updated-state="updated_test_state"
            ></TestingTool>
            <GrammarTestingTool
                v-else-if="isTestingGrammar"
                :grammar="get_selected_grammar() as Grammar"
                @close="close_test"
            ></GrammarTestingTool>
            <GrammarEnumerator
                v-else-if="isEnumeratingGrammar"
                :grammar="get_selected_grammar() as Grammar"
                @close="close_test"
            ></GrammarEnumerator>
            <OutputMessages
                v-else
                class="main-output"
                :messages="messages"
            ></OutputMessages>
        </template>
    </SplitView>
</template>

<script lang="ts" setup>
type Message = { level: string; message: string }

defineProps<{
    messages: Message[]
    objects: Scope | null
}>()
defineEmits<{
    (e: "lock-compilation", event: void): void
    (e: "unlock-compilation", event: void): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"
import OutputMessages from "./OutputMessages.vue"
import SplitView from "./SplitView.vue"
import TestingTool, { type Instance } from "./TestingTool.vue"
import GrammarTestingTool from "./testing/grammar/GrammarTestingTool.vue"
import GrammarEnumerator from "./testing/grammar/GrammarEnumerator.vue"
import GraphVisualizer, { type Visualizer } from "./GraphVisualizer.vue"
import SidebarArea from "./sidebar/SidebarArea.vue"
import { FiniteObject, GrammarObject, LangObject, Scope } from "../lib/evaluator"
import { StateMachine, TuringMachine } from "../lib/automaton"
import { convert_turing_xml } from "../lib/export"
import {
    make_graph,
    random_position,
    type GraphData,
    type Vector2,
    type GraphStyle,
    tuple_key,
} from "../lib/graph"
import type { Grammar } from "@/lib/grammar"

export enum Status {
    Idle,
    TestingAutomaton,
    TestingGrammar,
    EnumeratingGrammar,
}

export default defineComponent({
    components: {
        OutputMessages,
        TestingTool,
        GrammarTestingTool,
        GrammarEnumerator,
        GraphVisualizer,
        SidebarArea,
        SplitView,
    },
    data: () => ({
        selected: [] as string[],
        graph: make_graph(),
        graph_style: null as GraphStyle | null,
        visualizer: null as Visualizer | null,

        status: Status.Idle as Status,
        test_input: null as string | null,
    }),
    mounted() {
        window.addEventListener("storage", (event) => {
            if (event.key === "saved_graphs") this.update_graph()
        })
    },
    watch: {
        objects() {
            this.update_graph()
        },
        selected() {
            this.update_graph()
        },
    },
    computed: {
        selectedName() {
            return this.selected.join("/")
        },

        isIdle() {
            return this.status === Status.Idle
        },
        isTestingAutomaton() {
            return (
                this.status === Status.TestingAutomaton
                && this.get_selected_automaton() !== null
            )
        },
        isTestingGrammar() {
            return (
                this.status === Status.TestingGrammar
                && this.get_selected_grammar() !== null
            )
        },
        isEnumeratingGrammar() {
            return (
                this.status === Status.EnumeratingGrammar
                && this.get_selected_grammar() !== null
            )
        }
    },
    methods: {
        get_graph(name: string): GraphData {
            let graphs: { [name: string]: GraphData } = JSON.parse(
                localStorage.saved_graphs ?? "{}",
            )
            return {...make_graph(), ...(graphs[name] ?? {})}
        },
        save_graph(name: string, graph: GraphData) {
            let graphs: { [name: string]: GraphData } = JSON.parse(
                localStorage.saved_graphs ?? "{}",
            )
            graphs[name] = graph
            localStorage.saved_graphs = JSON.stringify(graphs)
        },
        update_graph() {
            const value = this.get_selected_automaton()
            if (!value) {
                this.graph = make_graph()
                return
            }

            const name = this.selectedName

            const saved = this.get_graph(name)
            this.graph = make_graph(
                value,
                saved,
                node => this.generate_node_pos(),
            )

            this.save_graph(name, this.graph)
        },
        generate_node_pos(): Vector2 {
            const rect = this.visualizer?.canvas.rect ?? { width: 500, height: 500 }
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

        update_selected(path: string[]) {
            this.selected = path
            this.visualizer?.autofocus()

            this.close_test()
        },
        get_object(path: string[]): LangObject | null {
            if (!this.objects) return null

            const binding = this.objects.path(path)
            if (!binding) return null

            
            const obj = binding.unwrap()

            if (!(obj instanceof LangObject)) return null

            return obj
        },
        get_selected_object(): LangObject | null {
            if (!this.selected.length) return new LangObject(null, this.objects)

            const namespace = this.selected.slice(0, -1)
            const name = this.selected[this.selected.length - 1]

            if (name === "#det") {
                const obj = this.get_object(namespace)
                if (!(obj instanceof FiniteObject)) return null

                return obj.$determinize()
            }
            if (name === "#min") {
                const obj = this.get_object(namespace)
                if (!(obj instanceof FiniteObject)) return null

                return obj.$minimize()
            }

            const obj = this.get_object([...namespace, name])
            if (!obj) return null
            return obj
        },
        get_selected_automaton(): StateMachine<any, any> | null {
            const obj = this.get_selected_object()
            if (!obj) return null

            return obj.value instanceof StateMachine ? obj.value : null
        },
        get_selected_grammar(): Grammar | null {
            const obj = this.get_selected_object()
            return obj instanceof GrammarObject ? obj.value : null
        },
 
        test_automaton(input: string) {
            const automaton = this.get_selected_automaton()
            if (!automaton) return

            this.status = Status.TestingAutomaton
            this.test_input = input
            this.$emit("lock-compilation")
        },
        test_grammar() {
            if (!this.get_selected_grammar()) return
            
            this.status = Status.TestingGrammar
            this.$emit("lock-compilation")
        },
        enumerate_grammar() {
            if (!this.get_selected_grammar()) return
            
            this.status = Status.EnumeratingGrammar
            this.$emit("lock-compilation")
        },
        close_test() {
            this.status = Status.Idle
            this.test_input = null
            this.graph_style = null

            this.$emit("unlock-compilation")
        },
        updated_test_state(instances: Instance[]) {
            const style: GraphStyle = {nodes:{},arcs:{}}

            const color_codes: {[id: number]: string} = {
                0: "#c0c0c0", // unselected
                1: "#e1b217", // selected
                2: "#f83939", // rejected
                3: "#00bd7e", // accepted
            }
            const node_colors: {[name: string]: number} = {}

            for (const instance of instances) {
                const state = instance.conf.state
                const color_id = (
                    !instance.selected ? 0 :
                    instance.accepted ? 3 :
                    instance.accepted === false ? 2 :
                    1
                )
    
                node_colors[state] = Math.max(node_colors[state] ?? 0, color_id)

                if (!instance.selected || instance.accepted !== null) continue

                for (const [start, _, end] of instance.transitions) {
                    const key = tuple_key(start, end)
                    style.arcs[key] = {color: "#e1b217"}
                }
            }

            for (const [name, color_id] of Object.entries(node_colors)) {
                style.nodes[name] = {color: color_codes[color_id]}
            }

            this.graph_style = style
        }
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

.main-sidebar {
    padding: 15px 0 0 15px;
}

.main-output {
    height: 100%;
}


.main-content button {
    font-size: 1em;
    position: relative;
    padding: 0.5em 1.25em;
    cursor: pointer;
    background: none;
    border: none;
    color: inherit;
}
.main-content button:hover::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    background: color-mix(in srgb, currentColor 40%, transparent);
}
.main-content button.green:hover::before {
    background: color-mix(in srgb, var(--detail-green) 30%, transparent);
}

.main-content .green {
color: var(--detail-green);
}
.main-content .text-small {
    font-size: 0.75em;
}
</style>
