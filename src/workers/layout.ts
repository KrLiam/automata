import type { State } from "@/lib/automaton"
import { from_tuple_key, vec, type GraphData, type Vector2 } from "@/lib/graph"
import { recover_prototypes } from "@/lib/prototypes"

export type LayoutMessage = 
    { type: "request_graph", name: string, graph: GraphData } |
    { type: "stop" } |
    { type: "update_graph", updated_pos: {[name: State]: Vector2} } |
    { type: "response", name: string, pos: {[name: State]: Vector2}, iteration: number }


const builder = {
    graph: {nodes: {}, arcs: {}, initial: "", finals: []} as GraphData,
    center: [0.0, 0.0] as Vector2,
    updated_pos: {} as {[name: State]: Vector2},

    interval: 1000 / 100,
    interval_id: -1,
    
    iter: 0,
    max_iterations: 2000,
    ideal_edge_len: 5.0,
    cooling_factor: 0.998,
    temperature: 1.0,
    threshold: 0.0025,
    gravity_factor: 1.0,
    limit_box: [[-200.0, -200.0], [200.0, 200.0]] as [Vector2, Vector2],

    init(g: GraphData) {
        this.graph = g
        this.center = this.get_barycenter()
        this.iter = 0

        clearInterval(this.interval_id)
        const loop = (() => {
            this.update()
            this.interval_id = setTimeout(loop, this.interval)
        }).bind(this)
        setTimeout(loop, this.interval)
    },
    stop() {
        clearInterval(this.interval_id)
    },

    update() {
        if (Object.keys(this.updated_pos).length) {
            this.iter = 0
        }
        for (const [v, pos] of Object.entries(this.updated_pos)) {
            this.graph.nodes[v] = pos
        }
        this.updated_pos = {}

        if (this.iter >= this.max_iterations) return

        this.apply()

        postMessage({
            type: "response",
            pos: this.graph.nodes,
            iteration: this.iter,
        })
    },

    get_barycenter(): Vector2 {
        let sum: Vector2 = [0.0, 0.0]
        for (let pos of Object.values(this.graph.nodes)) {
            sum = vec.sum(sum ,pos)
        }
        return vec.quot(sum, Object.keys(this.graph.nodes).length)
    },

    delta(v: State, u: State): Vector2 {
        const pos_v = this.graph.nodes[v]
        const pos_u = this.graph.nodes[u]
        const delta = vec.diff(pos_v, pos_u)

        if (vec.squared_magnitude(delta) !== 0.0) {
            return delta
        }
        
        return [1, 1] // must be random
    },

    apply() {
        const k = 200
        const t = this.temperature

        let forces: { [name: State]: Vector2 } = {}

        for (let v of Object.keys(this.graph.nodes)) {        
            let total: Vector2 = [0.0, 0.0]
            for (let u of Object.keys(this.graph.nodes)) {
                if (u === v) { continue }

                const delta = this.delta(v, u)
                const delta_mag = vec.magnitude(delta)
                const f_r = k**2 / delta_mag
                total = vec.sum(total, vec.prod(vec.quot(delta, delta_mag), f_r) )
            }
            forces[v] = total
        }
        
        for (const key of Object.keys(this.graph.arcs)) {
            const [v, u] = from_tuple_key(key) as [State, State]
            
            const delta = this.delta(v, u)
            const delta_mag = vec.magnitude(delta)
            const f_a = delta_mag**2 / k
            const force = vec.prod(vec.quot(delta, delta_mag), f_a)
            forces[v] = vec.sum(forces[v], vec.negated(force))
            forces[u] = vec.sum(forces[u], force)
        }

        for (let v of Object.keys(this.graph.nodes)) {
            const pos = this.graph.nodes[v]
            const force_mag = vec.magnitude(forces[v])
            const factor = Math.min(t, force_mag) / force_mag
            this.graph.nodes[v] = vec.sum(pos, vec.prod(forces[v], factor))
        }

        const barycenter = this.get_barycenter()
        const delta = vec.diff(this.center, barycenter)
        for (let v of Object.keys(this.graph.nodes)) {
            this.graph.nodes[v] = vec.sum(this.graph.nodes[v], delta)
        }

        this.iter++
    }
}

onmessage = function (event) {
    const data = recover_prototypes(event.data) as LayoutMessage

    if (data.type === "request_graph") {
        builder.init(data.graph)
    }
    else if (data.type === "stop") {
        builder.stop()
    }
    else if (data.type === "update_graph") {
        builder.updated_pos = {...builder.updated_pos, ...data.updated_pos}
    }
}
