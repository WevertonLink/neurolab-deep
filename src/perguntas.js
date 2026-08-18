/* =====================================================================
   NeuroLab Profundo · as perguntas

   Aqui a operação vira pergunta respondível, com alternativas e gabarito.
   Continua valendo a regra que originou o projeto: NADA aqui é texto
   escrito por pergunta. O enunciado sai da travessia, o gabarito sai da
   alcançabilidade, e os distratores saem do próprio recorte — que é o que
   os torna plausíveis sem ninguém ter escrito uma armadilha.

   Este módulo é PURO: não conhece DOM, não conhece armazenamento, e recebe
   o sorteio de fora. Se ele dependesse de `Math.random`, o portão ficaria
   intermitente e pararia de valer como portão.
   ===================================================================== */
const G = require('./grafo.js');
const E = require('./estudo.js');

const MAX_ALTERNATIVAS = 8;

/* ---------- sorteio determinístico ----------
   Um gerador congruente linear semeado por número. Duas sessões com a mesma
   semente produzem a mesma pergunta — é isso que torna um defeito
   reproduzível em vez de folclore. */
function sorteador(semente){
  let s = (semente >>> 0) || 1;
  return ()=>{ s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
function embaralhar(lista, sorteio){
  const a = lista.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(sorteio() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function escolher(lista, sorteio){ return lista[Math.floor(sorteio() * lista.length)]; }

const nomeDoNo = (g, id) => (g.nos[id] && g.nos[id].descricao) || id;

/* ---------- o slate de alternativas ----------
   Distratores vêm de DENTRO do recorte: nó do mesmo mecanismo que não é
   resposta. Nó de outro assunto seria descartável de graça, e a pergunta
   viraria reconhecimento em vez de reconstrução.

   O slate SEMPRE reserva ao menos `MIN_ERRADAS` alternativas erradas. Sem
   isso aparece uma degeneração que o primeiro teste de fumaça pegou:
   quando a entidade derruba o recorte inteiro, todas as alternativas são
   corretas e "marcar tudo" tira nota cheia. Com a reserva, marcar tudo dá
   no máximo (n − MIN_ERRADAS)/n, que fica abaixo da nota de corte — quem
   marca tudo reprova, como tem de ser.

   Quando as corretas não cabem no slate, ele vira uma AMOSTRA das duas
   classes, e o gabarito é a interseção com o que foi mostrado. É amostra do
   conjunto derivado, não truncamento dele: continua sendo verdade sobre o
   grafo, só perguntada sobre menos itens. */
const MIN_ERRADAS = 2;

function montarSlate(g, sg, corretas, sorteio){
  const universo = [...sg.nos];
  const certas  = universo.filter(n=>corretas.includes(n));
  const erradas = universo.filter(n=>!corretas.includes(n));
  if(!certas.length || erradas.length < MIN_ERRADAS) return null;

  const n = Math.min(MAX_ALTERNATIVAS, universo.length);
  const quantasCertas = Math.min(certas.length, n - MIN_ERRADAS);
  const escolhidasCertas = embaralhar(certas, sorteio).slice(0, quantasCertas);
  const escolhidasErradas = embaralhar(erradas, sorteio).slice(0, n - escolhidasCertas.length);

  const ids = embaralhar(escolhidasCertas.concat(escolhidasErradas), sorteio);
  return {
    alternativas: ids.map(id=>({ id, texto: nomeDoNo(g, id) })),
    corretas: escolhidasCertas
  };
}

/* A revelação é o `porque` das próprias transições, com a ressalva de
   certeza junto. É o momento em que a pergunta ensina, e é por isso que ela
   nunca pode ser texto separado do conteúdo. */
function revelar(g, transicoes){
  return transicoes.map(t=>{
    const ex = G.explicar(g, t);
    return { de: nomeDoNo(g, t.de), para: nomeDoNo(g, t.para), tipo: t.tipo,
             verbo: G.VERBO[t.tipo] || t.tipo, porque: ex.resposta,
             condicao: ex.condicao, requer: ex.requer,
             certeza: ex.certeza, ressalva: ex.ressalva,
             chave: E.chaveDaTransicao(t) };
  });
}

/* ---------- construir e reconstruir ----------
   São a mesma travessia em sentidos opostos, e por isso são um gerador só.
   Para frente pergunta "o que isto causa"; para trás, "o que precisava ter
   acontecido". A resposta é um CONJUNTO de nós, porque um passo pode ter
   várias saídas — e é justamente aí que a pergunta deixa de ser decorável
   como fila. */
function gerarTravessia(g, mecanismoId, operacao, sorteio, idx){
  idx = idx || E.indexar(g);
  const sg = idx[mecanismoId];
  if(!sg) return null;
  const r = G.reconstruir(g, mecanismoId, operacao === 'construir' ? 'frente' : 'tras');
  if(!r || !r.passos.length) return null;

  const passo = escolher(r.passos, sorteio);
  const slate = montarSlate(g, sg, passo.resposta.map(x=>x.no), sorteio);
  if(!slate) return null;
  // só entram as transições cuja saída ficou no slate: a evidência tem de
  // corresponder ao que foi de fato perguntado
  const transicoes = passo.transicoes.filter(t=>
    slate.corretas.includes(operacao === 'construir' ? t.para : t.de));
  if(!transicoes.length) return null;
  return {
    operacao, mecanismo: mecanismoId,
    enunciado: passo.pergunta,
    tipoDeResposta: 'conjunto',
    alternativas: slate.alternativas,
    corretas: slate.corretas,
    transicoes,
    revelacao: revelar(g, transicoes)
  };
}

/* ---------- perturbar ----------
   O gabarito é o que SOME da alcançabilidade quando a entidade desaparece.
   Ninguém escreveu essa lista: ela é recalculada a cada pergunta, e muda
   sozinha quando o conteúdo muda. É a resposta direta ao banco finito de
   contrafactuais escritos à mão. */
function gerarPerturbar(g, mecanismoId, sorteio, idx){
  idx = idx || E.indexar(g);
  const sg = idx[mecanismoId];
  if(!sg) return null;

  /* As candidatas são exatamente as que `operacoesMensuraveisEm` aceita:
     perda real e sobreviventes suficientes. Se o gerador aceitasse mais que
     o cronograma, apareceria pergunta sem caixa para receber a evidência. */
  const candidatas = [...new Set(sg.transicoes.flatMap(t=>t.requer || []))].sort()
    .filter(ent=>{
      const r = G.perturbarRecorte(g, { entidade: ent }, mecanismoId, sg);
      return r.perdidos.length > 0 && r.restantes.size >= E.MIN_SOBREVIVENTES;
    });
  if(!candidatas.length) return null;

  const entidade = escolher(candidatas, sorteio);
  const r = G.perturbarRecorte(g, { entidade }, mecanismoId, sg);
  const slate = montarSlate(g, sg, r.perdidos, sorteio);
  if(!slate) return null;
  const alvo = g.entidades[entidade] || { nome: entidade };
  const mortas = r.mortas.filter(t=>sg.transicoes.includes(t));

  return {
    operacao: 'perturbar', mecanismo: mecanismoId, entidade,
    enunciado: `Se ${alvo.nome} deixar de existir, o que deixa de acontecer?`,
    tipoDeResposta: 'conjunto',
    alternativas: slate.alternativas,
    corretas: slate.corretas,
    transicoes: mortas,
    revelacao: revelar(g, mortas),
    seFalhar: alvo.se_falhar || null
  };
}

/* ---------- depurar ----------
   O sistema INVERTE uma transição e apresenta a cadeia como prosa. A
   afirmação invertida é a errada, e é por isso que `operacoesMensuraveisEm`
   exige que a inversa não exista de verdade no grafo: se existisse, a
   afirmação invertida seria verdadeira e a pergunta não teria gabarito. */
function gerarDepurar(g, mecanismoId, sorteio, idx){
  idx = idx || E.indexar(g);
  const sg = idx[mecanismoId];
  if(!sg) return null;

  const podem = sg.transicoes.filter(t=>
    E.operacoesMensuraveisEm(g, t, mecanismoId, idx).includes('depurar'));
  if(!podem.length) return null;

  const errada = escolher(podem, sorteio);
  const outras = embaralhar(sg.transicoes.filter(t=>t !== errada), sorteio).slice(0, 3);
  const frase = (de, verbo, para) => `${nomeDoNo(g, de)} ${verbo} ${nomeDoNo(g, para)}`;

  const itens = embaralhar(outras.map(t=>({
    id: E.chaveDaTransicao(t),
    texto: frase(t.de, G.VERBO[t.tipo] || t.tipo, t.para),
    certa: true, transicao: t
  })).concat([{
    id: E.chaveDaTransicao(errada),
    texto: frase(errada.para, G.VERBO[errada.tipo] || errada.tipo, errada.de),  // invertida
    certa: false, transicao: errada
  }]), sorteio);

  /* A revelação cobre TODAS as afirmações mostradas, não só a invertida.
     A evidência também vai para todas — julgar as quatro é o trabalho —, e
     o que foi avaliado tem de ser explicado. `chaveErrada` diz à tela qual
     destacar. */
  return {
    operacao: 'depurar', mecanismo: mecanismoId,
    enunciado: 'Uma destas afirmações está invertida. Qual?',
    tipoDeResposta: 'unica',
    alternativas: itens.map(i=>({ id: i.id, texto: i.texto })),
    corretas: [E.chaveDaTransicao(errada)],
    chaveErrada: E.chaveDaTransicao(errada),
    transicoes: itens.map(i=>i.transicao),
    revelacao: revelar(g, itens.map(i=>i.transicao)),
    correcao: frase(errada.de, G.VERBO[errada.tipo] || errada.tipo, errada.para)
  };
}

function gerar(g, mecanismoId, operacao, semente, idx){
  const sorteio = sorteador(semente);
  if(operacao === 'construir' || operacao === 'reconstruir')
    return gerarTravessia(g, mecanismoId, operacao, sorteio, idx);
  if(operacao === 'perturbar') return gerarPerturbar(g, mecanismoId, sorteio, idx);
  if(operacao === 'depurar')   return gerarDepurar(g, mecanismoId, sorteio, idx);
  throw new Error(`operação desconhecida: ${operacao}`);
}

/* ---------- correção ----------
   Conjunto usa Jaccard, e não "quantas acertou": marcar tudo tem de ser
   ruim. Quem seleciona as dez alternativas para garantir as três certas não
   demonstrou saber nada, e uma nota que premiasse isso corromperia o
   cronograma inteiro — as caixas subiriam sem retenção por trás. */
function corrigir(pergunta, escolhidas){
  const esc = [...new Set(escolhidas || [])];
  const cor = [...new Set(pergunta.corretas)];
  let nota;
  if(pergunta.tipoDeResposta === 'unica'){
    nota = (esc.length === 1 && cor.includes(esc[0])) ? 1 : 0;
  } else {
    const inter = esc.filter(x=>cor.includes(x)).length;
    const uniao = new Set(esc.concat(cor)).size;
    nota = uniao ? inter / uniao : 0;
  }
  return {
    nota,
    acertou: nota >= E.PASSA,
    faltaram: cor.filter(x=>!esc.includes(x)),
    sobraram: esc.filter(x=>!cor.includes(x)),
    /* A mesma nota vai para todas as transições que a pergunta exercitou:
       é isso que o lote consome, e é uma decisão de intervalo por caixa. */
    porTransicao: pergunta.transicoes.map(t=>({ transicao: t, nota }))
  };
}

/* Anota uma pergunta corrigida no lote do cronograma. */
function anotarNoLote(lote, pergunta, correcao){
  correcao.porTransicao.forEach(x=>E.anotar(lote, x.transicao, pergunta.operacao, x.nota));
  return correcao.porTransicao.length;
}

/* ---------- a sessão ----------
   O plano do cronograma diz QUE atividades estão vencidas; aqui elas viram
   perguntas, uma por atividade em cada volta — rodízio, não fila.

   O plano é pedido SEM TETO de propósito. O teto de `planoDeSessao` conta
   CAIXAS, e foi desenhado quando eu supunha que uma atividade liquidava o
   recorte inteiro de uma vez. Não liquida: uma pergunta cobre uma a três
   transições. Usar o teto de caixas aqui admitiria uma atividade só (a
   primeira já estoura 42 caixas) e a sessão inteira viraria a mesma
   operação no mesmo mecanismo, quatro vezes seguidas — sem intercalação,
   que é justamente o que faz revisão espaçada funcionar. Quem limita a
   sessão aqui é o número de PERGUNTAS.

   Atividade que não rende pergunta (o sorteio caiu num passo sem slate
   possível) é pulada em silêncio, e as caixas dela seguem vencidas. Nada é
   inventado para encher sessão. */
function montarSessao(g, estado, agora, opcoes){
  opcoes = opcoes || {};
  const idx = opcoes.idx || E.indexar(g);
  const max = opcoes.maxPerguntas || 10;
  const semente = (opcoes.semente || 1) >>> 0;
  const plano = E.planoDeSessao(g, estado, agora,
    opcoes.teto === undefined ? Infinity : opcoes.teto, idx);

  const perguntas = [];
  for(let volta = 0; volta < 4 && perguntas.length < max; volta++){
    const antes = perguntas.length;
    for(const a of plano.atividades){
      if(perguntas.length >= max) break;
      const p = gerar(g, a.mecanismo, a.operacao, semente + volta * 7919 + perguntas.length * 31, idx);
      if(p) perguntas.push(p);
    }
    if(perguntas.length === antes) break;   // nenhuma atividade rende: para
  }
  return { plano, perguntas };
}

module.exports = {
  MAX_ALTERNATIVAS, MIN_ERRADAS, sorteador, embaralhar, montarSlate, montarSessao,
  gerar, gerarTravessia, gerarPerturbar, gerarDepurar,
  corrigir, anotarNoLote, revelar
};
