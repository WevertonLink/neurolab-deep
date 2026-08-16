#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão do percurso

   As cinco propriedades:

     1. ETAPAS     — todo mecanismo cai em exatamente uma etapa, e todo
                     pré-requisito mora numa etapa ESTRITAMENTE anterior.
     2. CICLO      — dois mecanismos que dependem um do outro são
                     denunciados, não engolidos em silêncio.
     3. TROFÉU     — a conquista sobe e não desce. Esquecer devolve a caixa
                     ao cronograma, e não desfaz etapa conquistada.
     4. CONQUISTA  — a etapa só está concluída quando TODOS os mecanismos
                     dela estão, e as contas fecham.
     5. SEPARAÇÃO  — a revisão de hoje viaja ao lado da conquista, nunca
                     dentro dela.

   Mesma disciplina dos outros portões: cada prova roda no real (tem de
   passar) e em mutantes (têm de falhar). Mutante vivo reprova o TESTE.

   Uso: node tools/test-percurso.js   ·   MOTIVOS=1 mostra as mortes
   ===================================================================== */
const G = require('../src/grafo.js');
const EST = require('../src/estudo.js');
const PER = require('../src/percurso.js');

class Falha extends Error {}
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) throw new Falha(msg); };
const clonar = o => JSON.parse(JSON.stringify(o));

const sujeito = ()=>({ g: G.carregar(), E: EST, P: PER });
const clonarSujeito = s => ({ g: clonar(s.g), E: Object.assign({}, s.E), P: Object.assign({}, s.P) });

const T0 = Date.UTC(2026, 7, 16, 9, 0, 0);

/* Sobe uma caixa até o intervalo pedido, viajando no tempo até cada
   vencimento. Repare que o laço olha `caixa`, não `recorde`: se olhasse o
   recorde, um motor que não registra recorde nenhum faria o helper girar
   até estourar, e o mutante morreria de exceção do teste em vez de morrer
   da asserção da propriedade — morte acidental não prova nada. */
function elevar(E, estado, chaves, ate){
  const teto = Math.min(ate, E.INTERVALOS.length - 1);
  chaves.forEach(k=>{
    let volta = 0;
    while(estado.caixas[k].caixa < teto){
      E.agendar(estado, k, 1, estado.caixas[k].vencimento, 1);
      if(++volta > 50) throw new Error(`não consegui elevar "${k}" até ${teto}`);
    }
  });
}
function derrubar(E, estado, chaves, vezes){
  chaves.forEach(k=>{
    for(let i = 0; i < vezes; i++) E.agendar(estado, k, 0, estado.caixas[k].vencimento, 1);
  });
}
function semearTudo(s, agora){
  const idx = s.E.indexar(s.g);
  const estado = s.E.novoEstado();
  Object.keys(s.g.mecanismos).sort().forEach(id=>s.E.semear(s.g, estado, id, agora, idx));
  return estado;
}

const TR = (de, para)=>({ de, para, tipo:'causa', certeza:'consolidado', requer:[],
  porque:'Justificativa sintética da fixture, longa o suficiente para o mínimo do formato.',
  _arquivo:'fixture.json', _i:0 });
const NOS = ids => ids.reduce((o, id)=>{ o[id] = { id, descricao:'Nó ' + id }; return o; }, {});

/* Fixture com DOIS mecanismos na mesma etapa. O conteúdo real de hoje tem um
   mecanismo por etapa, e com um só `todos` e `algum` são a mesma coisa — uma
   prova sobre "a etapa fecha quando TODOS fecham" passaria por acidente.

     a1→a2→a3   mecanismo ALFA
     b1→b2→b3   mecanismo BETA      (independente de alfa)
     a3→c, b3→c mecanismo GAMA      (depende dos dois: etapa 2)
*/
function fixtureLarga(){
  return {
    entidades: {},
    nos: NOS(['a1','a2','a3','b1','b2','b3','c']),
    transicoes: [TR('a1','a2'), TR('a2','a3'), TR('b1','b2'), TR('b2','b3'),
                 TR('a3','c'), TR('b3','c')],
    mecanismos: {
      alfa: { id:'alfa', entrada:'a1', terminal:'a3', fenomeno:'alfa',
              limites:'fixture sintética do portão, sem valor de conteúdo' },
      beta: { id:'beta', entrada:'b1', terminal:'b3', fenomeno:'beta',
              limites:'fixture sintética do portão, sem valor de conteúdo' },
      gama: { id:'gama', entrada:'a1', terminal:'c', fenomeno:'gama',
              limites:'fixture sintética do portão, sem valor de conteúdo' }
    },
    origem: {}, arquivos: []
  };
}

