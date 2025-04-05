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
                        @log="$emit('log', $event)"
                    ></SidebarArea>
                </template>
                <template v-slot:right>
                    <GraphVisualizer
                        :value="graph"
                        :style="graph_style ?? {nodes:{},arcs:{}}"
                        @mounted="visualizer = $event"
                        @moved-node="moved_node($event)"
                        @lock-node="lock_node($event[0], $event[1])"
                        @unlock-node="unlock_node($event[0], $event[1])"
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
    (e: "log", ev: [string, string, boolean]): void
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
import GraphLayoutWorker from "@/workers/layout?worker"
import { FiniteObject, GrammarObject, LangObject, Scope } from "../lib/evaluator"
import { StateMachine, TuringMachine, type State } from "../lib/automaton"
import { convert_turing_xml } from "../lib/export"
import {
    make_graph,
    random_position,
    type GraphData,
    type Vector2,
    type GraphStyle,
    tuple_key,
    get_node_neighbours,
    vec,
} from "../lib/graph"
import type { Grammar } from "@/lib/grammar"
import type { LayoutMessage } from "@/workers/layout"

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
        layout_worker: new GraphLayoutWorker(),

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

        this.layout_worker.onmessage = this.layout_response.bind(this)
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
                this.layout_worker.postMessage({ type: "stop" })
                return
            }

            const name = this.selectedName

            const saved = this.get_graph(name)
            const edges: [State, State][] = [...value.transitions()].map(([origin, _, dest]) => [origin, dest])
            this.graph = make_graph(
                value,
                saved,
                node => this.generate_node_pos(node, saved.nodes, edges),
            )

            const g = JSON.parse(JSON.stringify(this.graph))
            this.layout_worker.postMessage({
                type: "request_graph", graph: g
            } as LayoutMessage)

            this.save_graph(name, this.graph)
        },
        generate_node_pos(node: State, nodes: {[name: State]: Vector2}, edges: [State, State][]): Vector2 {
            const {width, height} = this.visualizer?.canvas.rect ?? { width: 500, height: 500 }
            let rect: Vector2 = [width, height]

            let center: Vector2 = vec.quot(rect, 2)
            const neighbours = get_node_neighbours(node, edges)

            if (neighbours.size) {
                const positions = Object.entries(nodes)
                    .filter(([v, _]) => neighbours.has(v))
                    .map(([_, pos]) => pos)
                center = vec.center(...positions)

                const [min, max] = vec.bbox(...positions)
                rect = [0, 0]
            }

            return random_position(vec.diff(center, vec.quot(rect, 2)), rect)
        },

        moved_node(node: State) {
            let updated_pos: {[name: State]: Vector2} = {}
            updated_pos[node] = [...this.graph.nodes[node]] as Vector2
            // console.log("updated node", updated_pos)
            this.layout_worker.postMessage({ type: "update_graph", updated_pos})
        },
        lock_node(node: State, persist: boolean) {
            let updated_locked_nodes: {[name: State]: boolean} = {}
            updated_locked_nodes[node] = true
            this.layout_worker.postMessage({ type: "update_graph", updated_locked_nodes})

            if (persist) {
                this.graph.locked_nodes[node] = true
                this.save_graph(this.selectedName, this.graph)
            }
        },
        unlock_node(node: State, persist: boolean) {
            let updated_locked_nodes: {[name: State]: boolean} = {}
            updated_locked_nodes[node] = false
            this.layout_worker.postMessage({ type: "update_graph", updated_locked_nodes})

            if (persist) {
                delete this.graph.locked_nodes[node]
                this.save_graph(this.selectedName, this.graph)
            }
        },
        
        layout_response(event: MessageEvent<any>) {
            const data = event.data as LayoutMessage
            if (data.type === "response") {
                //console.log(`received layout response.`)

                //console.log(Object.entries(data.pos).map(([v, pos]) => `${v}: ${pos}`).join(", "))
                for (let [node, pos] of Object.entries(data.pos)) {
                    if (!this.graph.nodes[node]) continue
                    this.graph.nodes[node] = pos
                }
                this.save_graph(this.selectedName, this.graph)
            }
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
        apply_modifier(obj: LangObject, modifier: string): LangObject {
            if (modifier === "#det" && obj instanceof FiniteObject) {
                return obj.$determinize()
            }

            if (modifier === "#min" && obj instanceof FiniteObject) {
                return obj.$minimize()
            }

            return obj
        },
        get_selected_object(): LangObject | null {
            if (!this.selected.length) return new LangObject(null, this.objects)

            let scope = this.objects
            let obj: LangObject | null = null

            for (const name of this.selected) {
                if (name.startsWith("#") && obj instanceof LangObject) {
                    obj = this.apply_modifier(obj, name)
                    continue
                }

                if (!scope) return null

                const binding = scope.path([name])
                if (!binding) return null

                obj = binding.unwrap()
                if (!(obj instanceof LangObject)) return null

                scope = obj.scope
            }

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
