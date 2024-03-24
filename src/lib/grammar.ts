
export abstract class SentenceSymbol {
    value: string

    constructor(value: string) {
        this.value = value
    }
}
export class NonTerminal extends SentenceSymbol {}
export class Terminal extends SentenceSymbol {}

export type SentencialSequence = (NonTerminal | Terminal)[]
export type Sentence = Terminal[]

export class ProductionRule {
    head: SentencialSequence
    results: SentencialSequence[]

    constructor(head: SentencialSequence, ...results: SentencialSequence[]) {
        this.head = head
        this.results = [...results]
    }
}

export class Grammar {
    nonterminals: Set<string>
    terminals: Set<string>
    rules: ProductionRule[]
    initial_symbol: string

    constructor(
        rules: Iterable<ProductionRule>,
        initial_symbol: string = "S",
        nonterminals: Iterable<string> = [],
        terminals: Iterable<string> = [],
    ) {
        this.rules = [...rules]
        this.initial_symbol = initial_symbol
        
        const [rule_nonterminals, rule_terminals] = this.get_used_symbols(this.rules)
        this.nonterminals = new Set([...nonterminals, ...rule_nonterminals])
        this.terminals = new Set([...terminals, ...rule_terminals])
    }

    get_used_symbols(rules: Iterable<ProductionRule>): [Set<string>, Set<string>] {
        const nonterminals: string[] = []
        const terminals: string[] = []

        for (const rule of rules) {
            for (const sequence of [rule.head, ...rule.results]) {
                for (const symbol of sequence) {
                    if (symbol instanceof NonTerminal) {
                        nonterminals.push(symbol.value)
                    }
                    else {
                        terminals.push(...symbol.value)
                    }
                }
            }
        }

        return [new Set(nonterminals), new Set(terminals)]
    }
}