/* Fixture com dois mecanismos que dependem um do outro: r→p→q→p fecha um
   laço, e aí o terminal de cada um mora dentro do recorte do outro. */
function fixtureCiclica(){
  const T = TR;
  return {
    entidades: {},
    nos: ['r','p','q'].reduce((o, id)=>{ o[id] = { id, descricao:'Nó ' + id }; return o; }, {}),
    transicoes: [T('r','p'), T('p','q'), T('q','p')],
    mecanismos: {
      alfa: { id:'alfa', entrada:'r', terminal:'p', fenomeno:'alfa',
              limites:'fixture sintética do portão, sem valor de conteúdo' },
      beta: { id:'beta', entrada:'r', terminal:'q', fenomeno:'beta',
              limites:'fixture sintética do portão, sem valor de conteúdo' }
    },
    origem: {}, arquivos: []
  };
}

/* ===================================================================== */
const PROVAS = [];

/* ---------- 1. ETAPAS ---------- */
PROVAS.push({
  nome: 'ETAPAS · o percurso é a ordem em que a matéria depende de si mesma',
  roda(s){
    const { g, P } = s;
    const { camadas, camadaDe, pre, ciclicos } = P.etapas(g);

    exigir(ciclicos.length === 0,
      `mecanismos em dependência mútua no conteúdo real: ${ciclicos.join(', ')}`);
    exigir(camadas.length > 0, 'nenhuma etapa calculada');

    /* Cada mecanismo em exatamente uma etapa — nenhum perdido, nenhum em duas. */
    const contagem = {};
    camadas.forEach(ids=>ids.forEach(id=>{ contagem[id] = (contagem[id] || 0) + 1; }));
    Object.keys(g.mecanismos).forEach(id=>{
      exigir(contagem[id] === 1,
        `mecanismo "${id}" aparece em ${contagem[id] || 0} etapas; deveria aparecer em exatamente uma`);
    });
    exigir(Object.keys(contagem).length === Object.keys(g.mecanismos).length,
      'o percurso inventou mecanismo que não existe no grafo');

    /* A propriedade que faz o percurso valer: pré-requisito vem ANTES. */
    Object.keys(g.mecanismos).forEach(id=>{
      pre[id].forEach(p=>{
        exigir(camadaDe[p] < camadaDe[id],
          `"${p}" é pré-requisito de "${id}" mas está na etapa ${camadaDe[p] + 1}, ` +
          `e "${id}" na ${camadaDe[id] + 1}: o percurso pediria o depois antes do antes`);
      });
    });

    /* A primeira etapa é a que não pressupõe nada — é por onde se começa. */
    camadas[0].forEach(id=>exigir(pre[id].length === 0,
      `"${id}" abre o percurso mas depende de ${pre[id].join(', ')}`));

    /* E a etapa n>1 tem de ter alguém dependendo de trás: senão a camada é
       um acaso de ordenação, não um degrau. */
    for(let i = 1; i < camadas.length; i++){
      exigir(camadas[i].some(id=>pre[id].length > 0),
        `a etapa ${i + 1} inteira não depende de nada: não é degrau, é lista`);
    }

    /* No conteúdo de hoje existe degrau de verdade — se um dia não existir,
       o percurso virou uma etapa só e a prova acima fica vazia. */
    exigir(camadas.length >= 2,
      'só há uma etapa: o percurso não tem começo-meio-fim para mostrar');
  },
  mutantes: [
    { como: 'etapas joga todos os mecanismos na mesma camada',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.etapas;
        m.P.etapas = g=>{ const r = real(g); const todos = r.camadas.flat();
          const camadaDe = {}; todos.forEach(id=>{ camadaDe[id] = 0; });
          return { camadas:[todos], camadaDe, pre:r.pre, ciclicos:r.ciclicos }; }; return m; } },
    { como: 'etapas inverte a ordem das camadas (o dependente vem antes do pré-requisito)',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.etapas;
        m.P.etapas = g=>{ const r = real(g); const camadas = r.camadas.slice().reverse();
          const camadaDe = {}; camadas.forEach((ids, i)=>ids.forEach(id=>{ camadaDe[id] = i; }));
          return { camadas, camadaDe, pre:r.pre, ciclicos:r.ciclicos }; }; return m; } },
    { como: 'etapas devolve só a primeira camada e perde o resto do percurso',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.etapas;
        m.P.etapas = g=>{ const r = real(g);
          const camadas = r.camadas.slice(0, 1); const camadaDe = {};
          camadas[0].forEach(id=>{ camadaDe[id] = 0; });
          return { camadas, camadaDe, pre:r.pre, ciclicos:r.ciclicos }; }; return m; } }
  ]
});

