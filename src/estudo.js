/* =====================================================================
   NeuroLab Profundo · o cronograma

   O que se agenda aqui não é "aula" nem "tópico": é o par
   TRANSIÇÃO × OPERAÇÃO. Saber reconstruir um elo não é o mesmo que saber
   o que acontece quando ele quebra, e as duas coisas se esquecem em
   ritmos diferentes — então são duas caixas de revisão distintas.

   O endereço da caixa é `de>para#operacao`. A transição não tem `id` de
   propósito: id é coisa que se digita errado, e o par de nós já identifica
   a transição sem ninguém precisar inventar nome. O validador garante que
   o par é único e que nenhum id de nó contém os separadores.

   Quais operações valem para cada transição é DERIVADO do grafo, nunca
   declarado no conteúdo — pela mesma razão que as perguntas são derivadas.
   Se coubesse escrever "esta transição serve para perturbar", alguém
   escreveria, e o conteúdo voltaria a mandar no estudo.

   Três diferenças deliberadas em relação ao SRS do NeuroLab v2, todas por
   causa de teste:
     · o lote de evidências é um OBJETO que se passa adiante, não um global
       de módulo (`_evidenceBatch`) — dois lotes simultâneos não se comem;
     · `agora` é PARÂMETRO em tudo. O v2 chama `Date.now()` por dentro, o
       que amarra o teste ao relógio de parede;
     · a folga do vencimento é determinística a partir do endereço, não
       `Math.random()` — senão o portão fica intermitente.
   ===================================================================== */
const G = require('./grafo.js');

/* As quatro operações. São as dimensões do SRS: a mesma transição tem uma
   caixa por operação. */
const OPERACOES = ['construir', 'reconstruir', 'perturbar', 'depurar'];

const INTERVALOS = [1, 3, 7, 14, 30, 60, 120, 240];  // dias, por caixa de Leitner
const PASSA = 0.8;          // nota mínima para promover
const TETO_RECAIDA = 2;     // errar não devolve à caixa 0 se já havia estrada andada
const TETO_SESSAO = 16;     // piso de parada da sessão, em caixas
const DIA = 86400000;
const FOLGA = 0.12;         // ±12% no vencimento, para o lote semeado junto não vencer junto para sempre
const MIN_NOS_PARA_ORDENAR = 3;  // com 2 nós a ordem é trivial e a operação não mede nada

/* ---------- o endereço ---------- */
function chaveDaTransicao(t){ return t.de + '>' + t.para; }
function chaveDaCaixa(t, operacao){ return chaveDaTransicao(t) + '#' + operacao; }
function lerChave(chave){
  const [par, operacao] = chave.split('#');
  const [de, para] = par.split('>');
  return { de, para, operacao };
}

/* Um índice dos recortes, para não recalcular subgrafo a cada transição. */
function indexar(g){
  const idx = {};
  Object.keys(g.mecanismos).forEach(id=>{ idx[id] = G.subgrafo(g, id); });
  return idx;
}

/* ---------- o que dá para medir ----------
   Uma operação só vira caixa de revisão se ela tem resposta certa NESTE
   grafo. Não é preferência de autor: é a pergunta "esta operação chega a
   perguntar alguma coisa aqui?".

   · construir/reconstruir — precisam de um mecanismo onde morar, e de
     ordem não trivial. Num recorte de dois nós não há o que ordenar.
   · perturbar — precisa de uma entidade cuja remoção realmente derrube
     alcance. Entidade cujo sumiço não muda nada gera pergunta sem resposta.
   · depurar — a operação inverte a transição e pergunta o que está errado.
     Se o inverso TAMBÉM existe no grafo (retroalimentação real), a
     afirmação invertida é verdadeira e a pergunta não tem gabarito.

   Transição fora de todo mecanismo não é estudável: o estudo acontece
   dentro de um recorte, e sem recorte não há contexto para nenhuma das
   quatro. */
function operacoesMensuraveis(g, t, idx){
  idx = idx || indexar(g);
  const meus = Object.keys(idx).sort().filter(id=>idx[id] && idx[id].transicoes.includes(t));
  if(!meus.length) return [];

  const ops = [];

  if(meus.some(id=>idx[id].nos.size >= MIN_NOS_PARA_ORDENAR)){
    ops.push('construir');
    ops.push('reconstruir');
  }

  const perturbavel = (t.requer||[]).some(entidade=>
    meus.some(id=>G.perturbar(g, { entidade }, idx[id].mecanismo.entrada).perdidos.length > 0));
  if(perturbavel) ops.push('perturbar');

  const inversoExiste = g.transicoes.some(o=>o.de === t.para && o.para === t.de);
  if(!inversoExiste) ops.push('depurar');

  return ops;
}

