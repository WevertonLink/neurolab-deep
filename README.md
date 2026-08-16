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
  `causa · permite · compoe · modula · inibe · bloqueia · remove`. Os três
  últimos estão **barrados pelo validador** por enquanto: o motor trata toda
  aresta como propagação, e numa aresta "A bloqueia B" a perturbação
  concluiria que B deixa de acontecer quando na verdade B passaria a
  acontecer mais. Gabarito derivado invertido é pior que pergunta escrita à
  mão. Enquanto o motor não tiver polaridade, escreva o **estado** que
  resulta do bloqueio e ligue com aresta positiva.
- **Nada escrito fica fora do estudo**: todo nó tem de cair no recorte de
  algum mecanismo. Nó só a jusante de todos os terminais é conteúdo que
  nenhuma operação alcança — ele sumiria sem erro.
- **Entidade não se redeclara.** Para reusar entre arquivos basta citar o id;
  declarar de novo faz a segunda apagar a primeira em silêncio.
- **Nada órfão**: todo nó participa de alguma transição; todo terminal é
  alcançável a partir da sua entrada.

O validador verifica **coerência, não verdade**. Ele pega aresta apontando
para nó inexistente; não tem como saber se a neurociência está certa. Por
isso o formato precisa ser legível: a auditoria é humana, e `tools/mostrar.js`
existe para torná-la barata.

## A revisão espaçada

O que se agenda **não é aula nem mecanismo: é o par transição × operação**.
Saber reconstruir um elo não é o mesmo que saber o que acontece quando ele
quebra, e as duas coisas se esquecem em ritmos diferentes — então são duas
caixas de revisão distintas. O endereço da caixa é `de>para#operacao`: a
transição não tem `id` de propósito, porque id é coisa que se digita errado,
e o par de nós já a identifica.

**Quais operações valem para cada transição é derivado do grafo**, pela mesma
razão que as perguntas são derivadas — se coubesse declarar "esta transição
serve para perturbar", alguém declararia:

- **construir / reconstruir** — precisam de um mecanismo onde morar, e de
  ordem não trivial. Num recorte de dois nós não há o que ordenar.
- **perturbar** — precisa de uma entidade cuja remoção realmente derrube
  alcance. Entidade cujo sumiço não muda nada gera pergunta sem resposta.
- **depurar** — se a transição inversa **também** existe no grafo
  (retroalimentação real), inverter não é erro e a pergunta fica sem gabarito.

Hoje isso dá 140 caixas para os três mecanismos: 40 construir, 40
reconstruir, 40 depurar e **20 perturbar** — a assimetria é o sinal de que a
regra está derivando, não carimbando.

A **atividade** é mecanismo × operação: reconstruir o potencial de repouso é
uma passada só que liquida as caixas de `reconstruir` de todo o recorte. As
respostas entram num **lote**, e o lote vira **uma** decisão de intervalo por
caixa, pela média — não uma promoção por resposta.

```sh
node tools/agenda.js         # a sessão de hoje, do zero
node tools/agenda.js 180     # simula 180 dias e mostra a carga por dia
```

## O percurso: etapas calculadas, não módulos

O NeuroLab v2 tinha módulos, e o módulo era **dono** do conteúdo: existia a
grade 16×4 e o material tinha de caber nela. Quando o container manda, o
conteúdo é escrito para preencher slot — e o banco de perguntas acaba finito
e decorável. É metade do problema que este projeto existe para resolver.

Aqui a **etapa é calculada**: uma camada topológica do DAG de pré-requisitos,
que por sua vez já é derivado (`A` é pré-requisito de `B` quando o *terminal*
de `A` mora dentro do recorte de `B`). Ninguém escreve a que etapa um
mecanismo pertence, e **não existe campo `modulo:`** — nem pode passar a
existir, pela mesma razão da lista branca fechada.

Consequência: a ordem do percurso é a ordem em que a matéria **depende de si
mesma**, e não a ordem em que alguém listou os arquivos. E vem um diagnóstico
de brinde que a grade nunca pôde dar — mecanismo que cai numa camada sem
ninguém depender dele está *solto* do resto do corpo de conhecimento.

**A barra é troféu: sobe e não desce.** `recorde` guarda o mais longe que
cada caixa já chegou; `caixa` guarda onde ela está hoje. São dois números
diferentes de propósito — o cronograma precisa da verdade de hoje para saber
o que cobrar, e o percurso precisa da conquista para não desfazer o que já
foi conquistado. Esquecer devolve a caixa à revisão e **não** reabre etapa
fechada. Uma caixa conta como conquistada ao alcançar o intervalo de 30 dias:
antes disso é reconhecimento recente, não retenção.

Recortes se sobrepõem — o do potencial de ação contém os outros dois
inteiros. Por isso cada caixa tem um **dono**: o menor recorte em que aquela
operação mede. Sem essa regra o progresso somava 85 de 58 caixas, e a mesma
caixa era cobrada duas vezes na mesma sessão.

```sh
node tools/percurso.js       # o mapa a partir do estado zero
node tools/percurso.js 200   # simula 200 dias e mostra o percurso preenchendo
```

## Os portões

```sh
node tools/valida-grafo.js   # estrutura do conteúdo
node tools/test-motor.js     # as quatro propriedades do motor
node tools/test-estudo.js    # as cinco propriedades do cronograma
node tools/test-percurso.js  # as cinco propriedades do percurso
```

Os três portões de teste rodam cada propriedade duas vezes: no grafo real
(tem de passar) e em **mutantes** — versões deliberadamente quebradas do
grafo ou do módulo (têm de falhar). Um mutante que sobrevive não acusa
conteúdo errado: acusa **teste decorativo**, e o portão fecha do mesmo jeito.
Isto é disciplina do projeto, não opcional — no NeuroLab v2, cinco testes
passaram com o código quebrado e nenhum foi pego por leitura.

`MOTIVOS=1` mostra por que cada mutante morreu. Um mutante que morre de
`exceção:` em vez de asserção morreu por acidente, e a propriedade continua
sem prova.

## Estado

Fase A fechada: formato, portões, vista humana e dois mecanismos
(gradiente eletroquímico, potencial de membrana).

Fase B fechada: o cronograma — caixa por transição × operação,
mensurabilidade derivada, lote de evidências, Leitner, plano de sessão — e o
percurso: etapas calculadas, conquista como troféu. Sem UI ainda.

Fase D em curso: **3 mecanismos** (gradiente eletroquímico, potencial de
membrana, potencial de ação), 3 etapas calculadas, 40 transições. O caminho
de `atp-disponivel` até `codigo-de-frequencia-com-teto` atravessa os três
arquivos em 14 transições, e nenhum arquivo declara ligação com outro.

Restam: condução saltatória, transmissão sináptica, LTP, LTD, consolidação
sistêmica, erro de previsão, acúmulo de evidência, controle top-down, eixo
HPA. E a tela, com o deslizador de escala como projeção do grafo.