/* ---------- 2. CICLO ---------- */
PROVAS.push({
  nome: 'CICLO · dependência mútua é denunciada, não engolida',
  roda(s){
    const { P, E } = s;
    const f = fixtureCiclica();

    /* Confirma que a fixture é mesmo cíclica no nível dos MECANISMOS —
       senão a prova toda estaria testando outra coisa. */
    exigir(G.prerequisitos(f, 'alfa').includes('beta') &&
           G.prerequisitos(f, 'beta').includes('alfa'),
      'a fixture cíclica não é cíclica: o teste não estaria provando nada');

    const r = P.etapas(f);
    exigir(r.ciclicos.length === 2,
      `${r.ciclicos.length} mecanismo(s) denunciado(s) como cíclico(s); esperava 2`);
    exigir(r.ciclicos.includes('alfa') && r.ciclicos.includes('beta'),
      `os cíclicos denunciados foram "${r.ciclicos.join(', ')}"`);
    exigir(r.camadas.flat().length === 0,
      'um mecanismo cíclico foi colocado numa etapa como se tivesse ordem');

    /* E o percurso propaga a denúncia até a superfície: não adianta detectar
       lá dentro e entregar um percurso silenciosamente incompleto. */
    const p = P.percurso(f, E.novoEstado(), T0, E.indexar(f));
    exigir(p.ciclicos.length === 2,
      `o percurso entregou ${p.ciclicos.length} cíclico(s): a denúncia se perdeu no caminho`);
    exigir(p.etapas.length === 0,
      'o percurso mostrou etapas para um grafo cujos mecanismos são todos cíclicos');
  },
  mutantes: [
    { como: 'etapas engole o ciclo e devolve `ciclicos` vazio',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.etapas;
        m.P.etapas = g=>Object.assign({}, real(g), { ciclicos: [] }); return m; } },
    { como: 'etapas empurra os cíclicos para uma última camada, fingindo ordem',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.etapas;
        m.P.etapas = g=>{ const r = real(g);
          if(!r.ciclicos.length) return r;
          const camadas = r.camadas.concat([r.ciclicos.slice()]);
          const camadaDe = Object.assign({}, r.camadaDe);
          r.ciclicos.forEach(id=>{ camadaDe[id] = camadas.length - 1; });
          return { camadas, camadaDe, pre:r.pre, ciclicos: [] }; }; return m; } },
    { como: 'percurso não propaga `ciclicos` para a superfície',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>
          Object.assign({}, real(g, estado, agora, idx), { ciclicos: [] }); return m; } }
  ]
});

