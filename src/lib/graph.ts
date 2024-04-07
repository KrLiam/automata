import {
    TuringMachine,
    type State,
    FiniteAutomaton,
    StateMachine,
    type TuringTransition,
    type FiniteTransition,
    type Transition,
    type PushdownTransition,
    PushdownAutomaton,
} from "../lib/automaton"

export function lerp(a: number, b: number, value: number): number {
    return a * (1 - value) + b * value
}

export type Vector2 = [number, number]

export const vec = {
    sqdistance([x1, y1]: Vector2, [x2, y2]: Vector2): number {
        return (x1 - x2) ** 2 + (y1 - y2) ** 2
    },
    distance([x1, y1]: Vector2, [x2, y2]: Vector2): number {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
    },
    magnitude([x, y]: Vector2): number {
        return Math.sqrt(x ** 2 + y ** 2)
    },
    angle([x, y]: Vector2): number {
        if (x >= 0 && y >= 0) return Math.atan(y / x)
        else if (x < 0 && y >= 0) return Math.atan(y / x) + Math.PI
        else if (x < 0 && y < 0) return Math.atan(y / x) + Math.PI
        else return Math.atan(y / x) + 2 * Math.PI
    },
    angle_between(u: Vector2, v: Vector2): number {
        return Math.acos(vec.dot(u, v) / (vec.magnitude(u) * vec.magnitude(v)))
    },
    lerp(a: Vector2, b: Vector2, value: number): Vector2 {
        return [lerp(a[0], b[0], value), lerp(a[1], b[1], value)]
    },
    straddle([x, y]: Vector2): Vector2 {
        return [Math.floor(x) + 0.5, Math.floor(y) + 0.5]
    },
    normalized([x, y]: Vector2): Vector2 {
        const mag = vec.magnitude([x, y])
        return [x / mag, y / mag]
    },
    sized([x, y]: Vector2, magnitude: number): Vector2 {
        const m = magnitude / Math.sqrt(x ** 2 + y ** 2)
        return [x * m, y * m]
    },
    negated([x, y]: Vector2): Vector2 {
        return [-x, -y]
    },
    negated_x([x, y]: Vector2): Vector2 {
        return [-x, y]
    },
    negated_y([x, y]: Vector2): Vector2 {
        return [x, -y]
    },
    sum(v: Vector2, u: Vector2 | number): Vector2 {
        if (typeof u === "number") {
            return [v[0] + u, v[1] + u]
        }
        return [v[0] + u[0], v[1] + u[1]]
    },
    diff(v: Vector2, u: Vector2 | number): Vector2 {
        if (typeof u === "number") {
            return [v[0] - u, v[1] - u]
        }
        return [v[0] - u[0], v[1] - u[1]]
    },
    prod(vector: Vector2, scalar: number): Vector2 {
        return [vector[0] * scalar, vector[1] * scalar]
    },
    dot([x1, y1]: Vector2, [x2, y2]: Vector2): number {
        return x1 * x2 + y1 * y2
    },
    quot(vector: Vector2, scalar: number): Vector2 {
        return [vector[0] / scalar, vector[1] / scalar]
    },
    rotated_right([x, y]: Vector2): Vector2 {
        return [y, -x]
    },
    rotated_left([x, y]: Vector2): Vector2 {
        return [-y, x]
    },
    rotated([x, y]: Vector2, a: number): Vector2 {
        return [
            Math.cos(a) * x + Math.sin(a) * y,
            -Math.sin(a) * x + Math.cos(a) * y,
        ]
    },
    faced_up([x, y]: Vector2): Vector2 {
        if (y == 0) {
            return x < 0 ? [-x, -y] : [x, y]
        }
        return y > 0 ? [-x, -y] : [x, y]
    },
    faced_down([x, y]: Vector2): Vector2 {
        if (y == 0) {
            return x > 0 ? [-x, -y] : [x, y]
        }
        return y < 0 ? [-x, -y] : [x, y]
    },
    proj(a: Vector2, b: Vector2) {
        return vec.prod(b, vec.dot(a, b) / vec.dot(b, b))
    },
    center(...pos: Vector2[]) {
        const x = pos.map(([x, _]) => x)
        const y = pos.map(([_, y]) => y)
        return vec.lerp(
            [Math.max(...x), Math.max(...y)],
            [Math.min(...x), Math.min(...y)],
            0.5,
        )
    },
}

