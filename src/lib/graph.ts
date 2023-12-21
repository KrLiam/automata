import { TuringMachine, type State, FiniteAutomaton } from "../lib/automaton"

export type Vector2 = [number, number]

export function straddle_vector([x, y]: Vector2): Vector2 {
    return [Math.floor(x) + 0.5, Math.floor(y) + 0.5]
}
export function square_distance(v: Vector2, u: Vector2) {
    return (v[0] - u[0]) ** 2 + (v[1] - u[1]) ** 2
}

export interface CanvasConfig {
    fontFamily: string
    fontSize: number
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
        return [x + ox, y + oy]
    }
    from_render_pos(render_pos: Vector2): Vector2 {
        const [ox, oy] = this.offset_value
        return [
            render_pos[0] / this.scale_value - ox,
            render_pos[1] / this.scale_value - oy,
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

        this.ctx.translate(x, y)
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
    }: {
        pos: Vector2
        radius: number
        width: number
        color: string
        alpha: number
    }) {
        this.ctx.imageSmoothingEnabled = true
        this.ctx.globalAlpha = alpha
        this.ctx.strokeStyle = color
        this.ctx.lineWidth = width
        this.ctx.beginPath()
        this.ctx.arc(pos[0], pos[1], radius, 0, 2.1 * Math.PI)
        this.ctx.stroke()
    }

    disk({
        pos,
        radius,
        color = "",
        border_width = 5,
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
        this.ctx.fillStyle = color
        this.ctx.globalAlpha = alpha
        this.ctx.beginPath()
        this.ctx.arc(...straddle_vector(pos), radius, 0, 2 * Math.PI)
        this.ctx.fill()
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
        this.ctx.moveTo(...straddle_vector(pos1))
        this.ctx.lineTo(...straddle_vector(pos2))
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
        align = false,
        family = "",
        alpha = 1.0,
        background = { alpha: 1.0 },
    }: {
        pos: Vector2
        text: string
        size: number
        color: string
        align?: boolean
        family?: string
        alpha?: number
        background?: { color?: string; alpha?: number; padding?: Vector2 }
    }) {
        if (!size) size = this.cfg.fontSize
        if (!family) family = this.cfg.fontFamily
        this.ctx.font = `${size}px ${family}`

        const {
            width,
            actualBoundingBoxAscent: ascent,
            actualBoundingBoxDescent: descent,
        } = this.ctx.measureText(text)
        const height = ascent + descent

        if (align) {
            pos = [pos[0] - width / 2, pos[1] - (descent - ascent) / 2]
        }
        if (background.color) {
            const padding = background.padding ?? [0, 0]
            const bg_pos: Vector2 = [
                pos[0] - padding[0],
                pos[1] - ascent - padding[1],
            ]
            this.square({
                pos: bg_pos,
                size: [width + padding[0] * 2, height + padding[1] * 2],
                color: background.color,
                alpha: background.alpha,
            })
        }

        this.ctx.fillStyle = "#ffffff"
        if (color) this.ctx.fillStyle = color
        this.ctx.globalAlpha = alpha

        this.ctx.fillText(text, ...straddle_vector(pos))
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

export interface Transition {
    origin: State
    destination: State
    labels: string[]
}

export interface GraphData {
    nodes: { [name: State]: Vector2 }
    transitions: Transition[]
    initial: State
    finals: State[]
}

export function stringify_char_list(value: string[]) {
    return value.map((ch) => (["", " "].includes(ch) ? `"${ch}"` : ch)).join(",")
}

export function make_graph(
    obj: any = {},
    positioning: ((node: string) => Vector2) | null = null,
): GraphData {
    if (!positioning) positioning = () => [0, 0]

    const graph: GraphData = { nodes: {}, transitions: [], initial: "", finals: [] }

    if (obj instanceof TuringMachine) {
        graph.initial = obj.initial_state
        graph.finals = [...obj.final_states]

        for (const trans of obj.transition_map.transitions()) {
            const [origin, read, destination, write, shift] = trans

            const read_label = stringify_char_list(read)
            const write_label = stringify_char_list(write)
            const shift_label = shift.join(",")
            const labels: string[] = [
                `${read_label} ; ${write_label} ; ${shift_label}`,
            ]
            graph.transitions.push({ origin, destination, labels })
        }

        for (const state of obj.states) {
            graph.nodes[state] = positioning(state)
        }
    } else if (obj instanceof FiniteAutomaton) {
        graph.initial = obj.initial_state
        graph.finals = [...obj.final_states]

        for (const trans of obj.traverse_transitions()) {
            const [origin, read, destination] = trans

            const labels: string[] = [`${read}`]
            graph.transitions.push({ origin, destination, labels })
        }

        for (const state of obj.states) {
            graph.nodes[state] = positioning(state)
        }
    }

    return graph
}

export function random_position(origin: Vector2, size: Vector2): Vector2 {
    const [min_x, min_y] = origin
    const [size_x, size_y] = size

    const x = min_x + Math.random() * size_x
    const y = min_y + Math.random() * size_y

    return [Math.floor(x), Math.floor(y)]
}
