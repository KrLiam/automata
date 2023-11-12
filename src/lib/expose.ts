import type { State, TuringMachine } from "./automaton";
import type { Scope } from "./evaluator";

function compute(mt: TuringMachine, input: string) {
	let steps = -1;

	let state: State = mt.initial_state;
	for (let [conf_state, _] of mt.compute(input)) {
		steps++;
        state = conf_state;
	}

	const accepted = mt.final_states.has(state);

	return {accepted, steps}
}

export function test(
    name: string,
    inputs: string[],
    show_input: boolean = true,
    baseline_function: ((n: number) => number) | null = null
) {
    // @ts-ignore
    const scope: Scope = window.$scope;

    const mt: TuringMachine = scope.value(name).value

    console.log(`Testing ${name}:`);

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const {accepted, steps} = compute(mt, input)

        const n = input.length
        
        const result = accepted ? "accepted" : "rejected";
        let out = `${show_input ? input : i}: ${result} | size=${n}, steps = ${steps}`;
        if (baseline_function) {
            const baseline = baseline_function(n);
            out += `, baseline = ${baseline}, steps/baseline = ${steps / baseline}`;
        }

        console.log(out);
    }
}