#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · o percurso, para olho humano

   A barra é TROFÉU: sobe e não desce. A revisão de hoje aparece ao lado,
   nunca dentro dela — esquecer devolve a caixa ao cronograma e não desfaz
   etapa conquistada. Decisão do Weverton, 16/08/2026.

   Uso:
     node tools/percurso.js          o percurso a partir do estado zero
     node tools/percurso.js 200      simula 200 dias de estudo e mostra o mapa
     node tools/percurso.js 200 0.7  o mesmo, para quem acerta 70%
   ===================================================================== */
const G = require('../src/grafo.js');
const E = require('../src/estudo.js');
const P = require('../src/percurso.js');

const dias = Number(process.argv[2] || 0);
const acerto = Number(process.argv[3] || 0.85);

const g = G.carregar();
const idx = E.indexar(g);
const HOJE = Date.UTC(2026, 7, 16, 9, 0, 0);
const data = ms => new Date(ms).toISOString().slice(0, 10);

const estado = E.novoEstado();
Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, estado, id, HOJE, idx));

/* Estuda `dias` dias, para o percurso ter o que mostrar. */
let semente = 20260816;
const sorteio = ()=>{ semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };
const porT = {}; g.transicoes.forEach(t=>{ porT[E.chaveDaTransicao(t)] = t; });
for(let d = 0; d < dias; d++){          // `dias = 0` tem de deixar o estado intacto
  const agora = HOJE + d * E.DIA;
  const plano = E.planoDeSessao(g, estado, agora, E.TETO_SESSAO, idx);
  if(!plano.caixas) continue;
  const lote = E.iniciarLote();
  plano.atividades.forEach(a=>a.caixas.forEach(k=>{
    const { de, para, operacao } = E.lerChave(k);
    E.anotar(lote, porT[de + '>' + para], operacao, sorteio() < acerto);
  }));
  E.fecharLote(g, estado, lote, agora);
}

const agora = HOJE + dias * E.DIA;
const p = P.percurso(g, estado, agora, idx);

/* ---------- desenho ---------- */
const barra = (n, total, largura)=>{
  const cheio = total ? Math.round(largura * n / total) : 0;
  return '█'.repeat(cheio) + '·'.repeat(largura - cheio);
};

if(p.ciclicos.length){
  console.log(`⚠ sem ordem possível entre: ${p.ciclicos.join(', ')}\n`);
}

const pct = f => (f * 100).toFixed(0) + '%';

p.etapas.forEach(e=>{
  const selo = e.concluida ? '  ✓ CONCLUÍDA' : (e.iniciada ? '  ◐ em curso' : '');
  console.log(`\nEtapa ${e.numero}${selo}` +
              `   ·   ${e.total} caixas, ${pct(e.peso)} do percurso`);
  e.mecanismos.forEach(m=>{
    console.log(`  ${m.mecanismo}`);
    console.log(`    ${g.mecanismos[m.mecanismo].fenomeno}`);
    console.log(`    ${barra(m.conquistadas, m.total, 20)}  ${m.conquistadas}/${m.total}` +
                (m.concluido ? '  ✓' : ''));
    if(m.prerequisitos.length) console.log(`    depende de: ${m.prerequisitos.join(', ')}`);
    if(m.soltinho && p.etapas.length > 1) console.log(`    ⚠ solto: ninguém depende dele e ele não depende de ninguém`);
  });
});

console.log(`\n${'─'.repeat(56)}`);
console.log('PERCURSO   ' + P.trilha(p));
console.log('           ' + p.etapas.map((e, i)=>(' ' + (i + 1)).padEnd(5)).join(''));

/* Os dois números lado a lado, de propósito. Contar etapa não é contar
   progresso: as etapas têm pesos muito diferentes, e a trilha desenha
   degraus iguais. Enquanto os dois percentuais não baterem, quem olha só a
   trilha está sendo enganado sobre quanto falta. */
const porEtapa = p.etapas.length ? p.etapasConcluidas / p.etapas.length : 0;
const porCaixa = p.total ? p.conquistadas / p.total : 0;
console.log(`\nEtapas concluídas:  ${p.etapasConcluidas} de ${p.etapas.length}   (${pct(porEtapa)})`);
console.log(`Caixas conquistadas: ${p.conquistadas} de ${p.total}   (${pct(porCaixa)})   ← este é o que vale`);
if(Math.abs(porEtapa - porCaixa) > 0.1){
  console.log(`\n⚠ Os dois números discordam em ${pct(Math.abs(porEtapa - porCaixa))}. ` +
              `A contagem de etapas está\n  ${porEtapa > porCaixa ? 'otimista' : 'pessimista'} ` +
              `porque as etapas não têm o mesmo tamanho.`);
}
console.log(`\nRevisões para hoje (${data(agora)}): ${p.revisoesHoje}`);
console.log('\nA conquista não desce. As revisões vêm por fora — e continuam vindo\n' +
            'mesmo com o percurso inteiro fechado, porque é assim que ele fica fechado.');
