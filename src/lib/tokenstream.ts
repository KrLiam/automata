export function count_ocurrences(str: string, char: string) {
    let result = 0
    for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) === char) result++
    }
    return result
}

export class SourceLocation {
    pos: number
    lineno: number
    colno: number

    constructor(pos: number, lineno: number, colno: number) {
        this.pos = pos
        this.lineno = lineno
        this.colno = colno

        Object.freeze(this)
    }

    static from(location: SourceLocation) {
        return new SourceLocation(location.pos, location.lineno, location.colno)
    }

    skipOver(value: string) {
        const line_start = value.lastIndexOf("\n")
        return new SourceLocation(
            this.pos + value.length,
            this.lineno + count_ocurrences(value, "\n"),
            line_start === -1
                ? this.colno + value.length
                : value.length - line_start,
        )
    }

    match(location: SourceLocation) {
        return (
            this.pos === location.pos &&
            this.lineno === location.lineno &&
            this.colno === location.colno
        )
    }

    static initial: SourceLocation = new SourceLocation(0, 1, 1)
    static invalid: SourceLocation = new SourceLocation(-1, -1, -1)
}

interface SupportsLocation {
    location: SourceLocation
    endLocation: SourceLocation
}

export function set_location<T extends SupportsLocation>(
    obj: T,
    location: SourceLocation | SupportsLocation,
    endLocation: SourceLocation | SupportsLocation | null = null,
): T {
    if (location instanceof SourceLocation) {
        obj.location = location
    } else {
        obj.location = location.location
        obj.endLocation = location.endLocation
    }

    if (endLocation instanceof SourceLocation) {
        obj.endLocation = endLocation
    } else if (endLocation) {
        obj.endLocation = endLocation.endLocation
    }

    return obj
}

export class InvalidSyntax extends Error {
    location: SourceLocation = SourceLocation.invalid
    endLocation: SourceLocation = SourceLocation.invalid
}

export class UnexpectedToken extends InvalidSyntax {
    token: Token
    expectedPatterns: string[]

    constructor(token: Token, expectedPatterns: string[]) {
        const patterns = expectedPatterns.join(", ")
        super(`Expected ${patterns} but got value '${token.value}'`)

        this.token = token
        this.expectedPatterns = expectedPatterns
    }
}

export class UnexpectedEOF extends InvalidSyntax {
    constructor() {
        super("Unexpected EOF")
    }
}

export type TokenPattern = string | [string, string]

export class Token {
    type: string
    value: string
    location: SourceLocation
    endLocation: SourceLocation

    constructor(
        type: string,
        value: string,
        location: SourceLocation = SourceLocation.initial,
        endLocation: SourceLocation = SourceLocation.initial,
    ) {
        this.type = type
        this.value = value
        this.location = location
        this.endLocation = endLocation
    }

    match(pattern: string): boolean {
        return pattern == this.type
    }

    static empty: Token = new Token("empty", "")
}

type CommitCheckpoint = {
    (): void
    index: number
    rollback: boolean
}

export class StreamContext {
    constructor(
        public source: string,
        public generator: Generator<Token, undefined, RegExp>,
        public done: boolean = false,
        public location: SourceLocation = SourceLocation.initial,
        public index: number = -1,
        public tokens: Token[] = [],
    ) {}
}

export class TokenStream {
    syntax_rules: { [key: string]: string }
    regex: RegExp = new RegExp("")
    ignoredTokens: string[] = []
    data: any

    context: StreamContext

    constructor(source: string | StreamContext) {
        if (!(source instanceof StreamContext)) {
            const generator = this.generateTokens()
            // force generator to start at a dummy yield statement
            // so the first .next() call can send a value.
            generator.next(new RegExp(""))
            source = new StreamContext(source, generator)
        }
        this.context = source

        this.data = {}
        this.ignoredTokens = ["whitespace", "newline", "eof"]
        this.syntax_rules = {
            newline: "\\r?\\n",
            whitespace: "[ \\t]+",
            invalid: ".+",
        }
        this.bakeRegex()
    }

    get source() {
        return this.context.source
    }
    get generator() {
        return this.context.generator
    }
    get done() {
        return this.context.done
    }
    set done(value) {
        this.context.done = value
    }
    get location() {
        return this.context.location
    }
    set location(location: SourceLocation) {
        this.context.location = location
    }
    get pos() {
        return this.context.location.pos
    }
    get index() {
        return this.context.index
    }
    set index(value) {
        this.context.index = value
    }
    get tokens() {
        return this.context.tokens
    }

