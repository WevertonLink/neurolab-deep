#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão do cronograma

   As cinco propriedades que a Fase B existe para provar:

     1. ENDEREÇO      — a caixa é transição × operação, e existe caixa
                        exatamente para as operações mensuráveis.
     2. MENSURABILIDADE — quais operações valem sai do GRAFO, não de campo
                        declarado no conteúdo.
     3. LOTE          — uma atividade que responde a mesma caixa N vezes
                        gera UMA decisão de intervalo, pela média.
     4. LEITNER       — o intervalo mede retenção: acertar fora do
                        vencimento não promove, e errar não zera a estrada.
     5. PLANO         — a sessão é derivada do que está vencido.

   Mesma disciplina do portão do motor: cada prova roda no grafo real (tem
   de passar) e em mutantes (têm de falhar). Mutante vivo reprova o TESTE.

   `MOTIVOS=1 node tools/test-estudo.js` mostra por que cada mutante morreu.
   Morrer de `exceção:` em vez de asserção é morte acidental e não prova
   nada.

   Uso: node tools/test-estudo.js
   ===================================================================== */
const G = require('../src/grafo.js');
const EST = require('../src/estudo.js');

/* ---------- utilitários do portão ---------- */
class Falha extends Error {}
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) throw new Falha(msg); };
const clonar = o => JSON.parse(JSON.stringify(o));

const sujeito = ()=>({ g: G.carregar(), E: EST });
const clonarSujeito = s => ({ g: clonar(s.g), E: Object.assign({}, s.E) });

/* O relógio é sempre explícito. Nenhuma prova aqui depende de `Date.now()`. */
const T0 = Date.UTC(2026, 7, 16, 9, 0, 0);
const DIAS = n => n * EST.DIA;

/* ---------- fixture ----------
   O conteúdo real não exercita todos os ramos da mensurabilidade: lá, toda
   entidade declarada em `requer` de fato derruba alcance quando some, e
   não existe par de transições inversas. Uma regra que só rodasse sobre ele
   passaria por acidente. Esta fixture força cada ramo a decidir:

     a→c  entidade viva   → única rota até c; removê-la perde alcance
     a→b  entidade inerte → b também chega por c; removê-la não perde nada
     b→d / d→b            → inversas uma da outra; inverter não é erro
     p→q                  → recorte de 2 nós; não há ordem a construir, e a
                            entidade dele derruba o recorte INTEIRO menos um
                            nó: sem sobrevivente não há distrator possível
     x→y                  → fora de todo mecanismo; nada a estudar
*/
function T(de, para, requer, certeza){
  return { de, para, tipo:'causa', certeza: certeza || 'consolidado', requer: requer || [],
           porque:'Justificativa sintética da fixture, longa o suficiente para o mínimo do formato.',
           _arquivo:'fixture.json', _i:0 };
}
function fixture(){
  return {
    entidades: { 'ent-viva':   { id:'ent-viva',   nome:'Entidade viva' },
                 'ent-inerte': { id:'ent-inerte', nome:'Entidade inerte' },
                 'ent-total':  { id:'ent-total',  nome:'Entidade total' } },
    nos: ['a','b','c','d','p','q','x','y'].reduce((o, id)=>{
      o[id] = { id, descricao:'Nó ' + id.toUpperCase() }; return o;
    }, {}),
    transicoes: [
      T('a','c', ['ent-viva']),
      T('a','b', ['ent-inerte']),
      T('c','b', [], 'debatido'),
      T('b','d', [], 'hipotese'),
      T('d','b', []),
      T('p','q', ['ent-total']),
      T('x','y', [])
    ],
    mecanismos: {
      fix:  { id:'fix',  entrada:'a', terminal:'d',
              fenomeno:'fixture', limites:'fixture sintética do portão, sem valor de conteúdo' },
      mini: { id:'mini', entrada:'p', terminal:'q',
              fenomeno:'fixture mínima', limites:'fixture sintética do portão, sem valor de conteúdo' }
    },
    origem: {}, arquivos: []
  };
}
const acharT = (g, de, para) => g.transicoes.find(t=>t.de === de && t.para === para);

/* Um `semear` parametrizado, para os mutantes de endereço e de derivação
   dizerem em uma linha o que estão quebrando. */
function semearComo(E, opsDe, endereco, sobrescrever){
  return (g, estado, mecanismoId, agora, idx)=>{
    idx = idx || E.indexar(g);
    const sg = idx[mecanismoId];
    const criadas = [], jaExistiam = [];
    if(!sg) return { criadas, jaExistiam };
    sg.transicoes.forEach(t=>opsDe(g, t, idx).forEach(op=>{
      const chave = endereco(t, op);
      if(estado.caixas[chave] && !sobrescrever){ jaExistiam.push(chave); return; }
      estado.caixas[chave] = { caixa:0, vencimento:agora, tentativas:0, evidencias:0,
                               ultimaNota:null, ultimoEstudo:null };
      criadas.push(chave);
    }));
    return { criadas, jaExistiam };
  };
}