export function circle_intersection(
    [x1, y1]: Vector2,
    r1: number,
    [x2, y2]: Vector2,
    r2: number,
): [Vector2, Vector2] | null {
    const centerdx = x1 - x2
    const centerdy = y1 - y2
    const R = Math.sqrt(centerdx * centerdx + centerdy * centerdy)

    // no intersection
    if (!(Math.abs(r1 - r2) <= R && R <= r1 + r2)) return null

    // intersection(s) should exist
    const R2 = R * R
    const R4 = R2 * R2
    const a = (r1 * r1 - r2 * r2) / (2 * R2)
    const r2r2 = r1 * r1 - r2 * r2
    const c = Math.sqrt((2 * (r1 * r1 + r2 * r2)) / R2 - (r2r2 * r2r2) / R4 - 1)

    const fx = (x1 + x2) / 2 + a * (x2 - x1)
    const gx = (c * (y2 - y1)) / 2
    const ix1 = fx + gx
    const ix2 = fx - gx

    const fy = (y1 + y2) / 2 + a * (y2 - y1)
    const gy = (c * (x1 - x2)) / 2
    const iy1 = fy + gy
    const iy2 = fy - gy

    // note if gy == 0 and gx == 0 then the circles are tangent and there is only one solution
    // but that one solution will just be duplicated as the code is currently written
    return [
        [ix1, iy1],
        [ix2, iy2],
    ]
}

export function line_intersection(
    m1: number,
    [x1, y1]: Vector2,
    m2: number,
    [x2, y2]: Vector2,
): Vector2 {
    // m1 * (x - x1) + y1 = m2 * (x - x2) + y2
    const x = (-m2 * x2 + y2 + m1 * x1 - y1) / (m1 - m2)
    const y = m1 * (x - x1) + y1

    return [x, y]
}

export function tuple_key(...el: any) {
    return JSON.stringify(el)
}
export function from_tuple_key(key: string) {
    return JSON.parse(key)
}

export function normalize_angle_range([a, b]: [number, number]): [number, number] {
    if (a < 0) {
        const v = Math.ceil((-a / 2) * Math.PI)
        return [a + 2 * Math.PI * v, b + 2 * Math.PI * v]
    }
    return [a, b]
}

export interface CanvasConfig {
    fontFamily: string
    fontSize: number
}


export enum TextAlign {
    left = 0.0,
    center = 0.5,
    right = 1.0
}

export class Canvas {
    cfg: CanvasConfig
    el: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    scale_value: number
    offset_value: Vector2

    constructor(el: HTMLCanvasElement, cfg: CanvasConfig) {
        this.cfg = { ...cfg }
        this.el = el
        this.scale_value = 1
        this.offset_value = [0, 0]

        const ctx = el.getContext("2d")
        if (!ctx) throw new Error("Canvas is missing context.")
        this.ctx = ctx
    }

    get rect() {
        return this.el.getBoundingClientRect()
    }

    client_to_render_pos(clientPos: Vector2): Vector2 {
        const rect = this.rect
        return [
            ((clientPos[0] - rect.x) * this.el.width) / rect.width,
            ((clientPos[1] - rect.y) * this.el.height) / rect.height,
        ]
    }
    client_to_pos(clientPos: Vector2) {
        return this.from_render_pos(this.client_to_render_pos(clientPos))
    }

    render_pos([x, y]: Vector2): Vector2 {
        const [ox, oy] = this.offset_value
        return [x - ox, y - oy]
    }
    from_render_pos(render_pos: Vector2): Vector2 {
        const [ox, oy] = this.offset_value
        return [
            render_pos[0] / this.scale_value + ox,
            render_pos[1] / this.scale_value + oy,
        ]
    }

    resize(width: number, height: number) {
        this.el.width = Math.round(width)
        this.el.height = Math.round(height)
    }
    scale(value: number) {
        this.ctx.scale(value, value)
        this.scale_value = value
    }
    offset(vec: Vector2 | null = null) {
        const [x, y] = vec ?? this.offset_value

        this.ctx.translate(-x, -y)
        this.offset_value = [x, y]
    }

