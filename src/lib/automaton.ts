
export function has_intersection<T>(a: Set<T>, b: Set<T> ): boolean {
    for (let value of a) {
        if (b.has(value)) return true;
    }
    return false;
}


export const Epsilon = "";

export type State = string;
export type TransitionTuple = [State, string, State];
export type SymbolMap = {[symbol: string]: State | Set<State>};
export type TransitionMap = {[state: string]: {[symbol: string]: State | Set<State>}}

export class Transition {
    start: State;
    symbol: string;
    end: State;

    constructor(start: State, symbol: string, end: State) {
        this.start = start;
        this.symbol = symbol;
        this.end = end;

        Object.freeze(this);
    }

    static from([start, symbol, end]: TransitionTuple | Transition): Transition {
        return new Transition(start, symbol, end);
    }

    [Symbol.iterator]() {
        return [this.start, this.symbol, this.end][Symbol.iterator]();
    }
}


export function get_transition_map(transitions: (Transition|TransitionTuple)[]): TransitionMap {
    const map: TransitionMap = {};

    for (let transition of transitions) {
        if (transition instanceof Array) {
            transition = Transition.from(transition);
        }

        if (!map[transition.start]) {
            map[transition.start] = {};
        }
        const symbol_map = map[transition.start];
        const end_state = symbol_map[transition.symbol];

        if (end_state === transition.end) continue;

        if (end_state instanceof Set) {
            end_state.add(transition.symbol)
        }
        else if (!end_state) {
            symbol_map[transition.symbol] = transition.end;
        }
        else {
            symbol_map[transition.symbol] = new Set([end_state, transition.end])
        }
    }

    return map;
}

export function get_alphabet(transitions: (Transition|TransitionTuple)[] | TransitionMap): Set<string> {
    if (transitions instanceof Array) {
        transitions = get_transition_map(transitions);
    }

    const alphabet = new Set<string>();

    for (let symbol_map of Object.values(transitions)) {
        for (let symbol of Object.keys(symbol_map)) {
            if (symbol === Epsilon) continue;
            alphabet.add(symbol);
        }
    }

    return alphabet;
}

export function get_states(transitions: (Transition|TransitionTuple)[] | TransitionMap): Set<State> {
    if (transitions instanceof Array) {
        transitions = get_transition_map(transitions);
    }

    const states = new Set<string>();

    for (let [start_state, symbol_map] of Object.entries(transitions)) {
        states.add(start_state);

        for (let end_state of Object.values(symbol_map)) {
            if (end_state instanceof Set) {
                for (let state of end_state) {
                    states.add(state);
                }
                continue;
            }

            states.add(end_state);
        }
    }

    return states;
}


/**
 * Splits the name of a state containing a numeric version in the
 * format `<name>.<version>`.
 * 
 * ```
 * split_state_version("q1.3")
 * // ["q1", 3]
 * split_state_version("no")
 * // ["no", 0]
 * split_state_version("dotted.name.4")
 * // ["dotted.name", 4]
 * split_state_version(".weird")
 * // [".weird", 0]
 * ```
 * 
 * @param state 
 * @returns A tuple containing the state name and version.
 */
export function split_state_version(state: State): [string, number] {
    const i = state.lastIndexOf(".");

    if (i >= 1) {
        const num = state.slice(i+1);
        if (num.match(/\d+/)) {
            return [state.slice(0, i), parseInt(num)];
        }
    }

    return [state, 0];
}

export function join_state_version(name: string, version: number) {
    return name + "." + version.toString();
}


export function split_state_set(state: State) {
    return new Set(state.split(","));
}

export function join_state_set(states: Set<State>) {
    return Array.from(states).sort().join(",");
}


/**
 * Makes a map to convert states in `target` that overlaps with any state in `base`. Overlapping
 * states will be mapped to states of same name but with an incremented version.
 * 
 * ```
 * make_state_conversion_map(["a","b"], ["a","c"])
 * // {a:"a.1",c:"c"}
 * ```
 * 
 * @param base Base states to check for overlap.
 * @param target States that will be mapped to avoid overlap.
 * @returns An object that maps the states in `target` to their respective non-overlapping names.
 */
export function make_state_conversion_map(base: Iterable<State>, target: Iterable<State>) {
    const visited = new Set(base);
    const state_map: {[key: string]: string} = {};

    for (let state of target) {
        if (!visited.has(state)) {
            state_map[state] = state;
            visited.add(state);
            continue;
        }
        let [name, version] = split_state_version(state);
        while (true) {
            version++;
            const new_state = join_state_version(name, version);
            if (!visited.has(new_state)) {
                state_map[state] = new_state;
                visited.add(new_state);
                break;
            }
        }
    }
    return state_map;
}


export class FiniteAutomaton {
    states: Set<State>;
    alphabet: Set<string>;
    transition_map: TransitionMap;
    initial_state: State;
    final_states: Set<State>;

    constructor(
        transitions: TransitionMap | (Transition|TransitionTuple)[],
        initial_state: State,
        final_states: Set<State> | State[] | null = null,
        states: Set<State> | State[] | null = null,
        alphabet: Set<string> | string[] | null = null,
    ) {
        if (transitions instanceof Array) {
            transitions = get_transition_map(transitions);
        }
        if (final_states instanceof Array) {
            final_states = new Set(final_states);
        }
        if (states instanceof Array) {
            states = new Set(states);
        }
        if (alphabet instanceof Array) {
            alphabet = new Set(alphabet);
        }

        this.transition_map = transitions;
        this.initial_state = initial_state;
        this.final_states = final_states ? final_states : new Set();
        this.states = states ? states : get_states(transitions);
        this.alphabet = alphabet ? alphabet : get_alphabet(transitions);
    }

