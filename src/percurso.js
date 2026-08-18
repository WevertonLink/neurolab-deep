/* =====================================================================
   NeuroLab Profundo · o percurso

   O que o NeuroLab v2 chamava de módulo, aqui é ETAPA — e a diferença é a
   tese inteira do projeto.

   No v2 o módulo era o DONO do conteúdo: existia a grade 16×4, e o material
   tinha de caber nela. Quando o container manda, o conteúdo é escrito para
   preencher slot, e o banco de perguntas acaba finito e decorável.

   Aqui a etapa é CALCULADA. Um mecanismo é pré-requisito de outro quando o
   TERMINAL dele mora dentro do recorte do outro (`grafo.prerequisitos`) —
   isso já é derivado desde a Fase A. A etapa é uma camada topológica desse
   DAG: etapa 1 é o que não depende de nada, etapa n+1 é o que só depende
   das etapas até n.

   Consequência prática: a ordem do percurso é a ordem em que a matéria
   realmente depende de si mesma, e não a ordem em que alguém listou os
   arquivos. Não existe campo `modulo:` em lugar nenhum, e não pode passar a
   existir — pela mesma razão da lista branca fechada do validador.

   E há um diagnóstico de brinde que a grade nunca pôde dar: mecanismo que
   cai sozinho numa camada, sem ninguém depender dele, está SOLTO do resto do
   corpo de conhecimento.

   ---------------------------------------------------------------------
   Sobre a conquista: decisão do Weverton, tomada em 16/08/2026 contra as
   alternativas. A barra é TROFÉU — sobe e não desce. A revisão continua
   chegando por fora, sem desfazer etapa conquistada.

   Por isso a conquista lê `recorde` (o mais longe que a caixa já chegou) e
   nunca `caixa` (onde ela está hoje). São dois números diferentes de
   propósito: quem mistura os dois ou mente sobre retenção, ou desmancha um
   trecho já vencido — e ele quer as duas coisas separadas.
   ===================================================================== */
const G = require('./grafo.js');
const E = require('./estudo.js');

/* Intervalo a partir do qual a caixa conta como conquistada. 4 = 30 dias:
   para chegar aqui foi preciso acertar numa revisão marcada para 14 dias
   depois da anterior. Antes disso é reconhecimento recente, não retenção. */
const CAIXA_FIRME = 4;

/* As etapas moraram aqui até 2026-08-18, e mudaram para `grafo.js` porque o
   CRONOGRAMA passou a precisar delas — a sessão ordena por etapa, senão
   entrega a etapa 7 antes da 1. `percurso.js` já requer `estudo.js`, então
   estudo não pode requerer percurso: a camada topológica desce para o grafo,
   que é de onde ela sempre saiu (só depende de `prerequisitos`). */
const etapas = G.etapas;

/* ---------- conquista ----------
   Uma caixa está conquistada quando o RECORDE dela alcançou `CAIXA_FIRME`.
   Nunca `caixa`: ela desce quando se esquece, e a conquista não desce. */
/* As caixas de que este mecanismo é DONO — não todas as que passam pelo
   recorte dele. Recortes se sobrepõem (é o que significa um depender do
   outro), e sem a regra de posse as caixas do gradiente seriam contadas de
   novo dentro do potencial de membrana: o progresso somaria 85 de 58.

   A regra é a mesma que a sessão usa para montar atividade — tem de ser,
   senão o estudo anda num mecanismo e a barra anda noutro. */
function caixasDoMecanismo(g, mecanismoId, idx){
  idx = idx || E.indexar(g);
  const sg = idx[mecanismoId];
  if(!sg) return [];
  return sg.transicoes.flatMap(t=>
    E.operacoesMensuraveisEm(g, t, mecanismoId, idx)
      .filter(op=>E.donoDaCaixa(g, t, op, idx) === mecanismoId)
      .map(op=>E.chaveDaCaixa(t, op)));
}

