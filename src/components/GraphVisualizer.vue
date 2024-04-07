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
}>()
</script>

<script lang="ts">
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

        hover: {
            pos: null as Vector2 | null,
            radius: 0
        },

        autofocus: true as boolean,

        units: {
            node_radius: 20,
            node_ring_radius: 25,
            node_ring_width: 2.5,
            node_initial_arrow_width: 12,
            node_initial_arrow_height: 8,
            arc_width: 3,
            arc_arrow_width: 6,
            arc_arrow_height: 10,
            arc_loop_radius: 20,
            arc_slider_radius: 4,
            arc_slider_hitbox_radius: 20,
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
    },
    mounted() {
        this.canvas = new Canvas(this.$refs.canvas as HTMLCanvasElement, {
            fontFamily: "Monospace",
            fontSize: 16,
        })
        window.addEventListener("load", this.load.bind(this))

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
            if (this.value.finals.includes(node)) {
                return this.units.node_ring_radius + this.units.node_ring_width/2
            }
            return this.units.node_radius
        },
        get_label_pos(arc: GraphArc) {
            const { origin, destination, arc_pos, label_ontop, label_pos } = arc
            const sin45 = Math.sin(Math.PI/4)

            const origin_pos = this.value.nodes[origin]
            const dest_pos = this.value.nodes[destination]

            const origin_radius = this.get_node_radius(origin)

            if (origin === destination) {
                const arc_radius = this.units.arc_loop_radius
                const direction = get_loop_direction(arc_pos)

                const center_dist = Math.sqrt(origin_radius**2 + arc_radius**2)
                const arc_center = vec.sum(
                    origin_pos, vec.prod(direction, center_dist)
                )
                const slider_pos = vec.sum(arc_center, vec.prod(direction, this.units.arc_loop_radius))
                const text_pos = vec.sum(slider_pos, vec.prod(direction, this.units.arc_label_spacing))

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
                    const arc_radius = this.units.arc_loop_radius
                    const direction = get_loop_direction(arc_pos)

                    // the arc circle and the node circle intersection forms a
                    // 90 degrees angle. therefore the line segment that connects the centers
                    // of both circles is the hypothenuse of the right triangle which catheti
                    // are the radii of the two circles
                    const center_dist = Math.sqrt(origin_radius**2 + arc_radius**2)
                    const arc_center = vec.sum(
                        origin_pos, vec.prod(direction, center_dist)
                    )

                    const h = origin_radius*arc_radius / center_dist
                    const alpha = Math.asin(h / origin_radius)
                    
                    // vector that points from the arc center to the tip of the arrow triangle
                    const center_to_tip_direction = vec.rotated(direction, alpha + Math.PI/2)
                    // vector that points from the arc center to the start of the arc curve
                    const center_to_curve_start_direction = vec.rotated(direction, -alpha - Math.PI/2)

                    // -(arrow_height / 2piR) * 2pi = -arrow_height / R
                    const tip_to_end_angle_offset = -arrow_height / arc_radius
                    const center_to_arrow_end_direction = vec.rotated(center_to_tip_direction, tip_to_end_angle_offset)

                    // the direction of the arrow triangle
                    const arrow_direction = vec.normalized(
                        vec.diff(center_to_arrow_end_direction, center_to_tip_direction)
                    )

                    const pos1 = vec.sum(
                        arc_center, vec.prod(center_to_tip_direction, arc_radius)
                    )
                    const arrow_width_direction = vec.prod(
                        vec.rotated_right(arrow_direction), arrow_width
                    )
                    const arrow_end = vec.sum(pos1, vec.prod(arrow_direction, arrow_height))
                    const pos2 = vec.sum(arrow_end, arrow_width_direction)
                    const pos3 = vec.sum(arrow_end, vec.negated(arrow_width_direction))

                    const arc_range = normalize_angle_range([
                        vec.angle(vec.negated_y(center_to_curve_start_direction)) - 0.025,
                        vec.angle(vec.negated_y(center_to_arrow_end_direction)) + 0.05 // small increment for seamless connection with the arrow head
                    ])
                    this.canvas.circle({
                        pos: arc_center, radius: arc_radius, width: this.units.arc_width, color, range: arc_range
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
                const node_pos = this.value.nodes[this.value.initial]
                const node_radius = this.get_node_radius(this.value.initial)
                const width = this.units.node_initial_arrow_width
                const height = this.units.node_initial_arrow_height

                const pos1 = vec.sum(node_pos, [-node_radius, 0])
                this.canvas.triangle({
                    pos1,
                    pos2: vec.sum(pos1, [-width, height]),
                    pos3: vec.sum(pos1, [-width, -height]),
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
                const color = node_style?.color ?? "#ffffff"

                const radius = this.units.node_radius
                
                if (this.value.finals.includes(name)) this.canvas.circle({
                    pos: [x, y], radius: this.units.node_ring_radius, width: this.units.node_ring_width, color
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
            this.clickDown([event.clientX, event.clientY])
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

            const slider_threshold = this.units.arc_slider_hitbox_radius ** 2
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
</style>
