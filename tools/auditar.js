#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · folha de auditoria

   Os seis portões verificam COERÊNCIA. Nenhum deles verifica VERDADE, e
   nenhum pode: um grafo inteiramente falso passa em todos, desde que seja
   consistente. Verificar verdade é trabalho humano, e este arquivo existe
   para tornar esse trabalho barato — ler as 250 transições em ordem, num
   celular, e marcar as suspeitas.

   O que a página faz e o que ela NÃO faz:
   · gera tudo a partir do grafo, sem campo novo em `content/`;
   · guarda o veredicto no endereço `de>para`, e não em `arquivo[i]`, pela
     mesma razão que o cronograma usa esse endereço: o par de nós é único e
     sobrevive a reordenar transição dentro do arquivo. Inserir uma
     transição no meio de um arquivo não embaralha as marcas já feitas.
   · não altera conteúdo nenhum. A saída é uma lista para colar de volta.

   Uso: node tools/auditar.js  →  auditoria.html
   ===================================================================== */
const fs = require('node:fs'), path = require('node:path');
const G = require('../src/grafo.js');

const SAIDA = path.join(__dirname, '..', 'auditoria.html');
const g = G.carregar();

/* ---------- os dados, derivados ---------- */
const nomeDoNo = id=>(g.nos[id] && g.nos[id].descricao) || id;

/* Um mecanismo "passa por" uma transição quando ela está no recorte dele.
   Serve para dizer ao auditor o que quebra se a transição estiver errada —
   que é a informação que decide se vale a pena parar naquele item. */
const recortes = {};
Object.keys(g.mecanismos).forEach(id=>{
  const sg = G.subgrafo(g, id);
  if(sg) recortes[id] = new Set(sg.transicoes);
});

/* Os textos entram na página por `innerHTML`, então escapam aqui. Hoje o
   conteúdo não tem `<`, `>` nem `&` em lugar nenhum — mas depender disso é
   depender de uma propriedade que ninguém verifica, e conteúdo cresce. */
const esc = s=>String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escObj = o=>{ if(!o) return null;
  const r = {}; Object.keys(o).forEach(k=>{ r[esc(k)] = esc(o[k]); }); return r; };

const itens = g.transicoes.map(t=>({
  chave: t.de + '>' + t.para,
  endereco: `${t._arquivo}[${t._i}]`,
  arquivo: t._arquivo,
  de: t.de, para: t.para,
  deTexto: esc(nomeDoNo(t.de)), paraTexto: esc(nomeDoNo(t.para)),
  verbo: esc(G.VERBO[t.tipo] || t.tipo),
  certeza: t.certeza,
  requer: (t.requer||[]).map(e=>esc((g.entidades[e]||{}).nome || e)),
  condicao: t.condicao ? esc(t.condicao) : null,
  porque: esc(t.porque),
  quant: escObj(t.quant),
  cruza: g.origem[t.de] !== g.origem[t.para],
  mecanismos: Object.keys(recortes).filter(id=>recortes[id].has(t)).sort()
}));

const arquivos = g.arquivos.map(arq=>{
  const doArquivo = Object.values(g.mecanismos).filter(m=>m._arquivo === arq);
  return {
    arquivo: arq,
    titulo: esc((JSON.parse(fs.readFileSync(path.join(G.CONTEUDO, arq), 'utf8')).arquivo) || arq),
    fenomeno: doArquivo.length ? esc(doArquivo[0].fenomeno) : null,
    quantas: itens.filter(i=>i.arquivo === arq).length
  };
});

const DADOS = { itens, arquivos, total: itens.length,
                debatidos: itens.filter(i=>i.certeza !== 'consolidado').length };

/* ---------- a página ----------
   `</script` dentro do JSON fecharia o bloco e derrubaria a página inteira.
   Não acontece hoje; custa uma linha impedir que passe a acontecer. */
const json = JSON.stringify(DADOS).replace(/<\/script/gi, '<\\/script');

