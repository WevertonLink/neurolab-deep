#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · a agenda, para olho humano

   O portão prova que o cronograma é coerente. Ele não mostra se a carga é
   estudável — se a sessão cabe numa sentada, se a revisão volta com
   espaçamento razoável, se as ressalvas chegam junto. Isso é julgamento, e
   julgamento precisa de vista.

   Uso:
     node tools/agenda.js            a sessão de hoje, do zero
     node tools/agenda.js 180        simula 180 dias de estudo e mostra a carga
     node tools/agenda.js 180 0.7    o mesmo, com quem acerta 70% das vezes
   ===================================================================== */
const G = require('../src/grafo.js');
const E = require('../src/estudo.js');

const dias = Number(process.argv[2] || 0);
const acerto = Number(process.argv[3] || 0.85);

const g = G.carregar();
const idx = E.indexar(g);
const HOJE = Date.UTC(2026, 7, 16, 9, 0, 0);
const data = ms => new Date(ms).toISOString().slice(0, 10);

const estado = E.novoEstado();
Object.keys(g.mecanismos).sort().forEach(id=>{
  const r = E.semear(g, estado, id, HOJE, idx);
  console.log(`semeado ${id}: ${r.criadas.length} caixas novas` +
              (r.jaExistiam.length ? `, ${r.jaExistiam.length} já abertas por outro recorte` : ''));
});

const r0 = E.resumo(estado, HOJE);
console.log(`\n${r0.total} caixas ao todo — uma por transição × operação mensurável.`);
E.OPERACOES.forEach(op=>{
  const n = Object.keys(estado.caixas).filter(k=>E.lerChave(k).operacao === op).length;
  console.log(`  ${op.padEnd(12)} ${String(n).padStart(3)}` +
              (n < r0.total / E.OPERACOES.length ? '   ← nem toda transição mede esta operação' : ''));
});

/* ---------- a sessão de hoje ---------- */
const nome = id => (g.nos[id] && g.nos[id].descricao) || id;
function imprimirSessao(plano){
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`SESSÃO DE ${data(plano.agora)} — ${plano.caixas} caixas em ${plano.atividades.length} atividade(s)` +
              (plano.adiadas ? `, ${plano.adiadasCaixas} caixas adiadas` : ''));
  console.log('═'.repeat(72));
  plano.atividades.forEach((a, i)=>{
    console.log(`\n${i + 1}. ${a.operacao.toUpperCase()} · ${a.mecanismo}   (${a.caixas.length} caixas)`);
    console.log(`   ${g.mecanismos[a.mecanismo].fenomeno}`);
    a.transicoes.forEach(t=>{
      console.log(`     · ${nome(t.de)} ${G.VERBO[t.tipo]} ${nome(t.para)}`);
    });
    if(a.ressalvas.length){
      console.log(`   ⚠ ${a.ressalvas.length} etapa(s) fora de \`consolidado\` — a ressalva vai junto:`);
      a.ressalvas.forEach(x=>console.log(`     · ${x.chave} (${x.certeza}): ${x.ressalva}`));
    }
  });
}
imprimirSessao(E.planoDeSessao(g, estado, HOJE, E.TETO_SESSAO, idx));

if(!dias) process.exit(0);

/* ---------- simulação ----------
   Pseudo-aleatório determinístico: a mesma simulação duas vezes dá o mesmo
   resultado, senão não dá para comparar duas mudanças de parâmetro. */
let semente = 20260816;
const sorteio = ()=>{ semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };

const porTransicao = {};
g.transicoes.forEach(t=>{ porTransicao[E.chaveDaTransicao(t)] = t; });

console.log(`\n${'═'.repeat(72)}`);
console.log(`SIMULAÇÃO — ${dias} dias, acertando ${Math.round(acerto * 100)}% das respostas`);
console.log('═'.repeat(72));
console.log('dia          sessão  caixas  adiadas   distribuição pelas caixas de Leitner');

let sessoes = 0, respostas = 0;
for(let d = 0; d <= dias; d++){
  const agora = HOJE + d * E.DIA;
  const plano = E.planoDeSessao(g, estado, agora, E.TETO_SESSAO, idx);
  if(!plano.caixas) continue;
  sessoes++;
  const lote = E.iniciarLote();
  plano.atividades.forEach(a=>a.caixas.forEach(k=>{
    const { de, para, operacao } = E.lerChave(k);
    E.anotar(lote, porTransicao[de + '>' + para], operacao, sorteio() < acerto);
    respostas++;
  }));
  E.fecharLote(g, estado, lote, agora);
  const res = E.resumo(estado, agora);
  console.log(`${data(agora)}  ${String(plano.atividades.length).padStart(6)}  ` +
              `${String(plano.caixas).padStart(6)}  ${String(plano.adiadasCaixas).padStart(7)}   ` +
              res.porCaixa.map(n=>String(n).padStart(3)).join(' '));
}

const fim = E.resumo(estado, HOJE + dias * E.DIA);
console.log(`\n${sessoes} sessões em ${dias} dias · ${respostas} respostas · ` +
            `${(respostas / Math.max(sessoes, 1)).toFixed(1)} respostas por sessão`);
console.log(`intervalos ao fim: ` + fim.porCaixa
  .map((n, i)=>n ? `${E.INTERVALOS[i]}d×${n}` : null).filter(Boolean).join('  '));
console.log(`vencidas hoje: ${fim.vencidas} · nunca estudadas: ${fim.novas}`);
