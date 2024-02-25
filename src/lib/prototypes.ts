import {
    AstNode,
    AstIdentifier,
    AstList,
    AstStateList,
    AstInitialState,
    AstFinalState,
    AstTransition,
    AstChar,
    AstRoot,
    AstModuleRoot,
    AstFiniteAutomaton,
    AstTapeList,
    AstTuringMachine,
    AstStartLocationChar,
    AstEndLocationChar,
    AstTuringShiftChar,
    AstTuringNamedShiftChar,
    AstTuringShiftCharList,
    AstTuringNamedChar,
    AstTuringCharList,
    AstTuringTransition,
    AstPrint,
    AstString,
    AstTest,
    AstExpression,
    AstUnary,
    AstBinary,
    AstAutomatonAssignment,
} from "./ast"
import { FiniteAutomaton, Tape, TuringMachine } from "./automaton"
import { Binding, Scope, LangObject, FiniteObject, TuringObject } from "./evaluator"
import { SourceLocation, Token } from "./tokenstream"

export const prototypes: any[] = [
    FiniteAutomaton,
    Tape,
    TuringMachine,
    Binding,
    Scope,
    LangObject,
    FiniteObject,
    TuringObject,
    SourceLocation,
    Token,
    AstNode,
    AstString,
    AstPrint,
    AstTest,
    AstIdentifier,
    AstList,
    AstStateList,
    AstInitialState,
    AstFinalState,
    AstTransition,
    AstChar,
    AstRoot,
    AstModuleRoot,
    AstFiniteAutomaton,
    AstAutomatonAssignment,
    AstTapeList,
    AstTuringMachine,
    AstStartLocationChar,
    AstEndLocationChar,
    AstTuringShiftChar,
    AstTuringNamedShiftChar,
    AstTuringShiftCharList,
    AstTuringNamedChar,
    AstTuringCharList,
    AstTuringTransition,
    AstExpression,
    AstUnary,
    AstBinary,
    Object,
    Array,
    Set,
    Map,
]

export const prototype_to_id = new Map(prototypes.map((v, i) => [v, i]))

export function store_prototypes(obj: any) {
    if (typeof obj !== "object" || !obj) return obj

    const proto = Object.getPrototypeOf(obj).constructor
    const id = prototype_to_id.get(proto)

    if (id !== undefined && obj.__prototype__ === undefined) {
        try {
            obj.__prototype__ = id

            for (const key of Object.keys(obj)) {
                store_prototypes(obj[key])
            }
        } catch (err) {}
    }

    return obj
}

export function recover_prototypes(obj: any) {
    if (!obj) return obj

    const id = obj.__prototype__ as string | undefined
    if (id === undefined) return obj
    delete obj.__prototype__

    const proto = prototypes[parseInt(id)]
    if (proto === undefined) return obj

    Object.setPrototypeOf(obj, proto.prototype)

    for (const key of Object.keys(obj)) {
        recover_prototypes(obj[key])
    }

    return obj
}
