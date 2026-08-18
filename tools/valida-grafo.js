#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão de estrutura

   Isto verifica COERÊNCIA, não VERDADE. Ele pega aresta apontando para nó
   inexistente, nó órfão, terminal inalcançável, `limites` vazio. Ele não
   tem como saber se a neurociência está certa — isso é auditoria humana, e
   é por isso que o formato precisa ser legível.

   Uso: node tools/valida-grafo.js
   ===================================================================== */
const G = require('../src/grafo.js');

const erros = [], avisos = [];
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) erros.push(msg); };
const notar   = (cond, msg)=>{ checagens++; if(!cond) avisos.push(msg); };

const g = G.carregar();

/* ---------- 1. referências ---------- */
g.transicoes.forEach(t=>{
  const onde = `${t._arquivo}[${t._i}] ${t.de} → ${t.para}`;
  exigir(g.nos[t.de],   `${onde}: o nó de origem "${t.de}" não existe`);
  exigir(g.nos[t.para], `${onde}: o nó de destino "${t.para}" não existe`);
  (t.requer||[]).forEach(e=>exigir(g.entidades[e], `${onde}: requer cita a entidade "${e}", que nao existe`));
  exigir(G.TIPOS_DE_TRANSICAO.includes(t.tipo),
    `${onde}: tipo "${t.tipo}" fora do vocabulário fechado (${G.TIPOS_DE_TRANSICAO.join(', ')})`);
  exigir(G.NIVEIS_DE_CERTEZA.includes(t.certeza),
    `${onde}: certeza "${t.certeza}" fora de (${G.NIVEIS_DE_CERTEZA.join(', ')})`);
});

/* ---------- 2. o `porque` é obrigatório e mede a granularidade ----------
   Regra do formato: o `porque` nomeia UM princípio. Se precisou de uma
   cadeia para ser dito, a transição está grossa demais e deve virar duas.
   A seta é a assinatura de uma cadeia disfarçada de justificativa. */
g.transicoes.forEach(t=>{
  const onde = `${t._arquivo}[${t._i}] ${t.de} → ${t.para}`;
  exigir(t.porque && t.porque.trim().length >= 40,
    `${onde}: sem \`porque\` (ou curto demais). Toda transição responde "por que A causa B".`);
  exigir(!/→|->/.test(t.porque||''),
    `${onde}: o \`porque\` contém uma seta — isso é uma CADEIA, não um princípio. Quebre a transição.`);
  notar(!/\bentão\b.*\bentão\b/i.test(t.porque||''),
    `${onde}: dois "então" no \`porque\` — pode ser cadeia disfarçada; verifique a granularidade.`);
});

/* ---------- 3. nada órfão ---------- */
const tocados = new Set();
g.transicoes.forEach(t=>{ tocados.add(t.de); tocados.add(t.para); });
Object.keys(g.nos).forEach(id=>{
  exigir(tocados.has(id), `nó órfão: "${id}" (${g.origem[id]}) não participa de nenhuma transição`);
});
const entidadesUsadas = new Set();
g.transicoes.forEach(t=>(t.requer||[]).forEach(e=>entidadesUsadas.add(e)));
Object.keys(g.nos).forEach(id=>{ if(g.nos[id].entidade) entidadesUsadas.add(g.nos[id].entidade); });
Object.keys(g.entidades).forEach(id=>{
  notar(entidadesUsadas.has(id), `entidade "${id}" declarada e nunca usada por nó nem por transição`);
});

/* ---------- 4. mecanismos ---------- */
Object.values(g.mecanismos).forEach(m=>{
  exigir(g.nos[m.entrada],  `mecanismo "${m.id}": entrada "${m.entrada}" não existe`);
  exigir(g.nos[m.terminal], `mecanismo "${m.id}": terminal "${m.terminal}" não existe`);
  exigir(m.fenomeno && m.fenomeno.trim(), `mecanismo "${m.id}": sem \`fenomeno\``);
  exigir(m.limites && m.limites.trim().length >= 40,
    `mecanismo "${m.id}": \`limites\` vazio ou curto. Um modelo sem fronteira declarada ensina certeza falsa.`);
  if(g.nos[m.entrada] && g.nos[m.terminal]){
    exigir(G.aJusante(g, m.entrada).has(m.terminal),
      `mecanismo "${m.id}": o terminal "${m.terminal}" não é alcançável a partir da entrada "${m.entrada}"`);
  }
});

/* ---------- 5. o formato não tem onde esconder autoria ----------
   Chaves fechadas por lista branca. Isto não é preciosismo de schema: é o
   que impede o projeto de virar "mais conteúdo". Se um dia couber um campo
   `pergunta`, `contrafactual` ou `consequencia` num arquivo, a pergunta
   volta a ser escrita à mão — e volta a ser decorável, que é exatamente o
   problema que originou este projeto. Campo novo aqui é decisão de projeto,
   não conveniência de autoria. */
