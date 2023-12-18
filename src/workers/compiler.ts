import { store_prototypes } from "../lib/prototypes"
import { CompilationError, Compiler } from "../lib/compiler"
import type { AstNode } from "../lib/ast"
import type { Token } from "../lib/tokenstream"
import type { Scope } from "../lib/evaluator"

const compiler = new Compiler(postMessage.bind(this))

onmessage = function (event) {
    const data = event.data

    if (data.type === "compile") {
        compile(data.source)
    }
}

export type CompileSuccessResponse = {
    type: "success"
    time_taken: number
    ast: AstNode
    tokens: Token[]
    scope: Scope
}

export function compile(source: string) {
    const start = Date.now()

    try {
        const { ast, tokens, scope } = compiler.compile(source)
        const time_taken = Date.now() - start

        postMessage(
            store_prototypes({
                type: "success",
                ast,
                tokens,
                scope,
                time_taken,
            }),
        )
    } catch (err) {
        if (err instanceof CompilationError) {
            postMessage({ type: "fail", message: err.message })
        } else throw err
    }
}