/* ---------- 3. TROFÉU ---------- */
PROVAS.push({
  nome: 'TROFÉU · a conquista sobe e não desce quando se esquece',
  roda(s){
    const { g, E, P } = s;
    const idx = E.indexar(g);
    const mec = Object.keys(g.mecanismos).sort()[0];
    const estado = semearTudo(s, T0);
    const chaves = P.caixasDoMecanismo(g, mec, idx);
    exigir(chaves.length > 0, `o mecanismo "${mec}" não tem caixa nenhuma`);

    const zero = P.conquistaDoMecanismo(g, estado, mec, idx);
    exigir(zero.conquistadas === 0, 'estado zero já veio com conquista');
    exigir(!zero.concluido, 'estado zero já veio concluído');

    /* Estudar conquista. */
    elevar(E, estado, chaves, P.CAIXA_FIRME);
    const cheio = P.conquistaDoMecanismo(g, estado, mec, idx);
    exigir(cheio.conquistadas === chaves.length,
      `${cheio.conquistadas}/${chaves.length} conquistadas depois de elevar todas ao firme`);
    exigir(cheio.concluido, 'todas as caixas no firme e o mecanismo não ficou concluído');

    /* Antes do firme não conta: conquista não é "eu vi uma vez". */
    const cedo = semearTudo(s, T0);
    elevar(E, cedo, chaves, P.CAIXA_FIRME - 1);
    const parcial = P.conquistaDoMecanismo(g, cedo, mec, idx);
    exigir(parcial.conquistadas === 0,
      `caixa no recorde ${P.CAIXA_FIRME - 1} já contou como conquistada`);
    exigir(parcial.iniciado, 'estudou e o mecanismo não ficou marcado como iniciado');

    /* E agora o que ele decidiu: esquecer NÃO desfaz. */
    derrubar(E, estado, chaves, 3);
    chaves.forEach(k=>exigir(estado.caixas[k].caixa < P.CAIXA_FIRME,
      `a caixa "${k}" não chegou a cair; a prova de troféu não estaria testando nada`));
    const depois = P.conquistaDoMecanismo(g, estado, mec, idx);
    exigir(depois.conquistadas === cheio.conquistadas,
      `errar derrubou a conquista de ${cheio.conquistadas} para ${depois.conquistadas}`);
    exigir(depois.concluido, 'errar desfez um mecanismo já concluído');

    /* O recorde é monótono por construção, em qualquer caixa e a qualquer hora. */
    Object.keys(estado.caixas).forEach(k=>{
      const c = estado.caixas[k];
      exigir(c.recorde >= c.caixa,
        `caixa "${k}": recorde ${c.recorde} menor que a caixa atual ${c.caixa}`);
    });
  },
  mutantes: [
    { como: 'a conquista lê a caixa de hoje em vez do recorde',
      aplicar(s){ const m = clonarSujeito(s);
        m.P.conquistaDoMecanismo = (g, estado, mecId, idx)=>{
          const chaves = m.P.caixasDoMecanismo(g, mecId, idx);
          const abertas = chaves.filter(k=>estado.caixas[k]);
          const conq = abertas.filter(k=>estado.caixas[k].caixa >= m.P.CAIXA_FIRME);
          return { mecanismo:mecId, total:chaves.length, semeadas:abertas.length,
                   conquistadas:conq.length, fracao: chaves.length ? conq.length/chaves.length : 0,
                   concluido: chaves.length > 0 && conq.length === chaves.length,
                   iniciado: abertas.some(k=>estado.caixas[k].tentativas > 0) };
        }; return m; } },
    { como: 'agendar deixa o recorde acompanhar a queda em vez de guardar o máximo',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.agendar;
        m.E.agendar = (estado, chave, nota, agora, ev)=>{
          const d = real(estado, chave, nota, agora, ev);
          estado.caixas[chave].recorde = estado.caixas[chave].caixa;
          return d;
        }; return m; } },
    { como: 'agendar nunca registra recorde nenhum',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.agendar;
        m.E.agendar = (estado, chave, nota, agora, ev)=>{
          const d = real(estado, chave, nota, agora, ev);
          estado.caixas[chave].recorde = 0;
          return d;
        }; return m; } }
  ]
});

