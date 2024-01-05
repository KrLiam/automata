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
} from "./ast"
import { FiniteAutomaton, Tape, TuringMachine } from "./automaton"
import { Binding, Scope, LangObject } from "./evaluator"
import { SourceLocation, Token } from "./tokenstream"

export const prototypes: any = {
    FiniteAutomaton,
    Tape,
    TuringMachine,
    Binding,
    Scope,
    LangObject,
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
    Object,
    Array,
    Set,
    Map,
}

export function store_prototypes(obj: any) {
    if (typeof obj !== "object" || !obj) return obj

    const proto = Object.getPrototypeOf(obj)
    const name = proto?.constructor?.name
    if (Object.keys(prototypes).includes(name) && !obj.__prototype__) {
        try {
            obj.__prototype__ = name

            for (const key of Object.keys(obj)) {
                store_prototypes(obj[key])
            }
        } catch (err) {}
    }

    return obj
}

export function recover_prototypes(obj: any) {
    if (!obj) return obj

    const proto_name = obj.__prototype__ as string | undefined
    if (proto_name === undefined) return obj
    delete obj.__prototype__

    const proto = prototypes[proto_name]
    if (proto === undefined) return obj

    Object.setPrototypeOf(obj, proto.prototype)

    for (const key of Object.keys(obj)) {
        recover_prototypes(obj[key])
    }

    return obj
}