    clear() {
        this.ctx.clearRect(0, 0, this.el.width, this.el.height)
    }

    circle({
        pos,
        radius,
        width = 1,
        color = "",
        alpha = 1.0,
        range = [0, 2 * Math.PI],
    }: {
        pos: Vector2
        radius: number
        width?: number
        color?: string
        alpha?: number
        range?: [number, number]
    }) {
        this.ctx.imageSmoothingEnabled = true
        this.ctx.globalAlpha = alpha
        this.ctx.strokeStyle = color
        this.ctx.lineWidth = width
        const path = new Path2D()
        path.arc(
            ...vec.straddle(pos),
            radius,
            -range[0],
            -range[1],
            true,
        )
        this.ctx.stroke(path)
    }

    disk({
        pos,
        radius,
        color = "",
        border_width = 0,
        border_color = "",
        alpha = 1.0,
    }: {
        pos: Vector2
        radius: number
        color?: string
        border_width?: number
        border_color?: string
        alpha?: number
    }) {
        if (!border_color) border_color = color

        this.ctx.lineWidth = border_width
        this.ctx.strokeStyle = border_color
        this.ctx.globalAlpha = alpha
        this.ctx.fillStyle = color
        const path = new Path2D()
        path.arc(...vec.straddle(pos), radius, 0, 2 * Math.PI)
        this.ctx.fill(path)
        this.ctx.stroke()
    }

    triangle({
        pos1,
        pos2,
        pos3,
        color = null,
    }: {
        pos1: Vector2
        pos2: Vector2
        pos3: Vector2
        color: string | null
    }) {
        this.ctx.lineWidth = 0
        this.ctx.strokeStyle = color ?? "#ffffff"
        this.ctx.fillStyle = color ?? "#ffffff"
        this.ctx.globalAlpha = 1.0
        const path = new Path2D()
        path.moveTo(...vec.straddle(pos1))
        path.lineTo(...vec.straddle(pos2))
        path.lineTo(...vec.straddle(pos3))
        this.ctx.fill(path)
        this.ctx.stroke()
    }

    line({
        pos1,
        pos2,
        width = 1,
        color = null,
    }: {
        pos1: Vector2
        pos2: Vector2
        width: number
        color: string | null
    }) {
        this.ctx.lineWidth = width
        this.ctx.strokeStyle = color ?? "#ffffff"
        this.ctx.globalAlpha = 1.0
        const path = new Path2D()
        path.moveTo(...vec.straddle(pos1))
        path.lineTo(...vec.straddle(pos2))
        this.ctx.stroke(path)
    }

    arcTo({
        pos1,
        pos2,
        radius,
        width = 1,
        color = null,
    }: {
        pos1: Vector2
        pos2: Vector2
        radius: number
        width: number
        color: string | null
    }) {
        this.ctx.lineWidth = width
        this.ctx.strokeStyle = color ?? "#ffffff"
        this.ctx.globalAlpha = 1.0
        this.ctx.beginPath()
        this.ctx.arcTo(...pos1, ...pos2, radius)
        this.ctx.stroke()
    }

    measureText({
        text,
        size,
        family = "",
    }: {
        text: string
        size: number
        family?: string
    }) {
        if (!size) size = this.cfg.fontSize
        if (!family) family = this.cfg.fontFamily
        this.ctx.font = `${size}px ${family}`

        const metrics = this.ctx.measureText(text)
        return {
            width: metrics.width,
            height:
                metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
            ascent: metrics.actualBoundingBoxAscent,
            descent: metrics.actualBoundingBoxDescent,
        }
    }