/* ---------- 4. CONQUISTA ---------- */
PROVAS.push({
  nome: 'CONQUISTA · a etapa fecha quando TODOS os mecanismos dela fecham',
  roda(s){
    const { g, E, P } = s;

    /* --- no conteúdo real: as caixas PARTICIONAM. ---
       Recortes se sobrepõem — o do potencial de membrana contém o do
       gradiente inteiro. Sem regra de posse o progresso somava 85 de 58. */
    const idx = E.indexar(g);
    const estadoReal = semearTudo(s, T0);
    const dono = {};
    Object.keys(g.mecanismos).sort().forEach(id=>{
      const minhas = P.caixasDoMecanismo(g, id, idx);
      exigir(minhas.length > 0,
        `o mecanismo "${id}" não é dono de caixa nenhuma: ele duplica outro recorte`);
      minhas.forEach(k=>{
        exigir(!dono[k], `a caixa "${k}" é contada em "${dono[k]}" e em "${id}"`);
        dono[k] = id;
      });
    });
    Object.keys(estadoReal.caixas).forEach(k=>
      exigir(dono[k], `a caixa "${k}" foi semeada e não é de mecanismo nenhum`));
    exigir(Object.keys(dono).length === Object.keys(estadoReal.caixas).length,
      `${Object.keys(dono).length} caixas com dono contra ${Object.keys(estadoReal.caixas).length} semeadas`);

    /* --- na fixture, onde a etapa 1 tem DOIS mecanismos --- */
    const f = fixtureLarga();
    const idxF = E.indexar(f);
    const { camadas } = P.etapas(f);
    exigir(camadas[0].length >= 2,
      'a fixture precisa de dois mecanismos na primeira etapa, senão `todos` e `algum` coincidem');

    /* Nada semeado: nada conquistado, mas o percurso inteiro já aparece —
       ver o fim desde o começo é metade do que a barra serve para fazer. */
    const vazio = P.percurso(f, E.novoEstado(), T0, idxF);
    exigir(vazio.etapas.length === camadas.length,
      `o percurso mostrou ${vazio.etapas.length} etapas de ${camadas.length}`);
    vazio.etapas.forEach(e=>{
      exigir(e.total > 0, `etapa ${e.numero} sem caixa nenhuma a conquistar`);
      exigir(e.conquistadas === 0 && !e.concluida && !e.iniciada,
        `etapa ${e.numero} veio com progresso antes de qualquer estudo`);
    });

    /* Um mecanismo inteiro conquistado e o outro pela metade: a etapa NÃO
       fecha, e a conta dela é a soma dos dois — não a do primeiro. */
    const primeiro = camadas[0][0], segundo = camadas[0][1];
    const st = E.novoEstado();
    E.semear(f, st, primeiro, T0, idxF);
    E.semear(f, st, segundo, T0, idxF);
    elevar(E, st, P.caixasDoMecanismo(f, primeiro, idxF), P.CAIXA_FIRME);
    const doSegundo = P.caixasDoMecanismo(f, segundo, idxF);
    exigir(doSegundo.length >= 2, `"${segundo}" tem caixas de menos para ficar pela metade`);
    elevar(E, st, doSegundo.slice(0, Math.floor(doSegundo.length / 2)), P.CAIXA_FIRME);

    const pp = P.percurso(f, st, T0, idxF);
    const achar = (e, id) => e.mecanismos.find(mm=>mm.mecanismo === id);
    exigir(achar(pp.etapas[0], primeiro).concluido,
      `"${primeiro}" teve todas as caixas conquistadas e não fechou`);
    const meio = achar(pp.etapas[0], segundo);
    exigir(meio.conquistadas > 0 && meio.conquistadas < meio.total,
      `"${segundo}" deveria estar pela metade; está em ${meio.conquistadas}/${meio.total}`);
    exigir(!meio.concluido, `"${segundo}" fechou com ${meio.conquistadas} de ${meio.total}`);
    exigir(!pp.etapas[0].concluida,
      `a etapa 1 fechou com "${segundo}" pela metade`);
    exigir(pp.etapas[0].iniciada, 'a etapa 1 tem mecanismo conquistado e não consta como iniciada');
    exigir(pp.etapas.slice(1).every(e=>!e.concluida),
      'etapa posterior fechou com caixas nunca semeadas');

    /* As contas fecham em todos os níveis. */
    let soma = 0;
    pp.etapas.forEach(e=>{
      const dos = e.mecanismos.reduce((n, mm)=>n + mm.conquistadas, 0);
      const tot = e.mecanismos.reduce((n, mm)=>n + mm.total, 0);
      exigir(e.conquistadas === dos,
        `etapa ${e.numero}: ${e.conquistadas} conquistadas contra ${dos} somadas dos mecanismos`);
      exigir(e.total === tot, `etapa ${e.numero}: total ${e.total} contra ${tot} somado`);
      exigir(e.concluida === e.mecanismos.every(mm=>mm.concluido),
        `etapa ${e.numero}: "concluída" não bate com o estado dos mecanismos`);
      soma += dos;
    });
    exigir(pp.conquistadas === soma,
      `o percurso soma ${pp.conquistadas} conquistadas contra ${soma} das etapas`);
    exigir(pp.etapasConcluidas === pp.etapas.filter(e=>e.concluida).length,
      'a contagem de etapas concluídas não bate com as etapas concluídas');

    /* O PESO de cada etapa. Contar etapa não é contar progresso: no conteúdo
       real a etapa 3 sozinha carrega a maioria das caixas, e uma trilha de
       degraus iguais diria que fechar as duas primeiras é a maior parte do
       caminho quando é menos de um terço dele. */
    let somaDosPesos = 0;
    pp.etapas.forEach(e=>{
      exigir(Math.abs(e.peso - e.total / pp.total) < 1e-9,
        `etapa ${e.numero}: peso ${e.peso} não é a fração ${e.total}/${pp.total} do percurso`);
      somaDosPesos += e.peso;
    });
    exigir(Math.abs(somaDosPesos - 1) < 1e-9,
      `os pesos das etapas somam ${somaDosPesos}, e teriam de somar 1`);

    /* E no conteúdo real os pesos são DESIGUAIS — é o fato que motivou o
       campo existir. Se um dia ficarem iguais, esta prova avisa que a
       assimetria sumiu e a correção deixou de ser necessária. */
    const real = P.percurso(g, estadoReal, T0, idx);
    const pesos = real.etapas.map(e=>e.peso);
    exigir(Math.max(...pesos) - Math.min(...pesos) > 0.05,
      'as etapas do conteúdo real têm peso praticamente igual: a trilha de degraus iguais não mentiria');

    /* Conteúdo NOVO reabre o que estava fechado. O denominador é o total de
       caixas do mecanismo, não o que já foi semeado — senão a Fase D
       acrescentaria transições e a barra continuaria dizendo "concluído". */
    const antes = P.conquistaDoMecanismo(f, st, primeiro, idxF);
    exigir(antes.concluido, 'o preparo da prova de conteúdo novo não fechou o mecanismo');
    const f2 = clonar(f);
    f2.nos.a0 = { id:'a0', descricao:'Nó a0' };
    f2.transicoes.push(TR('a0', 'a1'));            // entra no recorte de alfa
    const idx2 = E.indexar(f2);
    const depois = P.conquistaDoMecanismo(f2, st, primeiro, idx2);
    exigir(depois.total > antes.total,
      `o conteúdo novo não aumentou o total de "${primeiro}" (${antes.total} → ${depois.total})`);
    exigir(depois.semeadas < depois.total,
      'o conteúdo novo apareceu como já semeado');
    exigir(!depois.concluido,
      `"${primeiro}" continuou concluído depois de ganhar transição nova nunca estudada`);

    /* A régua de uma linha só reflete o estado. */
    const t = P.trilha(pp);
    exigir(t.startsWith('[◐]'), `a trilha começou com "${t.slice(0, 3)}" com a etapa 1 pela metade`);
    exigir(t.split('──').length === pp.etapas.length, 'a trilha tem número de degraus diferente do percurso');
  },
  mutantes: [
    { como: 'a etapa fecha quando ALGUM mecanismo dela fecha',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>{
          const p = real(g, estado, agora, idx);
          p.etapas.forEach(e=>{ e.concluida = e.mecanismos.some(mm=>mm.concluido); });
          return p;
        }; return m; } },
    { como: 'a conquista mede sobre as caixas semeadas, não sobre o total',
      aplicar(s){ const m = clonarSujeito(s);
        m.P.conquistaDoMecanismo = (g, estado, mecId, idx)=>{
          const chaves = m.P.caixasDoMecanismo(g, mecId, idx);
          const abertas = chaves.filter(k=>estado.caixas[k]);
          const conq = abertas.filter(k=>(estado.caixas[k].recorde || 0) >= m.P.CAIXA_FIRME);
          return { mecanismo:mecId, total:abertas.length, semeadas:abertas.length,
                   conquistadas:conq.length, fracao: abertas.length ? conq.length/abertas.length : 0,
                   concluido: abertas.length > 0 && conq.length === abertas.length,
                   iniciado: abertas.some(k=>estado.caixas[k].tentativas > 0) };
        }; return m; } },
    { como: 'todas as etapas pesam igual (é a mentira que a trilha de degraus iguais conta)',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>{
          const p = real(g, estado, agora, idx);
          p.etapas.forEach(e=>{ e.peso = p.etapas.length ? 1 / p.etapas.length : 0; });
          return p;
        }; return m; } },
    { como: 'o percurso soma as conquistas da etapa errado',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>{
          const p = real(g, estado, agora, idx);
          p.etapas.forEach(e=>{ e.conquistadas = e.mecanismos.length ? e.mecanismos[0].conquistadas : 0; });
          return p;
        }; return m; } }
  ]
});