    bakeRegex() {
        const patterns: string[] = []
        for (const [key, value] of Object.entries(this.syntax_rules)) {
            patterns.push(`(?<${key}>${value})`)
        }
        this.regex = new RegExp(patterns.join("|"))
    }

    crop() {
        for (let i = this.index + 1; i < this.tokens.length; i++) {
            this.tokens.pop()
        }

        if (this.tokens.length) {
            const token = this.tokens[this.tokens.length - 1]
            this.location = token.endLocation
        } else {
            this.location = SourceLocation.initial
        }
    }

    provide(data: object): TokenStream
    provide<T>(data: object, callback: () => T): T
    provide<T>(data: object, callback: (() => T) | null = null): T | TokenStream {
        const newData = { ...data, ...this.data }

        if (!callback) {
            const stream = this.copy()
            stream.data = newData
            return stream
        }

        const prevData = this.data
        this.data = newData

        let result

        try {
            result = callback()
        } finally {
            this.data = prevData
        }

        return result
    }

    syntax(patterns: { [key: string]: string | null }): TokenStream
    syntax<T>(patterns: { [key: string]: string | null }, callback: () => T): T
    syntax<T>(
        patterns: { [key: string]: string | null },
        callback: (() => T) | null = null,
    ): T | TokenStream {
        let rules: { [key: string]: string } = {}
        for (const [key, value] of Object.entries(patterns)) {
            if (value !== null) rules[key] = value
        }
        rules = { ...rules, ...this.syntax_rules }

        if (!callback) {
            const stream = this.copy()
            stream.syntax_rules = rules
            stream.bakeRegex()
            stream.crop()
            return stream
        }

        const prev_syntax = this.syntax_rules
        const prev_regex = this.regex
        this.syntax_rules = rules

        this.bakeRegex()
        this.crop()

        let result

        try {
            result = callback()
        } finally {
            this.syntax_rules = prev_syntax
            this.regex = prev_regex
            this.crop()
        }

        return result
    }

    intercept(tokens: string[]): TokenStream
    intercept<T>(tokens: string[], callback: () => T): T
    intercept<T>(
        tokens: string[],
        callback: (() => T) | null = null,
    ): T | TokenStream {
        const newIgnoredtokens = this.ignoredTokens.filter(
            (v) => !tokens.includes(v),
        )

        if (!callback) {
            const stream = this.copy()
            stream.ignoredTokens = newIgnoredtokens
            return stream
        }

        const prevIgnoredtokens = this.ignoredTokens
        this.ignoredTokens = newIgnoredtokens

        let result

        try {
            result = callback()
        } finally {
            this.ignoredTokens = prevIgnoredtokens
        }

        return result
    }

    ignore(tokens: string[]): TokenStream
    ignore<T>(tokens: string[], callback: () => T): T
    ignore<T>(tokens: string[], callback: (() => T) | null = null): T | TokenStream {
        const newIgnoredtokens = [...this.ignoredTokens]
        for (const token of tokens) {
            if (!newIgnoredtokens.includes(token)) {
                newIgnoredtokens.push(token)
            }
        }

        if (!callback) {
            const stream = this.copy()
            stream.ignoredTokens = newIgnoredtokens
            return stream
        }

        const prevIgnoredtokens = this.ignoredTokens
        this.ignoredTokens = newIgnoredtokens

        let result

        try {
            result = callback()
        } finally {
            this.ignoredTokens = prevIgnoredtokens
        }

        return result
    }

    emitToken(type: string, value: string = ""): Token {
        const location = SourceLocation.from(this.location)
        const endLocation = location.skipOver(value)

        this.location = endLocation

        const token = new Token(type, value, location, endLocation)
        this.tokens.push(token)

        this.index = this.tokens.length - 1

        return token
    }

    get current() {
        return this.tokens[this.index]
    }

    *generateTokens(): Generator<Token, undefined, RegExp> {
        // dummy yield statement to allow for an initial send value
        let regex = yield Token.empty

        while (this.pos < this.source.length) {
            const match = this.source.slice(this.pos).match(regex)
            if (match && match.groups) {
                const [[type, value], ..._] = Object.entries(match.groups).filter(
                    (v) => v[1],
                )

                this.emitToken(type, value)
                regex = yield this.current
            }
        }

        yield this.emitToken("eof")
    }

