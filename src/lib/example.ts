export const example_code = `




/*
    Automato que testa se a entrada possui uma quantidade par de a's
    e uma quantidade ímpar de b's.

    Alfabeto inferido: {a, b}

    Exemplos de entradas válidas:
    - b
    - aab
    - abaaabb
*/
finite a_par_b_impar {
    // para definir um estado como inicial:
    // initial <nome-do-estado>

    // define pA_pB como inicial
    initial pA_pB


    // para definir uma transição:
    // <estado-atual> <caractere-lido> -> <estado-de-destino>

    // se le a, inverte a entre par/impar
    pA_pB a -> iA_pB
    pA_iB a -> iA_iB
    iA_pB a -> pA_pB
    iA_iB a -> pA_iB

    // se le b, inverte b entre par/impar
    pA_pB b -> pA_iB
    pA_iB b -> pA_pB
    iA_pB b -> iA_iB
    iA_iB b -> iA_pB

    // para definir uma lista de estados finais
    // final <estado1>, <estado2>, <estado3>, ...

    // define o estado pA_iB como final
    final pA_iB
}


/*
    Máquinas de Turing

    transiçãos de máquinas de turing
    <estado-atual> <caracteres-lidos> -> <estado-destino> <caracteres-escritos> <deslocamento>
*/

turing ExemploFitaUnica tapes [A] {
    // define q0 como inicial
    initial q0;

    // le caractere de inicio "^", escreve "^" e desloca pra direita
    q0 ^ -> q1 ^ >

    // le a na fita, escreve A e desloca pra direita
    q1 a -> q1 A >
    // caracteres não alfanuméricos devem ser escritos entre aspas
    q1 "@" -> q2 "@" >

    // le qualquer simbolo, escreve b e desloca pra direita
    q2 "" -> q3 B >
    // tambem pode ser (lista de caracteres vazia)
    q2 [] -> q3 B >

    // le espaço em branco, escreve espaço em branco e não desloca
    q3 " " -> q4 " " -

    // le espaço em branco, não escreve e desloca pra esquerda
    q5 " " -> q6 [] <

    // le caractere de fim "$", escreve "$" e não desloca
    q6 $ -> q7 $ -

    // marca q7 como final
    final q7;
}

turing ExemploMultifita tapes [A, B] {
    // define q0 como inicial
    initial q0;

    // a entra sempre está na primeira fita (neste caso em A)

    // caracteres com nome de fita
    //
    // le caractere de inicio na fita A, não escreve nada
    // desloca todas as fitas pra direita 
    q0 A:^ -> q1 [] >
    // equivalente a
    q0 A:^ -> q1 [] [>, >]
    // le 1 na fita A e escreve 0 na fita B
    q1 A:1 -> q2 B:0 >

    // lista de caracteres
    //
    // [0, 1] : le 0 na fita A e le 1 na fita B
    // [1, 0] : escreve 1 na fita A e escreve 0 na fita B
    q2 [0, 1] -> q3 [1, 0] >
}

turing ExemploMuitasFitas tapes [A, B, C, D, E] {
    // define q0 como inicial
    initial q0;

    // A:^ : le caractere de inicio na primeira fita
    // []  : não escreve em nenhuma
    // >   : expande para [>, >, >, >, >] (desloca todas as fitas)
    q0 A:^ -> q1 [] >

    // [0, D:1, E:0] : le 0 na fita A, le 1 na fita D e le 0 na fita E
    // [D:0, E:1]    : escreve 0 na fita D e escreve 1 na fita E
    // [D:>, E:<]    : desloca fita D pra direita e fita E pra esquerda
    q1 [0, D:1, E:0] -> q2 [D:0, E:1] [D:>, E:>] 
}



/*
    linguagem: { a^n b^n c^n | n >= 0 }

    Máquina de turing chamada "anbncn" com três fitas
    chamadas "f1", "f2" e "f3".
*/
turing anbncn tapes [f1, f2, f3] {
    // marca q0 estado inicial
    initial q0

    // no estado q0
    // se le "a" na fita 1
    // vai pro estado q0
    // escreve "a" na fita 2
    // move fita 1 e fita 2 pra direita
    q0 f1:a -> q0 f2:a [f1:>, f2:>]

    // no estado q0
    // se le "b" na fita 1
    // vai pro estado q0
    // escreve "b" na fita 3
    // move fita 1 e fita 3 pra direita
    q0 f1:b -> q0 f3:b [f1:>, f3:>]

    // no estado q0
    // se le "c" na fita 1
    // vai pro estado q1
    // escreve nada
    // move fita 2 e fita 3 pra esquerda
    q0 f1:c -> q1 [] [f2:<, f3:<]

    // no estado q1
    // se le "c" na fita 1, "a" na fita 2 e "b" na fita 3
    // vai pro estado q1
    // escreve nada
    // move fita 1 pra direita e fita 2 e 3 pra esquerda
    q1 [f1:c, f2:a, f3:b] -> q1 [] [f1:>, f2:<, f3:<]

    // no estado q1
    // se le vazio nas tres fitas
    // vai pro estado qa
    // escreve nada
    // nao move nenhuma fita
    q1 [f1:" ", f2:" ", f3:" "] -> qa [] -;

    // marca qa como estado de aceitação
    final qa;
}
`
