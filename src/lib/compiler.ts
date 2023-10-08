import { Evaluator, Scope } from "./evaluator";
import { delegate, get_default_parsers, type Parser } from "./parser";
import { TokenStream, type TokenPattern } from "./tokenstream";

export class Compiler {
    parsers: {[key: string]: Parser;};
    evaluator: Evaluator;

    constructor() {
        this.parsers = get_default_parsers();
        this.evaluator = new Evaluator();
    }

    compile(source: string) {
        const stream = new TokenStream(source);

        const ast = stream.provide({parsers: this.parsers}, () => {
            return delegate("module", stream);
        })

        const scope = new Scope();
        this.evaluator.invoke(ast, scope);

        return {ast, tokens: [...stream.tokens], scope};
    }
}