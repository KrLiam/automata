<template>
    <div class="visualizer">
        <canvas
            class="visualizer-canvas"
            ref="canvas"
            :style="canvasStyle"
            @mousedown="mouseDown"
            @mousemove="mouseMove"
            @mouseup="clickUp"
            @mouseleave="clickUp"
            @touchstart="touchStart"
            @touchmove="touchMove"
            @touchend="touchEnd"
            @touchcancel="touchEnd"
        ></canvas>
        <input
            type="checkbox"
            class="autofocus-checkbox"
            title="Auto-focus"
            v-model="autofocus"
        >
        <button
            class="lock-button"
            v-if="showLockButton"
            @click="toggleLock"
        >
            {{ lockButtonText }}
        </button>
    </div>
</template>

<script lang="ts" setup>
withDefaults(
    defineProps<{
        value: GraphData
        style: GraphStyle
    }>(),
    {}
)
defineEmits<{
    (e: "mounted", event: Visualizer): void
    (e: "updated-graph", event: void): void
    (e: "moved-node", event: State): void
    (e: "lock-node", event: [node: State, persist: boolean]): void
    (e: "unlock-node", event: [node: State, persist: boolean]): void
}>()
</script>

<script lang="ts">
import type { State } from "@/lib/automaton"
import { type GraphData, type Vector2, Canvas, vec, get_loop_direction, normalize_angle_range, type GraphArc, get_curved_arc, type GraphUnits, type GraphStyle, type NodeStyle, type ArcStyle, TextAlign } from "../lib/graph"
import { defineComponent, defineProps, withDefaults } from "vue"

export interface Visualizer {
    canvas: Canvas

    autofocus(): void
}


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

export enum LockButtonAction {
    LOCK = 0,
    UNLOCK = 1,
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

        touch_identifier: null as number | null,
        drag: {
            type: DragType.None,
            value: null as any,
            start: [0, 0] as Vector2,
            base: [0, 0] as Vector2,
            data: {} as any,
        },
        displaying_locked_nodes: false,

        hover: {
            pos: null as Vector2 | null,
            radius: 0
        },

        autofocus: true as boolean,

        units: {
            node_radius: 20,
            arc_width: 5,
            arc_arrow_width: 10,
            arc_arrow_height: 15,
            arc_loop_radius: 20,
            arc_slider_radius: 5,
            arc_label_size: 16,
            arc_label_spacing: 15,
            arc_label_gap: 5,
        } as GraphUnits,