/* ---------- 5. SEPARAÇÃO ---------- */
PROVAS.push({
  nome: 'SEPARAÇÃO · a revisão de hoje viaja ao lado da conquista, nunca dentro',
  roda(s){
    const { g, E, P } = s;
    const idx = E.indexar(g);
    const estado = semearTudo(s, T0);
    const todas = Object.keys(estado.caixas);
    elevar(E, estado, todas, P.CAIXA_FIRME);

    const conquistado = P.percurso(g, estado, T0, idx);
    exigir(conquistado.conquistadas === todas.length,
      `${conquistado.conquistadas}/${todas.length} conquistadas depois de elevar tudo`);

    /* Um ano depois tudo está vencido. A conquista não muda um número. */
    const daquiUmAno = T0 + 365 * E.DIA;
    const vencido = P.percurso(g, estado, daquiUmAno, idx);
    exigir(vencido.revisoesHoje === todas.length,
      `um ano depois só ${vencido.revisoesHoje} de ${todas.length} caixas voltaram para revisão`);
    exigir(vencido.conquistadas === conquistado.conquistadas,
      `a conquista mudou de ${conquistado.conquistadas} para ${vencido.conquistadas} só porque venceu`);
    vencido.etapas.forEach((e, i)=>{
      exigir(e.concluida === conquistado.etapas[i].concluida,
        `etapa ${e.numero} mudou de estado só porque a revisão venceu`);
      exigir(e.conquistadas === conquistado.etapas[i].conquistadas,
        `etapa ${e.numero}: conquista mudou com o vencimento`);
    });
    exigir(P.trilha(vencido) === P.trilha(conquistado),
      'a trilha do percurso mudou só porque as revisões venceram');

    /* E no instante em que tudo está em dia, `revisoesHoje` é zero sem a
       conquista virar zero junto. */
    exigir(conquistado.revisoesHoje === 0,
      `${conquistado.revisoesHoje} revisões vencidas logo depois de estudar tudo`);
    exigir(conquistado.conquistadas > 0, 'estudar tudo não conquistou nada');
  },
  mutantes: [
    { como: 'o percurso desconta do troféu o que está vencido',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>{
          const p = real(g, estado, agora, idx);
          p.conquistadas = Math.max(0, p.conquistadas - p.revisoesHoje);
          p.etapas.forEach(e=>{
            const vencidasDaEtapa = e.mecanismos.reduce((n, mm)=>
              n + m.P.caixasDoMecanismo(g, mm.mecanismo, idx)
                   .filter(k=>estado.caixas[k] && estado.caixas[k].vencimento <= agora).length, 0);
            e.conquistadas = Math.max(0, e.conquistadas - vencidasDaEtapa);
            e.concluida = e.conquistadas === e.total;
          });
          return p;
        }; return m; } },
    { como: 'o percurso esquece de contar as revisões de hoje',
      aplicar(s){ const m = clonarSujeito(s); const real = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>
          Object.assign({}, real(g, estado, agora, idx), { revisoesHoje: 0 }); return m; } },
    { como: 'a conquista só conta caixa que não esteja vencida',
      aplicar(s){ const m = clonarSujeito(s);
        m.P.conquistaDoMecanismo = (g, estado, mecId, idx)=>{
          const chaves = m.P.caixasDoMecanismo(g, mecId, idx);
          const abertas = chaves.filter(k=>estado.caixas[k]);
          const conq = abertas.filter(k=>(estado.caixas[k].recorde || 0) >= m.P.CAIXA_FIRME);
          return { mecanismo:mecId, total:chaves.length, semeadas:abertas.length,
                   conquistadas:conq.length, fracao: chaves.length ? conq.length/chaves.length : 0,
                   concluido: chaves.length > 0 && conq.length === chaves.length,
                   iniciado: abertas.some(k=>estado.caixas[k].tentativas > 0) };
        };
        const realP = s.P.percurso;
        m.P.percurso = (g, estado, agora, idx)=>{
          const p = realP(g, estado, agora, idx);
          p.etapas.forEach(e=>e.mecanismos.forEach(mm=>{
            const emDia = m.P.caixasDoMecanismo(g, mm.mecanismo, idx)
              .filter(k=>estado.caixas[k] && (estado.caixas[k].recorde || 0) >= m.P.CAIXA_FIRME &&
                         estado.caixas[k].vencimento > agora);
            mm.conquistadas = emDia.length;
            mm.concluido = mm.total > 0 && emDia.length === mm.total;
          }));
          p.etapas.forEach(e=>{
            e.conquistadas = e.mecanismos.reduce((n, mm)=>n + mm.conquistadas, 0);
            e.concluida = e.mecanismos.every(mm=>mm.concluido);
          });
          p.conquistadas = p.etapas.reduce((n, e)=>n + e.conquistadas, 0);
          return p;
        }; return m; } }
  ]
});

