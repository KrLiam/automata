import { AstChar, AstFinalState, AstFiniteAutomaton, AstIdentifier, AstInitialState, AstNode, AstRoot, AstTransition } from "./ast";
import { FiniteAutomaton, type FiniteTransition } from "./automaton";
import { SourceLocation, set_location } from "./tokenstream";
import { Visitor, rule } from "./visitor";

export class EvaluationError extends Error {
    location: SourceLocation = SourceLocation.invalid;
    endLocation: SourceLocation = SourceLocation.invalid;
}

export class RedefinitionError extends EvaluationError {
    binding: Binding;
    
    constructor(binding: Binding) {
        super(`Invalid redefinition of name '${binding.name}'.`);

        this.binding = binding;
    }
}

export class PreDefinitionUsageError extends EvaluationError {
    binding: Binding;

    constructor(binding: Binding) {
        super(`Name '${binding.name}' used before definition.`);

        this.binding = binding;
    }
}

export class UndeclaredNameError extends EvaluationError {
    scope: Scope;
    name: string;

    constructor(scope: Scope, name: string) {
        super(`Name '${name}' is not declared.`);

        this.scope = scope;
        this.name = name;
    }
}

export class Binding {
    name: string;
    defined: boolean = false;
    value: any = null;

    constructor(name: string) {
        this.name = name;
    }
  
    define(value: any) {
      if (this.defined) throw new RedefinitionError(this);
  
      this.value = value;
      this.defined = true;
    }
  
    unwrap() {
      if (!this.defined) throw new PreDefinitionUsageError(this);
      return this.value;
    }
}


export class Scope {
    parent: Scope | null;
    bindings: {[name: string]: Binding};

    constructor(parent: Scope | null = null) {
        this.parent = parent;
        this.bindings = {};
    }

    declare(name: string, value: any = undefined): Binding {
        let binding = this.bindings[name];

        if (!binding) {
            binding = new Binding(name);
            this.bindings[name] = binding;
        }

        if (value !== undefined) {
            binding.define(value);
        }
        
        return binding;
    }

    value(name: string): any {
        const binding = this.bindings[name]
        if (!binding) {
            if (this.parent) return this.parent.value(name);
            throw new UndeclaredNameError(this, name);
        }

        return binding.unwrap();
    }
}


type ObjectMethodMap = {
    [name: string]: (...a: any[]) => LangObject | undefined
};

class LangObject {
    value: any;
    scope: Scope | null;
    methods: ObjectMethodMap;

    constructor(value: any, scope: Scope | null = null, methods: ObjectMethodMap | null = null) {
        this.value = value;
        this.scope = scope;
        this.methods = methods == null ? {} : methods;
    }
}


export class Evaluator extends Visitor<AstNode, Scope, void> {
    @rule(AstNode)
    fallback(node: AstNode) {}

    @rule(AstRoot)
    root(node: AstRoot, scope: Scope): any {
        for (const child of node.children) {
            this.invoke(child, scope);
        }
    }

    @rule(AstFiniteAutomaton)
    finite_automaton(node: AstFiniteAutomaton, scope: Scope) {
        const name = node.name.value;
        const binding = scope.declare(name);

        const child_scope = new Scope(scope);
        const initial = child_scope.declare("$initial");
        const final = child_scope.declare("$final", []);
        const transitions = child_scope.declare("$transitions", []);

        this.invoke(node.body, child_scope);

        if (!initial.defined) throw set_location(
            new EvaluationError(
                `Finite automaton '${name}' is missing initial state.`
            ),
            node.name
        );

        const automaton = new FiniteAutomaton(
            transitions.unwrap(), initial.unwrap(), final.unwrap()
        );
        const obj = new LangObject(automaton, child_scope);
        
        try {
            binding.define(obj);
        }
        catch (err) {
            if (err instanceof RedefinitionError) throw set_location(
                err, node.name
            );
            else throw err
        }
    }

    @rule(AstInitialState)
    initial(node: AstInitialState, scope: Scope) {
        const name = node.value.value;
        const binding = scope.declare("$initial");
        binding.define(name);
    }

    @rule(AstFinalState)
    final(node: AstFinalState, scope: Scope) {
        const binding = scope.declare("$final");
        if (!binding.defined) binding.define([]);
        
        const states = binding.unwrap() as string[];
        
        for (const identifier of node.list.values) {
            states.push(identifier.value);
        }
    }

    @rule(AstTransition)
    transition(node: AstTransition, scope: Scope) {
        const binding = scope.declare("$transitions");
        if (!binding.defined) binding.define([]);

        const transitions = binding.unwrap() as FiniteTransition[];

        const condition = node.condition;

        if (condition instanceof AstChar) {
            const start = node.start.value;
            const symbol = condition.value;
            const end = node.end.value;

            transitions.push([start, symbol, end]);
        }
        else if (condition instanceof AstIdentifier) throw set_location(
            new EvaluationError(
                `Name references in transition conditions are not supported yet.`
            ),
            condition
        );
    }
}