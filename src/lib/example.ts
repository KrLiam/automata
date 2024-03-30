export const example_code = `
/*
 Gramáticas
 
 Regra de produção:
 <subcadeia-inicial> -> <subcadeia-final1> | <subcadeia-final2> | ...
 
 Subcadeias são sequências de símbolos terminais e não-terminais.
 Abaixo segue alguns exemplos de subcadeias possíveis:
 - ""            : vazio
 - a             : um único terminal 'a'.
 - aB            : terminal 'a' seguido por um não-terminal 'B'.
 - "B"           : terminal 'B'
 - "a#%"         : um subcadeia de terminais contendo caracteres especiais
 - a<nome_longo> : terminal 'a' seguido por um não terminal nomeado 'nome_longo'
*/

/*
 Gramática livre de contexto que
 gera a linguagem {ww^r | w E {a,b}*}.
 
 Símbolos não-terminais: S e P.
 Símbolos terminais: a e b.
 
 Exemplos de sentenças válidas:
 "", aa, baab, babbab, baaabbaaab
*/
grammar wwr {
    S -> aPa | bPb | aa | bb | ""
    P -> aPa | bPb | aa | bb
}

/*
 Gramática regular que gera a linguagem
 {w | w E {a,b}* e w contém a subcadeia "bb"}.
 
 Símbolos não-terminais: S, A, B0 e B1.
 Símbolos terminais: a e b.
 
 Exemplos de sentenças válidas:
 bb, abbab, ababba, bbabbab, ababaababbaaa.
*/
grammar contains_bb start Inicial {
    <Inicial> -> a<B0> | b<B1>
    <A> -> a<A> | b<A> | a | b
    <B0> -> a<B0> | b<B1>
    <B1> -> a<B0> | bA | b
}


/*
 Autômatos Finitos
 
 Definir estado inicial:
 initial <estado>
 
 Definir estados finais:
 final <estado1>, <estado2>, ...
 
 Transiççoes de autômatos finitos:
 <estado-inicial> <leitura> -> <estado-final>
*/


/*
 Autômato finito que reconhece palavras com
 um número par de a's.
 
 Alfabeto: a, b
 Estados: a0, a1
 Estado inicial: a0
 Estado final: a0
*/
finite a_par {
    initial a0
    a0 a -> a1
    a0 b -> a0
    a1 a -> a0
    a1 b -> a1
    final a0
}

/*
 Autômato finito que reconhece palavras com
 um número par de b's.
 
 Alfabeto: a, b
 Estados: b0, b1
 Estado inicial: b0
 Estado final: b0
*/
finite b_par {
    initial b0
    b0 b -> b1
    b0 a -> b0
    b1 b -> b0
    b1 a -> b1
    final b0
}

/*
 Autômatos finitos podem ser definidos como uma expressão
 composta por outros autômatos finitos.
 
 Neste caso, 'a_par_ou_b_par' é a união dos dois autômatos acima.
*/
finite a_par_ou_b_par = a_par union b_par

/*
 Já este autômato é a interseção entre 'a_par' e o
 complemento de 'b_par'.
*/
finite a_par_b_impar = a_par intersection complement b_par

/*
 As operações disponíveis para autômatos finitos são:
 - União:           <expr1> union <expr2>
 - Interseção:      <expr1> intersection <expr2>
 - Complemento:     complement <expr>
 - Reverso:         reverse <expr>
 - Fecho de Kleene: star <expr>
 - Concatenação:    <expr1> concatenate <expr2>
 - Determinização:  determinize <expr>
*/


/*
 Define um autômato finito não-determinístico
 que reconhece palavras em que o
 antepenúltimo símbolo é 'b'.
 
 Alfabeto: a, b
 Estados: q0, q1, q2, q3
 Estado inicial: q0
 Estados finais: q3
 
 Palavras aceitas: baa, abaa, bbbbbb, baababbab.
*/
finite abn_b_ab_ab {
    // marca q0 como estado inicial
    initial q0

    // se estiver no estado q0 e ler 'a'
    // vai pro estado q0
    q0 a -> q0

    q0 b -> q0

    q0 b -> q1

    q1 a -> q2
    q1 b -> q2

    q2 a -> q3
    q2 b -> q3

    // marca q3 como estado de aceitação
    final q3
}

/*
 Define o autômato finito que reconhece o reverso
 da linguagem acima. Ou seja, reconhece palavras
 em que o terceiro símbolo é 'b'.
*/
finite ab_ab_b_abn = reverse abn_b_ab_ab


/*
 Autômatos de Pilha
 
 Transições de autômatos de pilha:
 <estado-inicial> <leitura> <desempilhamento> -> <estado-destino> <empilhamento>
*/


/*
 Define um autômato de pilha que reconhece
 a linguagem {a^n b^m c^n | a,m >= 0}.
 
 Alfabeto: a, b, c
 Estados: q0, q1, q2
 Estado inicial: q0
 Estados finais: q0, q1, q2
 
 Palavras aceitas: "", a, 
*/
pushdown AnBmCn {
    initial q0

    // No estado q0,
    // se lê 'a' na fita
    // e não desempilha nada,
    // vai pro estado q0
    // e empilha 'a'.
    q0 a "" -> q0 a

    q0 b "" -> q1 ""
    q0 c a -> q2 ""

    q1 b "" -> q1 ""
    q1 c a -> q2 ""
        
    q2 c a -> q2 ""

    final q0, q1, q2
}


/*
 Máquinas de Turing
 
 Transições de máquinas de Turing:
 <estado-atual> <leitura> -> <estado-destino> <escrita> <deslocamento>
 
 Caracteres de deslocamento: > (Direita), < (Esquerda) e - (Stay).
*/


/*
 Define uma máquina de Turing de fita única que
 reconhece palavras com a mesma quantidade de 0s e 1s.
*/
turing equal_0s_1s {
    initial q0

    // Se lê 0, marca X e vai pro estado s1 procurar um 1.
    q0 0 -> s1 X >
    // Se lê 1, marca X e vai pro estado s0 procurar um 0.
    q0 1 -> s0 X >
    // Ignora X's
    q0 X -> q0 X >
    // Se lê espaço em branco significa que chegou
    // no fim da palavra, logo aceita.
    q0 " " -> qa " " -

    // Avança pra direita ignorando X's e 1's
    s0 X -> s0 X >
    s0 1 -> s0 1 >
    // Se lê 0, marca X e retorna pro início
    s0 0 -> r0 X <
    // Se chegar no fim da palavra e ler branco, rejeita.

    // Avança pra direita ignorando X's e 0's
    s1 X -> s1 X >
    s1 0 -> s1 0 >
    // Se lê 0, marca X e retorna pro início
    s1 1 -> r0 X <
    // Se chegar no fim da palavra e ler branco, rejeita.

    // Estado de retorno
    // Desloca para esquerda até ler branco
    r0 0 -> r0 0 <
    r0 1 -> r0 1 <
    r0 X -> r0 X <
    r0 " " -> q0 " " >

    final qa
}


/*
 Define uma máquina de Turing multi-fita que
 reconhece a linguagem: { a^n b^n c^n | n >= 0 }.
 
 Fitas: f1, f2 e f3. A primeira fita (f1) é a fita de entrada.
 As fitas restantes (f2 e f3) iniciam vazias.
*/
turing anbncn tapes [f1, f2, f3] {
    initial q0

    // No estado q0,
    // se lê 'a' na fita 1,
    // vai pro estado q0,
    // escreve 'a' na fita 2
    // e move fita 1 e fita 2 pra direita.
    q0 f1:a -> q0 f2:a [f1:>, f2:>]

    q0 f1:b -> q1 f3:b [f1:>, f3:>]
    q1 f1:b -> q1 f3:b [f1:>, f3:>]

    // No estado q1,
    // se lê 'c'na fita 1,
    // vai pro estado q2,
    // não escreve nada (escreve os símbolos lidos)
    // e move fita 2 e fita 3 pra esquerda.
    q1 f1:c -> q2 [] [f2:<, f3:<]

    // No estado q2,
    // se lê 'c' na fita 1, 'a' na fita 2 e 'b' na fita 3,
    // vai pro estado q2,
    // não escreve nada
    // e move fita 1 pra direita e fitas 2 e 3 pra esquerda.
    q2 [c, a, b] -> q2 [] [>, <, <]

    // No estado q2,
    // se lê vazio nas três fitas,
    // vai pro estado qa,
    // não escreve nada
    // e nao move nenhuma fita.
    q2 [f1:" ", f2:" ", f3:" "] -> qa [] -;

    final qa;
}
`