/* Semeia tudo e devolve o estado. */
function semearTudo(s, agora){
  const idx = s.E.indexar(s.g);
  const estado = s.E.novoEstado();
  Object.keys(s.g.mecanismos).sort().forEach(id=>s.E.semear(s.g, estado, id, agora, idx));
  return estado;
}

/* Responde um lote inteiro com a mesma nota. */
function responder(s, estado, chaves, nota, agora){
  const porTransicao = {};
  s.g.transicoes.forEach(t=>{ porTransicao[s.E.chaveDaTransicao(t)] = t; });
  const lote = s.E.iniciarLote();
  chaves.forEach(chave=>{
    const { de, para, operacao } = s.E.lerChave(chave);
    s.E.anotar(lote, porTransicao[de + '>' + para], operacao, nota);
  });
  return s.E.fecharLote(s.g, estado, lote, agora);
}

/* ===================================================================== */
const PROVAS = [];

/* ---------- 1. ENDEREÇO ---------- */
PROVAS.push({
  nome: 'ENDEREÇO · a caixa é transição × operação, e só as mensuráveis',
  roda(s){
    const { g, E } = s;
    const idx = E.indexar(g);
    const estado = semearTudo(s, T0);

    exigir(Object.keys(estado.caixas).length > 0, 'semeadura não abriu caixa nenhuma');

    /* A equivalência é a propriedade inteira: existe caixa se, e somente
       se, a operação é mensurável naquela transição. */
    let esperadas = 0;
    for(const t of g.transicoes){
      const mensuraveis = E.operacoesMensuraveis(g, t, idx);
      esperadas += mensuraveis.length;
      for(const op of E.OPERACOES){
        const existe = !!estado.caixas[E.chaveDaCaixa(t, op)];
        exigir(existe === mensuraveis.includes(op),
          `${t.de} → ${t.para} · ${op}: caixa ${existe ? 'existe' : 'não existe'} mas a operação ` +
          `${mensuraveis.includes(op) ? 'é' : 'não é'} mensurável neste grafo`);
      }
    }
    exigir(Object.keys(estado.caixas).length === esperadas,
      `${Object.keys(estado.caixas).length} caixas para ${esperadas} pares mensuráveis: sobrou endereço sem dono`);

    /* Todo endereço lê de volta para uma transição real e uma operação real. */
    for(const chave of Object.keys(estado.caixas)){
      const { de, para, operacao } = E.lerChave(chave);
      exigir(E.OPERACOES.includes(operacao), `endereço "${chave}": operação "${operacao}" não existe`);
      exigir(!!acharT(g, de, para), `endereço "${chave}": não há transição "${de} → ${para}"`);
    }

    /* Semear de novo não duplica nem apaga o que já foi estudado. É o que
       torna seguro semear um mecanismo cujo recorte cobre outro — no
       conteúdo real isso acontece, porque a composição atravessa arquivos. */
    const algumaChave = Object.keys(estado.caixas).sort()[0];
    responder(s, estado, [algumaChave], true, T0);
    const antes = clonar(estado.caixas[algumaChave]);
    exigir(antes.tentativas === 1, 'o preparo da re-semeadura não chegou a estudar a caixa');

    let reabertas = 0, reencontradas = 0;
    Object.keys(g.mecanismos).sort().forEach(id=>{
      const r = E.semear(g, estado, id, T0, idx);
      reabertas += r.criadas.length; reencontradas += r.jaExistiam.length;
    });
    exigir(reabertas === 0, `a segunda semeadura abriu ${reabertas} caixa(s) que já existiam`);
    exigir(reencontradas > 0, 'a segunda semeadura não reconheceu nenhuma caixa existente');
    exigir(Object.keys(estado.caixas).length === esperadas,
      `a segunda semeadura mudou o total de caixas para ${Object.keys(estado.caixas).length}`);
    exigir(estado.caixas[algumaChave].caixa === antes.caixa &&
           estado.caixas[algumaChave].tentativas === antes.tentativas &&
           estado.caixas[algumaChave].vencimento === antes.vencimento,
      `re-semear apagou o progresso de "${algumaChave}"`);
  },
  mutantes: [
    { como: 'semear abre as quatro operações sempre, sem derivar mensurabilidade',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.semear = semearComo(m.E, ()=>m.E.OPERACOES, m.E.chaveDaCaixa, false); return m; } },
    { como: 'o endereço da caixa esquece a operação (as quatro caem na mesma caixa)',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.semear = semearComo(m.E, (g,t,idx)=>m.E.operacoesMensuraveis(g,t,idx),
                                t=>m.E.chaveDaTransicao(t), false); return m; } },
    { como: 'semear sobrescreve caixa existente em vez de preservá-la',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.semear = semearComo(m.E, (g,t,idx)=>m.E.operacoesMensuraveis(g,t,idx),
                                m.E.chaveDaCaixa, true); return m; } }
  ]
});

