#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · monta o app.html

   Um arquivo só, sem servidor, sem dependência, sem rede: dá para mandar
   para o celular e abrir. É a forma de protótipo que cabe em quem estuda
   no telefone.

   A regra que importa: `src/` NÃO é adaptado para o navegador. Os módulos
   entram exatamente como o Node os executa, e o que muda é o ambiente em
   volta — um `require` mínimo e um `node:fs` falso servindo o conteúdo já
   embutido. Se eu tivesse feito o contrário (versões separadas para Node e
   navegador), o app rodaria um motor que portão nenhum vigia.

   `app.html` é gerado, nunca editado à mão. `tools/test-app.js` confere
   que o arquivo commitado corresponde às fontes de hoje.

   Uso: node tools/build-app.js
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const MODULOS = ['grafo', 'estudo', 'percurso', 'perguntas'];
const SAIDA = path.join(RAIZ, 'app.html');

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

module.exports = { construir, MODULOS, SAIDA };

if(require.main === module){
  const html = construir();
  fs.writeFileSync(SAIDA, html);
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log(`app.html: ${kb} KB · ${MODULOS.length} módulos · ` +
              `${fs.readdirSync(path.join(RAIZ, 'content')).filter(f=>f.endsWith('.json')).length} arquivos de conteúdo`);
  console.log('Abra direto no navegador — não precisa de servidor.');
}
