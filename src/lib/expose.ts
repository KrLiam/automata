import { XMLParser } from "fast-xml-parser"
import { AstRoot, AstIdentifier } from "./ast"
import {
    FiniteAutomaton,
    format_transition_table,
    type State,
    TuringMachine,
    StateMachine,
} from "./automaton"
import { Compiler, underline_code } from "./compiler"
import { Evaluator, Scope } from "./evaluator"
import { convert_turing_xml } from "./export"
import { get_default_parsers, delegate, Patterns } from "./parser"
import { TokenStream, SourceLocation } from "./tokenstream"
import { get_class_hierarchy, Visitor, rule, Rule } from "./visitor"
import { Grammar, NonTerminal, parse_sequence, ProductionRule, serialize_sequence, Terminal } from "./grammar"

export const exposed_default = {
    TokenStream,
    SourceLocation,
    get_default_parsers,
    delegate,
    FiniteAutomaton,
    format_transition_table,
    TuringMachine,
    Compiler,
    get_class_hierarchy,
    Evaluator,
    Scope,
    Visitor,
    rule,
    Rule,
    underline_code,
    convert_turing_xml,
    test,
    Grammar,
    NonTerminal,
    Terminal,
    ProductionRule,
    parse_sequence,
    serialize_sequence,
}

export function expose(values: { [name: string]: any }) {
    for (let [key, value] of Object.entries(values)) {
        // @ts-ignore
        window[key] = value
    }
}

function compute(mt: StateMachine<any, any>, input: string) {
    let steps = -1

    let accepted = false
    for (let confs of mt.compute(input)) {
        steps++

        if (confs.some(conf => conf.accepted)) {
            accepted = true
            break
        }
    }

    return { accepted, steps }
}

export function test(
    name: string,
    inputs: string[],
    show_input: boolean = true,
    baseline_function: ((n: number) => number) | null = null,
) {
    // @ts-ignore
    const scope: Scope = window.$scope

    const mt: TuringMachine = scope.value(name).value

    console.log(`Testing ${name}:`)

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i]
        const { accepted, steps } = compute(mt, input)

        const n = input.length

        const result = accepted ? "accepted" : "rejected"
        let out = `${
            show_input ? input : i
        }: ${result} | size=${n}, steps = ${steps}`
        if (baseline_function) {
            const baseline = baseline_function(n)
            out += `, baseline = ${baseline}, steps/baseline = ${steps / baseline}`
        }

        console.log(out)
    }
}