    text({
        pos,
        text,
        size,
        color,
        align = TextAlign.left,
        family = "",
        alpha = 1.0,
        background = { alpha: 1.0 },
    }: {
        pos: Vector2
        text: string
        size: number
        color: string
        align?: TextAlign
        family?: string
        alpha?: number
        background?: { color?: string; alpha?: number; padding?: Vector2 }
    }) {
        if (!size) size = this.cfg.fontSize
        if (!family) family = this.cfg.fontFamily
        this.ctx.font = `${size}px ${family}`

        const m = this.measureText({ text, size })

        const y_offset = (m.ascent - m.descent) / 2
        pos = vec.sum(pos, [-m.width * align, y_offset])

        if (background.color) {
            const padding = background.padding ?? [0, 0]
            const bg_pos: Vector2 = [
                pos[0] - padding[0],
                pos[1] - m.ascent - padding[1],
            ]
            this.square({
                pos: bg_pos,
                size: [m.width + padding[0] * 2, m.height + padding[1] * 2],
                color: background.color,
                alpha: background.alpha,
            })
        }

        this.ctx.fillStyle = "#ffffff"
        if (color) this.ctx.fillStyle = color
        this.ctx.globalAlpha = alpha

        this.ctx.fillText(text, ...vec.straddle(pos))

        return m
    }

    square({
        pos,
        size,
        color = "",
        alpha = 1.0,
    }: {
        pos: Vector2
        size: Vector2
        color?: string
        alpha?: number
    }) {
        if (alpha) this.ctx.globalAlpha = alpha
        if (color) this.ctx.fillStyle = color
        this.ctx.beginPath()
        this.ctx.fillRect(pos[0], pos[1], size[0], size[1])
    }
}

export interface GraphArc {
    origin: State
    destination: State
    arc_pos: number
    labels: string[]
    label_pos: number
    label_ontop: boolean
}

export interface GraphData {
    nodes: { [name: State]: Vector2 }
    arcs: { [tuple: string]: GraphArc }
    initial: State
    finals: State[]
}

export interface NodeStyle {
    color: string
}
export interface ArcStyle {
    color: string
}
export interface GraphStyle {
    nodes: { [name: State]: NodeStyle }
    arcs: { [tuple: string]: ArcStyle }
}

export interface GraphUnits {
    node_radius: number
    node_ring_radius: number
    node_ring_width: number
    node_initial_arrow_width: number
    node_initial_arrow_height: number
    arc_width: number
    arc_arrow_width: number
    arc_arrow_height: number
    arc_loop_radius: number
    arc_slider_radius: number
    arc_slider_hitbox_radius: number
    arc_label_size: number
    arc_label_spacing: number
    arc_label_gap: number
}

export const formatted_chars: { [ch: string]: string } = {
    "": "ε",
    " ": "□",
}

export function stringify_char_list(value: string[]) {
    const chars = value.map((ch) => (formatted_chars[ch] ? formatted_chars[ch] : ch))
    return chars.join(",")
}

export function make_finite_label(transitions: FiniteTransition[]): string[] {
    const chars = transitions.map(([_, read]) => read)
    const label = stringify_char_list(chars)

    return [label]
}

export function make_turing_label(transitions: TuringTransition[]): string[] {
    const labels: string[] = []

    for (const transition of transitions) {
        const [_, read, __, write, shift] = transition

        const read_label = stringify_char_list(read)
        const write_label = stringify_char_list(write)
        const shift_label = shift.join(",")

        labels.push(`${read_label}; ${write_label}; ${shift_label}`)
    }

    return labels
}

export function make_pushdown_label(transitions: PushdownTransition[]): string[] {
    const labels: string[] = []

    for (const transition of transitions) {
        const [_, [read, ...pop], __, push] = transition

        const pop_label = stringify_char_list(pop)
        const push_label = stringify_char_list(push)

        labels.push(`${read}; ${pop_label}; ${push_label}`)
    }

    return labels
}