function conquistaDoMecanismo(g, estado, mecanismoId, idx){
  const chaves = caixasDoMecanismo(g, mecanismoId, idx);
  const abertas = chaves.filter(k=>estado.caixas[k]);
  const conquistadas = abertas.filter(k=>(estado.caixas[k].recorde || 0) >= CAIXA_FIRME);

  /* ---------- firmeza: a subida, não só o topo ----------
     `conquistadas` é binário e exige `recorde >= CAIXA_FIRME`, o que
     significa ter acertado numa revisão marcada 30 dias depois da anterior.
     É a definição certa de retenção, e ela fica.

     Só que ela leva MESES para sair de zero. Simulando 40 dias de estudo
     honesto sobre este conteúdo: 1 caixa conquistada de 860. Uma barra
     parada em 0% por meses não é rigor, é uma barra quebrada — e o motivo
     de a barra existir foi o engajamento.

     `firmeza` mede quanto da subida já foi feito: a média de
     `min(recorde, CAIXA_FIRME) / CAIXA_FIRME`. Move desde a primeira
     resposta, é monótona pelo mesmo motivo que a conquista (lê `recorde`,
     que nunca desce), e chega a 1 exatamente quando tudo foi conquistado.
     As duas convivem porque medem coisas diferentes, e nenhuma mente. */
  const somaFirmeza = chaves.reduce((s, k)=>{
    const c = estado.caixas[k];
    return s + Math.min(c ? (c.recorde || 0) : 0, CAIXA_FIRME) / CAIXA_FIRME;
  }, 0);

  return {
    mecanismo: mecanismoId,
    total: chaves.length,
    semeadas: abertas.length,
    conquistadas: conquistadas.length,
    fracao: chaves.length ? conquistadas.length / chaves.length : 0,
    firmeza: chaves.length ? somaFirmeza / chaves.length : 0,
    concluido: chaves.length > 0 && conquistadas.length === chaves.length,
    iniciado: abertas.some(k=>estado.caixas[k].tentativas > 0)
  };
}

/* ---------- o percurso inteiro ----------
   Devolve TODAS as etapas, inclusive as que ainda não foram semeadas: ver o
   fim desde o começo é metade do que uma barra de progresso serve para
   fazer. `revisoesHoje` viaja ao lado, nunca dentro da conquista — é a
   separação que o Weverton pediu entre o troféu e a manutenção. */
function percurso(g, estado, agora, idx){
  idx = idx || E.indexar(g);
  const { camadas, pre, ciclicos } = etapas(g);

  const lista = camadas.map((ids, i)=>{
    const mecanismos = ids.map(id=>Object.assign(
      conquistaDoMecanismo(g, estado, id, idx),
      { fenomeno: g.mecanismos[id].fenomeno,
        prerequisitos: pre[id],
        soltinho: pre[id].length === 0 && !Object.keys(g.mecanismos)
          .some(outro=>G.prerequisitos(g, outro).includes(id)) }));
    const total = mecanismos.reduce((n, m)=>n + m.total, 0);
    const conquistadas = mecanismos.reduce((n, m)=>n + m.conquistadas, 0);
    return {
      numero: i + 1, mecanismos, total, conquistadas,
      fracao: total ? conquistadas / total : 0,
      firmeza: total ? mecanismos.reduce((s, m)=>s + m.firmeza * m.total, 0) / total : 0,
      concluida: mecanismos.length > 0 && mecanismos.every(m=>m.concluido),
      iniciada: mecanismos.some(m=>m.iniciado)
    };
  });

  /* O PESO de cada etapa: que fração do percurso inteiro ela representa.
     Sem isto a trilha mente. Hoje a etapa 3 tem 142 das 200 caixas, e
     `[✓]──[✓]──[◐]` desenha três degraus do mesmo tamanho: fechar as duas
     primeiras parece "2 de 3 feito" e são 29% do trabalho. Contar etapa não
     é contar progresso, e a barra que ele pediu não pode mentir sobre
     quanto falta. */
  const total = lista.reduce((n, e)=>n + e.total, 0);
  lista.forEach(e=>{ e.peso = total ? e.total / total : 0; });

  return {
    agora,
    etapas: lista,
    ciclicos,
    revisoesHoje: E.devidas(estado, agora).length,   // ao lado, não dentro
    conquistadas: lista.reduce((n, e)=>n + e.conquistadas, 0),
    firmeza: total ? lista.reduce((s, e)=>s + e.firmeza * e.total, 0) / total : 0,
    total,
    etapasConcluidas: lista.filter(e=>e.concluida).length
  };
}

/* A régua de uma linha só: [✓]──[✓]──[◐]──[ ] */
function trilha(p){
  return p.etapas.map(e=>e.concluida ? '[✓]' : (e.iniciada ? '[◐]' : '[ ]')).join('──');
}

module.exports = { CAIXA_FIRME, etapas, caixasDoMecanismo, conquistaDoMecanismo, percurso, trilha };
