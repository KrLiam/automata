import { delegate, get_default_parsers, type Parser } from "./parser";
import { TokenStream, type TokenPattern } from "./tokenstream";

export class Compiler {
    parsers: {[key: string]: Parser;};

    constructor() {
        this.parsers = get_default_parsers();
    }

    compile(source: string) {
        const stream = new TokenStream(source);

        const ast = stream.provide({parsers: this.parsers}, () => {
            return delegate("module", stream);
        })

        return {ast, tokens: [...stream.tokens]};
    }
}