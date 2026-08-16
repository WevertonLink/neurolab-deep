# NeuroLab Profundo

Laboratório de reconstrução de mecanismos. O NeuroLab (v2) continua sendo o
mapa: 16 módulos, o território inteiro, conteúdo fechado. Este aqui é a
bancada — poucos mecanismos, fundo até a física, e **operáveis** em vez de
lidos.

O problema que originou o projeto: um banco finito de perguntas escritas à
mão acaba decorado. A resposta não é escrever mais perguntas — é fazer as
perguntas **saírem do conteúdo**.

---

## A unidade: a transição causal

O átomo não é o módulo, nem a aula, nem o mecanismo. É a **transição**:

```json
{ "de": "k-concentrado-dentro", "para": "k-difunde-para-fora",
  "tipo": "causa", "certeza": "consolidado",
  "requer": ["canal-vazamento-k", "membrana"],
  "porque": "Difusão: o movimento térmico de cada íon é aleatório e não tem
             direção preferida. Mas como há 35× mais K⁺ dentro, o número de
             íons que por acaso cruza para fora é maior que o que cruza para
             dentro. O fluxo líquido não vem de nenhuma força puxando — vem
             só de haver mais partículas de um lado.",
  "condicao": "canal de vazamento aberto" }
```

Ao redor dela:

- **nó** — um estado do sistema. Só existe para ser ponta de transição.
- **entidade** — o objeto sobre o qual as transições operam. É o que dá para
  **remover**, e por isso é o que torna a perturbação possível.
- **mecanismo** — um *recorte* do grafo: `fenomeno`, `entrada`, `terminal`,
  `limites`. **Nunca lista os próprios nós.** O conteúdo dele é calculado.

Arquivos em `content/` são recortes de autoria, não módulos. Todos viram
**um grafo só**. Nenhum arquivo declara ligação com outro — a composição
acontece porque dois arquivos usam o mesmo id de nó, e nada mais.

## As quatro operações, todas derivadas

Nenhuma tem texto escrito por pergunta:

| operação | de onde sai | resposta |
|---|---|---|
| **construir** | travessia das raízes até o terminal | o nó seguinte + o `porque` |
| **reconstruir** | travessia do terminal até as raízes | o nó anterior + o `porque` |
| **perturbar** | remove uma entidade, recalcula a alcançabilidade | o conjunto de nós que some |
| **depurar** | inverte uma transição sorteada | qual item da cadeia está errado |

Em `perturbar` e `depurar` a resposta é um **conjunto de nós** ou **um elo** —
verificável por máquina e não decorável, porque o alvo muda a cada volta.

Para ver tudo isso rodando sobre o conteúdo real:

```sh
node tools/mostrar.js potencial-de-membrana bomba-na-k
```

## As regras do formato (e por que existem)

O validador é uma lista branca fechada de chaves. Isso não é preciosismo:
**se um dia couber um campo `pergunta`, `contrafactual` ou `consequencia`,
a pergunta volta a ser escrita à mão** — e volta a ser decorável, que é o
problema que este projeto existe para resolver. Campo novo é decisão de
projeto, não conveniência de autoria.

- **`porque` obrigatório, ≥ 40 caracteres.** A transição tem de ser
  *reconstruível*: quem lê o `porque` consegue refazer a relação sozinho.
- **`porque` não pode conter seta (`→`).** Uma seta na justificativa é a
  assinatura de uma cadeia disfarçada — a transição está grossa demais e
  deve virar duas. Cada `porque` nomeia **um** princípio.
- **`certeza` tem consequência.** `consolidado` é o único nível que chega ao
  estudo sem ressalva. `debatido` e `hipotese` carregam avisos distintos até
  a superfície, e o portão prova que carregam.
- **`limites` obrigatório no mecanismo, ≥ 40 caracteres.** Um modelo sem
  fronteira declarada ensina certeza falsa.
- **Vocabulário de `tipo` fechado**, e todo tipo lê no sentido da seta:
  `causa · permite · compoe · modula · inibe · bloqueia · remove`.
- **Nada órfão**: todo nó participa de alguma transição; todo terminal é
  alcançável a partir da sua entrada.

O validador verifica **coerência, não verdade**. Ele pega aresta apontando
para nó inexistente; não tem como saber se a neurociência está certa. Por
isso o formato precisa ser legível: a auditoria é humana, e `tools/mostrar.js`
existe para torná-la barata.

## Os portões

```sh
node tools/valida-grafo.js   # estrutura do conteúdo
node tools/test-motor.js     # as quatro propriedades do motor
```

`test-motor.js` roda cada propriedade duas vezes: no grafo real (tem de
passar) e em **mutantes** — versões deliberadamente quebradas do grafo ou do
módulo (têm de falhar). Um mutante que sobrevive não acusa conteúdo errado:
acusa **teste decorativo**, e o portão fecha do mesmo jeito. Isto é
disciplina do projeto, não opcional — no NeuroLab v2, cinco testes passaram
com o código quebrado e nenhum foi pego por leitura.

`MOTIVOS=1 node tools/test-motor.js` mostra por que cada mutante morreu. Um
mutante que morre de `exceção:` em vez de asserção morreu por acidente, e a
propriedade continua sem prova.

## Estado

Fase A fechada: formato, os dois portões, a vista humana e dois mecanismos
(gradiente eletroquímico, potencial de membrana). Sem UI ainda.

Fases seguintes: revisão espaçada por operação; a tela; e os mecanismos
restantes — potencial de ação, condução saltatória, transmissão sináptica,
LTP, LTD, consolidação, erro de previsão, acúmulo de evidência, controle
top-down, eixo HPA.