/* ---------- 2. MENSURABILIDADE ---------- */
PROVAS.push({
  nome: 'MENSURABILIDADE · quais operações valem sai do grafo, não do conteúdo',
  roda(s){
    const { g, E } = s;

    /* --- no conteúdo real --- */
    const idx = E.indexar(g);
    const comPerturbar = g.transicoes.filter(t=>E.operacoesMensuraveis(g, t, idx).includes('perturbar'));
    exigir(comPerturbar.length > 0, 'nenhuma transição perturbável: a operação nunca seria exercitada');
    exigir(comPerturbar.length < g.transicoes.length,
      'todas as transições são perturbáveis — a regra não está discriminando nada');
    comPerturbar.forEach(t=>exigir((t.requer||[]).length > 0,
      `${t.de} → ${t.para}: perturbável sem declarar entidade em \`requer\``));

    /* Tirar `requer` do conteúdo tem de apagar `perturbar`, e só ela. Se a
       operação sobrevivesse, ela não estaria vindo do grafo. */
    const semRequer = clonar(g);
    semRequer.transicoes.forEach(t=>{ t.requer = []; });
    const idxSem = E.indexar(semRequer);
    semRequer.transicoes.forEach(t=>{
      const ops = E.operacoesMensuraveis(semRequer, t, idxSem);
      exigir(!ops.includes('perturbar'),
        `${t.de} → ${t.para}: continua perturbável mesmo sem entidade nenhuma declarada`);
    });

    /* --- na fixture, onde cada ramo é forçado a decidir --- */
    const f = fixture();
    const idxF = E.indexar(f);
    const ops = (de, para) => E.operacoesMensuraveis(f, acharT(f, de, para), idxF).sort().join(',');

    exigir(ops('a','c') === 'construir,depurar,perturbar,reconstruir',
      `a→c deveria medir as quatro; mediu "${ops('a','c')}"`);
    exigir(ops('a','b') === 'construir,depurar,reconstruir',
      `a→b tem \`requer\`, mas remover a entidade não perde alcance: não é perturbável. Mediu "${ops('a','b')}"`);
    exigir(ops('b','d') === 'construir,reconstruir',
      `b→d tem inversa no grafo: inverter não é erro, logo não é depurável. Mediu "${ops('b','d')}"`);
    exigir(ops('d','b') === 'construir,reconstruir',
      `d→b tem inversa no grafo: inverter não é erro, logo não é depurável. Mediu "${ops('d','b')}"`);
    exigir(ops('p','q') === 'depurar',
      `p→q mora num recorte de 2 nós (nada a ordenar) e a entidade dele não deixa sobrevivente ` +
      `(nenhum distrator possível, "marcar tudo" acertaria). Mediu "${ops('p','q')}"`);
    exigir(ops('x','y') === '',
      `x→y está fora de todo mecanismo: não há recorte onde estudá-la. Mediu "${ops('x','y')}"`);

    /* E o que a fixture afirma tem de valer também depois de semeada: a
       caixa só existe onde a operação mede. */
    const estado = E.novoEstado();
    Object.keys(f.mecanismos).sort().forEach(id=>E.semear(f, estado, id, T0, idxF));
    exigir(!estado.caixas[E.chaveDaCaixa(acharT(f,'a','b'), 'perturbar')],
      'a fixture abriu caixa de perturbar para uma transição cuja entidade não derruba nada');
    exigir(!estado.caixas[E.chaveDaCaixa(acharT(f,'b','d'), 'depurar')],
      'a fixture abriu caixa de depurar para uma transição que tem inversa verdadeira');
    exigir(!estado.caixas[E.chaveDaCaixa(acharT(f,'x','y'), 'depurar')],
      'a fixture abriu caixa para uma transição fora de todo mecanismo');
  },
  mutantes: [
    { como: 'operacoesMensuraveis devolve as quatro sempre (declarado, não derivado)',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.operacoesMensuraveis = ()=>m.E.OPERACOES.slice(); return m; } },
    { como: 'perturbar basta ter `requer`, sem conferir se a remoção perde alcance',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.operacoesMensuraveis;
        m.E.operacoesMensuraveis = (g, t, idx)=>{
          const ops = real(g, t, idx).filter(o=>o !== 'perturbar');
          if(!ops.length) return ops;                        // fora de mecanismo continua fora
          if((t.requer||[]).length) ops.push('perturbar');
          return ops;
        }; return m; } },
    { como: 'perturbar não exige sobreviventes (entidade que derruba tudo vira pergunta sem distrator)',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.operacoesMensuraveisEm;
        m.E.operacoesMensuraveisEm = (g, t, mecId, idx)=>{
          const ops = real(g, t, mecId, idx);
          const sg = (idx || m.E.indexar(g))[mecId];
          if(!sg || !sg.transicoes.includes(t) || ops.includes('perturbar')) return ops;
          const derruba = (t.requer||[]).some(entidade=>
            s.E.indexar && G.perturbar(g, { entidade }, sg.mecanismo.entrada)
              .perdidos.filter(n=>sg.nos.has(n)).length > 0);
          return derruba ? ops.concat(['perturbar']) : ops;
        };
        m.E.operacoesMensuraveis = (g, t, idx)=>{
          idx = idx || m.E.indexar(g);
          const vistas = new Set();
          m.E.mecanismosDe(g, t, idx).forEach(id=>
            m.E.operacoesMensuraveisEm(g, t, id, idx).forEach(o=>vistas.add(o)));
          return m.E.OPERACOES.filter(o=>vistas.has(o));
        };
        return m; } },
    { como: 'depurar ignora se a transição inversa já existe no grafo',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.operacoesMensuraveis;
        m.E.operacoesMensuraveis = (g, t, idx)=>{
          const ops = real(g, t, idx);
          if(ops.length && !ops.includes('depurar')) ops.push('depurar');
          return ops;
        }; return m; } }
  ]
});

