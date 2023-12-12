import type { AstNode } from "./ast";
import { EvaluationError, Evaluator, Scope } from "./evaluator";
import { delegate, get_default_parsers, Patterns, type Parser } from "./parser";
import { TokenStream, type TokenPattern, InvalidSyntax, SourceLocation, count_ocurrences } from "./tokenstream";


export function underline_code(
    source: string,
    location: SourceLocation,
    endLocation: SourceLocation,
    padding: number = 1,
) {
    const {pos, lineno, colno} = location;
    const {pos: end_pos, lineno: end_lineno, colno: end_colno} = endLocation;

    let view_begin = pos;
    let view_end = end_pos;

    for (let i = 0; i <= padding; i++) {
        view_begin = source.lastIndexOf("\n", view_begin - 1);
        view_end = source.indexOf("\n", view_end + 1);
        if (view_end === -1) view_end = source.length;
    }
    view_begin += 1;

    const view = source.slice(view_begin, view_end).split("\n");
    const view_start_line = lineno - count_ocurrences(source.slice(view_begin, pos), "\n");
    const prefix = Array.from(new Array(view.length), (_, i) => `${view_start_line + i} |`);

    for (let line = end_lineno; line >= lineno; line--) {
        const index = line - view_start_line;
        const code = index < view.length ? view[index] : "";
        let start = line === lineno ? colno : 1;
        let stop = line === end_lineno ? end_colno : code.length + 1;

        if (start >= stop) {
            stop = start + 1;
        }
        
        if (start < stop) {
            const underline = " ".repeat(start - 1) + "^".repeat(stop - start);
            view.splice(index + 1, 0, underline);
            prefix.splice(index + 1, 0, ":");
        }
    }

    const prefix_size = Math.max(8, ...prefix.map(s => s.length));
    return prefix.map((p, i) => p.padStart(prefix_size) + view[i]).join("\n");
}

export class CompilationError extends Error {
    source: string;
    module_name: string;
    error_name: string;
    error_message: string;
    location: SourceLocation;
    endLocation: SourceLocation;
    
    constructor(
        source: string,
        module_name: string,
        name: string,
        message: string,
        location: SourceLocation,
        endLocation: SourceLocation
    ) {
        const formatted = CompilationError.format(
            source, module_name, name, message, location, endLocation
        );
        console.log(formatted);
        super(formatted);

        this.source = source;
        this.module_name = module_name;
        this.error_name = name;
        this.error_message = message;
        this.location = location;
        this.endLocation = endLocation;
    }

    static format(
        source: string,
        module_name: string,
        name: string,
        message: string,
        location: SourceLocation,
        endLocation: SourceLocation
    ) {
        let msg = `${name}: ${message}`;

        if (!location.match(SourceLocation.invalid)) {
            msg += "\n\n";
            msg += `${module_name}, line ${location.lineno}, column ${location.colno}\n`;
            msg += underline_code(source, location, endLocation, 1);
            msg += "\n";
        }

        return msg;
    }
}

export class Compiler {
    parsers: {[key: string]: Parser<AstNode>;};
    evaluator: Evaluator;
    post: (arg: any) => any;

    constructor(post: (a: any) => any = () => {}) {
        this.parsers = get_default_parsers();
        this.evaluator = new Evaluator();
        this.post = post;
    }

    parse(source: string | TokenStream, parser: string = "module"): AstNode {
        let stream: TokenStream;
        if (source instanceof TokenStream) {
            stream = source;
        }
        else {
            stream = new TokenStream(source);
        }

        const ast = stream.provide({parsers: this.parsers}, () => (
            stream.syntax(Patterns, () => delegate(parser, stream))
        ));

        return ast;
    }

    compile(source: string, module_name: string = "main", scope: Scope | null = null) {
        try {
            const stream = new TokenStream(source);

            const ast = stream.provide({post: this.post}, () => (
                this.parse(stream)
            ));

            if (!scope) scope = new Scope();

            scope.provide({$post: this.post}, () => (
                this.evaluator.invoke(ast, scope as Scope)
            ));

            return {ast, tokens: [...stream.tokens], scope};
        }
        catch (err) {
            if (!(err instanceof InvalidSyntax || err instanceof EvaluationError)) {
                throw err;
            }
            throw new CompilationError(
                source,
                module_name,
                err.constructor.name,
                err.message,
                err.location,
                err.endLocation
            );
        }
    }
}