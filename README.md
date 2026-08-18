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

Hoje isso dá 852 caixas para os doze mecanismos: 250 construir, 250
reconstruir, 250 depurar e **102 perturbar** — a assimetria é o sinal de que
a regra está derivando, não carimbando.

A perturbação de um mecanismo parte das **raízes do recorte**, não da
`entrada` declarada. A distinção não é sutil: o recorte é
`aMontante(terminal)`, e `aJusante(entrada)` é outro conjunto — a diferença
entre os dois são os fios que entram pela lateral, as co-causas. Medindo da
entrada, eles eram invisíveis para a perturbação, e remover a calcineurina
perdia zero nós no mecanismo cujo assunto é a calcineurina. `subgrafo` já
chamava esses nós de `raizes` desde o começo; `perturbar` é que nunca os
usou.

Sobra o limite de **conjunção**: um nó com dois pais sobrevive se qualquer
um deles sobrevive, e alcançabilidade não sabe dizer E. O gabarito fica
conservador — o que ele lista realmente some, e pode faltar coisa. Está
documentado em `perturbar`, com o aviso de **não** serializar conteúdo para
o número subir: a conjunção é real, e achatá-la seria falsificar o mecanismo
para agradar o motor. A seção 10 do validador lista quem ainda não morde.

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
de `A` mora dentro do recorte de `B`). A regra é de propósito conservadora —
ela erra por FALTA, nunca por inversão, e falta se conserta no conteúdo. Já
tentei trocá-la por posse de material e o resultado foi pior: a LTP virava
pré-requisito da transmissão sináptica, porque o recorte dela é menor. O
raciocínio inteiro está em `src/grafo.js`. Ninguém escreve a que etapa um
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

## O app

```sh
node tools/build-app.js      # gera app.html
```

Um arquivo só, ~100 KB, **sem servidor e sem rede**: abre direto no
navegador, e dá para mandar para o celular por qualquer meio. O estado fica
no `localStorage` do aparelho.

A regra que sustenta isso: `src/` **não é adaptado** para o navegador. Os
módulos entram no pacote byte a byte como o Node os executa, e o que muda é
o ambiente em volta — um `require` mínimo e um `node:fs` falso servindo o
conteúdo já embutido. Se houvesse uma versão de navegador separada, o app
rodaria um motor que portão nenhum vigia. `tools/test-app.js` confere que a
fonte inteira de cada módulo está lá dentro e que o `app.html` commitado é o
que as fontes geram hoje.

A **escala** é atributo do nó, e o deslizador é uma projeção do mesmo grafo —
nunca uma tela nova nem texto por camada. Se cada escala tivesse conteúdo
próprio, a camada voltaria a ser dona do material, que é o defeito da grade
16×4. O vocabulário de escalas é derivado do conteúdo: escala nova num
mecanismo futuro aparece no deslizador sozinha. Há ainda a faixa **pontes**,
que mostra só as transições cujas pontas trocam de nível — é onde o
molecular vira celular, e são 25 das 58 transições de hoje.

A tela de leitura mostra o **endereço** de cada transição (`03-….json[7]`),
para um erro de neurociência poder ser reportado por número em vez de por
descrição. É a auditoria no celular, em vez de no terminal.

A tela é **burra de propósito**: não escolhe pergunta, não corrige, não
calcula intervalo, não sabe o que é caixa de revisão. Uma das provas do
portão lê `app/ui.js` procurando constante de estudo (nota de corte,
intervalos) e falha se encontrar — regra que mora na tela é regra que
nenhum portão vigia.

## Como testar

Quatro coisas diferentes, em ordem de custo.

### 1. O sistema está íntegro? (30 segundos)

```sh
for t in valida-grafo test-motor test-estudo test-percurso test-perguntas test-app; do
  node tools/$t.js | tail -1
done
```

Tem de terminar com seis linhas `ok`. Qualquer `✕` diz exatamente qual
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

### 5. Estudar de verdade

```sh
node tools/build-app.js
```

Abra o `app.html` no navegador (ou mande para o celular). Você vê o
percurso, aperta Estudar, responde as quatro operações intercaladas e vê a
revelação com o `porque` de cada transição que a pergunta cobrou. Ao fechar
a sessão, o cronograma decide um intervalo por caixa e o progresso fica
salvo no aparelho.

Duas coisas para conferir com olho crítico:

- **Marque TODAS as alternativas de propósito.** Tem de reprovar. Item que
  se acerta sem saber nada corrompe o cronograma inteiro, e essa
  degeneração já apareceu uma vez neste projeto.
