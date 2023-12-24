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
import { type GraphData, type Vector2, Canvas, vec, get_loop_direction, normalize_angle_range, type GraphArc } from "../lib/graph"
import { defineComponent, defineProps } from "vue"

export enum DragType {
    None = 0,
    Node,
    Canvas,
    LoopArc,
    LineArc,
}

export enum CollisionType {
    Node,
    ArcSlider,
}


export interface ArcSlider {
    arc: string
    pos: Vector2
}

export default defineComponent({
    data: () => ({
        // @ts-ignore
        canvas: null as Canvas,
        loaded: false,
        frameHandle: null as number | null,

        arcSliders: [] as ArcSlider[],

        drag: {
            type: DragType.None,
            value: null as any,
            start: [0, 0] as Vector2,
            base: [0, 0] as Vector2,
        },

        hover: {
            pos: null as Vector2 | null,
            radius: 0
        },

        node_radius: 20,
        arc_width: 5,
        arc_loop_radius: 20,
        arc_slider_radius: 5,
    }),
    computed: {
        canvasStyle() {
            let style: any = {
                cursor: this.drag.type ? "grabbing" : "grab",
            }

            if (!this.loaded) style.display = "none"

            return style
        },
        arc_arrow_size() {
            return [this.arc_width * 2, this.arc_width * 3]
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
    updated() {
        this.load()

    },
    methods: {
        load() {
            this.loaded = true
            if (this.frameHandle) cancelAnimationFrame(this.frameHandle)
            this.request_frame()
        },
        resize() {
            const rect = this.canvas.rect
            const dpi = window.devicePixelRatio

            this.canvas.resize(rect.width * dpi, rect.height * dpi)
            this.canvas.scale(dpi)
        },

        request_frame() {
            this.frameHandle = requestAnimationFrame(this.frame.bind(this))
        },
        frame() {
            this.resize()
            this.canvas.clear()
            this.canvas.offset()
            this.draw()

            this.request_frame()
        },
        get_node_radius(node: string): number {
            let radius = this.node_radius
            if (this.value.finals.includes(node)) radius += 6.25
            return radius
        },
        get_label_pos(arc: GraphArc) {
            const { origin, destination, arc_pos, label_ontop, label_pos } = arc
            const sin45 = Math.sin(Math.PI/4)

            const origin_pos = this.value.nodes[origin]
            const dest_pos = this.value.nodes[destination]

            if (origin === destination) {
                const direction = get_loop_direction(arc_pos)
                const node_radius = this.get_node_radius(origin)
                const length = node_radius*sin45 + this.arc_loop_radius*(1+sin45) - this.arc_width/2

                const slider_pos = vec.sum(
                    origin_pos,
                    vec.prod(direction, length)
                )
                const text_pos = vec.sum(
                    slider_pos,
                    vec.prod(direction, 15)
                )
                return {slider_pos, text_pos}
            }

            const direction = vec.normalized(vec.diff(origin_pos, dest_pos))
            const rotated = vec.rotated_right(vec.prod(direction, 20))
            
            const slider_pos = vec.lerp(origin_pos, dest_pos, label_pos)
            const text_pos = vec.sum(
                slider_pos,
                label_ontop ? vec.faced_up(rotated) : vec.faced_down(rotated)
            )
            return {slider_pos, text_pos}
        },
        draw() {
            const sin45 = Math.sin(Math.PI/4)

            // arcs
            const [arrow_width, arrow_height] = this.arc_arrow_size
            for (const { origin, destination, arc_pos, label_pos } of Object.values(this.value.arcs)) {
                const origin_pos = this.value.nodes[origin]
                const dest_pos = this.value.nodes[destination]
                const origin_radius = this.get_node_radius(origin)
                const dest_radius = this.get_node_radius(destination)

                if (origin === destination) {
                    const radius = this.arc_loop_radius
                    const direction = get_loop_direction(arc_pos)
                    const angle = vec.angle(vec.negated_y(direction))

                    const pos = vec.sum(
                        origin_pos, vec.prod(direction, origin_radius*sin45 + radius*sin45)
                    )
                    const arrow_direction = vec.prod(
                        vec.normalized(vec.rotated(direction, Math.PI*0.125)), arrow_height
                    )
                    const arrow_width_direction = vec.prod(
                        vec.normalized(vec.rotated_right(arrow_direction)), arrow_width
                    )
                    const pos1 = vec.sum(
                        pos, vec.prod(vec.rotated(direction, Math.PI*0.75), radius - this.arc_width)
                    )
                    const arrow_end = vec.sum(pos1, arrow_direction)
                    const pos2 = vec.sum(arrow_end, arrow_width_direction)
                    const pos3 = vec.sum(arrow_end, vec.negated(arrow_width_direction))

                    const arc_range = normalize_angle_range([angle - 0.76*Math.PI, angle + 0.5*Math.PI])
                    this.canvas.circle({
                        pos, radius, width: this.arc_width, color:"#ffffff", range: arc_range
                    })
                    this.canvas.triangle({pos1, pos2, pos3, color: "#ffffff"})
                    continue
                }

                const direction = vec.normalized(vec.diff(dest_pos, origin_pos))
                const height = vec.prod(direction, -arrow_height)
                const width = vec.rotated_right(vec.prod(direction, -arrow_width))

                const pos1 = vec.sum(dest_pos, vec.prod(direction, -dest_radius))
                const line_start = vec.sum(origin_pos, vec.prod(direction, origin_radius))
                const line_end = vec.sum(pos1, height)

                const pos2 = vec.sum(line_end, width)
                const pos3 = vec.sum(line_end, vec.negated(width))

                this.canvas.triangle({pos1, pos2, pos3, color: "#ffffff"})
                this.canvas.line({
                    pos1: line_start,
                    pos2: line_end,
                    width: this.arc_width,
                    color: "#ffffff",
                })
            }

            // initial node
            if (this.value.initial) {
                const initial_pos = this.value.nodes[this.value.initial]
                const initial_triangle = vec.sum(initial_pos, [-this.node_radius, 0])
                this.canvas.triangle({
                    pos1: initial_triangle,
                    pos2: vec.sum(initial_triangle, [-15, 10]),
                    pos3: vec.sum(initial_triangle, [-15, -10]),
                    color: "#ffffff"
                })
            }

            // hovered node
            if (this.hover.pos) {
                this.canvas.disk({
                    pos: this.hover.pos,
                    radius: this.hover.radius,
                    color: "#ffac11",
                    alpha: 0.5,
                })
            }

            // nodes
            for (const [name, [x, y]] of Object.entries(this.value.nodes)) {
                const radius = this.node_radius
                
                if (this.value.finals.includes(name)) this.canvas.circle({
                    pos: [x, y], radius: radius + 6.25, width: 2.5, color: "#ffffff"
                })
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

            this.arcSliders = []

            // labels
            for (const [key, arc] of Object.entries(this.value.arcs)) {
                const {slider_pos, text_pos} = this.get_label_pos(arc)
                
                this.canvas.disk({pos: slider_pos, color:"#ffffff", radius: this.arc_slider_radius})

                let offset = 0
                for (const label of arc.labels) {
                    const {height} = this.canvas.text({
                        pos: vec.sum(text_pos, [0, arc.label_ontop ? -offset : offset]),
                        text: label,
                        color: "#ffffff",
                        size: 20,
                        align: true,
                        background: {alpha: 0.3, color: "#000000"}
                    })
                    offset += height + 5
                }

                this.arcSliders.push({arc: key, pos: slider_pos})
            }
        },

        mouseDown(event: MouseEvent) {
            let pos = this.canvas.client_to_render_pos([event.clientX, event.clientY])
            const result = this.check_mouse_collision(this.canvas.from_render_pos(pos))

            if (!result) {
                this.drag.type = DragType.Canvas
                this.drag.base = this.canvas.offset_value
                this.drag.start = pos
                return
            }

            if (result.type === CollisionType.Node) {
                const node = result.value

                this.drag.type = DragType.Node
                this.drag.value = node
                this.drag.base = this.value.nodes[node]
                this.drag.start = pos
                return
            }
            if (result.type === CollisionType.ArcSlider) {
                const slider = result.value
                const {origin, destination} = this.value.arcs[slider.arc]

                this.drag.type = origin === destination ? DragType.LoopArc : DragType.LineArc
                this.drag.value = slider
            }
        },
        mouseUp(event: MouseEvent) {
            if (this.drag.type) {
                this.$emit("updated-graph")
                this.drag.type = DragType.None
            }
        },
        mouseMove(event: MouseEvent) {
            const render_pos = this.canvas.client_to_render_pos([event.clientX, event.clientY])
            const pos = this.canvas.from_render_pos(render_pos)

            if (this.drag.type) {
                const delta: Vector2 = vec.diff(render_pos, this.drag.start)
                const drag_pos = vec.sum(this.drag.base, delta)
                
                if (this.drag.type === DragType.Node) {
                    this.value.nodes[this.drag.value] = drag_pos
                    this.hover.pos = drag_pos
                    return
                }
                if (this.drag.type === DragType.Canvas) {
                    const offset = vec.sum(this.drag.base, vec.negated(delta))
                    this.canvas.offset(offset)
                    return
                }
                if (this.drag.type === DragType.LoopArc) {
                    const slider = this.drag.value as ArcSlider
                    const arc = this.value.arcs[slider.arc]

                    const node_pos = this.value.nodes[arc.origin]

                    const direction = vec.diff(pos, node_pos)
                    const angle = vec.angle(vec.negated_y(direction))
                    arc.arc_pos = angle

                    const {slider_pos} = this.get_label_pos(arc)
                    this.hover.pos = slider_pos
                    
                    return
                }

                return
            }
            
            this.hover.pos = null
            const result = this.check_mouse_collision(pos)
            if (!result) return

            if (result.type === CollisionType.Node) {
                const node = result.value

                const node_pos = this.value.nodes[node]
                this.hover.pos = node_pos
                this.hover.radius = this.get_node_radius(node) * 1.25
            }
            else if (result.type === CollisionType.ArcSlider) {
                const slider = result.value

                this.hover.pos = slider.pos
                this.hover.radius = this.arc_slider_radius * 2
            }
        },

        check_mouse_collision(pos: Vector2):
            {type: CollisionType.Node, value: string} |
            {type: CollisionType.ArcSlider, value: ArcSlider} |
            null
        {
            const node_threshold = this.node_radius ** 2 * 1.5
            for (const [value, node_pos] of Object.entries(this.value.nodes)) {
                const dist = vec.square_distance(pos, node_pos)
                if (dist <= node_threshold) {
                    return {type: CollisionType.Node, value}
                }
            }

            const slider_threshold = this.arc_slider_radius ** 2 * 8
            for (const slider of this.arcSliders) {
                const dist = vec.square_distance(pos, slider.pos)
                if (dist <= slider_threshold) {
                    return {type: CollisionType.ArcSlider, value: slider}
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