    [Symbol.iterator]() {
        return this
    }

    next(): IteratorResult<Token, unknown> {
        if (this.index + 1 < this.tokens.length) {
            this.index += 1
        } else {
            const result = this.generator.next(this.regex)
            this.done = result.done ? true : false
            if (this.done) return result
        }

        if (this.ignoredTokens.includes(this.current.type)) {
            return this.next()
        }

        return { value: this.current, done: this.done }
    }

    peek(n: number = 1): Token | null {
        const prevIndex = this.index
        let token: Token | null = null

        try {
            for (let i = 0; i < n; i++) {
                for (token of this) {
                    if (!this.ignoredTokens.includes(token.type)) {
                        break
                    }
                }
                if (this.done) {
                    return null
                }
            }
        } finally {
            this.index = prevIndex
        }

        return token
    }

    *collect_multiple(...patterns: string[]): Generator<(Token | null)[]> {
        if (!patterns.length) {
            for (const token of this) {
                yield [token]
            }
            return
        }

        let token = this.peek()
        while (token) {
            const matches = patterns.map((pattern) =>
                token?.match(pattern) ? token : null,
            )
            if (matches.every((v) => v === null)) break

            this.next()

            yield matches

            token = this.peek()
        }
    }

    *collect(pattern: string | null = null): Generator<Token> {
        const args = pattern ? [pattern] : []
        for (const [result] of this.collect_multiple(...args)) {
            if (!result) break
            yield result
        }
    }

    *collect_any(...patterns: string[]): Generator<Token> {
        if (patterns.length == 0) {
            yield* this.collect()
        } else if (patterns.length == 1) {
            yield* this.collect(patterns[0])
        } else {
            for (const matches of this.collect_multiple(...patterns)) {
                const value = matches.filter((v) => v !== null) as Token[]
                yield value[0]
            }
        }
    }

    expect_multiple(...patterns: string[]): (Token | null)[] {
        for (const result of this.collect_multiple(...patterns)) {
            return result
        }
        const token = this.peek()
        throw token
            ? set_location(new UnexpectedToken(token, patterns), token)
            : set_location(new UnexpectedEOF(), this.tokens[this.tokens.length - 1])
    }

    expect(pattern: string | null = null): Token {
        for (const result of this.collect(pattern)) {
            return result
        }
        const token = this.peek()
        if (token) {
            throw set_location(
                new UnexpectedToken(token, [pattern ? pattern : "any"]),
                token,
            )
        } else {
            const lastToken = this.tokens[this.tokens.length - 1]
            const location = lastToken
                ? lastToken.endLocation
                : SourceLocation.initial
            throw set_location(new UnexpectedEOF(), location, location)
        }
    }

    expect_any(...patterns: string[]): Token {
        if (patterns.length == 0) {
            return this.expect()
        } else if (patterns.length == 1) {
            return this.expect(patterns[0])
        } else {
            const matches = this.expect_multiple(...patterns)
            return matches.find((v) => v !== null) as Token
        }
    }

    get(...patterns: string[]): Token | null {
        for (const result of this.collect_multiple(...patterns)) {
            return result.find((v) => v !== null) as Token
        }
        return null
    }

    checkpoint<T>(callback: (commit: CommitCheckpoint) => T): {
        result: T | undefined
        err: InvalidSyntax | undefined
        rollback: boolean
    } {
        const commit: CommitCheckpoint = () => {
            commit.rollback = false
        }
        commit.rollback = true
        commit.index = this.index

        let result, err
        try {
            result = callback(commit)
        } catch (e) {
            if (!(e instanceof InvalidSyntax) || !commit.rollback) {
                throw e
            }
            err = e
        } finally {
            if (commit.rollback) {
                this.index = commit.index
            }
        }

        return { result, err, rollback: commit.rollback }
    }

    copy() {
        const stream = new TokenStream(this.context)

        stream.syntax_rules = { ...this.syntax_rules }
        stream.ignoredTokens = [...this.ignoredTokens]
        stream.data = { ...this.data }
        stream.bakeRegex()

        return stream
    }
}
