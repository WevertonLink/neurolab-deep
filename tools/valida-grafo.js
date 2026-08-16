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
