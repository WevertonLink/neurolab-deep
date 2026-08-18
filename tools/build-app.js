#!/usr/bin/env node
/* =====================================================================
   NeuroLab Deep · monta o site

   Um arquivo só, sem servidor, sem dependência, sem rede: dá para mandar
   para o celular e abrir. É a forma de protótipo que cabe em quem estuda
   no telefone.

   A regra que importa: `src/` NÃO é adaptado para o navegador. Os módulos
   entram exatamente como o Node os executa, e o que muda é o ambiente em
   volta — um `require` mínimo e um `node:fs` falso servindo o conteúdo já
   embutido. Se eu tivesse feito o contrário (versões separadas para Node e
   navegador), o app rodaria um motor que portão nenhum vigia.

   `index.html` é gerado, nunca editado à mão. `tools/test-app.js` confere
   que os arquivos commitados correspondem às fontes de hoje.

   Uso: node tools/build-app.js
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.join(__dirname, '..');
const MODULOS = ['grafo', 'estudo', 'percurso', 'perguntas'];
const SAIDA = path.join(RAIZ, 'index.html');
const SAIDA_SW = path.join(RAIZ, 'sw.js');

/* Os quatro arquivos que o service worker precisa guardar. É uma lista curta
   porque o motor e o conteúdo inteiro já vão dentro do `index.html`. */
const ATIVOS = ['./', './index.html', './manifest.webmanifest',
                './icons/icon-192.png', './icons/icon-512.png'];

/* A `VERSION` do service worker é DERIVADA do conteúdo, não escrita à mão.
   No neurolab-v2 ela é manual, e a consequência de esquecer de incrementá-la
   é a pior possível num app offline: o usuário fica preso numa versão antiga
   para sempre, sem sinal nenhum de que isso aconteceu. Aqui, mudar qualquer
   byte do app muda o hash, e o cache velho é descartado sozinho. */
const versaoDe = html => 'deep-' + crypto.createHash('sha256')
  .update(html).digest('hex').slice(0, 12);

function montarSW(html){
  return `/* =====================================================================
   NeuroLab Deep · service worker

   GERADO por tools/build-app.js — não edite à mão.

   VERSION é o hash do index.html. Não existe "esquecer de incrementar":
   qualquer mudança no app produz uma versão nova, e a antiga é apagada.
   \`tools/test-app.js\` confere que este arquivo corresponde ao index.html
   commitado, de modo que publicar um app que o portão nunca viu falha o CI.
   ===================================================================== */
const VERSION = '${versaoDe(html)}';
const ATIVOS = ${JSON.stringify(ATIVOS, null, 2).replace(/\n/g, '\n')};

self.addEventListener('install', function(ev){
  ev.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ATIVOS); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(ev){
  ev.waitUntil(caches.keys().then(function(chaves){
    return Promise.all(chaves.filter(function(k){ return k !== VERSION; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* Cache primeiro, rede depois. O app é um arquivo só e não conversa com
   servidor nenhum: uma vez guardado, funciona em modo avião, que é o ponto.
   A busca de rede em segundo plano atualiza o cache para a próxima abertura. */
self.addEventListener('fetch', function(ev){
  if(ev.request.method !== 'GET') return;
  ev.respondWith(caches.match(ev.request).then(function(guardado){
    var daRede = fetch(ev.request).then(function(resp){
      if(resp && resp.ok && resp.type === 'basic'){
        var copia = resp.clone();
        caches.open(VERSION).then(function(c){ c.put(ev.request, copia); });
      }
      return resp;
    }).catch(function(){ return guardado; });
    return guardado || daRede;
  }));
});
`;
}

/* `</script>` dentro de uma string mataria o bloco no navegador. */
const seguro = txt => txt.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

function montarMotor(){
  const dirConteudo = path.join(RAIZ, 'content');
  const conteudo = {};
  fs.readdirSync(dirConteudo).filter(f=>f.endsWith('.json')).sort().forEach(f=>{
    conteudo[f] = JSON.parse(fs.readFileSync(path.join(dirConteudo, f), 'utf8'));
  });

  const partes = [];
  partes.push('/* gerado por tools/build-app.js — não edite à mão */');
  partes.push('var __CONTEUDO = ' + JSON.stringify(conteudo) + ';');

  /* O `fs` falso: `carregar()` lê o mesmo caminho de sempre, e aqui o
     caminho vira uma chave do objeto embutido. `grafo.js` não sabe a
     diferença, e é isso que garante que o app roda o motor testado. */
  partes.push(`
var __mods = {};
var __dirname = '.';
function require(pedido){
  if(pedido === 'node:fs' || pedido === 'fs') return {
    readdirSync: function(){ return Object.keys(__CONTEUDO); },
    readFileSync: function(p){
      var nome = String(p).split('/').pop();
      if(!(nome in __CONTEUDO)) throw new Error('conteúdo ausente no pacote: ' + nome);
      return JSON.stringify(__CONTEUDO[nome]);
    }
  };
  if(pedido === 'node:path' || pedido === 'path') return {
    join: function(){ return Array.prototype.slice.call(arguments).join('/'); }
  };
  var nome = String(pedido).replace(/^\\.\\//, '').replace(/\\.js$/, '');
  if(!(nome in __mods)) throw new Error('módulo não empacotado: ' + pedido);
  return __mods[nome];
}`);

  MODULOS.forEach(nome=>{
    const fonte = fs.readFileSync(path.join(RAIZ, 'src', nome + '.js'), 'utf8');
    partes.push(`\n/* ===== src/${nome}.js ===== */\n(function(){\n` +
                `var module = { exports: {} }, exports = module.exports;\n` +
                fonte +
                `\n__mods[${JSON.stringify(nome)}] = module.exports;\n})();`);
  });

  return partes.join('\n');
}

function construir(){
  const casca = fs.readFileSync(path.join(RAIZ, 'app', 'casca.html'), 'utf8');
  const ui = fs.readFileSync(path.join(RAIZ, 'app', 'ui.js'), 'utf8');
  const html = casca
    .replace('/*__MOTOR__*/', ()=>seguro(montarMotor()))
    .replace('/*__UI__*/', ()=>seguro(ui));
  if(html.indexOf('__MOTOR__') >= 0 || html.indexOf('__UI__') >= 0){
    throw new Error('a casca não tem os dois pontos de injeção');
  }
  return html;
}

module.exports = { construir, montarSW, versaoDe, MODULOS, SAIDA, SAIDA_SW, ATIVOS };

if(require.main === module){
  const html = construir();
  fs.writeFileSync(SAIDA, html);
  fs.writeFileSync(SAIDA_SW, montarSW(html));
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log(`index.html: ${kb} KB · ${MODULOS.length} módulos · ` +
              `${fs.readdirSync(path.join(RAIZ, 'content')).filter(f=>f.endsWith('.json')).length} arquivos de conteúdo`);
  console.log(`sw.js: VERSION ${versaoDe(html)}`);
  console.log('Abra direto no navegador — não precisa de servidor.');
}