const CHAVES = {
  raiz:      ['arquivo','nota_de_autoria','entidades','nos','transicoes','mecanismos'],
  entidade:  ['id','nome','escala','funcao','se_falhar'],
  no:        ['id','entidade','escala','descricao','quant'],
  transicao: ['de','para','tipo','certeza','porque','condicao','requer','quant'],
  mecanismo: ['id','fenomeno','entrada','terminal','limites']
};
const INTERNAS = ['_arquivo','_i'];
function fecharChaves(obj, tipo, onde){
  Object.keys(obj).forEach(k=>{
    if(INTERNAS.includes(k)) return;
    exigir(CHAVES[tipo].includes(k),
      `${onde}: chave "${k}" fora do formato de ${tipo} (permitidas: ${CHAVES[tipo].join(', ')})`);
  });
}
const fs = require('node:fs'), path = require('node:path');
g.arquivos.forEach(arq=>{
  const d = JSON.parse(fs.readFileSync(path.join(G.CONTEUDO, arq), 'utf8'));
  fecharChaves(d, 'raiz', arq);
  (d.entidades||[]).forEach(e=>fecharChaves(e, 'entidade',  `${arq} entidade "${e.id}"`));
  (d.nos||[]).forEach(n=>fecharChaves(n, 'no',              `${arq} nó "${n.id}"`));
  (d.transicoes||[]).forEach((t,i)=>fecharChaves(t, 'transicao', `${arq} transição[${i}]`));
  (d.mecanismos||[]).forEach(m=>fecharChaves(m, 'mecanismo', `${arq} mecanismo "${m.id}"`));
});

/* ---------- 6. ids únicos entre arquivos ---------- */
const vistos = {};
g.arquivos.forEach(()=>{});
Object.keys(g.nos).forEach(id=>{ vistos[id] = (vistos[id]||0)+1; });
Object.keys(vistos).forEach(id=>{
  exigir(vistos[id] === 1, `id de nó duplicado: "${id}"`);
});

/* ---------- 7. o par (de, para) endereça a caixa de revisão ----------
   A transição não tem `id` — de propósito, para não haver id a errar de
   digitação. O endereço dela é o par de nós, e o cronograma guarda o
   progresso nesse endereço. Duas transições com o mesmo par colidiriam no
   estado e uma comeria o histórico da outra em silêncio. */
const pares = {};
g.transicoes.forEach(t=>{
  const par = t.de + '>' + t.para;
  (pares[par] = pares[par] || []).push(`${t._arquivo}[${t._i}]`);
});
/* O endereço completo da caixa é `de>para#operacao`. Um id que contenha `>`
   ou `#` torna o endereço ambíguo de ler de volta, e o cronograma passa a
   escrever progresso na caixa errada — em silêncio. */
