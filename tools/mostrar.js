#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · vista humana

   A outra metade da Fase A. O portão prova que a máquina deriva as quatro
   operações; isto prova a condição que nenhum teste alcança: que dá para
   LER o mecanismo e dizer "esta transição está errada" sem abrir código.

   Tudo abaixo é calculado na hora, a partir das transições. Nenhuma linha
   de texto foi escrita para esta tela.

   Uso: node tools/mostrar.js [id-do-mecanismo] [entidade-a-perturbar]
   ===================================================================== */
const G = require('../src/grafo.js');

const g = G.carregar();
const alvoMec = process.argv[2] || Object.keys(g.mecanismos)[0];
const m = g.mecanismos[alvoMec];
if(!m){
  console.error(`mecanismo "${alvoMec}" não existe. Há: ${Object.keys(g.mecanismos).join(', ')}`);
  process.exit(1);
}

const L = s => console.log(s);
const nome = id => (g.nos[id] && g.nos[id].descricao) || id;
const regua = (t, c)=> L('\n' + (c||'═').repeat(2) + ' ' + t + ' ' + (c||'═').repeat(Math.max(2, 68 - t.length)));
const quebrar = (txt, larg, recuo)=>{
  const out = []; let linha = '';
  for(const p of String(txt).split(/\s+/)){
    if((linha + ' ' + p).trim().length > larg){ out.push(linha.trim()); linha = p; }
    else linha += ' ' + p;
  }
  if(linha.trim()) out.push(linha.trim());
  return out.map(l=>recuo + l).join('\n');
};

/* ---------- o mecanismo ---------- */
regua(`MECANISMO · ${m.id}`);
L(`\n  ${m.fenomeno}\n`);
L(`  entrada   ${m.entrada}  —  ${nome(m.entrada)}`);
L(`  terminal  ${m.terminal}  —  ${nome(m.terminal)}`);

const sg = G.subgrafo(g, alvoMec);
const pre = G.prerequisitos(g, alvoMec);
L(`\n  recorte calculado: ${sg.nos.size} nós · ${sg.transicoes.length} transições` +
  ` · de ${[...new Set(sg.transicoes.map(t=>t._arquivo))].length} arquivo(s)`);
L(`  raízes (o que nada dentro do recorte causa): ${sg.raizes.join(', ')}`);
L(`  pré-requisitos derivados: ${pre.length ? pre.join(', ') : '— nenhum'}   (mostrados, não bloqueantes)`);
L('\n  limites declarados:');
L(quebrar(m.limites, 66, '    '));

/* ---------- 1. auditoria: as transições, uma por uma ---------- */
regua('AUDITORIA · toda a base do mecanismo, transição por transição', '─');
L('  É esta lista que precisa estar cientificamente certa. Se uma linha');
L('  aqui estiver errada, tudo o que vem depois herda o erro.\n');
sg.transicoes.forEach((t, i)=>{
  const ex = G.explicar(g, t);
  L(`  [${String(i+1).padStart(2)}] ${nome(t.de)}`);
  L(`       ──${G.VERBO[t.tipo]}──▶ ${nome(t.para)}`);
  L(quebrar(t.porque, 62, '       '));
  if(t.condicao)            L(`       condição: ${t.condicao}`);
  if((t.requer||[]).length) L(`       depende de: ${ex.requer.join(' · ')}`);
  if(t.quant)               L(`       números: ${JSON.stringify(t.quant)}`);
  if(ex.ressalva)           L(`       ⚠ ${ex.ressalva}`);
  L(`       [${t.certeza}] ${t._arquivo}`);
  L('');
});

/* ---------- 2. construir / reconstruir para frente ---------- */
regua('OPERAÇÃO 1 · CONSTRUIR (da entrada até o fim)', '─');
const frente = G.reconstruir(g, alvoMec, 'frente');
frente.passos.forEach((p, i)=>{
  L(`\n  ${i+1}. ${p.pergunta}`);
  p.resposta.forEach(r=>{
    L(`     ▸ ${nome(r.no)}`);
    L(quebrar(r.explicacao.resposta, 60, '       '));
    if(r.explicacao.ressalva) L(`       ⚠ ${r.explicacao.ressalva}`);
  });
});

/* ---------- 3. reconstruir para trás ---------- */
regua('OPERAÇÃO 2 · RECONSTRUIR (do fim até a origem)', '─');
const tras = G.reconstruir(g, alvoMec, 'tras');
tras.passos.forEach((p, i)=>{
  L(`\n  ${i+1}. ${p.pergunta}`);
  p.resposta.forEach(r=>{
    L(`     ◂ ${nome(r.no)}`);
    L(quebrar(r.explicacao.resposta, 60, '       '));
  });
});
L(`\n  (ida e volta cobrem as mesmas ${sg.transicoes.length} transições — o portão verifica isso)`);

/* ---------- 4. perturbar ---------- */
regua('OPERAÇÃO 3 · PERTURBAR (o contrafactual, derivado)', '─');
const candidatas = Object.keys(g.entidades)
  .filter(e=>G.transicoesQueDependemDe(g, e).length > 0);
const alvoEnt = process.argv[3] || candidatas[0];
L(`\n  Entidades que dá para remover neste grafo: ${candidatas.join(', ')}\n`);
L(`  ▸ E se removermos: ${(g.entidades[alvoEnt]||{}).nome || alvoEnt}?\n`);
const p = G.perturbarRecorte(g, { entidade: alvoEnt }, m.id);
L(`  Param de acontecer ${p.mortas.length} transição(ões):`);
p.mortas.forEach(t=>L(`     ✕ ${nome(t.de)}  ──${G.VERBO[t.tipo]}──▶  ${nome(t.para)}`));
L(`\n  Deixa de existir (${p.perdidos.length} nós, de ${p.perdidos.length + p.restantes.size} do recorte):`);
p.perdidos.forEach(n=>L(`     ✕ ${nome(n)}`));
L(`\n  Continua de pé: ${p.restantes.size ? [...p.restantes].map(nome).join(' · ') : '— nada'}`);
if((g.entidades[alvoEnt]||{}).se_falhar){
  L(`\n  (a nota humana desta entidade diz: "${g.entidades[alvoEnt].se_falhar}" —`);
  L('   note que a lista acima NÃO foi lida daí; ela sai da travessia)');
}

/* ---------- 5. depurar ---------- */
regua('OPERAÇÃO 4 · DEPURAR (um elo mutado, achar qual)', '─');
const mutavel = sg.transicoes.filter(t=>sg.nos.has(t.de) && sg.nos.has(t.para));
const sorteada = mutavel[Math.floor(Math.random() * mutavel.length)];
L('\n  A cadeia abaixo tem UMA afirmação invertida. Qual?\n');
sg.transicoes.forEach((t, i)=>{
  const invertida = t === sorteada;
  const a = invertida ? t.para : t.de, b = invertida ? t.de : t.para;
  L(`   ${String(i+1).padStart(2)}. ${nome(a)} ${G.VERBO[t.tipo]} ${nome(b)}.`);
});
L(`\n  resposta: item ${sg.transicoes.indexOf(sorteada)+1}` +
  `  ·  o certo é "${nome(sorteada.de)} ${G.VERBO[sorteada.tipo]} ${nome(sorteada.para)}"`);
L('  (sorteada a cada execução — não há o que decorar)\n');