- **Erre de propósito e volte ao percurso.** A barra de conquista NÃO pode
  descer. O que desce é a caixa, que volta para a revisão.

## Os portões

```sh
node tools/valida-grafo.js   # estrutura do conteúdo
node tools/test-motor.js     # as quatro propriedades do motor
node tools/test-estudo.js    # as cinco propriedades do cronograma
node tools/test-percurso.js  # as cinco propriedades do percurso
node tools/test-perguntas.js # as cinco propriedades do gerador de perguntas
node tools/test-app.js       # o app montado, num DOM stubado (~1s, sem navegador)
```

Os cinco portões de teste rodam cada propriedade duas vezes: no grafo real
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
percurso: etapas calculadas, conquista como troféu.

Fase C fechada: `src/perguntas.js` gera e corrige as quatro operações, e
`app.html` é o protótipo jogável — arquivo único, sem servidor, com sessão
de estudo, leitura do mecanismo e deslizador de escala.

**Fase D fechada: os 12 mecanismos do primeiro corte estão escritos.** 202
nós, 250 transições, 42 entidades, **7 etapas** calculadas. Nenhum arquivo
declara ligação com outro — as etapas, os irmãos e as pontes entre escalas
são todos resultado de leitura do grafo.

```
1  gradiente-eletroquimico
2  potencial-de-membrana
3  potencial-de-acao · conducao-saltatoria
4  transmissao-sinaptica · acumulo-de-evidencia
5  ltp-nmda · controle-top-down
6  ltd-metaplasticidade · erro-de-previsao
7  consolidacao-sistemica · eixo-hpa
```

Cinco das sete etapas têm mais de um mecanismo. Numa grade autorada isso
seria uma decisão editorial; aqui é o que sobra depois que as dependências
são calculadas.

A etapa 3 tem DOIS mecanismos, e isso é resultado derivado, não escolha: o
terminal do potencial de ação (o código de frequência) não fica a montante
da velocidade de condução, então os dois são irmãos e não sequência. A
grade 16×4 do v2 nunca poderia ter dito isso.

O vocabulário de escalas dobrou no mecanismo 08 e passou a ser `molecular ·
celular · rede · sistemas`. Também aqui ninguém declarou nada: `escalasDe`
lê o conteúdo, e o deslizador ganhou dois entalhes porque dois nós novos
disseram que existiam. A distinção carrega o argumento do mecanismo — a
interferência é um fato de **rede**, e a saída é um fato de **sistemas**.

O mecanismo 09 (erro de previsão) é irmão do 07, não filho: os dois saem do
mesmo buraco deixado pela regra de coincidência — a LTD porque falta um
sentido de descida, o erro de previsão porque a regra é cega à consequência.
A etapa 6 ficou com os dois, e ninguém decidiu isso.

O 10 (acúmulo de evidência) caiu na etapa **4**, ao lado da transmissão
sináptica, e isso responde a uma pergunta de currículo sem que ninguém a
tenha respondido: decidir sob ruído não depende de plasticidade, só de
neurônios que integrem e disparem. Ele entra pelo terminal do 03. Numa
grade autorada, "decisão" seria um módulo avançado, no fim — aqui ele é
irmão da sinapse, porque é o que o grafo diz.

O 11 (controle top-down) é o primeiro que reusa uma peça de outro mecanismo
como PEÇA, e não como ponto de entrada: a realimentação recorrente que o 10
usa para o integrador guardar um total é a mesma que segura um alvo ativo
sem estímulo. Remover `circuito-integrador` derruba 5 nós do 11 — a ponte é
verificável, não retórica.

E o 12 (eixo HPA) fecha um arco que o 07 abriu: duas leituras do mesmo sinal
com afinidades diferentes, agora com um hormônio no lugar do Ca²⁺. A curva em
U não precisou ser afirmada — ela cai das duas afinidades. O projeto
reencontra a própria estrutura em outra escala, e isso não foi arranjado: MR
e GR têm afinidades diferentes de fato.

**O que falta agora não é conteúdo, é auditoria.** São 250 transições, e
nenhum portão checa verdade. Os seis verificam coerência: referência que não
existe, nó órfão, terminal inalcançável, entidade que promete e não entrega,
gabarito que não bate com o grafo. Todos passam num grafo inteiramente falso,
desde que ele seja consistente. A tela de leitura do `app.html` mostra o
endereço de cada transição (`07-….json[3]`) exatamente para tornar esse
trabalho reportável por número, do celular.