Object.keys(g.nos).forEach(id=>{
  exigir(!/[>#]/.test(id),
    `id de nó "${id}" contém ">" ou "#", que separam os campos do endereço da caixa de revisão`);
});
Object.keys(pares).forEach(par=>{
  exigir(pares[par].length === 1,
    `duas transições com o mesmo par "${par}" (${pares[par].join(', ')}): ` +
    `elas colidiriam no cronograma. Se as duas relações são reais, o nó do meio está faltando.`);
});

/* ---------- 7b. os tipos negativos ainda não podem ser usados ----------
   `inibe`, `bloqueia` e `remove` são relações reais e estão no vocabulário,
   mas o motor trata TODA aresta como propagação: `aJusante` e `aMontante`
   não sabem de sinal. Numa aresta "A bloqueia B", remover a entidade que A
   precisa mataria a aresta e a perturbação concluiria que B deixa de
   acontecer — quando na verdade B passaria a acontecer MAIS. O gabarito
   sairia invertido, e gabarito derivado errado é pior que pergunta escrita
   à mão.

   Enquanto o motor não tiver polaridade, escreva o ESTADO que resulta do
   bloqueio, com aresta positiva: em vez de "inativação bloqueia entrada de
   Na⁺", um nó `corrente-de-na-cessa` e "inativação causa corrente cessa". */
const TIPOS_SEM_MOTOR = ['inibe', 'bloqueia', 'remove'];
g.transicoes.forEach(t=>{
  exigir(!TIPOS_SEM_MOTOR.includes(t.tipo),
    `${t._arquivo}[${t._i}] ${t.de} → ${t.para}: tipo "${t.tipo}" está no vocabulário mas o motor ` +
    `ainda não tem polaridade — a perturbação calcularia ao contrário. Escreva o estado que ` +
    `resulta do bloqueio e ligue com aresta positiva.`);
});

/* ---------- 7c. entidade não pode ser declarada duas vezes ----------
   O carregador faz `g.entidades[e.id] = e`: a segunda declaração come a
   primeira em silêncio, e um `se_falhar` some sem ninguém notar. */
const entPorArquivo = {};
g.arquivos.forEach(arq=>{
  const d = JSON.parse(fs.readFileSync(path.join(G.CONTEUDO, arq), 'utf8'));
  (d.entidades||[]).forEach(e=>{ (entPorArquivo[e.id] = entPorArquivo[e.id] || []).push(arq); });
});
Object.keys(entPorArquivo).forEach(id=>{
  exigir(entPorArquivo[id].length === 1,
    `entidade "${id}" declarada em ${entPorArquivo[id].join(' e ')}: a segunda apaga a primeira. ` +
    `Para reusar, basta citar o id — entidade não precisa ser redeclarada.`);
});

/* ---------- 8. o percurso tem ordem ----------
   Etapa é camada topológica do DAG de pré-requisitos. Se dois mecanismos
   dependem um do outro, não existe "antes" entre eles e os dois somem do
   percurso — o estudo perderia o começo-meio-fim sem avisar. Não é erro de
   digitação: é sinal de que os dois recortes são o mesmo mecanismo partido
   em dois, ou de que um terminal está no lugar errado. */
const P = require('../src/percurso.js');
const { camadas, ciclicos } = P.etapas(g);
exigir(ciclicos.length === 0,
  `mecanismos em dependência mútua, sem ordem possível entre eles: ${ciclicos.join(', ')}. ` +
  `Ou são o mesmo mecanismo partido em dois, ou um \`terminal\` está no lugar errado.`);
camadas.forEach((ids, i)=>ids.forEach(id=>{
  exigir(P.caixasDoMecanismo(g, id).length > 0,
    `mecanismo "${id}" (etapa ${i + 1}) não é dono de caixa de revisão nenhuma: ` +
    `o recorte dele é coberto inteiro por outro mecanismo menor.`);
}));

/* ---------- 9. nada escrito fica fora do estudo ----------
   Um mecanismo é o recorte a MONTANTE do terminal. Nó que só existe a
   jusante dele é conteúdo autorado que nenhuma operação alcança: não gera
   caixa de revisão, não aparece em travessia nenhuma, e some sem erro. Se o
   nó importa, ele tem de levar ao terminal de alguém — e se não leva, ou
   falta uma transição, ou falta um mecanismo que o tenha por terminal. */
const dentroDeAlgum = new Set();
Object.keys(g.mecanismos).forEach(id=>{
  const sg = G.subgrafo(g, id);
  if(sg) sg.nos.forEach(n=>dentroDeAlgum.add(n));
});
Object.keys(g.nos).forEach(id=>{
  exigir(dentroDeAlgum.has(id),
    `nó "${id}" (${g.origem[id]}) está fora do recorte de todos os mecanismos: ` +
    `ele foi escrito e nunca será estudado. Falta uma transição que o leve a algum terminal, ` +
    `ou falta um mecanismo que termine nele.`);
});

/* ---------- 10. entidade que promete e não entrega ----------
   Uma entidade citada em `requer` afirma que aquela relação depende dela.
   Se removê-la não derruba NADA a jusante de nenhuma entrada, a promessa é
   vazia: o `se_falhar` descreve uma consequência que o grafo não produz, e
   `perturbar` nunca gera pergunta a partir dela.

   Isto é AVISO, não erro. Há dois motivos legítimos para a lista não ser
   vazia: (a) a entidade sustenta um nó de origem, que fica fora do
   `aJusante` de qualquer entrada; (b) a conjunção — o nó depende dela E de
   outro caminho, e alcançabilidade não sabe dizer E (ver o comentário em
   `perturbar`, em src/grafo.js). Nos dois casos o que se pede é olhar, não
   consertar às cegas.

   Nasceu de um defeito real: no mecanismo 09 escrito em 2026-08-18, remover
   `dopamina` perdia zero nós, e o mecanismo inteiro gerou zero caixas de
   `perturbar` sem que portão nenhum reclamasse. */
const entidadesEmRequer = new Set();
g.transicoes.forEach(t=>(t.requer||[]).forEach(e=>entidadesEmRequer.add(e)));
const inertes = [];
entidadesEmRequer.forEach(e=>{
  const mordeEmAlgum = Object.values(g.mecanismos).some(m=>{
    if(!g.nos[m.entrada]) return false;
    const sg = G.subgrafo(g, m.id);
    if(!sg) return false;
    return G.perturbar(g, { entidade: e }, m.entrada).perdidos
      .some(n=>sg.nos.has(n));
  });
  checagens++;
  if(!mordeEmAlgum) inertes.push(e);
});
notar(inertes.length === 0,
  `entidade(s) em \`requer\` cuja remoção não derruba nada em mecanismo nenhum: ` +
  `${inertes.join(', ')}. O \`se_falhar\` delas promete uma consequência que o grafo ` +
  `não produz, e nenhuma pergunta de \`perturbar\` sai daí.`);

/* ---------- resultado ---------- */
console.log(`grafo: ${Object.keys(g.nos).length} nós · ${g.transicoes.length} transições · ` +
            `${Object.keys(g.entidades).length} entidades · ${Object.keys(g.mecanismos).length} mecanismos ` +
            `· ${g.arquivos.length} arquivos`);
if(avisos.length){
  console.log('');
  avisos.forEach(a=>console.log('  ⚠ ' + a));
}
if(erros.length){
  console.error(`\nEstrutura: ${erros.length} erro(s) em ${checagens} checagens\n`);
  erros.forEach(e=>console.error('  ✕ ' + e));
  process.exit(1);
}
console.log(`Estrutura: ok — ${checagens} checagens`);
