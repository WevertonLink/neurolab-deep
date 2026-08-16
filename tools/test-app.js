#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão do app

   O app.html é gerado, e gerado é onde as coisas apodrecem em silêncio: o
   arquivo commitado descola das fontes, um módulo deixa de ser empacotado,
   o conteúdo fica velho. Nada disso dá erro visível — dá um app que estuda
   um grafo que não existe mais.

     1. PACOTE     — o que está dentro do app.html é byte a byte o `src/` e
                     o `content/` de hoje.
     2. CARREGA    — o app monta num DOM stubado e mostra o percurso real.
     3. SESSÃO     — estudar gera perguntas, responder o gabarito faz a
                     caixa subir NO ESTADO, e errar faz cair.
     4. TELA BURRA — nenhuma regra de estudo mora na tela: a nota que chega
                     ao cronograma é a da correção, não do DOM.
     5. PERSISTE   — o estado sobrevive a recarregar, e conteúdo novo abre
                     caixa sem apagar progresso.

   Roda em ~1s no Termux, sem navegador. Playwright fica para o CI.

   Uso: node tools/test-app.js   ·   MOTIVOS=1 mostra as mortes
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('./build-app.js');

class Falha extends Error {}
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) throw new Falha(msg); };
const RAIZ = path.join(__dirname, '..');
const T0 = Date.UTC(2026, 7, 16, 9, 0, 0);

/* ---------- um DOM mínimo, mas honesto ----------
   Só o que a tela usa. Se ela passar a usar mais, o stub quebra e eu fico
   sabendo — que é melhor do que um stub permissivo escondendo uso novo. */
function fazerDom(){
  function Elemento(tag){
    this.tag = tag; this.filhos = []; this.attrs = {}; this.className = '';
    this._texto = ''; this.onclick = null; this.disabled = false; this.style = {};
    const self = this;
    this.classList = {
      add(c){ if(!self.temClasse(c)) self.className = (self.className + ' ' + c).trim(); },
      remove(c){ self.className = self.className.split(/\s+/).filter(x=>x && x !== c).join(' '); },
      contains(c){ return self.temClasse(c); }
    };
  }
  Elemento.prototype.temClasse = function(c){ return this.className.split(/\s+/).indexOf(c) >= 0; };
  Elemento.prototype.appendChild = function(n){ this.filhos.push(n); return n; };
  Elemento.prototype.setAttribute = function(k, v){ this.attrs[k] = String(v); if(k === 'class') this.className = String(v); };
  Elemento.prototype.getAttribute = function(k){ return k === 'class' ? this.className : (this.attrs[k] || null); };
  Object.defineProperty(Elemento.prototype, 'textContent', {
    get(){ return this._texto || this.filhos.map(f=>f.textContent || '').join(''); },
    set(v){ this._texto = String(v); this.filhos = []; }
  });
  Object.defineProperty(Elemento.prototype, 'innerHTML', {
    get(){ return this._texto; },
    set(v){ this._texto = String(v); this.filhos = []; }
  });

  const porId = {};
  ['app', 'rodape', 'acao'].forEach(id=>{ porId[id] = new Elemento('div'); });
  porId.rodape.className = 'rodape oculto';

  const guardado = {};
  return {
    Elemento, porId,
    document: {
      getElementById: id => porId[id] || null,
      createElement: t => new Elemento(t),
      createTextNode(t){ const n = new Elemento('#texto'); n.textContent = t; return n; },
      body: new Elemento('body')
    },
    localStorage: {
      getItem: k => (k in guardado ? guardado[k] : null),
      setItem(k, v){ guardado[k] = String(v); },
      _bruto: guardado
    }
  };
}

/* Anda a árvore procurando elementos por classe. */
function porClasse(raiz, classe, achados){
  achados = achados || [];
  (raiz.filhos || []).forEach(f=>{
    if(f.temClasse && f.temClasse(classe)) achados.push(f);
    porClasse(f, classe, achados);
  });
  return achados;
}
function textoTodo(raiz){
  return (raiz._texto || '') + (raiz.filhos || []).map(textoTodo).join(' ');
}

