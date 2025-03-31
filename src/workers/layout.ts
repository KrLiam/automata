import type { State } from "@/lib/automaton"
import { vec, type GraphData, type Vector2 } from "@/lib/graph"
import { recover_prototypes } from "@/lib/prototypes"

export type LayoutMessage = 
    { type: "graph", graph: GraphData } |
    { type: "pos", pos: {[name: State]: Vector2} }


const builder = {
    graph: {nodes: {}, arcs: {}, initial: "", finals: []} as GraphData,

    iter: 0,
    max_iterations: 300,
    ideal_edge_len: 5.0,
    cooling_factor: 0.998,
    temperature: 1.0,
    threshold: 0.0025,
    gravity_center: [0.0, 0.0] as Vector2,
    gravity_factor: 1.0,
    limit_box: [[-200.0, -200.0], [200.0, 200.0]] as [Vector2, Vector2],

    delta(v: State, u: State): Vector2 {
        const pos_v = this.graph.nodes[v]
        const pos_u = this.graph.nodes[u]
        const delta = vec.diff(pos_v, pos_u)

        if (vec.squared_magnitude(delta) != 0.0) {
            return delta
        }
        
        return [1, 1] // must be random
    },

    apply() {
        const k = 5
        const t = this.temperature

        let forces: { [name: State]: Vector2 } = {}

        for (let v of Object.keys(this.graph.nodes)) {        
            let total: Vector2 = [0.0, 0.0]
            for (let u of Object.keys(this.graph.nodes)) {
                if (u == v) { continue }

                const delta = this.delta(v, u)
                const delta_mag = vec.magnitude(delta)
                const f_r = k**2 / delta_mag
                total = vec.sum(total, vec.prod(vec.quot(delta, delta_mag), f_r) )
            }
            forces[v] = total
        }
    }
}

onmessage = function (event) {
    const data = recover_prototypes(event.data) as LayoutMessage

    if (data.type === "graph") {
        
    }
}