/* ---------- estado ----------
   Projeto novo, estado zero: não existe migração e não vai existir. */
function novoEstado(){ return { versao: 1, caixas: {} }; }

function caixaNova(agora){
  return { caixa: 0, vencimento: agora, tentativas: 0, evidencias: 0,
           ultimaNota: null, ultimoEstudo: null };
}

/* Semear um mecanismo abre uma caixa por transição × operação mensurável —
   e só essas. */
function semear(g, estado, mecanismoId, agora, idx){
  idx = idx || indexar(g);
  const sg = idx[mecanismoId];
  const criadas = [], jaExistiam = [];
  if(!sg) return { criadas, jaExistiam };
  sg.transicoes.forEach(t=>{
    operacoesMensuraveis(g, t, idx).forEach(op=>{
      const chave = chaveDaCaixa(t, op);
      if(estado.caixas[chave]){ jaExistiam.push(chave); return; }
      estado.caixas[chave] = caixaNova(agora);
      criadas.push(chave);
    });
  });
  return { criadas, jaExistiam };
}

/* ---------- o lote ----------
   Uma atividade responde a mesma caixa várias vezes (a reconstrução passa
   por dezessete transições). Isso é UMA decisão de intervalo por caixa, com
   a média das respostas — não dezessete promoções em cadeia. */
function iniciarLote(){ return { notas: {}, aberto: true }; }

function normalizar(nota){
  if(nota === true) return 1;
  if(nota === false) return 0;
  if(typeof nota === 'number' && Number.isFinite(nota) && nota >= 0 && nota <= 1) return nota;
  throw new Error(`nota inválida: ${JSON.stringify(nota)} — use true/false ou um número de 0 a 1`);
}

function anotar(lote, t, operacao, nota){
  if(!lote || !lote.aberto) throw new Error('lote inexistente ou já fechado');
  if(!OPERACOES.includes(operacao)) throw new Error(`operação desconhecida: ${operacao}`);
  const chave = chaveDaCaixa(t, operacao);
  (lote.notas[chave] = lote.notas[chave] || []).push(normalizar(nota));
  return chave;
}

/* Fechar o lote é o único lugar que mexe no cronograma. Caixa que não foi
   semeada não é criada aqui de contrabando: ela volta em `ignoradas`, para
   o chamador descobrir que pediu uma operação que este grafo não mede. */
function fecharLote(g, estado, lote, agora){
  if(!lote || !lote.aberto) throw new Error('lote inexistente ou já fechado');
  lote.aberto = false;
  const decididas = [], ignoradas = [];
  Object.keys(lote.notas).sort().forEach(chave=>{
    const notas = lote.notas[chave];
    if(!estado.caixas[chave]){ ignoradas.push(chave); return; }
    const media = notas.reduce((a, b)=>a + b, 0) / notas.length;
    decididas.push(agendar(estado, chave, media, agora, notas.length));
  });
  return { decididas, ignoradas };
}

/* Folga determinística: mesma caixa, mesmo desvio, sempre. Sessenta caixas
   semeadas no mesmo minuto venceriam no mesmo minuto para sempre; ±12% de
   um intervalo de 30 dias são ±3,6 dias, o bastante para o bloco se
   desmanchar sozinho ao longo das revisões. */