/* Sobe o app num contexto isolado, com o relógio parado. */
function subir(html, armazenamentoInicial){
  const dom = fazerDom();
  if(armazenamentoInicial) dom.localStorage._bruto['neurolab-profundo/estado/v1'] = armazenamentoInicial;
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(blocos.length !== 2) throw new Error(`o app tem ${blocos.length} blocos de script, esperava 2`);

  const ctx = vm.createContext({
    console, Math, JSON, Object, Array, String, Number, Boolean, Error, Set, Map, Buffer,
    Date: new Proxy(Date, { get(alvo, p){ return p === 'now' ? ()=>T0 : alvo[p]; } }),
    document: dom.document, localStorage: dom.localStorage,
    window: { scrollTo(){}, localStorage: dom.localStorage }
  });
  vm.runInContext(blocos[0], ctx, { filename: 'motor.js' });
  const req = ctx.require;                    // o motor, exatamente como o app o vê
  vm.runInContext(blocos[1], ctx, { filename: 'ui.js' });
  return { dom, ctx, req, app: dom.porId.app, rodape: dom.porId.rodape, acao: dom.porId.acao };
}

const sujeito = ()=>({ html: B.construir(),
                       uiFonte: fs.readFileSync(path.join(RAIZ, 'app', 'ui.js'), 'utf8') });
const clonarSujeito = s => ({ html: s.html, uiFonte: s.uiFonte });

/* ===================================================================== */
const PROVAS = [];

/* ---------- 1. PACOTE ---------- */
PROVAS.push({
  nome: 'PACOTE · o app carrega o mesmo motor que os portões provam',
  roda(s){
    /* A fonte INTEIRA, não uma assinatura: o app tem de rodar exatamente o
       módulo que os outros portões provam, sem adaptação de navegador pelo
       caminho. Qualquer divergência aqui significa dois motores. */
    B.MODULOS.forEach(nome=>{
      const fonte = fs.readFileSync(path.join(RAIZ, 'src', nome + '.js'), 'utf8')
        .replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
      exigir(s.html.indexOf(fonte) >= 0,
        `src/${nome}.js não está inteiro dentro do app.html — o pacote descolou da fonte`);
    });

    const dirConteudo = path.join(RAIZ, 'content');
    const arquivos = fs.readdirSync(dirConteudo).filter(f=>f.endsWith('.json')).sort();
    exigir(arquivos.length > 0, 'não há conteúdo para empacotar');
    arquivos.forEach(f=>{
      exigir(s.html.indexOf(JSON.stringify(f)) >= 0, `${f} não foi empacotado no app`);
    });

    /* E o arquivo commitado tem de ser o que o build produz HOJE. Sem isto
       o app do celular estuda um grafo de semanas atrás. */
    if(fs.existsSync(B.SAIDA)){
      exigir(fs.readFileSync(B.SAIDA, 'utf8') === s.html,
        'app.html no repositório está diferente do que as fontes geram — rode `node tools/build-app.js`');
    }
  },
  mutantes: [
    { como: 'um módulo deixa de ser empacotado',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/\/\* ===== src\/percurso\.js ===== \*\/[\s\S]*?__mods\["percurso"\] = module\.exports;/,
                                '/* removido pelo mutante */'); return m; } },
    { como: 'o conteúdo embutido é esvaziado',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/var __CONTEUDO = \{[\s\S]*?\};\n/, 'var __CONTEUDO = {};\n'); return m; } },
    { como: 'o app.html do repositório fica velho em relação às fontes',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace('<title>NeuroLab Profundo</title>', '<title>versão antiga</title>');
        return m; } }
  ]
});