/* ---------- 3. LOTE ---------- */
PROVAS.push({
  nome: 'LOTE · uma atividade responde N vezes e decide UM intervalo, pela média',
  roda(s){
    const { g, E } = s;
    const idx = E.indexar(g);
    const t = g.transicoes[0];
    const chave = E.chaveDaCaixa(t, 'reconstruir');

    /* Caso A — média 0.8 (o mínimo para passar), com o erro na frente.
       Se cada evidência virasse uma decisão, o erro da primeira rebaixaria
       e os acertos seguintes não promoveriam (já não estaria vencida). */
    const a = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, a, id, T0, idx));
    exigir(!!a.caixas[chave], 'a caixa escolhida para o teste de lote não foi semeada');
    let lote = E.iniciarLote();
    [false, true, true, true, true].forEach(n=>E.anotar(lote, t, 'reconstruir', n));
    let r = E.fecharLote(g, a, lote, T0);

    exigir(r.decididas.length === 1, `${r.decididas.length} decisões de intervalo para uma caixa só`);
    exigir(Math.abs(r.decididas[0].nota - 0.8) < 1e-9,
      `a nota do lote foi ${r.decididas[0].nota}, esperava a média 0.8`);
    exigir(a.caixas[chave].tentativas === 1,
      `${a.caixas[chave].tentativas} tentativas: o lote virou uma decisão por evidência`);
    exigir(a.caixas[chave].evidencias === 5,
      `${a.caixas[chave].evidencias} evidências registradas, esperava 5`);
    exigir(a.caixas[chave].caixa === 1,
      `média 0.8 é a nota de corte e deveria promover; a caixa ficou em ${a.caixas[chave].caixa}`);

    /* Caso B — média 0.6 com acertos no fim: quem usa a última resposta em
       vez da média promove aqui, e não deveria. */
    const b = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, b, id, T0, idx));
    lote = E.iniciarLote();
    [false, false, true, true, true].forEach(n=>E.anotar(lote, t, 'reconstruir', n));
    r = E.fecharLote(g, b, lote, T0);
    exigir(Math.abs(r.decididas[0].nota - 0.6) < 1e-9,
      `a nota do lote foi ${r.decididas[0].nota}, esperava a média 0.6`);
    exigir(b.caixas[chave].caixa === 0,
      `média 0.6 está abaixo do corte e não pode promover; a caixa foi para ${b.caixas[chave].caixa}`);

    /* Uma atividade de verdade liquida muitas caixas de uma vez, cada uma
       com a sua decisão — é isso que paga o agrupamento por mecanismo. */
    const c = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, c, id, T0, idx));
    const daOperacao = Object.keys(c.caixas).filter(k=>E.lerChave(k).operacao === 'reconstruir');
    exigir(daOperacao.length > 1, 'a operação escolhida tem uma caixa só; o lote não seria testado');
    const rc = responder(s, c, daOperacao, true, T0);
    exigir(rc.decididas.length === daOperacao.length,
      `${rc.decididas.length} decisões para ${daOperacao.length} caixas`);
    daOperacao.forEach(k=>exigir(c.caixas[k].tentativas === 1,
      `caixa "${k}" recebeu ${c.caixas[k].tentativas} decisões numa atividade só`));

    /* Caixa não semeada não é criada de contrabando pelo fechamento. */
    const d = E.novoEstado();
    const solto = E.iniciarLote();
    E.anotar(solto, t, 'reconstruir', true);
    const rd = E.fecharLote(g, d, solto, T0);
    exigir(rd.ignoradas.length === 1 && rd.decididas.length === 0,
      'fechar lote sobre caixa não semeada deveria devolvê-la em `ignoradas`');
    exigir(Object.keys(d.caixas).length === 0,
      'fechar o lote criou caixa que a semeadura não abriu');

    /* O lote fecha uma vez só: fechar duas vezes contaria a mesma sessão duas vezes. */
    let reabriu = false;
    try { E.fecharLote(g, d, solto, T0); reabriu = true; } catch(e){ /* esperado */ }
    exigir(!reabriu, 'o mesmo lote foi fechado duas vezes sem reclamar');
  },
  mutantes: [
    { como: 'fecharLote decide um intervalo por evidência, em vez de um por caixa',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.fecharLote = (g, estado, lote, agora)=>{
          if(!lote || !lote.aberto) throw new Error('lote inexistente ou já fechado');
          lote.aberto = false;
          const decididas = [], ignoradas = [];
          Object.keys(lote.notas).sort().forEach(chave=>{
            if(!estado.caixas[chave]){ ignoradas.push(chave); return; }
            lote.notas[chave].forEach(n=>decididas.push(m.E.agendar(estado, chave, n, agora, 1)));
          });
          return { decididas, ignoradas };
        }; return m; } },
    { como: 'fecharLote usa a última resposta do lote em vez da média',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.fecharLote = (g, estado, lote, agora)=>{
          if(!lote || !lote.aberto) throw new Error('lote inexistente ou já fechado');
          lote.aberto = false;
          const decididas = [], ignoradas = [];
          Object.keys(lote.notas).sort().forEach(chave=>{
            if(!estado.caixas[chave]){ ignoradas.push(chave); return; }
            const notas = lote.notas[chave];
            decididas.push(m.E.agendar(estado, chave, notas[notas.length - 1], agora, notas.length));
          });
          return { decididas, ignoradas };
        }; return m; } },
    { como: 'fecharLote cria em silêncio a caixa que a semeadura não abriu',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.fecharLote = (g, estado, lote, agora)=>{
          if(!lote || !lote.aberto) throw new Error('lote inexistente ou já fechado');
          lote.aberto = false;
          const decididas = [];
          Object.keys(lote.notas).sort().forEach(chave=>{
            if(!estado.caixas[chave]){
              estado.caixas[chave] = { caixa:0, vencimento:agora, tentativas:0, evidencias:0,
                                       ultimaNota:null, ultimoEstudo:null };
            }
            const notas = lote.notas[chave];
            decididas.push(m.E.agendar(estado, chave, notas.reduce((x,y)=>x+y,0)/notas.length, agora, notas.length));
          });
          return { decididas, ignoradas: [] };
        }; return m; } }
  ]
});