/* ===================================================================== */
const base = sujeito();
let falhou = false, mutantesMortos = 0, mutantesVivos = 0;

{
  const r = base.P.etapas(base.g);
  console.log(`percurso: ${r.camadas.length} etapa(s) · ` +
              r.camadas.map((ids, i)=>`${i + 1}: ${ids.join(', ')}`).join(' · ') + '\n');
}

for(const prova of PROVAS){
  const antes = checagens;
  try {
    prova.roda(base);
  } catch(e){
    falhou = true;
    console.error(`✕ ${prova.nome}`);
    console.error(`    ${e instanceof Falha ? e.message : (e.stack || e)}\n`);
    continue;
  }

  const sobreviventes = [];
  for(const mut of prova.mutantes){
    let morreu = false, motivo = '';
    try {
      prova.roda(mut.aplicar(base));
    } catch(e){
      morreu = true;
      motivo = e instanceof Falha ? e.message : `exceção: ${e.message}`;
    }
    if(morreu){
      mutantesMortos++;
      if(process.env.MOTIVOS) console.log(`    ✝ ${mut.como}\n        → ${motivo}`);
    }
    else { mutantesVivos++; sobreviventes.push(mut.como); }
  }

  if(sobreviventes.length){
    falhou = true;
    console.error(`✕ ${prova.nome}`);
    console.error(`    a prova passa, mas estes mutantes sobreviveram — o teste não morde:`);
    sobreviventes.forEach(m=>console.error(`      · ${m}`));
    console.error('');
  } else {
    console.log(`✓ ${prova.nome}`);
    console.log(`    ${checagens - antes} checagens · ${prova.mutantes.length} mutantes mortos`);
  }
}

console.log('');
if(falhou){
  console.error(`Percurso: FALHOU (${mutantesVivos} mutante(s) vivo(s))`);
  process.exit(1);
}
console.log(`Percurso: ok — ${PROVAS.length} propriedades, ${checagens} checagens, ${mutantesMortos} mutantes mortos`);