/* ---------- 2. CARREGA ---------- */
PROVAS.push({
  nome: 'CARREGA · o app monta e mostra o percurso do grafo real',
  roda(s){
    const v = subir(s.html);
    const G = v.req('./grafo.js'), P = v.req('./percurso.js'), E = v.req('./estudo.js');
    const g = G.carregar();

    exigir(Object.keys(g.mecanismos).length > 0, 'o app carregou um grafo sem mecanismo');
    exigir(g.transicoes.length > 0, 'o app carregou um grafo sem transição');

    const texto = textoTodo(v.app);
    exigir(texto.indexOf('NeuroLab Profundo') >= 0, 'a tela não tem título');
    const etapas = P.etapas(g).camadas.length;
    for(let i = 1; i <= etapas; i++){
      exigir(texto.indexOf('Etapa ' + i) >= 0, `a tela não mostra a etapa ${i}`);
    }
    Object.keys(g.mecanismos).forEach(id=>{
      exigir(texto.indexOf(g.mecanismos[id].fenomeno) >= 0,
        `a tela não mostra o fenômeno de "${id}"`);
    });

    /* os dois números, que é a correção contra a trilha de degraus iguais */
    exigir(texto.indexOf('Etapas concluídas') >= 0 && texto.indexOf('Caixas conquistadas') >= 0,
      'a tela mostra um número de progresso só — a contagem de etapas mente sozinha');

    exigir(!v.rodape.temClasse('oculto'), 'o botão de ação não apareceu');
    exigir(v.acao.textContent.indexOf('Estudar') >= 0,
      `o botão diz "${v.acao.textContent}" com tudo vencido`);
    exigir(typeof v.acao.onclick === 'function', 'o botão de estudar não tem ação');
    void E;
  },
  mutantes: [
    { como: 'a tela não mostra as etapas do percurso',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/texto: 'Etapa ' \+ e\.numero/, "texto: 'X'"); return m; } },
    { como: 'a tela mostra só a contagem de etapas, sem a de caixas',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/texto: 'Caixas conquistadas'/, "texto: 'Etapas de novo'"); return m; } },
    { como: 'o botão de estudar não recebe ação',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/acao\.onclick = aoClicar;/, 'acao.onclick = null;'); return m; } }
  ]
});

/* ---------- 3. SESSÃO ---------- */
PROVAS.push({
  nome: 'SESSÃO · responder o gabarito faz a caixa subir no estado',
  roda(s){
    const v = subir(s.html);
    const G = v.req('./grafo.js'), E = v.req('./estudo.js'), Q = v.req('./perguntas.js');
    const g = G.carregar(), idx = E.indexar(g);

    /* O relógio está parado em T0, então dá para reproduzir exatamente a
       sessão que a tela montou. */
    const st = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, st, id, T0, idx));
    const esperada = Q.montarSessao(g, st, T0, { idx, semente: (T0 / 60000) | 0 });
    exigir(esperada.perguntas.length > 1, 'a sessão prevista tem menos de duas perguntas');

    v.acao.onclick();                                    // "Estudar"
    const texto1 = textoTodo(v.app);
    exigir(texto1.indexOf(esperada.perguntas[0].enunciado) >= 0,
      'a primeira pergunta da tela não é a que o motor monta com a mesma semente');

    const alts = porClasse(v.app, 'alt');
    exigir(alts.length === esperada.perguntas[0].alternativas.length,
      `${alts.length} alternativas na tela contra ${esperada.perguntas[0].alternativas.length} na pergunta`);
    exigir(v.acao.disabled, 'dá para responder sem escolher nada');

    /* Responde o gabarito exato. */
    const p0 = esperada.perguntas[0];
    p0.alternativas.forEach((a, i)=>{ if(p0.corretas.indexOf(a.id) >= 0) alts[i].onclick(); });
    exigir(!v.acao.disabled, 'escolhi alternativas e o botão continuou travado');
    v.acao.onclick();                                    // "Responder"

    const texto2 = textoTodo(v.app);
    exigir(texto2.indexOf('Certo') >= 0, 'acertei o gabarito e a tela não disse que estava certo');
    p0.revelacao.forEach(r=>{
      exigir(texto2.indexOf(r.porque) >= 0,
        'a revelação não trouxe o `porque` da transição — a pergunta não ensinou nada');
    });

    /* Anda até o fim e fecha. */
    let voltas = 0;
    while(v.acao.textContent !== 'Voltar ao percurso' && voltas++ < 60){
      if(v.acao.disabled){
        const atuais = porClasse(v.app, 'alt');
        exigir(atuais.length > 0, 'pergunta sem alternativa para escolher');
        atuais[0].onclick();
      }
      v.acao.onclick();
    }
    exigir(voltas < 60, 'a sessão não terminou');

    const bruto = v.dom.localStorage._bruto['neurolab-profundo/estado/v1'];
    exigir(!!bruto, 'a sessão fechou e nada foi salvo');
    const salvo = JSON.parse(bruto);
    const estudadas = Object.keys(salvo.caixas).filter(k=>salvo.caixas[k].tentativas > 0);
    exigir(estudadas.length > 0, 'nenhuma caixa registrou tentativa depois da sessão');

    const chave = E.chaveDaCaixa(p0.transicoes[0], p0.operacao);
    exigir(salvo.caixas[chave] && salvo.caixas[chave].tentativas === 1,
      `a caixa "${chave}" que a primeira pergunta exercitou não recebeu exatamente uma decisão`);
    exigir(salvo.caixas[chave].caixa === 1,
      `acertei o gabarito e a caixa ficou em ${salvo.caixas[chave].caixa}, não subiu para 1`);
    exigir(salvo.caixas[chave].recorde === 1, 'o recorde não acompanhou a subida');
  },
  mutantes: [
    { como: 'a tela não anota a evidência no lote',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/s\.caixas \+= Q\.anotarNoLote\(s\.lote, p, c\);/,
                                's.caixas += 0;'); return m; } },
    { como: 'a sessão nunca fecha o lote, e nada chega ao cronograma',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/var r = E\.fecharLote\(g, estado, s\.lote, s\.agora\);/,
                                'var r = { decididas: [], ignoradas: [] };'); return m; } },
    { como: 'a revelação não é mostrada (a pergunta cobra e não ensina)',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/bloco\.appendChild\(el\('p', \{ texto: r\.porque \}\)\);/, ''); return m; } }
  ]
});

