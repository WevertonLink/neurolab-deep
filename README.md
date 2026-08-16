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

Hoje isso dá 200 caixas para os quatro mecanismos: 58 construir, 58
reconstruir, 58 depurar e **26 perturbar** — a assimetria é o sinal de que a
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

## Como testar

Quatro coisas diferentes, em ordem de custo.

### 1. O sistema está íntegro? (30 segundos)

```sh
node tools/valida-grafo.js && node tools/test-motor.js && \
node tools/test-estudo.js && node tools/test-percurso.js
```

Tem de terminar com quatro linhas `ok`. Qualquer `✕` diz exatamente qual
propriedade quebrou e onde.

### 2. Os portões mordem? (2 minutos — o teste mais importante)

Portão verde não significa nada se ele não fecha quando devia. Quebre de
propósito e confira que ele grita:

```sh
# guarde o original
cp content/03-potencial-de-acao.json /tmp/backup.json

# invente um nó que não existe
sed -i 's/"para": "na-entra-rapido"/"para": "nao-existe"/' content/03-potencial-de-acao.json
node tools/valida-grafo.js       # tem de FALHAR dizendo que o nó não existe

# devolva
cp /tmp/backup.json content/03-potencial-de-acao.json
node tools/valida-grafo.js       # verde de novo
```

Outras quebras que o portão tem de pegar, todas em `content/`:

| o que fazer | o que tem de acontecer |
|---|---|
| apagar um `porque` | erro: toda transição responde "por que A causa B" |
| pôr uma seta `→` dentro de um `porque` | erro: isso é cadeia, quebre a transição |
| acrescentar um campo `pergunta` a uma transição | erro: chave fora do formato |
| trocar um `tipo` por `bloqueia` | erro: o motor ainda não tem polaridade |
| duplicar uma entidade que já existe noutro arquivo | erro: a segunda apagaria a primeira |
| apagar `limites` de um mecanismo | erro: modelo sem fronteira ensina certeza falsa |

E os portões de teste têm mutantes próprios. Para ver **por que** cada um
morreu:

```sh
MOTIVOS=1 node tools/test-percurso.js
```

Toda morte tem de ser de uma asserção nomeada. Se aparecer `exceção:`, o
mutante morreu por acidente e aquela propriedade continua **sem prova**.

### 3. A neurociência está certa? (o gargalo real, e é trabalho humano)

Nenhum portão sabe se o conteúdo é verdadeiro — eles verificam coerência.
Esta é a parte que só você pode fazer:

```sh
node tools/mostrar.js potencial-de-acao canal-na-voltagem
node tools/mostrar.js conducao-saltatoria mielina
node tools/mostrar.js potencial-de-membrana bomba-na-k
node tools/mostrar.js gradiente-eletroquimico canal-vazamento-k
```

A seção **AUDITORIA** lista cada transição com o `porque` inteiro. Leia
procurando três coisas:

1. **O `porque` está errado?** Diga o número da linha.
2. **O `porque` não basta para reconstruir a relação?** Se você lê e não
   consegue refazer o raciocínio sozinho, ele está curto demais — ainda que
   esteja correto.
3. **Falta um passo no meio?** Se a transição pula uma etapa, ela está
   grossa demais e tem de virar duas.

Depois da auditoria, a seção **OPERAÇÕES** mostra as quatro perguntas
geradas a partir daquele mesmo material. Se a transição está certa, a
pergunta está certa — é essa a aposta do formato.

### 4. O estudo faz sentido? (a ergonomia)

```sh
node tools/agenda.js             # a sessão de hoje
node tools/agenda.js 180         # a carga ao longo de 180 dias
node tools/percurso.js           # o mapa, do zero
node tools/percurso.js 200       # o mapa preenchendo
```

Olhe a coluna de respostas por sessão em `agenda.js 180`. Se a mediana for
1 ou 2, a sessão está fragmentada demais para valer a pena abrir o app — é
sintoma de corpus pequeno, e some conforme os mecanismos entram.

### O que ainda NÃO dá para testar

**Não dá para estudar.** Não existe tela: você consegue ver as perguntas
geradas (`mostrar.js`) e o cronograma decidindo (`agenda.js`), mas não
consegue responder nenhuma e ver a caixa subir. Isso é a Fase C.

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

Fase D em curso: **4 mecanismos** (gradiente eletroquímico, potencial de
membrana, potencial de ação, condução saltatória), **3 etapas** calculadas,
58 transições. Nenhum arquivo declara ligação com outro.

A etapa 3 tem DOIS mecanismos, e isso é resultado derivado, não escolha:
o terminal do potencial de ação (o código de frequência) não fica a montante
da velocidade de condução, então os dois são irmãos e não sequência. A grade
16×4 do v2 nunca poderia ter dito isso.

Restam: transmissão sináptica, LTP, LTD, consolidação sistêmica, erro de
previsão, acúmulo de evidência, controle top-down, eixo HPA. E a tela, com o
deslizador de escala como projeção do grafo.