export const example_graphs = {
    "a_par": {
        "nodes": { "a0": [406.0006055901028, 331], "a1": [576.0008441559008, 336] },
        "arcs": {
            "[\"a0\",\"a1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0",
                "destination": "a1",
                "labels": ["a"]
            },
            "[\"a0\",\"a0\"]": {
                "arc_pos": 1.6614949831281327,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0",
                "destination": "a0",
                "labels": ["b"]
            },
            "[\"a1\",\"a0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1",
                "destination": "a0",
                "labels": ["a"]
            },
            "[\"a1\",\"a1\"]": {
                "arc_pos": 1.6443188012901324,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1",
                "destination": "a1",
                "labels": ["b"]
            }
        },
        "initial": "a0",
        "finals": ["a0"]
    },
    "b_par": {
        "nodes": { "b0": [180.99770609809536, 343], "b1": [321.0000917560762, 347] },
        "arcs": {
            "[\"b0\",\"b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b0",
                "destination": "b1",
                "labels": ["b"]
            },
            "[\"b0\",\"b0\"]": {
                "arc_pos": 1.9237947971509097,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b0",
                "destination": "b0",
                "labels": ["a"]
            },
            "[\"b1\",\"b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b1",
                "destination": "b0",
                "labels": ["b"]
            },
            "[\"b1\",\"b1\"]": {
                "arc_pos": 1.527342647413896,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b1",
                "destination": "b1",
                "labels": ["a"]
            }
        },
        "initial": "b0",
        "finals": ["b0"]
    },
    "a_par_ou_b_par": {
        "nodes": {
            "u": [326.91111840828216, 379.9227299223881],
            "a0": [507.04144613306516, 474.9651258941752],
            "b0": [508.04719588562926, 299.14359925927874],
            "a1": [710.0321027851486, 475.9719639541409],
            "b1": [703.0380921107362, 300.05607209171836]
        },
        "arcs": {
            "[\"a0\",\"a1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0",
                "destination": "a1",
                "labels": ["a"]
            },
            "[\"a0\",\"a0\"]": {
                "arc_pos": 1.594445746657606,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0",
                "destination": "a0",
                "labels": ["b"]
            },
            "[\"a1\",\"a0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1",
                "destination": "a0",
                "labels": ["a"]
            },
            "[\"a1\",\"a1\"]": {
                "arc_pos": 1.49774879828675,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1",
                "destination": "a1",
                "labels": ["b"]
            },
            "[\"b0\",\"b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b0",
                "destination": "b1",
                "labels": ["b"]
            },
            "[\"b0\",\"b0\"]": {
                "arc_pos": 1.6935993033378005,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b0",
                "destination": "b0",
                "labels": ["a"]
            },
            "[\"b1\",\"b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b1",
                "destination": "b0",
                "labels": ["b"]
            },
            "[\"b1\",\"b1\"]": {
                "arc_pos": 1.2844539535971038,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "b1",
                "destination": "b1",
                "labels": ["a"]
            },
            "[\"u\",\"a0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "u",
                "destination": "a0",
                "labels": ["ε"]
            },
            "[\"u\",\"b0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "u",
                "destination": "b0",
                "labels": ["ε"]
            }
        },
        "initial": "u",
        "finals": ["a0", "b0"]
    },
    "a_par_ou_b_par/#det": {
        "nodes": {
            "a0,b0,u": [293.99640640464753, 279.88306917458726],
            "a1,b0": [556.9669389227573, 152.11077657144358],
            "a0,b1": [552.0836109852008, 400.9712801481443],
            "a0,b0": [425.9767614167208, 279.8892234285564],
            "a1,b1": [683.1562016113207, 281.1504373192444]
        },
        "arcs": {
            "[\"a0,b0,u\",\"a1,b0\"]": {
                "arc_pos": 66.47719007921171,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0,u",
                "destination": "a1,b0",
                "labels": ["a"]
            },
            "[\"a0,b0,u\",\"a0,b1\"]": {
                "arc_pos": -54.34854928999868,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0,u",
                "destination": "a0,b1",
                "labels": ["b"]
            },
            "[\"a1,b0\",\"a0,b0\"]": {
                "arc_pos": 19.822001794285864,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b0",
                "destination": "a0,b0",
                "labels": ["a"]
            },
            "[\"a1,b0\",\"a1,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b0",
                "destination": "a1,b1",
                "labels": ["b"]
            },
            "[\"a0,b1\",\"a1,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b1",
                "destination": "a1,b1",
                "labels": ["a"]
            },
            "[\"a0,b1\",\"a0,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b1",
                "destination": "a0,b0",
                "labels": ["b"]
            },
            "[\"a0,b0\",\"a1,b0\"]": {
                "arc_pos": 17.892432643324135,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0",
                "destination": "a1,b0",
                "labels": ["a"]
            },
            "[\"a0,b0\",\"a0,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0",
                "destination": "a0,b1",
                "labels": ["b"]
            },
            "[\"a1,b1\",\"a0,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b1",
                "destination": "a0,b1",
                "labels": ["a"]
            },
            "[\"a1,b1\",\"a1,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b1",
                "destination": "a1,b0",
                "labels": ["b"]
            }
        },
        "initial": "a0,b0,u",
        "finals": ["a0,b0,u", "a1,b0", "a0,b1", "a0,b0"]
    },
    "a_par_b_impar": {
        "nodes": {
            "a0,b0": [224.930284250162, 489.67724356962117],
            "a0,b1": [228.02443644839676, 322.11556321341953],
            "a1,b1": [440.9896983599896, 325.00888947795534],
            "a1,b0": [442.9631057543812, 492.9541849982301]
        },
        "arcs": {
            "[\"a0,b0\",\"a1,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0",
                "destination": "a1,b0",
                "labels": ["a"]
            },
            "[\"a0,b0\",\"a0,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b0",
                "destination": "a0,b1",
                "labels": ["b"]
            },
            "[\"a0,b1\",\"a1,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b1",
                "destination": "a1,b1",
                "labels": ["a"]
            },
            "[\"a0,b1\",\"a0,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a0,b1",
                "destination": "a0,b0",
                "labels": ["b"]
            },
            "[\"a1,b1\",\"a0,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b1",
                "destination": "a0,b1",
                "labels": ["a"]
            },
            "[\"a1,b1\",\"a1,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b1",
                "destination": "a1,b0",
                "labels": ["b"]
            },
            "[\"a1,b0\",\"a0,b0\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b0",
                "destination": "a0,b0",
                "labels": ["a"]
            },
            "[\"a1,b0\",\"a1,b1\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "a1,b0",
                "destination": "a1,b1",
                "labels": ["b"]
            }
        },
        "initial": "a0,b0",
        "finals": ["a0,b1"]
    },
    "a_par_b_impar/#det": {
        "nodes": {
            "(q0,q0)": [257.8950670157079, 355.99452955202753],
            "(q0,q0),(q1,q1)": [592.1365566233939, 354.7736602151369],
            "(q0,q1)": [403.9616683162403, 354.0690644056531]
        },
        "arcs": {
            "[\"(q0,q0)\",\"(q0,q1)\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "(q0,q0)",
                "destination": "(q0,q1)",
                "labels": ["a,b"]
            },
            "[\"(q0,q1)\",\"(q0,q0),(q1,q1)\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "(q0,q1)",
                "destination": "(q0,q0),(q1,q1)",
                "labels": ["a,b"]
            },
            "[\"(q0,q0),(q1,q1)\",\"(q0,q1)\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "(q0,q0),(q1,q1)",
                "destination": "(q0,q1)",
                "labels": ["a,b"]
            }
        },
        "initial": "(q0,q0)",
        "finals": ["(q0,q0)", "(q0,q0),(q1,q1)"]
    },
    "abn_b_ab_ab": {
        "nodes": {
            "q0": [302.1430813670115, 149.9035833544843],
            "q3": [706.9089063965649, 154.91178902644305],
            "q1": [425.9599740227331, 151.1155632134195],
            "q2": [557.0211631603939, 153.06154253969086]
        },
        "arcs": {
            "[\"q0\",\"q0\"]": {
                "arc_pos": 1.4745529925367369,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["a,b"]
            },
            "[\"q0\",\"q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q1",
                "labels": ["b"]
            },
            "[\"q1\",\"q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q2",
                "labels": ["a,b"]
            },
            "[\"q2\",\"q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q2",
                "destination": "q3",
                "labels": ["a,b"]
            }
        },
        "initial": "q0",
        "finals": ["q3"]
    },
    "abn_b_ab_ab/#det": {
        "nodes": {
            "q0": [193.20111568820388, 386.0129923139347],
            "q0,q3": [300.14542829765077, 283.0211979858934],
            "q0,q1,q3": [544.9203783919176, 393.9699125361511],
            "q0,q2,q3": [653.8511369456942, 279.0006838059966],
            "q0,q1,q2,q3": [773.0464771665585, 393.0608587336944],
            "q0,q1": [297.0134076568832, 503.96444208817866],
            "q0,q2": [408.91794450699695, 394.05196925573904],
            "q0,q1,q2": [653.9832463357432, 506.9541849982301]
        },
        "arcs": {
            "[\"q0\",\"q0\"]": {
                "arc_pos": 2.059020906308788,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["a"]
            },
            "[\"q0\",\"q0,q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0,q1",
                "labels": ["b"]
            },
            "[\"q0,q1\",\"q0,q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1",
                "destination": "q0,q2",
                "labels": ["a"]
            },
            "[\"q0,q1\",\"q0,q1,q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1",
                "destination": "q0,q1,q2",
                "labels": ["b"]
            },
            "[\"q0,q2\",\"q0,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q2",
                "destination": "q0,q3",
                "labels": ["a"]
            },
            "[\"q0,q2\",\"q0,q1,q3\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q2",
                "destination": "q0,q1,q3",
                "labels": ["b"]
            },
            "[\"q0,q1,q2\",\"q0,q2,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q2",
                "destination": "q0,q2,q3",
                "labels": ["a"]
            },
            "[\"q0,q1,q2\",\"q0,q1,q2,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q2",
                "destination": "q0,q1,q2,q3",
                "labels": ["b"]
            },
            "[\"q0,q3\",\"q0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q3",
                "destination": "q0",
                "labels": ["a"]
            },
            "[\"q0,q3\",\"q0,q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q3",
                "destination": "q0,q1",
                "labels": ["b"]
            },
            "[\"q0,q1,q3\",\"q0,q2\"]": {
                "arc_pos": 15,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q3",
                "destination": "q0,q2",
                "labels": ["a"]
            },
            "[\"q0,q1,q3\",\"q0,q1,q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q3",
                "destination": "q0,q1,q2",
                "labels": ["b"]
            },
            "[\"q0,q2,q3\",\"q0,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q2,q3",
                "destination": "q0,q3",
                "labels": ["a"]
            },
            "[\"q0,q2,q3\",\"q0,q1,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q2,q3",
                "destination": "q0,q1,q3",
                "labels": ["b"]
            },
            "[\"q0,q1,q2,q3\",\"q0,q2,q3\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q2,q3",
                "destination": "q0,q2,q3",
                "labels": ["a"]
            },
            "[\"q0,q1,q2,q3\",\"q0,q1,q2,q3\"]": {
                "arc_pos": 6.008426237785445,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0,q1,q2,q3",
                "destination": "q0,q1,q2,q3",
                "labels": ["b"]
            }
        },
        "initial": "q0",
        "finals": ["q0,q3", "q0,q1,q3", "q0,q2,q3", "q0,q1,q2,q3"]
    },
    "ab_ab_b_abn": {
        "nodes": {
            "q3": [358.9568768557704, 335.98905910405495],
            "q0": [760.0471958856292, 333.9658097001718],
            "q1": [620.0448001553941, 337.01504373192444],
            "q2": [490.9635849004284, 336.9268327583675]
        },
        "arcs": {
            "[\"q0\",\"q0\"]": {
                "arc_pos": 1.9083352394148085,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["a,b"]
            },
            "[\"q1\",\"q0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q0",
                "labels": ["b"]
            },
            "[\"q2\",\"q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q2",
                "destination": "q1",
                "labels": ["a,b"]
            },
            "[\"q3\",\"q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q3",
                "destination": "q2",
                "labels": ["a,b"]
            }
        },
        "initial": "q3",
        "finals": ["q0"]
    },
    "AnBmCn": {
        "nodes": {
            "q0": [709.2769334537937, 401.8135366450909],
            "q1": [1151.0362064857763, 396.4403689769888],
            "q2": [909.2235927842737, 224.4432755915895]
        },
        "arcs": {
            "[\"q0\",\"q0\"]": {
                "arc_pos": 4.435459540782328,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["a; ε; a"]
            },
            "[\"q0\",\"q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q1",
                "labels": ["b; ε; ε"]
            },
            "[\"q0\",\"q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q2",
                "labels": ["c; a; ε"]
            },
            "[\"q1\",\"q1\"]": {
                "arc_pos": 6.262270996356991,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q1",
                "labels": ["b; ε; ε"]
            },
            "[\"q1\",\"q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q2",
                "labels": ["c; a; ε"]
            },
            "[\"q2\",\"q2\"]": {
                "arc_pos": 1.5906172472235311,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q2",
                "destination": "q2",
                "labels": ["c; a; ε"]
            }
        },
        "initial": "q0",
        "finals": ["q0", "q1", "q2"]
    },
    "equal_0s_1s": {
        "nodes": {
            "q0": [59.94139150447363, 146.88472985356313],
            "qa": [3.0189164358821756, 268.14086403529234],
            "s1": [263.0188950685371, 41.99286708744055],
            "s0": [256.01306810735804, 268.90604882621096],
            "r0": [477.9888553510567, 150.1855023051037]
        },
        "arcs": {
            "[\"q0\",\"s1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "s1",
                "labels": ["0; X; >"]
            },
            "[\"q0\",\"s0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "s0",
                "labels": ["1; X; >"]
            },
            "[\"q0\",\"q0\"]": {
                "arc_pos": 1.6145719670409178,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["X; X; >"]
            },
            "[\"q0\",\"qa\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "qa",
                "labels": ["□; □; -"]
            },
            "[\"s0\",\"s0\"]": {
                "arc_pos": 4.774966548660116,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "s0",
                "destination": "s0",
                "labels": ["X; X; >", "1; 1; >"]
            },
            "[\"s0\",\"r0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "s0",
                "destination": "r0",
                "labels": ["0; X; <"]
            },
            "[\"s1\",\"s1\"]": {
                "arc_pos": 0.4941410486557533,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "s1",
                "destination": "s1",
                "labels": ["X; X; >", "0; 0; >"]
            },
            "[\"s1\",\"r0\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "s1",
                "destination": "r0",
                "labels": ["1; X; <"]
            },
            "[\"r0\",\"r0\"]": {
                "arc_pos": 1.5664330001650977,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "r0",
                "destination": "r0",
                "labels": ["0; 0; <", "1; 1; <", "X; X; <"]
            },
            "[\"r0\",\"q0\"]": {
                "arc_pos": 10.852797139431065,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "r0",
                "destination": "q0",
                "labels": ["□; □; >"]
            }
        },
        "initial": "q0",
        "finals": ["qa"]
    },
    "anbncn": {
        "nodes": {
            "q0": [-25.12595319050392, 365.1949194481494],
            "qa": [286.9977781948033, 537.343905085362],
            "q1": [301.2423062511374, 368.8485659536691],
            "q2": [-31.00265419022088, 533.8554597326323]
        },
        "arcs": {
            "[\"q0\",\"q0\"]": {
                "arc_pos": 1.620990348602884,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q0",
                "labels": ["a,ε,ε; a,a,ε; >,>,-"]
            },
            "[\"q0\",\"q1\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q0",
                "destination": "q1",
                "labels": ["b,ε,ε; b,ε,b; >,-,>"]
            },
            "[\"q1\",\"q1\"]": {
                "arc_pos": 1.5560825315399374,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q1",
                "labels": ["b,ε,ε; b,ε,b; >,-,>"]
            },
            "[\"q1\",\"q2\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q1",
                "destination": "q2",
                "labels": ["c,ε,ε; c,ε,ε; -,<,<"]
            },
            "[\"q2\",\"q2\"]": {
                "arc_pos": 4.739251190821205,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q2",
                "destination": "q2",
                "labels": ["c,a,b; c,a,b; >,<,<"]
            },
            "[\"q2\",\"qa\"]": {
                "arc_pos": 0,
                "label_pos": 0.5,
                "label_ontop": true,
                "origin": "q2",
                "destination": "qa",
                "labels": ["□,□,□; □,□,□; -,-,-"]
            }
        },
        "initial": "q0",
        "finals": ["qa"]
    }
}