/* ---------- 4. TELA BURRA ---------- */
PROVAS.push({
  nome: 'TELA BURRA · a nota que chega ao cronograma é a da correção',
  roda(s){
    const v = subir(s.html);
    const G = v.req('./grafo.js'), E = v.req('./estudo.js'), Q = v.req('./perguntas.js');
    const g = G.carregar(), idx = E.indexar(g);
    const st = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, st, id, T0, idx));
    const esperada = Q.montarSessao(g, st, T0, { idx, semente: (T0 / 60000) | 0 });
    const p0 = esperada.perguntas[0];

    v.acao.onclick();
    const alts = porClasse(v.app, 'alt');
    /* Responde SÓ errado: marca apenas distratores. */
    let marcou = 0;
    p0.alternativas.forEach((a, i)=>{
      if(p0.corretas.indexOf(a.id) < 0 && marcou < 2){ alts[i].onclick(); marcou++; }
    });
    exigir(marcou > 0, 'a pergunta não tem distrator para marcar');
    v.acao.onclick();

    const texto = textoTodo(v.app);
    exigir(texto.indexOf('Errado') >= 0 || texto.indexOf('Quase') >= 0,
      'respondi só errado e a tela não acusou');
    exigir(texto.indexOf('nota 0.00') >= 0,
      'marcar apenas distratores tinha de dar nota zero na tela');

    while(v.acao.textContent !== 'Voltar ao percurso'){
      if(v.acao.disabled) porClasse(v.app, 'alt')[0].onclick();
      v.acao.onclick();
    }
    const salvo = JSON.parse(v.dom.localStorage._bruto['neurolab-profundo/estado/v1']);
    const chave = E.chaveDaCaixa(p0.transicoes[0], p0.operacao);
    exigir(salvo.caixas[chave].caixa === 0,
      `errei tudo e a caixa foi para ${salvo.caixas[chave].caixa}`);
    exigir(salvo.caixas[chave].ultimaNota === 0,
      `a nota que chegou ao cronograma foi ${salvo.caixas[chave].ultimaNota}, e eu errei tudo`);
    exigir(salvo.caixas[chave].recorde === 0, 'errar tudo mexeu no recorde');

    /* E a tela não pode carregar regra de estudo própria: se o número da
       nota de corte ou dos intervalos aparecer no ui.js, existe uma regra
       ali que nenhum portão vigia. */
    const ui = s.uiFonte;
    [/\bPASSA\s*=/, /\[\s*1\s*,\s*3\s*,\s*7\s*,\s*14/, /\b0\.8\b/, /TETO_RECAIDA\s*=/].forEach(re=>{
      exigir(!re.test(ui), `app/ui.js contém regra de estudo própria (${re}) — a tela tem de ser burra`);
    });
  },
  mutantes: [
    { como: 'a tela decide sozinha que o aluno acertou',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/var c = Q\.corrigir\(p, escolhidas\);/,
          'var c = Q.corrigir(p, escolhidas); c.nota = 1; c.acertou = true; ' +
          'c.porTransicao = c.porTransicao.map(function(x){ return { transicao: x.transicao, nota: 1 }; });');
        return m; } },
    { como: 'a tela corrige contra o gabarito em vez de contra o que foi marcado',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/var c = Q\.corrigir\(p, escolhidas\);/,
                                'var c = Q.corrigir(p, p.corretas);'); return m; } },
    { como: 'a tela ganha a sua própria nota de corte',
      aplicar(s){ const m = clonarSujeito(s);
        m.uiFonte = 'var PASSA = 0.8;\n' + m.uiFonte; return m; } }
  ]
});