function embaralho(chave){
  let h = 2166136261;
  for(let i = 0; i < chave.length; i++){ h ^= chave.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
function desvio(chave){ return (embaralho(chave) - 0.5) * 2 * FOLGA; }

/* Leitner. Duas regras que não são óbvias e vieram do v2:
   · acertar SEM estar vencida não promove — senão dá para subir de caixa
     repetindo a mesma coisa no mesmo dia, e o intervalo deixa de medir
     retenção;
   · errar não devolve à caixa 0. Cai no máximo para `TETO_RECAIDA`, porque
     um tropeço não apaga meses de estrada. */
function agendar(estado, chave, nota, agora, evidencias){
  const c = estado.caixas[chave];
  if(!c) throw new Error(`caixa inexistente: ${chave}`);
  const estavaVencida = c.vencimento == null || c.vencimento <= agora;
  const anterior = c.caixa;
  if(nota >= PASSA){
    if(estavaVencida) c.caixa = Math.min(c.caixa + 1, INTERVALOS.length - 1);
  } else {
    c.caixa = Math.max(0, Math.min(c.caixa - 1, TETO_RECAIDA));
  }
  c.tentativas += 1;
  c.evidencias += (evidencias || 1);
  c.ultimaNota = nota;
  c.ultimoEstudo = agora;
  c.vencimento = agora + Math.round(INTERVALOS[c.caixa] * DIA * (1 + desvio(chave)));
  return { chave, nota, de: anterior, para: c.caixa, estavaVencida,
           vencimento: c.vencimento, evidencias: evidencias || 1 };
}

/* ---------- o que está vencido ---------- */
function devidas(estado, agora){
  return Object.keys(estado.caixas)
    .filter(k=>estado.caixas[k].vencimento <= agora)
    .sort((a, b)=>
      (estado.caixas[a].vencimento - estado.caixas[b].vencimento) || (a < b ? -1 : a > b ? 1 : 0));
}

/* ---------- o plano da sessão ----------
   A atividade é MECANISMO × OPERAÇÃO, não caixa avulsa: reconstruir o
   potencial de repouso é uma passada só que liquida as caixas de
   `reconstruir` de todas as transições daquele recorte. É daí que vem o
   ganho do lote — dezessete evidências, dezessete decisões de intervalo,
   uma atividade.

   Caixa cuja transição mora em mais de um mecanismo entra no MENOR recorte
   que a contém: é onde ela é exercitada com menos ruído em volta. Empate
   desempata por id, para o plano ser reproduzível. */
function planoDeSessao(g, estado, agora, teto, idx){
  idx = idx || indexar(g);
  teto = (teto == null) ? TETO_SESSAO : teto;

  const porTransicao = {};
  g.transicoes.forEach(t=>{ porTransicao[chaveDaTransicao(t)] = t; });

  const grupos = new Map();
  devidas(estado, agora).forEach(chave=>{
    const { de, para, operacao } = lerChave(chave);
    const t = porTransicao[de + '>' + para];
    if(!t) return;                       // o conteúdo mudou debaixo do estado
    const donos = Object.keys(idx)
      .filter(id=>idx[id].transicoes.includes(t))
      .sort((a, b)=>(idx[a].nos.size - idx[b].nos.size) || (a < b ? -1 : 1));
    if(!donos.length) return;            // deixou de ser estudável
    const mecanismo = donos[0];
    const id = mecanismo + '#' + operacao;
    if(!grupos.has(id)){
      grupos.set(id, { id, mecanismo, operacao, caixas: [], transicoes: [],
                       ressalvas: [], prioridade: Infinity });
    }
    const a = grupos.get(id);
    a.caixas.push(chave);
    a.transicoes.push(t);
    a.prioridade = Math.min(a.prioridade, estado.caixas[chave].vencimento);
  });

  /* A ressalva de certeza viaja junto com a atividade. `explicar` é a única
     fonte do texto: se a tela esquecer de mostrar, some do plano também, e
     o portão pega. */
  grupos.forEach(a=>{
    a.ressalvas = a.transicoes
      .filter(t=>t.certeza !== 'consolidado')
      .map(t=>{
        const e = G.explicar(g, t);
        return { chave: chaveDaTransicao(t), certeza: e.certeza, ressalva: e.ressalva };
      });
  });

  const ordenadas = [...grupos.values()].sort((a, b)=>
    (a.prioridade - b.prioridade) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  /* O teto é piso de parada, não tesoura: uma atividade entra inteira ou
     não entra. Reconstruir metade de um mecanismo não é reconstruí-lo. */
  const atividades = [], adiadas = [];
  let caixas = 0;
  ordenadas.forEach(a=>{
    if(caixas >= teto){ adiadas.push(a); return; }
    atividades.push(a);
    caixas += a.caixas.length;
  });

  return { agora, teto, atividades, caixas,
           vencidas: ordenadas.reduce((n, a)=>n + a.caixas.length, 0),
           adiadas: adiadas.length,
           adiadasCaixas: adiadas.reduce((n, a)=>n + a.caixas.length, 0) };
}

/* ---------- progresso ---------- */
function resumo(estado, agora){
  const caixas = Object.values(estado.caixas);
  const porCaixa = INTERVALOS.map(()=>0);
  caixas.forEach(c=>{ porCaixa[c.caixa]++; });
  return {
    total: caixas.length,
    novas: caixas.filter(c=>c.tentativas === 0).length,
    vencidas: devidas(estado, agora).length,
    porCaixa
  };
}

module.exports = {
  OPERACOES, INTERVALOS, PASSA, TETO_RECAIDA, TETO_SESSAO, DIA, FOLGA,
  MIN_NOS_PARA_ORDENAR,
  chaveDaTransicao, chaveDaCaixa, lerChave, indexar, operacoesMensuraveis,
  novoEstado, semear, iniciarLote, anotar, fecharLote, agendar,
  devidas, planoDeSessao, resumo
};