/* ---------- 4. LEITNER ---------- */
PROVAS.push({
  nome: 'LEITNER · o intervalo mede retenção, e o tropeço não zera a estrada',
  roda(s){
    const { g, E } = s;
    const idx = E.indexar(g);
    const chave = E.chaveDaCaixa(g.transicoes[0], 'reconstruir');
    const novo = ()=>{ const e = E.novoEstado();
      Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, e, id, T0, idx)); return e; };

    /* Acertar vencida promove, uma caixa por vez, até o teto. E o
       vencimento cresce junto — é o intervalo que carrega o significado. */
    const sobe = novo();
    let agora = T0, anterior = -1, ultimoIntervalo = 0;
    for(let i = 0; i < E.INTERVALOS.length + 2; i++){
      const c = sobe.caixas[chave];
      exigir(c.vencimento <= agora, `passo ${i}: a caixa não estava vencida quando devia estar`);
      const antes = c.caixa;
      const d = E.agendar(sobe, chave, 1, agora, 1);
      exigir(c.caixa === Math.min(antes + 1, E.INTERVALOS.length - 1),
        `passo ${i}: acerto no vencimento levou a caixa de ${antes} para ${c.caixa}`);
      exigir(d.estavaVencida, `passo ${i}: a decisão não reconheceu que a caixa estava vencida`);
      const intervalo = c.vencimento - agora;
      if(antes !== E.INTERVALOS.length - 1){
        exigir(intervalo > ultimoIntervalo, `passo ${i}: o intervalo não cresceu ao promover`);
      }
      ultimoIntervalo = intervalo;
      anterior = c.caixa;
      agora = c.vencimento;
    }
    exigir(anterior === E.INTERVALOS.length - 1,
      `a caixa parou em ${anterior}; deveria ter chegado ao teto ${E.INTERVALOS.length - 1}`);

    /* Acertar ANTES do vencimento não promove. Senão dá para subir de
       caixa repetindo no mesmo dia, e o intervalo deixa de medir retenção. */
    const cedo = novo();
    E.agendar(cedo, chave, 1, T0, 1);
    const depoisDoPrimeiro = cedo.caixas[chave].caixa;
    const d2 = E.agendar(cedo, chave, 1, T0 + DIAS(0.5), 1);
    exigir(!d2.estavaVencida, 'meio dia depois a caixa foi considerada vencida');
    exigir(cedo.caixas[chave].caixa === depoisDoPrimeiro,
      `acertar fora do vencimento promoveu de ${depoisDoPrimeiro} para ${cedo.caixas[chave].caixa}`);

    /* Errar cai no máximo até o teto de recaída, venha de onde vier. */
    const alto = novo();
    let quando = T0;
    while(alto.caixas[chave].caixa < E.INTERVALOS.length - 1){
      E.agendar(alto, chave, 1, quando, 1);
      quando = alto.caixas[chave].vencimento;
    }
    exigir(alto.caixas[chave].caixa === E.INTERVALOS.length - 1, 'o preparo não chegou ao teto');
    E.agendar(alto, chave, 0, quando, 1);
    exigir(alto.caixas[chave].caixa === E.TETO_RECAIDA,
      `errar no topo levou a caixa para ${alto.caixas[chave].caixa}, esperava o teto de recaída ${E.TETO_RECAIDA}`);

    const baixo = novo();
    E.agendar(baixo, chave, 0, T0, 1);
    exigir(baixo.caixas[chave].caixa === 0,
      `errar na caixa 0 levou para ${baixo.caixas[chave].caixa}; não existe caixa negativa`);

    /* A folga do vencimento é determinística: o mesmo endereço, no mesmo
       instante, vence no mesmo milissegundo. Sem isso o portão fica
       intermitente e para de valer como portão. */
    for(let i = 0; i < 5; i++){
      const u = novo(), v = novo();
      const du = E.agendar(u, chave, 1, T0, 1);
      const dv = E.agendar(v, chave, 1, T0, 1);
      exigir(du.vencimento === dv.vencimento,
        `mesma caixa, mesmo instante, vencimentos diferentes (${du.vencimento} ≠ ${dv.vencimento})`);
    }
    /* E ela espalha: caixas semeadas no mesmo minuto não vencem todas juntas. */
    const espalha = novo();
    const chaves = Object.keys(espalha.caixas);
    responder(s, espalha, chaves, true, T0);
    const vencimentos = new Set(chaves.map(k=>espalha.caixas[k].vencimento));
    exigir(vencimentos.size > 1,
      'todas as caixas venceram no mesmo instante: o bloco semeado junto nunca se desmancha');
    chaves.forEach(k=>{
      const c = espalha.caixas[k];
      const nominal = E.INTERVALOS[c.caixa] * E.DIA;
      exigir(Math.abs((c.vencimento - T0) - nominal) <= nominal * E.FOLGA + 1,
        `caixa "${k}": vencimento fora da folga de ±${E.FOLGA * 100}%`);
    });
  },
  mutantes: [
    { como: 'agendar promove mesmo respondendo antes do vencimento',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.agendar = (estado, chave, nota, agora, ev)=>{
          const c = estado.caixas[chave];
          const estavaVencida = c.vencimento == null || c.vencimento <= agora;
          const de = c.caixa;
          if(nota >= m.E.PASSA) c.caixa = Math.min(c.caixa + 1, m.E.INTERVALOS.length - 1);
          else c.caixa = Math.max(0, Math.min(c.caixa - 1, m.E.TETO_RECAIDA));
          c.tentativas += 1; c.evidencias += (ev || 1); c.ultimaNota = nota; c.ultimoEstudo = agora;
          c.vencimento = agora + m.E.INTERVALOS[c.caixa] * m.E.DIA;
          return { chave, nota, de, para:c.caixa, estavaVencida, vencimento:c.vencimento };
        }; return m; } },
    { como: 'errar devolve a caixa a zero, apagando a estrada andada',
      aplicar(s){ const m = clonarSujeito(s);
        m.E.agendar = (estado, chave, nota, agora, ev)=>{
          const c = estado.caixas[chave];
          const estavaVencida = c.vencimento == null || c.vencimento <= agora;
          const de = c.caixa;
          if(nota >= m.E.PASSA){ if(estavaVencida) c.caixa = Math.min(c.caixa + 1, m.E.INTERVALOS.length - 1); }
          else c.caixa = 0;
          c.tentativas += 1; c.evidencias += (ev || 1); c.ultimaNota = nota; c.ultimoEstudo = agora;
          c.vencimento = agora + m.E.INTERVALOS[c.caixa] * m.E.DIA;
          return { chave, nota, de, para:c.caixa, estavaVencida, vencimento:c.vencimento };
        }; return m; } },
    { como: 'a folga do vencimento vem de Math.random em vez do endereço',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.agendar;
        m.E.agendar = (estado, chave, nota, agora, ev)=>{
          const d = real(estado, chave, nota, agora, ev);
          const c = estado.caixas[chave];
          c.vencimento = agora + Math.round(m.E.INTERVALOS[c.caixa] * m.E.DIA *
                                            (1 + (Math.random() - 0.5) * 2 * m.E.FOLGA));
          d.vencimento = c.vencimento;
          return d;
        }; return m; } }
  ]
});