const html = `<title>Auditoria científica — ${DADOS.total} transições</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  --ground:#f6f9f9; --surface:#ffffff; --surface-2:#eef3f3;
  --ink:#131b1a; --ink-2:#41514f; --ink-3:#6d7d7b;
  --linha:#d7e2e1; --linha-forte:#b9c9c7;
  --acento:#0e6b62; --acento-fraco:#e2efed;
  --confere:#2e7d5b; --suspeita:#8f5e05; --errada:#b23a2c;
  --confere-fundo:#e6f2eb; --suspeita-fundo:#f8eedb; --errada-fundo:#f8e7e4;
  --sombra:0 1px 2px rgba(19,27,26,.06), 0 4px 12px rgba(19,27,26,.04);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --ground:#0d1413; --surface:#141d1c; --surface-2:#1b2625;
    --ink:#e6edec; --ink-2:#a8b8b6; --ink-3:#7d8d8b;
    --linha:#263432; --linha-forte:#384845;
    --acento:#4fbfae; --acento-fraco:#16302d;
    --confere:#6cc294; --suspeita:#d8a441; --errada:#e58272;
    --confere-fundo:#152922; --suspeita-fundo:#2b2415; --errada-fundo:#2c1a17;
    --sombra:0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.25);
  }
}
:root[data-theme="dark"]{
  --ground:#0d1413; --surface:#141d1c; --surface-2:#1b2625;
  --ink:#e6edec; --ink-2:#a8b8b6; --ink-3:#7d8d8b;
  --linha:#263432; --linha-forte:#384845;
  --acento:#4fbfae; --acento-fraco:#16302d;
  --confere:#6cc294; --suspeita:#d8a441; --errada:#e58272;
  --confere-fundo:#152922; --suspeita-fundo:#2b2415; --errada-fundo:#2c1a17;
  --sombra:0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.25);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  font-size:16px; line-height:1.5; -webkit-text-size-adjust:100%;
}
.mono{font-family:ui-monospace,"SF Mono","Roboto Mono",Menlo,Consolas,monospace}

/* ---- barra ---- */
header{
  position:sticky; top:0; z-index:10; background:var(--surface);
  border-bottom:1px solid var(--linha); box-shadow:var(--sombra);
}
.barra{max-width:46rem; margin:0 auto; padding:.75rem 1rem .6rem}
.titulo{display:flex; align-items:baseline; gap:.6rem; flex-wrap:wrap}
h1{font-size:1rem; font-weight:650; letter-spacing:-.01em; margin:0}
.contagem{font-size:.8rem; color:var(--ink-3); font-variant-numeric:tabular-nums}
.trilho{height:3px; background:var(--surface-2); border-radius:2px; margin:.55rem 0 .5rem; overflow:hidden; display:flex}
.trilho i{display:block; height:100%; transition:width .2s}
.tf{background:var(--confere)} .ts{background:var(--suspeita)} .te{background:var(--errada)}
.filtros{display:flex; gap:.35rem; overflow-x:auto; padding-bottom:.15rem; scrollbar-width:none}
.filtros::-webkit-scrollbar{display:none}
.filtros button{
  flex:0 0 auto; font:inherit; font-size:.78rem; padding:.28rem .6rem;
  border:1px solid var(--linha-forte); background:transparent; color:var(--ink-2);
  border-radius:999px; cursor:pointer; white-space:nowrap;
}
.filtros button[aria-pressed="true"]{background:var(--acento); border-color:var(--acento); color:var(--ground)}

/* ---- corpo ---- */
main{max-width:46rem; margin:0 auto; padding:1rem 1rem 6rem; display:flex; flex-direction:column; gap:1.4rem}
section{display:flex; flex-direction:column; gap:.7rem}
.cabecalho-arquivo{display:flex; flex-direction:column; gap:.3rem; padding-top:.4rem; border-top:2px solid var(--acento)}
.cabecalho-arquivo .arq{font-size:.72rem; color:var(--acento); letter-spacing:.04em}
.cabecalho-arquivo h2{margin:0; font-size:1.15rem; font-weight:650; letter-spacing:-.015em; text-wrap:balance}
.fenomeno{margin:0; font-family:ui-serif,Georgia,"Noto Serif",serif; font-size:.95rem; color:var(--ink-2); font-style:italic; text-wrap:pretty}

/* ---- cartão ---- */
article{
  background:var(--surface); border:1px solid var(--linha); border-left:4px solid var(--linha-forte);
  border-radius:4px; padding:.8rem .9rem; display:flex; flex-direction:column; gap:.6rem;
}
article[data-veredicto="confere"]{border-left-color:var(--confere); background:var(--confere-fundo)}
article[data-veredicto="suspeita"]{border-left-color:var(--suspeita); background:var(--suspeita-fundo)}
article[data-veredicto="errada"]{border-left-color:var(--errada); background:var(--errada-fundo)}
.topo{display:flex; align-items:center; gap:.5rem; flex-wrap:wrap}
.endereco{font-size:.74rem; color:var(--acento); font-weight:600}
.chip{
  font-size:.68rem; letter-spacing:.03em; text-transform:uppercase;
  padding:.12rem .45rem; border-radius:3px; border:1px solid currentColor; color:var(--ink-3);
}
.chip.debatido{color:var(--suspeita)} .chip.hipotese{color:var(--errada)}
.chip.ponte{color:var(--acento)}

.cadeia{display:flex; flex-direction:column; gap:.2rem}
.no{font-size:.95rem; line-height:1.35; text-wrap:pretty}
.no small{display:block; font-size:.7rem; color:var(--ink-3); margin-top:.1rem;
  font-family:ui-monospace,"SF Mono","Roboto Mono",Menlo,Consolas,monospace; word-break:break-all}
.seta{display:flex; align-items:center; gap:.45rem; color:var(--acento); font-size:.8rem; padding:.15rem 0}
.seta::before{content:"↓"; font-size:1rem; line-height:1}
.seta b{font-weight:600; letter-spacing:.02em}

.porque{
  margin:0; font-family:ui-serif,Georgia,"Noto Serif",serif;
  font-size:.95rem; line-height:1.6; color:var(--ink); text-wrap:pretty;
  padding-left:.7rem; border-left:2px solid var(--linha);
}
.condicao{margin:0; font-size:.82rem; color:var(--suspeita)}
.meta{display:flex; flex-wrap:wrap; gap:.3rem .5rem; font-size:.76rem; color:var(--ink-3)}
.meta code{font-family:ui-monospace,"SF Mono","Roboto Mono",Menlo,Consolas,monospace; font-size:.72rem}

.veredicto{display:flex; gap:.4rem; padding-top:.15rem}
.veredicto button{
  flex:1; font:inherit; font-size:.8rem; padding:.4rem .3rem; cursor:pointer;
  border:1px solid var(--linha-forte); background:transparent; color:var(--ink-2); border-radius:3px;
}
.veredicto button:hover{border-color:var(--ink-3)}
.veredicto button[aria-pressed="true"]{color:var(--surface); font-weight:600}
.veredicto button[data-v="confere"][aria-pressed="true"]{background:var(--confere); border-color:var(--confere)}
.veredicto button[data-v="suspeita"][aria-pressed="true"]{background:var(--suspeita); border-color:var(--suspeita)}
.veredicto button[data-v="errada"][aria-pressed="true"]{background:var(--errada); border-color:var(--errada)}
:focus-visible{outline:2px solid var(--acento); outline-offset:2px}

/* ---- rodapé ---- */
footer{
  position:fixed; left:0; right:0; bottom:0; z-index:10; background:var(--surface);
  border-top:1px solid var(--linha); box-shadow:0 -4px 12px rgba(19,27,26,.06);
}
.rodape{max-width:46rem; margin:0 auto; padding:.6rem 1rem; display:flex; align-items:center; gap:.6rem}
.rodape span{font-size:.8rem; color:var(--ink-3); flex:1; font-variant-numeric:tabular-nums}
.rodape button{
  font:inherit; font-size:.82rem; padding:.4rem .8rem; cursor:pointer; border-radius:3px;
  border:1px solid var(--acento); background:var(--acento); color:var(--surface); font-weight:600;
}
.rodape button.secundario{background:transparent; color:var(--ink-2); border-color:var(--linha-forte); font-weight:400}
dialog{
  border:1px solid var(--linha); border-radius:6px; background:var(--surface); color:var(--ink);
  max-width:min(42rem,92vw); width:100%; padding:1rem; box-shadow:var(--sombra);
}
dialog::backdrop{background:rgba(0,0,0,.45)}
dialog h3{margin:0 0 .5rem; font-size:.95rem}
dialog textarea{
  width:100%; min-height:14rem; font-family:ui-monospace,"SF Mono","Roboto Mono",Menlo,monospace;
  font-size:.76rem; line-height:1.5; background:var(--surface-2); color:var(--ink);
  border:1px solid var(--linha); border-radius:3px; padding:.6rem; resize:vertical;
}
dialog .acoes{display:flex; gap:.5rem; margin-top:.6rem; justify-content:flex-end}
.vazio{color:var(--ink-3); font-size:.9rem; text-align:center; padding:2rem 0}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<header>
  <div class="barra">
    <div class="titulo">
      <h1>Auditoria científica</h1>
      <span class="contagem" id="contagem"></span>
    </div>
    <div class="trilho"><i class="tf" id="bf"></i><i class="ts" id="bs"></i><i class="te" id="be"></i></div>
    <div class="filtros" id="filtros">
      <button data-f="tudo" aria-pressed="true">Tudo</button>
      <button data-f="pendente" aria-pressed="false">Não revisadas</button>
      <button data-f="marcada" aria-pressed="false">Marcadas</button>
      <button data-f="debatido" aria-pressed="false">Debatidas</button>
      <button data-f="ponte" aria-pressed="false">Pontes entre arquivos</button>
    </div>
  </div>
</header>

<main id="lista"></main>

<footer>
  <div class="rodape">
    <span id="resumo"></span>
    <button class="secundario" id="limpar">Limpar</button>
    <button id="exportar">Reportar</button>
  </div>
</footer>

<dialog id="dlg">
  <h3>Cole isto de volta na conversa</h3>
  <textarea id="saida" readonly></textarea>
  <div class="acoes">
    <button class="secundario" id="copiar">Copiar</button>
    <button id="fechar">Fechar</button>
  </div>
</dialog>

<script>
const D = ${json};
const CHAVE = 'neurolab-profundo/auditoria/v1';
let marcas = {};
try { marcas = JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch(e) { marcas = {}; }
let filtro = 'tudo';

const salvar = ()=>{ try { localStorage.setItem(CHAVE, JSON.stringify(marcas)); } catch(e){} };

function passaNoFiltro(it){
  const v = marcas[it.chave];
  if(filtro === 'pendente')  return !v;
  if(filtro === 'marcada')   return v === 'suspeita' || v === 'errada';
  if(filtro === 'debatido')  return it.certeza !== 'consolidado';
  if(filtro === 'ponte')     return it.cruza;
  return true;
}

function cartao(it){
  const art = document.createElement('article');
  art.dataset.chave = it.chave;
  if(marcas[it.chave]) art.dataset.veredicto = marcas[it.chave];

  const chips = [];
  if(it.certeza !== 'consolidado') chips.push('<span class="chip ' + it.certeza + '">' + it.certeza + '</span>');
  if(it.cruza) chips.push('<span class="chip ponte">ponte entre arquivos</span>');

  art.innerHTML =
    '<div class="topo"><span class="endereco mono">' + it.endereco + '</span>' + chips.join('') + '</div>' +
    '<div class="cadeia">' +
      '<div class="no">' + it.deTexto + '<small>' + it.de + '</small></div>' +
      '<div class="seta"><b>' + it.verbo + '</b></div>' +
      '<div class="no">' + it.paraTexto + '<small>' + it.para + '</small></div>' +
    '</div>' +
    (it.condicao ? '<p class="condicao">só quando: ' + it.condicao + '</p>' : '') +
    '<p class="porque">' + it.porque + '</p>' +
    '<div class="meta">' +
      (it.requer.length ? '<span>exige ' + it.requer.join(' · ') + '</span>' : '') +
      (it.quant ? Object.keys(it.quant).map(k=>'<span><code>' + k + '</code> ' + it.quant[k] + '</span>').join('') : '') +
      '<span>usada em ' + it.mecanismos.length + ' mecanismo' + (it.mecanismos.length === 1 ? '' : 's') + '</span>' +
    '</div>' +
    '<div class="veredicto">' +
      ['confere','suspeita','errada'].map(v=>
        '<button data-v="' + v + '" aria-pressed="' + (marcas[it.chave] === v) + '">' + v + '</button>').join('') +
    '</div>';

  art.querySelectorAll('.veredicto button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = b.dataset.v;
      if(marcas[it.chave] === v) delete marcas[it.chave]; else marcas[it.chave] = v;
      salvar();
      art.dataset.veredicto = marcas[it.chave] || '';
      if(!marcas[it.chave]) delete art.dataset.veredicto;
      art.querySelectorAll('.veredicto button').forEach(o=>
        o.setAttribute('aria-pressed', String(marcas[it.chave] === o.dataset.v)));
      atualizar();
      if(filtro !== 'tudo') setTimeout(desenhar, 250);
    });
  });
  return art;
}

function desenhar(){
  const lista = document.getElementById('lista');
  lista.textContent = '';
  let mostrados = 0;
  D.arquivos.forEach(a=>{
    const doArquivo = D.itens.filter(i=>i.arquivo === a.arquivo && passaNoFiltro(i));
    if(!doArquivo.length) return;
    mostrados += doArquivo.length;
    const sec = document.createElement('section');
    const cab = document.createElement('div');
    cab.className = 'cabecalho-arquivo';
    cab.innerHTML = '<span class="arq mono">' + a.arquivo + ' · ' + doArquivo.length + ' de ' + a.quantas + '</span>' +
      '<h2>' + a.titulo + '</h2>' +
      (a.fenomeno ? '<p class="fenomeno">' + a.fenomeno + '</p>' : '');
    sec.appendChild(cab);
    doArquivo.forEach(it=>sec.appendChild(cartao(it)));
    lista.appendChild(sec);
  });
  if(!mostrados){
    const p = document.createElement('p');
    p.className = 'vazio';
    p.textContent = 'Nada neste filtro.';
    lista.appendChild(p);
  }
}

function atualizar(){
  const vs = Object.values(marcas);
  const c = vs.filter(v=>v === 'confere').length;
  const s = vs.filter(v=>v === 'suspeita').length;
  const e = vs.filter(v=>v === 'errada').length;
  const revisadas = c + s + e;
  document.getElementById('contagem').textContent = revisadas + ' de ' + D.total + ' revisadas';
  document.getElementById('bf').style.width = (100 * c / D.total) + '%';
  document.getElementById('bs').style.width = (100 * s / D.total) + '%';
  document.getElementById('be').style.width = (100 * e / D.total) + '%';
  document.getElementById('resumo').textContent =
    s + e === 0 ? (revisadas ? 'nada marcado até agora' : D.total + ' transições · ' + D.debatidos + ' não consolidadas')
                : s + ' suspeita' + (s === 1 ? '' : 's') + ' · ' + e + ' errada' + (e === 1 ? '' : 's');
}

document.getElementById('filtros').addEventListener('click', ev=>{
  const b = ev.target.closest('button'); if(!b) return;
  filtro = b.dataset.f;
  document.querySelectorAll('#filtros button').forEach(o=>
    o.setAttribute('aria-pressed', String(o === b)));
  desenhar(); window.scrollTo(0, 0);
});

document.getElementById('exportar').addEventListener('click', ()=>{
  const marcadas = D.itens.filter(i=>marcas[i.chave] === 'suspeita' || marcas[i.chave] === 'errada');
  const linhas = marcadas.map(i=>
    i.endereco + '  ' + marcas[i.chave].toUpperCase() + '  ' + i.de + ' > ' + i.para);
  const vs = Object.values(marcas);
  const txt = (linhas.length ? linhas.join('\\n') : '(nada marcado)') +
    '\\n\\n— ' + vs.filter(v=>v === 'confere').length + ' conferem, ' +
    vs.filter(v=>v === 'suspeita').length + ' suspeitas, ' +
    vs.filter(v=>v === 'errada').length + ' erradas, de ' + D.total + ' transições.';
  document.getElementById('saida').value = txt;
  document.getElementById('dlg').showModal();
});
document.getElementById('copiar').addEventListener('click', async ()=>{
  const ta = document.getElementById('saida');
  try { await navigator.clipboard.writeText(ta.value); }
  catch(e){ ta.select(); document.execCommand('copy'); }
  document.getElementById('copiar').textContent = 'Copiado';
  setTimeout(()=>{ document.getElementById('copiar').textContent = 'Copiar'; }, 1500);
});
document.getElementById('fechar').addEventListener('click', ()=>document.getElementById('dlg').close());
document.getElementById('limpar').addEventListener('click', ()=>{
  if(!Object.keys(marcas).length) return;
  if(!confirm('Apagar as ' + Object.keys(marcas).length + ' marcas?')) return;
  marcas = {}; salvar(); desenhar(); atualizar();
});

desenhar(); atualizar();
</script>
`;

fs.writeFileSync(SAIDA, html);
console.log(`auditoria.html: ${Math.round(html.length / 1024)} KB · ${DADOS.total} transições · ` +
            `${DADOS.debatidos} não consolidadas · ${g.arquivos.length} arquivos`);

module.exports = { SAIDA };