/* ---------- 5. PERSISTE ---------- */
PROVAS.push({
  nome: 'PERSISTE · o progresso sobrevive a recarregar, e conteúdo novo não o apaga',
  roda(s){
    const v1 = subir(s.html);
    v1.acao.onclick();
    while(v1.acao.textContent !== 'Voltar ao percurso'){
      if(v1.acao.disabled) porClasse(v1.app, 'alt')[0].onclick();
      v1.acao.onclick();
    }
    const salvo = v1.dom.localStorage._bruto['neurolab-profundo/estado/v1'];
    exigir(!!salvo, 'nada foi salvo na primeira sessão');
    const antes = JSON.parse(salvo);
    const estudadas = Object.keys(antes.caixas).filter(k=>antes.caixas[k].tentativas > 0);
    exigir(estudadas.length > 0, 'a primeira sessão não estudou nada');

    /* Agora abre o app DE NOVO com o armazenamento anterior. É a recarga
       real: se `carregarEstado` ignorasse o que está salvo, a tela voltaria
       a mostrar tudo vencido como se nada tivesse sido estudado. */
    const vencidasFrescas = subir(s.html).acao.textContent;
    const v2 = subir(s.html, salvo);
    const vencidasDepois = v2.acao.textContent;
    exigir(vencidasDepois !== vencidasFrescas,
      `depois de estudar, reabrir mostrou "${vencidasDepois}" — o mesmo de um app zerado`);

    const numero = t => { const m = /\((\d+)/.exec(t); return m ? Number(m[1]) : -1; };
    exigir(numero(vencidasDepois) < numero(vencidasFrescas),
      `reabrir mostrou ${numero(vencidasDepois)} vencidas contra ${numero(vencidasFrescas)} de um app zerado`);

    /* E o progresso continua lá depois de semear de novo — é o que faz
       conteúdo novo aparecer sem migração e sem apagar nada. */
    const E = v2.req('./estudo.js'), G = v2.req('./grafo.js');
    const g = G.carregar(), idx = E.indexar(g);
    const recarregado = JSON.parse(salvo);
    const chaves = Object.keys(recarregado.caixas).length;
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, recarregado, id, T0, idx));
    exigir(Object.keys(recarregado.caixas).length === chaves,
      'semear de novo criou caixa que já existia');
    estudadas.forEach(k=>{
      exigir(recarregado.caixas[k].tentativas === antes.caixas[k].tentativas &&
             recarregado.caixas[k].recorde === antes.caixas[k].recorde,
        `semear de novo apagou o progresso de "${k}"`);
    });
  },
  mutantes: [
    { como: 'a sessão não salva o estado ao terminar',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/salvarEstado\(\);/, ''); return m; } },
    { como: 'carregar começa do zero e ignora o que estava salvo',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/var st = bruto \? JSON\.parse\(bruto\) : E\.novoEstado\(\);/,
                                'var st = E.novoEstado();'); return m; } },
    { como: 'semear reinicia as caixas já existentes',
      aplicar(s){ const m = clonarSujeito(s);
        m.html = m.html.replace(/if\(estado\.caixas\[chave\]\)\{ jaExistiam\.push\(chave\); return; \}/,
                                'if(estado.caixas[chave]) jaExistiam.push(chave);'); return m; } }
  ]
});

/* ===================================================================== */
const base = sujeito();
let falhou = false, mutantesMortos = 0, mutantesVivos = 0;

console.log(`app.html: ${(Buffer.byteLength(base.html, 'utf8') / 1024).toFixed(0)} KB · ` +
            `${B.MODULOS.length} módulos empacotados\n`);

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
    let morreu = false, motivo = '', aplicado = null;
    try {
      aplicado = mut.aplicar(base);
      prova.roda(aplicado);
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
  console.error(`App: FALHOU (${mutantesVivos} mutante(s) vivo(s))`);
  process.exit(1);
}
console.log(`App: ok — ${PROVAS.length} propriedades, ${checagens} checagens, ${mutantesMortos} mutantes mortos`);
