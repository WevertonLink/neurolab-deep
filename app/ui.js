/* =====================================================================
   NeuroLab Profundo · a tela

   Esta camada é fina de propósito. Ela NÃO decide nada sobre estudo: não
   escolhe pergunta, não corrige, não calcula intervalo, não sabe o que é
   uma caixa de revisão. Tudo isso vem de `src/`, que roda igual no Node e
   é provado por cinco portões com mutantes.

   Se uma regra de estudo aparecer aqui dentro, ela é uma regra que nenhum
   portão vigia — e este projeto já provou, em quatro ocasiões, que regra
   sem portão é regra errada.
   ===================================================================== */
(function(){
'use strict';
var G = require('./grafo.js');
var E = require('./estudo.js');
var P = require('./percurso.js');
var Q = require('./perguntas.js');

var CHAVE_ESTADO = 'neurolab-profundo/estado/v1';
var app = document.getElementById('app');
var rodape = document.getElementById('rodape');
var acao = document.getElementById('acao');

var g = G.carregar();
var idx = E.indexar(g);
var estado = carregarEstado();
var sessao = null;

/* ---------- estado ---------- */
function carregarEstado(){
  var bruto = null;
  try { bruto = localStorage.getItem(CHAVE_ESTADO); } catch(e){ /* modo privado */ }
  var st = bruto ? JSON.parse(bruto) : E.novoEstado();
  /* Semear é idempotente: mecanismo novo abre caixa nova sem tocar no que
     já foi estudado. É o que faz conteúdo novo aparecer sem migração. */
  Object.keys(g.mecanismos).sort().forEach(function(id){ E.semear(g, st, id, Date.now(), idx); });
  return st;
}
function salvarEstado(){
  try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch(e){ /* ignora */ }
}

/* ---------- utilidades de DOM ---------- */
function el(tag, attrs, filhos){
  var n = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function(k){
    if(k === 'texto') n.textContent = attrs[k];
    else if(k === 'html') n.innerHTML = attrs[k];
    else n.setAttribute(k, attrs[k]);
  });
  (filhos || []).forEach(function(f){ if(f) n.appendChild(f); });
  return n;
}
function limpar(){ app.innerHTML = ''; }
function pct(f){ return Math.round(f * 100) + '%'; }
function nomeNo(id){ return (g.nos[id] && g.nos[id].descricao) || id; }
function botao(rotulo, aoClicar){
  rodape.classList.remove('oculto');
  acao.textContent = rotulo;
  acao.disabled = false;
  acao.onclick = aoClicar;
}
function semBotao(){ rodape.classList.add('oculto'); acao.onclick = null; }

/* ---------- tela do percurso ---------- */
function telaPercurso(){
  sessao = null;
  limpar();
  var p = P.percurso(g, estado, Date.now(), idx);

  app.appendChild(el('h1', { texto: 'NeuroLab Profundo' }));
  app.appendChild(el('p', { class: 'sub',
    texto: p.total + ' caixas de revisão · ' + g.transicoes.length + ' transições causais' }));

  /* a trilha, com os degraus coloridos por estado */
  var trilha = el('div', { class: 'trilha' });
  p.etapas.forEach(function(e, i){
    if(i) trilha.appendChild(document.createTextNode('──'));
    trilha.appendChild(el('span', {
      class: e.concluida ? 'feito' : (e.iniciada ? 'curso' : ''),
      texto: e.concluida ? '[✓]' : (e.iniciada ? '[◐]' : '[ ]')
    }));
  });
  app.appendChild(trilha);

  p.etapas.forEach(function(e){
    var cartao = el('div', { class: 'cartao' });
    cartao.appendChild(el('div', { class: 'linha' }, [
      el('h2', { texto: 'Etapa ' + e.numero }),
      el('span', {
        class: 'selo' + (e.concluida ? ' ok' : (e.iniciada ? ' curso' : '')),
        texto: e.concluida ? 'concluída' : (e.iniciada ? 'em curso' : 'não começada')
      })
    ]));
    cartao.appendChild(el('div', { class: 'rotulo',
      texto: e.total + ' caixas · ' + pct(e.peso) + ' do percurso' }));

    e.mecanismos.forEach(function(m){
      cartao.appendChild(el('div', { class: 'fenomeno', texto: m.fenomeno }));
      var barra = el('div', { class: 'barra' });
      barra.appendChild(el('i', { style: 'width:' + pct(m.fracao) }));
      cartao.appendChild(barra);
      cartao.appendChild(el('div', { class: 'rotulo',
        texto: m.conquistadas + ' de ' + m.total + ' conquistadas' }));
      if(m.prerequisitos.length){
        cartao.appendChild(el('div', { class: 'dep', texto: 'depende de: ' + m.prerequisitos.join(', ') }));
      }
      var ver = el('button', { class: 'fantasma explorar', type: 'button', texto: 'Ler o mecanismo' });
      ver.onclick = (function(id){ return function(){ telaExplorar(id, 'todas'); }; })(m.mecanismo);
      cartao.appendChild(ver);
    });
    app.appendChild(cartao);
  });

  /* Os dois números lado a lado: contar etapa não é contar progresso. */
  var porEtapa = p.etapas.length ? p.etapasConcluidas / p.etapas.length : 0;
  var porCaixa = p.total ? p.conquistadas / p.total : 0;
  var resumo = el('div', { class: 'cartao' });
  var dois = el('div', { class: 'dois' });
  dois.appendChild(el('div', {}, [
    el('div', { class: 'rotulo', texto: 'Etapas concluídas' }),
    el('div', { class: 'numero', texto: p.etapasConcluidas + ' de ' + p.etapas.length + '  (' + pct(porEtapa) + ')' })
  ]));
  dois.appendChild(el('div', {}, [
    el('div', { class: 'rotulo', texto: 'Caixas conquistadas' }),
    el('div', { class: 'numero', texto: p.conquistadas + ' de ' + p.total + '  (' + pct(porCaixa) + ')' })
  ]));
  resumo.appendChild(dois);
  if(Math.abs(porEtapa - porCaixa) > 0.1){
    resumo.appendChild(el('div', { class: 'discorda',
      texto: 'Os dois discordam em ' + pct(Math.abs(porEtapa - porCaixa)) +
             '. As etapas não têm o mesmo tamanho — o número da direita é o que vale.' }));
  }
  app.appendChild(resumo);

  app.appendChild(el('p', { class: 'aviso',
    texto: 'A conquista não desce: esquecer devolve a caixa à revisão e não reabre etapa fechada. ' +
           'As revisões vêm por fora, e continuam vindo mesmo com o percurso inteiro fechado — ' +
           'é assim que ele fica fechado.' }));

  if(p.revisoesHoje > 0) botao('Estudar (' + p.revisoesHoje + ' vencidas)', comecarSessao);
  else { rodape.classList.remove('oculto'); acao.textContent = 'Nada vencido hoje'; acao.disabled = true; acao.onclick = null; }
}

/* ---------- ler o mecanismo ----------
   A mesma cadeia que gera as perguntas, em ordem causal e por extenso. Serve
   para duas coisas: estudar antes de ser cobrado, e AUDITAR — por isso cada
   transição mostra o endereço no arquivo, para um erro de neurociência poder
   ser reportado por número em vez de por descrição.

   O deslizador de escala é uma projeção deste mesmo grafo. Não existe texto
   por camada: se existisse, a camada voltaria a ser dona do conteúdo. */
function telaExplorar(mecanismoId, escala){
  limpar();
  semBotao();
  var m = g.mecanismos[mecanismoId];
  var cadeia = G.projetar(g, mecanismoId, escala);
  var total = G.cadeiaOrdenada(g, mecanismoId).length;

  var voltar = el('button', { class: 'fantasma', type: 'button', texto: '‹ percurso' });
  voltar.onclick = telaPercurso;
  app.appendChild(voltar);

  app.appendChild(el('h1', { texto: mecanismoId }));
  app.appendChild(el('p', { class: 'sub', texto: m.fenomeno }));

  var cabeca = el('div', { class: 'cartao' });
  cabeca.appendChild(el('div', { class: 'rotulo', texto: 'entrada' }));
  cabeca.appendChild(el('div', { texto: nomeNo(m.entrada) }));
  cabeca.appendChild(el('div', { class: 'rotulo', style: 'margin-top:10px', texto: 'termina em' }));
  cabeca.appendChild(el('div', { texto: nomeNo(m.terminal) }));
  var pre = G.prerequisitos(g, mecanismoId);
  if(pre.length) cabeca.appendChild(el('div', { class: 'dep', texto: 'pré-requisitos derivados: ' + pre.join(', ') }));
  cabeca.appendChild(el('div', { class: 'rotulo', style: 'margin-top:10px', texto: 'limites declarados' }));
  cabeca.appendChild(el('p', { class: 'fenomeno', texto: m.limites }));
  app.appendChild(cabeca);

  /* O vocabulário de escalas vem do conteúdo, nunca de uma lista fixa aqui. */
  var faixas = [{ id: 'todas', rotulo: 'todas' }]
    .concat(G.escalasDe(g).map(function(e){ return { id: e, rotulo: e }; }))
    .concat([{ id: 'pontes', rotulo: 'pontes entre escalas' }]);
  var barra = el('div', { class: 'faixas' });
  faixas.forEach(function(f){
    var b = el('button', { class: 'faixa' + (f.id === escala ? ' viva' : ''), type: 'button', texto: f.rotulo });
    b.onclick = (function(id){ return function(){ telaExplorar(mecanismoId, id); }; })(f.id);
    barra.appendChild(b);
  });
  app.appendChild(barra);
  app.appendChild(el('p', { class: 'rotulo',
    texto: cadeia.length + ' de ' + total + ' transições nesta projeção' }));

  if(!cadeia.length){
    app.appendChild(el('p', { class: 'aviso', texto: 'Nenhuma transição nesta escala.' }));
    return;
  }

  cadeia.forEach(function(t){
    var ex = G.explicar(g, t);
    var cartao = el('div', { class: 'cartao' });
    var rel = el('div', { class: 'rel' });
    rel.appendChild(document.createTextNode(nomeNo(t.de) + ' '));
    rel.appendChild(el('span', { class: 'verbo', texto: G.VERBO[t.tipo] || t.tipo }));
    rel.appendChild(document.createTextNode(' ' + nomeNo(t.para)));
    cartao.appendChild(rel);
    cartao.appendChild(el('div', { class: 'escalas',
      texto: (g.nos[t.de].escala || '?') + ' › ' + (g.nos[t.para].escala || '?') }));
    cartao.appendChild(el('p', { texto: ex.resposta }));
    var meta = [];
    if(ex.condicao) meta.push('condição: ' + ex.condicao);
    if(ex.requer && ex.requer.length) meta.push('depende de: ' + ex.requer.join(' · '));
    if(meta.length) cartao.appendChild(el('div', { class: 'meta', texto: meta.join('   ') }));
    if(ex.ressalva) cartao.appendChild(el('div', { class: 'ressalva', texto: ex.ressalva }));
    /* o endereço, para auditoria: dá para dizer "03[7] está errado" */
    cartao.appendChild(el('div', { class: 'endereco', texto: t._arquivo + '[' + t._i + ']' }));
    app.appendChild(cartao);
  });

  app.appendChild(el('p', { class: 'aviso',
    texto: 'Nenhum portão sabe se isto é verdade — eles verificam coerência. ' +
           'Se uma destas relações estiver errada, o endereço embaixo dela é o que identifica.' }));
}

/* ---------- sessão ---------- */
function comecarSessao(){
  var agora = Date.now();
  var montada = Q.montarSessao(g, estado, agora, { idx: idx, semente: (agora / 60000) | 0 });
  if(!montada.perguntas.length) return telaPercurso();
  sessao = {
    perguntas: montada.perguntas, i: 0, agora: agora,
    lote: E.iniciarLote(), resultados: [], caixas: 0
  };
  telaPergunta();
}

function telaPergunta(){
  limpar();
  var s = sessao, p = s.perguntas[s.i];
  var escolhidas = [];

  var prog = el('div', { class: 'progresso' });
  s.perguntas.forEach(function(_, i){
    var r = s.resultados[i];
    prog.appendChild(el('i', { class: i === s.i ? 'atual' : (r ? (r.acertou ? 'feita' : 'falha') : '') }));
  });
  app.appendChild(prog);

  app.appendChild(el('div', { class: 'linha' }, [
    el('span', { class: 'selo curso', texto: p.operacao }),
    el('span', { class: 'rotulo', texto: (s.i + 1) + ' de ' + s.perguntas.length })
  ]));
  app.appendChild(el('h2', { texto: p.enunciado }));
  app.appendChild(el('p', { class: 'sub',
    texto: p.tipoDeResposta === 'unica' ? 'Escolha uma.' : 'Pode haver mais de uma. Marcar tudo não passa.' }));

  var botoes = {};
  p.alternativas.forEach(function(a){
    var b = el('button', { class: 'alt' + (p.tipoDeResposta === 'unica' ? ' unica' : ''),
                           'aria-pressed': 'false', type: 'button' }, [
      el('span', { class: 'marca', texto: '✓' }),
      el('span', { texto: a.texto })
    ]);
    b.onclick = function(){
      if(p.tipoDeResposta === 'unica'){
        escolhidas = [a.id];
        Object.keys(botoes).forEach(function(k){ botoes[k].setAttribute('aria-pressed', String(k === a.id)); });
      } else {
        var j = escolhidas.indexOf(a.id);
        if(j >= 0) escolhidas.splice(j, 1); else escolhidas.push(a.id);
        b.setAttribute('aria-pressed', escolhidas.indexOf(a.id) >= 0 ? 'true' : 'false');
      }
      acao.disabled = escolhidas.length === 0;
    };
    botoes[a.id] = b;
    app.appendChild(b);
  });

  botao('Responder', function(){ responder(p, escolhidas, botoes); });
  acao.disabled = true;
}

function responder(p, escolhidas, botoes){
  var s = sessao;
  var c = Q.corrigir(p, escolhidas);
  s.caixas += Q.anotarNoLote(s.lote, p, c);
  s.resultados[s.i] = c;

  /* marca as alternativas: o que estava certo, o que faltou, o que sobrou */
  Object.keys(botoes).forEach(function(id){
    var b = botoes[id];
    b.onclick = null;
    b.disabled = true;
    var era = p.corretas.indexOf(id) >= 0;
    var marcou = escolhidas.indexOf(id) >= 0;
    if(era && marcou) b.className += ' certa';
    else if(era && !marcou) b.className += ' perdida';
    else if(!era && marcou) b.className += ' errada';
  });

  var caixa = el('div', { class: 'cartao' });
  caixa.appendChild(el('div', { class: 'linha' }, [
    el('h2', { texto: c.acertou ? 'Certo' : (c.nota > 0 ? 'Quase' : 'Errado') }),
    el('span', { class: 'selo' + (c.acertou ? ' ok' : ''), texto: 'nota ' + c.nota.toFixed(2) })
  ]));
  if(p.operacao === 'depurar' && p.correcao){
    caixa.appendChild(el('p', { class: 'sub', texto: 'O certo seria: ' + p.correcao }));
  }
  if(p.seFalhar){
    caixa.appendChild(el('p', { class: 'sub', texto: 'Se falhar: ' + p.seFalhar }));
  }

  /* A revelação é o `porque` da própria transição. É o momento em que a
     pergunta ensina, e por isso ela nunca é texto separado do conteúdo. */
  p.revelacao.forEach(function(r){
    var destaque = (p.chaveErrada && r.chave === p.chaveErrada) ? ' destaque' : '';
    var bloco = el('div', { class: 'rev' + destaque });
    var rel = el('div', { class: 'rel' });
    rel.appendChild(document.createTextNode(r.de + ' '));
    rel.appendChild(el('span', { class: 'verbo', texto: r.verbo }));
    rel.appendChild(document.createTextNode(' ' + r.para));
    bloco.appendChild(rel);
    bloco.appendChild(el('p', { texto: r.porque }));
    var meta = [];
    if(r.condicao) meta.push('condição: ' + r.condicao);
    if(r.requer && r.requer.length) meta.push('depende de: ' + r.requer.join(' · '));
    if(meta.length) bloco.appendChild(el('div', { class: 'meta', texto: meta.join('   ') }));
    if(r.ressalva) bloco.appendChild(el('div', { class: 'ressalva', texto: r.ressalva }));
    caixa.appendChild(bloco);
  });
  app.appendChild(caixa);
  window.scrollTo(0, document.body.scrollHeight);

  botao(s.i + 1 < s.perguntas.length ? 'Próxima' : 'Terminar', function(){
    s.i++;
    if(s.i < s.perguntas.length) telaPergunta();
    else fecharSessao();
  });
}

function fecharSessao(){
  var s = sessao;
  var r = E.fecharLote(g, estado, s.lote, s.agora);
  salvarEstado();

  limpar();
  semBotao();
  var acertos = s.resultados.filter(function(x){ return x.acertou; }).length;
  var subiram = r.decididas.filter(function(d){ return d.para > d.de; }).length;
  var cairam = r.decididas.filter(function(d){ return d.para < d.de; }).length;

  app.appendChild(el('h1', { texto: 'Sessão fechada' }));
  app.appendChild(el('p', { class: 'sub',
    texto: acertos + ' de ' + s.perguntas.length + ' perguntas · ' +
           r.decididas.length + ' caixas decididas' }));

  var cartao = el('div', { class: 'cartao' });
  var dois = el('div', { class: 'dois' });
  dois.appendChild(el('div', {}, [
    el('div', { class: 'rotulo', texto: 'Intervalos que subiram' }),
    el('div', { class: 'numero', texto: String(subiram) })
  ]));
  dois.appendChild(el('div', {}, [
    el('div', { class: 'rotulo', texto: 'Que voltaram atrás' }),
    el('div', { class: 'numero', texto: String(cairam) })
  ]));
  cartao.appendChild(dois);
  cartao.appendChild(el('p', { class: 'aviso',
    texto: 'Cada caixa tomou UMA decisão de intervalo, pela média das respostas que a ' +
           'exercitaram — não uma promoção por resposta. Acertar antes do vencimento ' +
           'não promove, e errar não zera a estrada andada.' }));
  app.appendChild(cartao);

  botao('Voltar ao percurso', telaPercurso);
}

telaPercurso();
})();