/* ---------- 5. PLANO ---------- */
PROVAS.push({
  nome: 'PLANO · a sessão é derivada do que está vencido, não uma lista fixa',
  roda(s){
    const { g, E } = s;
    const idx = E.indexar(g);

    /* Sem nada semeado não há sessão. */
    const vazio = E.planoDeSessao(g, E.novoEstado(), T0, E.TETO_SESSAO, idx);
    exigir(vazio.atividades.length === 0 && vazio.vencidas === 0,
      'estado zero produziu sessão com atividade');

    const estado = semearTudo(s, T0);
    const plano = E.planoDeSessao(g, estado, T0, E.TETO_SESSAO, idx);
    exigir(plano.atividades.length > 0, 'tudo vencido e o plano veio vazio');
    exigir(plano.vencidas === Object.keys(estado.caixas).length,
      `o plano viu ${plano.vencidas} caixas vencidas de ${Object.keys(estado.caixas).length} recém-semeadas`);
    exigir(plano.caixas + plano.adiadasCaixas === plano.vencidas,
      'as caixas do plano mais as adiadas não fecham com as vencidas: alguma sumiu');

    /* Cada atividade é um par mecanismo × operação, e cada caixa aparece em
       uma só — senão a mesma caixa tomaria duas decisões de intervalo na
       mesma sessão. */
    const vistas = new Set();
    plano.atividades.forEach(a=>{
      exigir(!!g.mecanismos[a.mecanismo], `atividade aponta para mecanismo inexistente "${a.mecanismo}"`);
      exigir(E.OPERACOES.includes(a.operacao), `atividade com operação inexistente "${a.operacao}"`);
      exigir(a.caixas.length === a.transicoes.length,
        `atividade "${a.id}": ${a.caixas.length} caixas para ${a.transicoes.length} transições`);
      a.caixas.forEach(k=>{
        exigir(!vistas.has(k), `caixa "${k}" aparece em duas atividades da mesma sessão`);
        vistas.add(k);
        exigir(estado.caixas[k].vencimento <= T0, `caixa "${k}" entrou na sessão sem estar vencida`);
        exigir(E.lerChave(k).operacao === a.operacao,
          `caixa "${k}" entrou numa atividade de "${a.operacao}"`);
        exigir(idx[a.mecanismo].transicoes.some(t=>E.chaveDaTransicao(t) === k.split('#')[0]),
          `caixa "${k}" entrou numa atividade de "${a.mecanismo}", que não a contém`);
      });
    });

    /* O teto para de acrescentar atividades — e não corta uma pela metade. */
    const apertado = E.planoDeSessao(g, estado, T0, 1, idx);
    exigir(apertado.atividades.length === 1,
      `teto de 1 caixa deveria admitir uma atividade inteira; veio com ${apertado.atividades.length}`);
    exigir(apertado.adiadas > 0, 'com teto de 1 caixa nada foi adiado');
    exigir(apertado.caixas + apertado.adiadasCaixas === apertado.vencidas,
      'o plano apertado perdeu caixas pelo caminho');
    const largo = E.planoDeSessao(g, estado, T0, 10000, idx);
    exigir(largo.atividades.length > apertado.atividades.length,
      'o teto não mudou nada: a sessão é a mesma com 1 ou com 10000 caixas');
    exigir(largo.adiadas === 0, 'com teto largo ainda sobrou atividade adiada');

    /* Estudar muda a sessão. É a diferença entre plano derivado e lista fixa. */
    responder(s, estado, Object.keys(estado.caixas), true, T0);
    const depois = E.planoDeSessao(g, estado, T0, E.TETO_SESSAO, idx);
    exigir(depois.atividades.length === 0 && depois.vencidas === 0,
      `estudei tudo e ${depois.vencidas} caixas continuam vencidas no mesmo instante`);
    const futuro = E.planoDeSessao(g, estado, T0 + DIAS(365), E.TETO_SESSAO, idx);
    exigir(futuro.vencidas === Object.keys(estado.caixas).length,
      'um ano depois nem tudo voltou a vencer');

    /* Transição que mora em dois recortes é estudada no MENOR deles — o
       contexto mais apertado é onde ela é exercitada com menos ruído em
       volta. Confere-se na sessão sem teto, porque a sessão com teto pode
       ter adiado justamente a atividade que a contém. */
    const tCompartilhada = g.transicoes.find(t=>
      Object.keys(idx).filter(id=>idx[id].transicoes.includes(t)).length > 1);
    exigir(!!tCompartilhada,
      'nenhuma transição mora em dois recortes: a regra de desempate nunca seria exercitada');
    const donos = Object.keys(idx).filter(id=>idx[id].transicoes.includes(tCompartilhada))
      .sort((a, b)=>(idx[a].nos.size - idx[b].nos.size) || (a < b ? -1 : 1));
    const chaveC = E.chaveDaCaixa(tCompartilhada, 'reconstruir');
    const dono = largo.atividades.find(a=>a.caixas.includes(chaveC));
    exigir(dono && dono.mecanismo === donos[0],
      `a caixa compartilhada foi estudada em "${dono && dono.mecanismo}", não no menor recorte "${donos[0]}"`);

    /* A ressalva de certeza chega ao plano. Uma etapa debatida não pode
       entrar na sessão parecendo fato fechado. */
    const f = fixture();
    const idxF = E.indexar(f);
    const eF = E.novoEstado();
    Object.keys(f.mecanismos).sort().forEach(id=>E.semear(f, eF, id, T0, idxF));
    const planoF = E.planoDeSessao(f, eF, T0, 10000, idxF);
    const comRessalva = planoF.atividades.filter(a=>a.ressalvas.length);
    exigir(comRessalva.length > 0,
      'a fixture tem etapa debatida e outra hipotética, e nenhuma atividade carregou ressalva');
    comRessalva.forEach(a=>a.ressalvas.forEach(r=>{
      exigir(r.certeza !== 'consolidado', `ressalva emitida para etapa consolidada em "${a.id}"`);
      exigir(r.ressalva && r.ressalva.trim().length > 20,
        `ressalva vazia ou curta demais em "${a.id}" (${r.chave})`);
    }));
    const naoConsolidadas = new Set(f.transicoes.filter(t=>t.certeza !== 'consolidado')
      .map(t=>E.chaveDaTransicao(t)));
    planoF.atividades.forEach(a=>{
      a.transicoes.forEach(t=>{
        if(!naoConsolidadas.has(E.chaveDaTransicao(t))) return;
        exigir(a.ressalvas.some(r=>r.chave === E.chaveDaTransicao(t)),
          `atividade "${a.id}" leva a transição ${t.de} → ${t.para} (${t.certeza}) sem ressalva junto`);
      });
    });
  },
  mutantes: [
    { como: 'o plano monta a sessão com todas as caixas, vencidas ou não',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.planoDeSessao;
        m.E.planoDeSessao = (g, estado, agora, teto, idx)=>{
          // finge que tudo venceu agora — é exatamente o defeito de não filtrar
          const tudoVencido = { versao: estado.versao, caixas: {} };
          Object.keys(estado.caixas).forEach(k=>{
            tudoVencido.caixas[k] = Object.assign({}, estado.caixas[k], { vencimento: agora });
          });
          return real(g, tudoVencido, agora, teto, idx);
        }; return m; } },
    { como: 'o plano ignora o teto da sessão',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.planoDeSessao;
        m.E.planoDeSessao = (g, estado, agora, teto, idx)=>real(g, estado, agora, Infinity, idx);
        return m; } },
    { como: 'o plano perde as ressalvas de certeza pelo caminho',
      aplicar(s){ const m = clonarSujeito(s); const real = s.E.planoDeSessao;
        m.E.planoDeSessao = (g, estado, agora, teto, idx)=>{
          const p = real(g, estado, agora, teto, idx);
          p.atividades.forEach(a=>{ a.ressalvas = []; });
          return p;
        }; return m; } }
  ]
});

/* ===================================================================== */
const base = sujeito();
let falhou = false, mutantesMortos = 0, mutantesVivos = 0;

{
  const estado = semearTudo(base, T0);
  const conta = {};
  Object.keys(estado.caixas).forEach(k=>{
    const op = base.E.lerChave(k).operacao; conta[op] = (conta[op] || 0) + 1;
  });
  console.log(`cronograma: ${Object.keys(estado.caixas).length} caixas · ` +
              base.E.OPERACOES.map(o=>`${o} ${conta[o] || 0}`).join(' · ') + '\n');
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
  console.error(`Cronograma: FALHOU (${mutantesVivos} mutante(s) vivo(s))`);
  process.exit(1);
}
console.log(`Cronograma: ok — ${PROVAS.length} propriedades, ${checagens} checagens, ${mutantesMortos} mutantes mortos`);