    transition(state: State, symbol: string): Set<string> | undefined {
        const symbol_map = this.transition_map[state];
        if (!symbol_map) return;

        let end_states = symbol_map[symbol];
        if (!end_states) return;

        if (typeof end_states === "string") end_states = new Set([end_states]);

        return end_states;
    }

    *traverse_transition_map(): Generator<[State, string, State | Set<State>]> {
        for (let [start_state, symbol_map] of Object.entries(this.transition_map)) {
            for (let [symbol, end_states] of Object.entries(symbol_map)) {
                yield [start_state, symbol, end_states];
            }
        }

    }

    *traverse_transitions(): Generator<TransitionTuple> {
        for (let [start_state, symbol, end_states] of this.traverse_transition_map()) {
            if (end_states instanceof Set) {
                for (let state of end_states) {
                    yield [start_state, symbol, state];
                }
                continue;
            }
            yield [start_state, symbol, end_states];
        }
    }
    
    is_deterministic() {
        for (let [_, symbol, end_states] of this.traverse_transition_map()) {
            if (symbol === Epsilon) {
                return false;
            }
            if (end_states instanceof Set && end_states.size > 1) {
                return false;
            }
        }
        return true;
    }

    compute_epsilon_closure() {
        const closure: {[state: State]: Set<State>} = {};

        for (let originState of this.states) {
            const reached = [];
            const queue = [originState];

            while (queue.length) {
                const state = queue.shift() as string;
                reached.push(state);

                const end_states = this.transition(state, Epsilon)
                if (!end_states) continue;

                for (let end_state of end_states) {
                    if (!reached.includes(end_state)) queue.push(end_state);
                }
            }

            closure[originState] = new Set(reached);
        }

        return closure;
    }

    determinize() {
        const epsilon_closure = this.compute_epsilon_closure();
        const initial_state = join_state_set(epsilon_closure[this.initial_state]);
        const transitions: TransitionMap = {};
        const final_states: Set<State> = new Set();
        
        const remaining: State[] = [initial_state];

        while (remaining.length) {
            const state_name = remaining.shift() as State;

            if (transitions[state_name]) continue;
            transitions[state_name] = {};

            for (let symbol of this.alphabet) {
                const end_state_set: Set<State> = new Set();

                for (let state of split_state_set(state_name)) {
                    const end_states = this.transition(state, symbol);
                    if (!end_states) continue;

                    for (let end_state of end_states) {
                        for (let closed_end_state of epsilon_closure[end_state]) {
                            end_state_set.add(closed_end_state);
                        }
                    }
                }

                if (!end_state_set.size) continue;
                const end_state_name = join_state_set(end_state_set);

                transitions[state_name][symbol] = end_state_name;

                if (has_intersection(this.final_states, end_state_set)) {
                    final_states.add(end_state_name);
                }
                if (!remaining.includes(end_state_name) && !transitions[end_state_name]) {
                    remaining.push(end_state_name);
                }
            }
        }

        return new FiniteAutomaton(transitions, initial_state, final_states, null, this.alphabet);
    }

    union(automaton: FiniteAutomaton): FiniteAutomaton {
        const {u} = make_state_conversion_map(this.states, ["u"]);
        const state_map = make_state_conversion_map([...this.states, u], automaton.states);

        const states = [
            ...this.states,
            ...Array.from(automaton.states, s => state_map[s]),
            u
        ]

        const automaton_transitions: TransitionTuple[] = Array.from(
            automaton.traverse_transitions(),
            ([start, symbol, end]) => [state_map[start], symbol, state_map[end]]
        );
        const transitions: TransitionTuple[] = [
            ...this.traverse_transitions(),
            ...automaton_transitions,
            [u, Epsilon, this.initial_state],
            [u, Epsilon, state_map[automaton.initial_state]],
        ];

        const final = [
            ...this.final_states,
            ...Array.from(automaton.final_states, s => state_map[s])
        ];
        const alphabet = [...this.alphabet, ...automaton.alphabet];

        return new FiniteAutomaton(transitions, u, final, states, alphabet);
    }

    complement() {
    }
}

export function format_transition_table(automaton: FiniteAutomaton) {
    const columns = [];
    
    const states = Array.from(automaton.states).sort();
    const alphabet = Array.from(automaton.alphabet).sort();

    const states_column = ["    δ"];
    for (let state of states) {
        let prefix = "";
        if (state === automaton.initial_state) prefix += "-> "; 
        if (automaton.final_states.has(state)) prefix += "*";

        const value = prefix.padStart(4, " ") + "{" + state + "}";
        states_column.push(value);
    }
    columns.push(states_column);

    for (let symbol of [Epsilon, ...alphabet]) {
        const column = [symbol === Epsilon ? "ε" : symbol];

        for (let state of states) {
            const end_state = automaton.transition(state, symbol);
            const value = end_state ? "{" + join_state_set(end_state) + "}" : "-";
            column.push(value);
        }

        columns.push(column);
    }

    for (let column of columns) {
        const max_length = Math.max(...column.map(s => s.length));
        for (let i = 0; i < column.length; i++) {
            column[i] = column[i].padEnd(max_length, " ");
        }
    }

    const lines = [];
    for (let i = 0; i < columns[0].length; i++) {
        const line = columns.map(column => column[i]).join("   ");
        lines.push(line);
    }

    return lines.join("\n");
}