        peak_value: 0
    }),
    computed: {
        canvasStyle() {
            let style: any = {
                cursor: this.drag.type ? "grabbing" : "grab",
            }

            if (!this.loaded) style.display = "none"

            return style
        },
        showLockButton() {
            return Object.keys(this.value.nodes).length > 0
        },
        lockButtonAction() {
            if (Object.keys(this.value.nodes).some(v => !this.value.locked_nodes[v])) {
                return LockButtonAction.LOCK
            }
            return LockButtonAction.UNLOCK
        },
        lockButtonText() {
            return this.lockButtonAction == LockButtonAction.LOCK ? "Lock All Nodes" : "Unlock All Nodes"
        },
    },
    mounted() {
        this.canvas = new Canvas(this.$refs.canvas as HTMLCanvasElement, {
            fontFamily: "Monospace",
            fontSize: 16,
        })
        window.addEventListener("load", this.load.bind(this))
        window.addEventListener("keydown", this.keyDown.bind(this))
        window.addEventListener("keyup", this.keyUp.bind(this))

        this.$emit("mounted", {
            canvas: this.canvas,
            autofocus: this.enable_autofocus.bind(this)
        } as Visualizer)
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
        focus(pos: Vector2) {
            const {width, height} = this.canvas.rect

            this.canvas.offset(vec.diff(pos, [width/2, height/2]))
        },

        focus_center() {
            const center_pos = vec.center(...Object.values(this.value.nodes))
            this.focus(center_pos)
        },
        enable_autofocus() {
            this.autofocus = true
        },

        toggleLock() {
            if (this.lockButtonAction == LockButtonAction.LOCK) {
                for (let node of Object.keys(this.value.nodes)) {
                    this.$emit("lock-node", [node, true])
                }
            }
            else {
                for (let node of Object.keys(this.value.nodes)) {
                    this.$emit("unlock-node", [node, true])
                }
            }
        },

        request_frame() {
            this.frameHandle = requestAnimationFrame(this.frame.bind(this))
        },
        frame() {
            if (this.autofocus) this.focus_center()

            this.resize()
            this.canvas.clear()
            this.canvas.offset()
            this.draw()

            this.request_frame()
        },
        get_node_radius(node: string): number {
            let radius = this.units.node_radius
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
                const length = node_radius*sin45 + this.units.arc_loop_radius*(1+sin45) - this.units.arc_width/2

                const slider_pos = vec.sum(
                    origin_pos,
                    vec.prod(direction, length)
                )
                const text_pos = vec.sum(
                    slider_pos,
                    vec.prod(direction, this.units.arc_label_spacing)
                )
                return {slider_pos, text_pos}
            }

            if (arc_pos !== 0) {
                const direction = vec.normalized(vec.diff(dest_pos, origin_pos))
                const mean1 = vec.quot(vec.sum(origin_pos, dest_pos), 2)

                const perpendicular = vec.rotated_right(direction)
                const slider_pos = vec.sum(
                    mean1, vec.prod(perpendicular, arc_pos)
                )
                const text_pos = vec.sum(
                    slider_pos,
                    vec.prod(
                        arc_pos >= 0 ? perpendicular : vec.negated(perpendicular),
                        this.units.arc_label_spacing
                    )
                )
                return {slider_pos, text_pos}
            }

            const direction = vec.normalized(vec.diff(origin_pos, dest_pos))
            const rotated = vec.rotated_right(vec.prod(direction, this.units.arc_label_spacing))
            
            const slider_pos = vec.lerp(origin_pos, dest_pos, label_pos)
            const text_pos = vec.sum(slider_pos, rotated)
            return {slider_pos, text_pos}
        },
        draw() {
            const sin45 = Math.sin(Math.PI/4)

            // arcs
            const arrow_width = this.units.arc_arrow_width
            const arrow_height = this.units.arc_arrow_height
            for (const [key, { origin, destination, arc_pos, label_pos }] of Object.entries(this.value.arcs)) {
                const origin_pos = this.value.nodes[origin]
                const dest_pos = this.value.nodes[destination]
                const origin_radius = this.get_node_radius(origin)
                const dest_radius = this.get_node_radius(destination)

                const arc_style: ArcStyle | undefined = this.style.arcs[key]
                const color = arc_style?.color ?? "#ffffff"

                if (origin === destination) {
                    const radius = this.units.arc_loop_radius
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
                        pos, vec.prod(vec.rotated(direction, Math.PI*0.75), radius - this.units.arc_width)
                    )
                    const arrow_end = vec.sum(pos1, arrow_direction)
                    const pos2 = vec.sum(arrow_end, arrow_width_direction)
                    const pos3 = vec.sum(arrow_end, vec.negated(arrow_width_direction))

                    const arc_range = normalize_angle_range([angle - 0.76*Math.PI, angle + 0.5*Math.PI])
                    this.canvas.circle({
                        pos, radius, width: this.units.arc_width, color, range: arc_range
                    })
                    this.canvas.triangle({pos1, pos2, pos3, color})
                    continue
                }

                if (arc_pos !== 0) {
                    const result = get_curved_arc(
                        origin_pos, dest_pos, origin_radius, dest_radius, arc_pos, this.units
                    )
                    // if failed to get curved arc info, this section is ignored and fallbacks
                    // to default line arcs.
                    if (result !== null) {
                        const {center, radius, angle_range, arrow1, arrow2, arrow3} = result

                        this.canvas.circle({
                            pos: center,
                            radius: radius + this.units.arc_width/2,
                            width: this.units.arc_width,
                            color,
                            range: angle_range
                        })
                        this.canvas.triangle({pos1: arrow1, pos2: arrow2, pos3: arrow3, color})

                        continue
                    }
                }

                const direction = vec.normalized(vec.diff(dest_pos, origin_pos))
                const height = vec.prod(direction, -arrow_height)
                const width = vec.rotated_right(vec.prod(direction, -arrow_width))

                const pos1 = vec.sum(dest_pos, vec.prod(direction, -dest_radius))
                const line_start = vec.sum(origin_pos, vec.prod(direction, origin_radius))
                const line_end = vec.sum(pos1, height)

                const pos2 = vec.sum(line_end, width)
                const pos3 = vec.sum(line_end, vec.negated(width))

                this.canvas.triangle({pos1, pos2, pos3, color})
                this.canvas.line({
                    pos1: line_start,
                    pos2: line_end,
                    width: this.units.arc_width,
                    color,
                })
            }

            // initial node
            if (this.value.initial) {
                const initial_pos = this.value.nodes[this.value.initial]
                const initial_triangle = vec.sum(initial_pos, [-this.units.node_radius, 0])
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
                const node_style: NodeStyle | undefined = this.style.nodes[name]
                let color = node_style?.color ?? "#ffffff"
                if (this.displaying_locked_nodes && this.value.locked_nodes[name]) {
                    color = "#90c0ff"
                }   

                const radius = this.units.node_radius
                
                if (this.value.finals.includes(name)) this.canvas.circle({
                    pos: [x, y], radius: radius + 6.25, width: 2.5, color
                })
                this.canvas.disk({ pos: [x, y], radius, color})
   
                const metrics = this.canvas.measureText({ text: name, size: 20 })
                if (metrics.width >= radius * 2) {
                    const pos: Vector2 = [x, y - radius - metrics.height / 2 - 5]
                    this.canvas.text({
                        pos,
                        text: name,
                        size: 15,
                        align: TextAlign.center,
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
                        align: TextAlign.center,
                        color: "#000000",
                    })
                }
            }

            this.arcSliders = []

            // labels
            for (const [key, arc] of Object.entries(this.value.arcs)) {
                const {slider_pos, text_pos} = this.get_label_pos(arc)
                
                const direction = vec.normalized(vec.negated_y(vec.diff(text_pos, slider_pos)))

                const align = (
                    Math.abs(direction[1]) >= Math.sin(5*Math.PI/12) ? TextAlign.center :
                    direction[0] < 0 ? TextAlign.right :
                    TextAlign.left
                )

                const arc_style: ArcStyle | undefined = this.style.arcs[key]
                const color = arc_style?.color ?? "#ffffff"
                
                this.canvas.disk({pos: slider_pos, color, radius: this.units.arc_slider_radius})

                const label_down = direction[1] < 0

                let offset = 0
                for (const label of arc.labels) {
                    const {height} = this.canvas.text({
                        pos: vec.sum(text_pos, [0, label_down ? offset : -offset]),
                        text: label,
                        color: "#ffffff",
                        size: this.units.arc_label_size,
                        align,
                        background: {alpha: 0.3, color: "#000000"}
                    })
                    offset += height + this.units.arc_label_gap
                }

                this.arcSliders.push({arc: key, pos: slider_pos})
            }
        },

        touchStart(event: TouchEvent) {
            if (event.touches.length > 1) return

            const [touch] = Object.values(event.touches)
            
            this.clickDown([touch.clientX, touch.clientY])

            this.touch_identifier = touch.identifier
        },
        mouseDown(event: MouseEvent) {
            if (event.button === 0 && event.ctrlKey) {
                this.toggleLockClick([event.clientX, event.clientY])
            }
            else if (event.button === 0 && !event.ctrlKey) {
                this.clickDown([event.clientX, event.clientY])
            }
        },
        clickDown(client_pos: Vector2) {
            let pos = this.canvas.client_to_render_pos(client_pos)
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
                this.$emit("lock-node", [node, false])

                return
            }
            if (result.type === CollisionType.ArcSlider) {
                const slider = result.value
                const {origin, destination} = this.value.arcs[slider.arc]

                this.drag.type = origin === destination ? DragType.LoopArc : DragType.LineArc
                this.drag.base = slider.pos
                this.drag.start = pos
                this.drag.value = slider
            }
        },
        toggleLockClick(client_pos: Vector2) {
            let pos = this.canvas.client_to_render_pos(client_pos)
            const result = this.check_mouse_collision(this.canvas.from_render_pos(pos))

            if (result?.type === CollisionType.Node) {
                const node = result.value

                if (this.value.locked_nodes[node]) {
                    this.$emit("unlock-node", [node, true])
                }
                else {
                    this.$emit("lock-node", [node, true])
                }
            }
        },

        touchEnd(event: TouchEvent) {
            for (const touch of Object.values(event.changedTouches)) {
                if (touch.identifier !== this.touch_identifier) continue

                this.clickUp()
                this.touch_identifier = null
                return
            }
        },
        clickUp() {
            if (this.drag.type) {
                this.$emit("updated-graph")

                const node = this.drag.value
                if (this.drag.type === DragType.Node && !this.value.locked_nodes[node]) {
                    this.$emit("unlock-node", [node, false])
                }

                this.drag.type = DragType.None
                this.drag.data = {}
            }
        },

        touchMove(event: TouchEvent) {
            for (const touch of Object.values(event.touches)) {
                if (touch.identifier !== this.touch_identifier) continue

                this.clickMove([touch.clientX, touch.clientY])
                event.preventDefault()
                return
            }
        },
        mouseMove(event: MouseEvent) {
            this.clickMove([event.clientX, event.clientY])
        },
        clickMove(client_pos: Vector2) {
            const render_pos = this.canvas.client_to_render_pos(client_pos)
            const pos = this.canvas.from_render_pos(render_pos)

            if (this.drag.type) {
                this.autofocus = false

                const delta: Vector2 = vec.quot(vec.diff(render_pos, this.drag.start), this.canvas.scale_value)
                const drag_pos = vec.sum(this.drag.base, delta)
                
                if (this.drag.type === DragType.Node) {
                    this.value.nodes[this.drag.value] = drag_pos
                    this.$emit("moved-node", this.drag.value)
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
                if (this.drag.type === DragType.LineArc) {
                    const slider = this.drag.value as ArcSlider
                    const arc = this.value.arcs[slider.arc]
                    if (!this.drag.data.base_arc_pos) {
                        this.drag.data.base_arc_pos = arc.arc_pos
                    } 

                    const origin_pos = this.value.nodes[arc.origin]
                    const dest_pos = this.value.nodes[arc.destination]
                    const direction = vec.diff(dest_pos, origin_pos)
                    const slider_direction = vec.rotated_right(direction)
                    
                    const directed_delta = vec.proj(delta, slider_direction)
                    const [_, delta_arc_pos] = vec.rotated(directed_delta, vec.angle(direction))
                    
                    const arc_pos = this.drag.data.base_arc_pos - delta_arc_pos
                    arc.arc_pos = Math.abs(arc_pos) < 10 ? 0 : arc_pos

                    const {slider_pos} = this.get_label_pos(arc)
                    this.hover.pos = slider_pos
                    
                    this.drag.data.direction = [slider.pos, vec.sum(slider.pos, vec.sized(direction, 100))]
                    this.drag.data.mouse = drag_pos
                    this.drag.data.proj = vec.sum(slider.pos, directed_delta)
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
                this.hover.radius = this.units.arc_slider_radius * 2
            }
        },

        keyDown(event: KeyboardEvent) {
            if (event.key === "Control") {
                this.displaying_locked_nodes = true
            }
        },
        keyUp(event: KeyboardEvent) {
            if (event.key === "Control") {
                this.displaying_locked_nodes = false
            }
        },

        check_mouse_collision(pos: Vector2):
            {type: CollisionType.Node, value: string} |
            {type: CollisionType.ArcSlider, value: ArcSlider} |
            null
        {
            const node_threshold = this.units.node_radius ** 2 * 1.5
            for (const [value, node_pos] of Object.entries(this.value.nodes)) {
                const dist = vec.sqdistance(pos, node_pos)
                if (dist <= node_threshold) {
                    return {type: CollisionType.Node, value}
                }
            }

            const slider_threshold = this.units.arc_slider_radius ** 2 * 8
            for (const slider of this.arcSliders) {
                const dist = vec.sqdistance(pos, slider.pos)
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

.visualizer,
.visualizer-canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.visualizer {
    position: relative;
    overflow: hidden;
}

.autofocus-checkbox {
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    z-index: 1;
}

.lock-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    z-index: 1;
    color: var(--white);
}
</style>
