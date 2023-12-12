import { store_prototypes } from "@/lib/prototypes";
import { CompilationError, Compiler } from "../lib/compiler";

const compiler = new Compiler();

onmessage = function (event) {
    const data = event.data;

    if (data.type === "compile") {
        compile(data.source);
    }
}


export function compile(source: string) {
    const start = Date.now();

    try {
        const {ast, tokens, scope} = compiler.compile(source);
        const time_taken = Date.now() - start;

        postMessage(store_prototypes(
            {type: "success", ast, tokens, scope, time_taken}
        ));
    }
    catch (err) {
        if (err instanceof CompilationError) {
            postMessage({type: "error", message: err.message})
        }
        else throw err;
    }

}