export function make_graph(
    obj: StateMachine<any, any> | null = null,
    base_graph: GraphData | null = null,
    positioning: ((node: string) => Vector2) | null = null,
): GraphData {
    if (!positioning) positioning = () => [0, 0]

    const graph: GraphData = { nodes: {}, arcs: {}, initial: "", finals: [] }

    if (!obj) return graph

    const format_label =
        obj instanceof TuringMachine ? make_turing_label :
        obj instanceof PushdownAutomaton ? make_pushdown_label :
        make_finite_label

    const default_arc = {
        arc_pos: 0,
        label_pos: 0.5,
        label_ontop: true,
    }

    graph.initial = obj.initial_state
    graph.finals = [...obj.final_states]

    const transitions: { [key: string]: any[] } = {}

    for (const trans of obj.transitions()) {
        const [origin, _, destination] = trans
        const key = tuple_key(origin, destination)

        if (!transitions[key]) transitions[key] = []
        transitions[key].push(trans)
    }

    for (const [key, trans_arr] of Object.entries(transitions)) {
        const [origin, destination] = from_tuple_key(key)

        const labels = format_label(trans_arr)

        const base_arc = base_graph?.arcs[key]
        let arc_pos = obj.has_transition(destination, origin) ? 15 : 0
        if (base_arc?.arc_pos) arc_pos = base_arc.arc_pos

        const new_arc: GraphArc = {
            ...default_arc,
            ...base_arc,
            origin,
            destination,
            labels,
            arc_pos,
        }
        graph.arcs[key] = new_arc
    }

    for (const node of obj.states) {
        let pos = base_graph?.nodes[node]
        if (!pos) pos = positioning(node)
        graph.nodes[node] = pos
    }

    return graph
}

export function get_loop_direction(arc_pos: number): Vector2 {
    return [Math.cos(arc_pos), -Math.sin(arc_pos)]
}

export function random_position(origin: Vector2, size: Vector2): Vector2 {
    const [min_x, min_y] = origin
    const [size_x, size_y] = size

    const x = min_x + Math.random() * size_x
    const y = min_y + Math.random() * size_y

    return [Math.floor(x), Math.floor(y)]
}

export type CurvedArc = {
    center: Vector2
    radius: number
    angle_range: Vector2
    arrow1: Vector2
    arrow2: Vector2
    arrow3: Vector2
}
export function get_curved_arc(
    pos1: Vector2,
    pos2: Vector2,
    radius1: number,
    radius2: number,
    peak_value: number,
    units: GraphUnits,
): CurvedArc | null {
    const direction = vec.diff(pos2, pos1)
    const mean1 = vec.quot(vec.sum(pos1, pos2), 2)

    const perpendicular = vec.rotated_right(direction)
    const pos3 = vec.sum(mean1, vec.prod(vec.normalized(perpendicular), peak_value))

    const mean2 = vec.quot(vec.sum(pos1, pos3), 2)

    const [dx1, dy1] = direction
    const m1 = -dx1 / dy1 // bisector slope -1/(dy1/dx1)
    // y = m1 * (x - mean1[0]) + mean1[1]

    const [dx2, dy2] = vec.diff(pos3, pos1)
    const m2 = -dx2 / dy2 // bisector slope -1/(dy2/dx2)
    // y = m2 * (x - mean2[0]) + mean2[1]

    const center = line_intersection(m1, mean1, m2, mean2)
    const radius = vec.magnitude(vec.diff(pos1, center))

    const intersec = circle_intersection(pos2, radius2, center, radius)
    if (intersec === null) return null;
    const [int1, int2] = intersec;

    const arrow1 =
        vec.sqdistance(int1, pos3) > vec.sqdistance(int2, pos3) ? int2 : int1
    let arrow_direction = vec.rotated_right(vec.diff(arrow1, center))
    if (peak_value < 0) arrow_direction = vec.negated(arrow_direction)
    const arrow_width = vec.prod(
        vec.normalized(vec.rotated_right(arrow_direction)),
        units.arc_arrow_width,
    )
    const arrow_height = vec.prod(
        vec.normalized(arrow_direction),
        units.arc_arrow_height,
    )
    const arrow_end = vec.sum(arrow1, arrow_height)
    const arrow2 = vec.sum(arrow_end, arrow_width)
    const arrow3 = vec.sum(arrow_end, vec.negated(arrow_width))

    const origin_delta = vec.diff(pos1, center)
    const origin_offset = vec.sized(
        peak_value > 0
            ? vec.rotated_right(origin_delta)
            : vec.rotated_left(origin_delta),
        -radius1,
    )
    const delta1 = vec.sum(origin_delta, origin_offset)

    const delta2 = vec.diff(arrow_end, center)
    let angle_range = normalize_angle_range([
        vec.angle(vec.negated_y(delta2)),
        vec.angle(vec.negated_y(delta1)),
    ])
    if (peak_value < 0) angle_range = [angle_range[1], angle_range[0]]

    return { center, radius, angle_range, arrow1, arrow2, arrow3 }
}
