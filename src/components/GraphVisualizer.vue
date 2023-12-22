<template>
    <canvas
        class="visualizer"
        ref="canvas"
        :style="canvasStyle"
        @mousedown="mouseDown"
        @mouseup="mouseUp"
        @mousemove="mouseMove"
        @mouseleave="mouseUp"
    ></canvas>
</template>

<script lang="ts" setup>
defineProps<{
    value: GraphData
}>()
defineEmits<{
    (e: "mounted", event: any): void
    (e: "updated-graph", event: void): void
}>()
</script>

<script lang="ts">
import { type GraphData, type Vector2, Canvas, vec } from "../lib/graph"
import { defineComponent, defineProps } from "vue"

export enum DragType {
    None = 0,
    Node,
    Canvas,
}

export default defineComponent({
    data: () => ({
        // @ts-ignore
        canvas: null as Canvas,
        loaded: false,

        drag: {
            type: DragType.None,
            id: "" as string,
            origin: [0, 0] as Vector2,
        },

        hoverNode: null as string | null,

        node_radius: 20,
    }),
    computed: {
        canvasStyle() {
            let style: any = {
                cursor: this.drag.type ? "grabbing" : "grab",
            }

            if (!this.loaded) style.display = "none"

            return style
        },
    },
    mounted() {
        this.canvas = new Canvas(this.$refs.canvas as HTMLCanvasElement, {
            fontFamily: "Monospace",
            fontSize: 16,
        })
        window.addEventListener("load", this.load.bind(this))

        this.$emit("mounted", this)
    },
    methods: {
        load() {
            this.loaded = true
            requestAnimationFrame(this.frame.bind(this))
        },
        resize() {
            const rect = this.canvas.rect
            const dpi = window.devicePixelRatio

            this.canvas.resize(rect.width * dpi, rect.height * dpi)
            this.canvas.scale(dpi)
        },

        frame() {
            this.resize()
            this.canvas.clear()
            this.canvas.offset()
            this.draw()

            requestAnimationFrame(this.frame.bind(this))
        },
        draw() {
            // arcs
            for (const { origin, destination } of this.value.transitions) {
                const origin_pos = this.value.nodes[origin]
                const dest_pos = this.value.nodes[destination]

                const direction = vec.normalized(vec.diff(origin_pos, dest_pos))
                const height = vec.prod(direction, 15)
                const width = vec.rotated_right(vec.prod(direction, 10))

                const pos1 = vec.sum(dest_pos, vec.prod(direction, this.node_radius))
                const line_end = vec.sum(pos1, height)

                const pos2 = vec.sum(line_end, width)
                const pos3 = vec.sum(line_end, vec.negated(width))

                this.canvas.triangle({pos1, pos2, pos3, color: "#ffffff"})
                this.canvas.line({
                    pos1: origin_pos,
                    pos2: line_end,
                    width: 5,
                    color: "#ffffff",
                })
            }

            // hovered node
            if (this.hoverNode) {
                const pos = this.value.nodes[this.hoverNode]
                this.canvas.disk({
                    pos,
                    radius: this.node_radius + 5,
                    color: "#ffac11",
                    alpha: 0.5,
                })
            }

            // nodes
            for (const [name, [x, y]] of Object.entries(this.value.nodes)) {
                const radius = this.node_radius

                this.canvas.disk({ pos: [x, y], radius, color: "#ffffff" })

                const metrics = this.canvas.measureText({ text: name, size: 20 })
                if (metrics.width >= radius * 2) {
                    const pos: Vector2 = [x, y - radius - metrics.height / 2 - 5]
                    this.canvas.text({
                        pos,
                        text: name,
                        size: 15,
                        align: true,
                        color: "#ffffff",
                        background: {
                            color: "#000000",
                            alpha: 0.25,
                            padding: [5, 2.5],
                        },
                    })
                } else {
                    this.canvas.text({
                        pos: [x, y],
                        text: name,
                        size: 20,
                        align: true,
                        color: "#000000",
                    })
                }
            }

            // labels
            for (const trans of this.value.transitions) {
                const { origin, destination, labels, label_ontop, label_pos } = trans
                const origin_pos = this.value.nodes[origin]
                const dest_pos = this.value.nodes[destination]
                
                const mid_pos = vec.lerp(origin_pos, dest_pos, label_pos)
                
                const direction = vec.normalized(vec.diff(origin_pos, dest_pos))
                const rotated = vec.rotated_right(vec.prod(direction, 20))
                const pos = vec.sum(
                    mid_pos,
                    label_ontop ? vec.faced_up(rotated) : vec.faced_down(rotated)
                )
                this.canvas.disk({pos: mid_pos, color:"#ffffff", radius: 3})

                let offset = 0
                for (const label of labels) {
                    const {height} = this.canvas.text({
                        pos: vec.sum(pos, [0, label_ontop ? -offset : offset]),
                        text: label,
                        color: "#ffffff",
                        size: 20,
                        align: true,
                        background: {alpha: 0.3, color: "#000000"}
                    })
                    offset += height + 5
                }
            }
        },

        mouseDown(event: MouseEvent) {
            let pos = this.canvas.client_to_pos([event.clientX, event.clientY])
            const node = this.check_node_overlap(pos)

            const offset = this.canvas.offset_value
            pos = [pos[0] + offset[0], pos[1] + offset[1]]
            if (node) {
                this.drag.type = DragType.Node
                this.drag.id = node
                const base = this.value.nodes[node]
                this.drag.origin = [base[0] - pos[0], base[1] - pos[1]]
            } else {
                this.drag.type = DragType.Canvas
                const base = this.canvas.offset_value
                this.drag.origin = [base[0] - pos[0], base[1] - pos[1]]
            }
        },
        mouseUp(event: MouseEvent) {
            if (this.drag.type) {
                this.$emit("updated-graph")
                this.drag.type = DragType.None
            }
        },
        mouseMove(event: MouseEvent) {
            let [x, y] = this.canvas.client_to_pos([event.clientX, event.clientY])

            if (this.drag.type) {
                const offset = this.canvas.offset_value
                const [offset_x, offset_y] = [x + offset[0], y + offset[1]]

                const [ox, oy] = this.drag.origin
                const pos: Vector2 = [offset_x + ox, offset_y + oy]

                if (this.drag.type === DragType.Node) {
                    this.value.nodes[this.drag.id] = pos
                } else if (this.drag.type === DragType.Canvas) {
                    this.canvas.offset(pos)
                }
            } else {
                this.hoverNode = null
                const node = this.check_node_overlap([x, y])
                if (node) {
                    this.hoverNode = node
                }
            }
        },

        check_node_overlap(pos: Vector2): string | null {
            const threshold = this.node_radius ** 2 * 1.5
            for (const [name, node_pos] of Object.entries(this.value.nodes)) {
                const dist = vec.square_distance(pos, node_pos)
                if (dist <= threshold) {
                    return name
                }
            }
            return null
        },
    },
})
</script>

<style scoped>
.visualizer {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
