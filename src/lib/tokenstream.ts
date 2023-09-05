export class SourceLocation {
    pos: number
    
    constructor(pos: number) {
        this.pos = pos;

        Object.freeze(this);
    }

    skipOver(value: string) {
        return new SourceLocation(
            this.pos + value.length
        );
    }

    static initial: SourceLocation = new SourceLocation(0);
}

interface SupportsLocation {
    location: SourceLocation;
    endLocation: SourceLocation;
}

function set_location<T extends SupportsLocation>(
    obj: T,
    location: SourceLocation | SupportsLocation,
    endLocation: SourceLocation | SupportsLocation | null = null
): T {
    if (location instanceof SourceLocation) {
        obj.location = location;
    }
    else {
        obj.location = location.location;
        obj.endLocation = location.endLocation;
    }

    if (endLocation instanceof SourceLocation) {
        obj.endLocation = endLocation;
    }
    else if (endLocation) {
        obj.endLocation = endLocation.endLocation;
    }

    return obj;
}

export class InvalidSyntax extends Error {
    location: SourceLocation = SourceLocation.initial;
    endLocation: SourceLocation = SourceLocation.initial;
}

export class UnexpectedToken extends InvalidSyntax {
    token: Token;

    constructor(token: Token) {
        super(`Unexpected token of type '${token.type}' and value '${token.value}'`);

        this.token = token;
    }
}

export class UnexpectedEOF extends InvalidSyntax {
    constructor() {
        super("Unexpected EOF");
    }
}

export class Token {
    type: string
    value: string;
    location: SourceLocation;
    endLocation: SourceLocation;

    constructor(
        type: string,
        value: string,
        location: SourceLocation, 
        endLocation: SourceLocation
    ) {
        this.type = type;
        this.value = value;
        this.location = location;
        this.endLocation = endLocation;
    }

    match(pattern: string): boolean {
        return pattern == this.type;
    }
}



type CommitCheckpoint = {
    (arg: number): void,
    index: number,
    rollback: boolean
}


export class TokenStream {
    source: string;

    pos: number = 0;

    syntax_rules: {[key: string]: string};
    regex: RegExp = new RegExp("");
    
    tokens: Token[] = []
    index: number = -1
    generator: Generator<Token, unknown>;
    ignoredTokens: string[] = []
    done: boolean = false

    constructor(source: string) {
        this.source = source;
        this.syntax_rules = {
            newline: "\\r?\\n",
            whitespace: "[ \\t]+",
            invalid: ".+"
        };
        this.generator = this.generateTokens();
        this.ignoredTokens = ["whitespace", "newline","eof"]
        this.bakeRegex();
    }

    bakeRegex() {
        let patterns = [];
        for (let [key, value] of Object.entries(this.syntax_rules)) {
            patterns.push(`(?<${key}>${value})`);
        }
        this.regex = new RegExp(patterns.join("|"));
    }

    crop() {
        for (let i = this.index + 1; i < this.tokens.length; i++) {
            this.tokens.pop();
        }
    }

    syntax(patterns: {[key: string]: string}, callback: () => void) {
        const prev_syntax = this.syntax_rules;
        const prev_regex = this.regex;
        this.syntax_rules = {...patterns, ...this.syntax_rules};
        this.bakeRegex();
        this.crop();
        try {
            callback();
        }
        finally {
            this.syntax_rules = prev_syntax;
            this.regex = prev_regex;
            this.crop();
        }
    }

    emitToken(type: string, value: string = "") {
        const location = new SourceLocation(this.pos);
        const endLocation = location.skipOver(value);

        this.pos = endLocation.pos;

        const token = new Token(type, value, location, endLocation);
        this.tokens.push(token);

        this.index = this.tokens.length - 1;
    }

    get current() {
        return this.tokens[this.index];
    }

    *generateTokens() {
        while (this.pos < this.source.length) {
            const match = this.source.slice(this.pos).match(this.regex);
            if (match && match.groups) {
                const [[type, value], ..._] = Object.entries(match.groups).filter((v) => v[1]);

                this.emitToken(type, value);
                yield this.current;
            }
        }

        this.emitToken("eof");
        yield this.current;
    }
    
    [Symbol.iterator]() { return this; }

    next(): IteratorResult<Token, unknown> {
        if (this.index + 1 < this.tokens.length) {
            this.index += 1;
        }
        else {
            const result = this.generator.next();
            this.done = result.done ? true : false;
            if (result.done) return result;
        }

        if (this.ignoredTokens.includes(this.current.type)) {
            return this.next();
        }

        return {value: this.current, done: this.done};
    }

    peek(n: number = 1): Token | null {
        const prevIndex = this.index;
        let token: Token | null = null;

        try {
            for (let i = 0; i < n; i++) {
                for (token of this) {
                    if (!this.ignoredTokens.includes(token.type)) {
                        break;
                    }
                }
                if (this.done) {
                    return null;
                }
            }
        }
        finally {
            this.index = prevIndex;
        }

        return token;
    }

    *collect_multiple(...patterns: string[]): Generator<(Token|null)[]> {
        if (!patterns.length) {
            for (let token of this) {
                yield [token];
            }
            return;
        }

        let token = this.peek();
        while (token) {
            const matches = patterns.map(pattern => token?.match(pattern) ? token : null);
            if (matches.every(v => v === null)) break;

            this.next();

            yield matches;

            token = this.peek();
        }
    }

    *collect(pattern: string | null = null): Generator<Token> {
        const args = pattern ? [pattern] : [];
        for (let [result] of this.collect_multiple(...args)) {
            if (!result) break;
            yield result;
        }
    }

    *collect_any(...patterns: string[]): Generator<Token> {
        if (patterns.length == 0) {
            yield* this.collect();
        }
        else if (patterns.length == 1) {
            yield* this.collect(patterns[0]);
        }
        else {
            for (let matches of this.collect_multiple(...patterns)) {
                const value = matches.filter(v => v !== null) as Token[];
                yield value[0];
            }
        }
    }

    expect_multiple(...patterns: string[]): (Token|null)[] {
        for (let result of this.collect_multiple(...patterns)) {
            return result;
        }
        const token = this.peek();
        throw token ? new UnexpectedToken(token) : new UnexpectedEOF();
    }
    
    expect(pattern: string | null = null): Token {
        for (let result of this.collect(pattern)) {
            return result;
        }
        const token = this.peek();
        throw token ? new UnexpectedToken(token) : new UnexpectedEOF();
    }

    *expect_any(...patterns: string[]): Generator<Token> {
        if (patterns.length == 0) {
            return this.expect();
        }
        else if (patterns.length == 1) {
            return this.expect(patterns[0]);
        }
        else {
            const matches = this.expect_multiple(...patterns);
            return matches.find(v => v !== null);
        }
    }

    get(...patterns: string[]): Token | null {
        for (let result of this.collect_multiple(...patterns)) {
            return result.find(v => v !== null) as Token;
        }
        return null;
    }

    checkpoint(callback: (commit: CommitCheckpoint) => any) {
        const commit: CommitCheckpoint = () => { commit.rollback = false; };
        commit.rollback = true;
        commit.index = this.index;

        try {
            callback(commit);
        }
        catch (err) {
            if (!(err instanceof InvalidSyntax) || !commit.rollback) {
                throw err;
            }
        }
        finally {
            if (commit.rollback) {
                this.index = commit.index;
            }
        }
    }
}