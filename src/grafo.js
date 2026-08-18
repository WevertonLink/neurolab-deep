/* =====================================================================
   NeuroLab Profundo · o grafo

   Os arquivos de `content/` são recortes de autoria, não módulos. Aqui eles
   viram UM grafo só. Nenhum arquivo declara ligação com outro: a composição
   acontece porque dois arquivos usam o mesmo id de nó.

   O átomo é a TRANSIÇÃO. A entidade é o objeto sobre o qual as transições
   operam. O mecanismo é um recorte — entrada e terminal —, e o conjunto de
   nós dele é CALCULADO pela travessia, nunca listado à mão.
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const CONTEUDO = path.join(RAIZ, 'content');

/* Vocabulário fechado. TODO tipo lê no sentido da seta: "A <tipo> B".
   `requer` foi removido daqui na Fase A por violar as duas regras — lia ao
   contrário ("A requer B" quando o sentido era B depender de A) e colidia
   com o campo `requer:` das entidades. Virou `compoe`: A é um dos termos
   que produzem B. */
const TIPOS_DE_TRANSICAO = ['causa', 'permite', 'compoe', 'modula', 'inibe', 'bloqueia', 'remove'];
const VERBO = { causa:'causa', permite:'permite', compoe:'compõe', modula:'modula',
                inibe:'inibe', bloqueia:'bloqueia', remove:'remove' };
const NIVEIS_DE_CERTEZA = ['consolidado', 'debatido', 'hipotese'];

function carregar(){
  const g = { entidades:{}, nos:{}, transicoes:[], mecanismos:{}, origem:{}, arquivos:[] };
  const arquivos = fs.readdirSync(CONTEUDO).filter(f=>f.endsWith('.json')).sort();
  for(const arq of arquivos){
    const dados = JSON.parse(fs.readFileSync(path.join(CONTEUDO, arq), 'utf8'));
    g.arquivos.push(arq);
    (dados.entidades||[]).forEach(e=>{ g.entidades[e.id] = e; g.origem[e.id] = arq; });
    (dados.nos||[]).forEach(n=>{ g.nos[n.id] = n; g.origem[n.id] = arq; });
    (dados.transicoes||[]).forEach((t,i)=>{ t._arquivo = arq; t._i = i; g.transicoes.push(t); });
    (dados.mecanismos||[]).forEach(m=>{ m._arquivo = arq; g.mecanismos[m.id] = m; });
  }
  return g;
}

/* ---------- travessia ---------- */

function saindoDe(g, noId){ return g.transicoes.filter(t=>t.de === noId); }
function chegandoEm(g, noId){ return g.transicoes.filter(t=>t.para === noId); }

// tudo que depende deste nó, direta ou indiretamente
function aJusante(g, noId){
  const vistos = new Set(), fila = [noId];
  while(fila.length){
    const atual = fila.shift();
    for(const t of saindoDe(g, atual)){
      if(vistos.has(t.para)) continue;
      vistos.add(t.para); fila.push(t.para);
    }
  }
  return vistos;
}

// tudo de que este nó depende
function aMontante(g, noId){
  const vistos = new Set(), fila = [noId];
  while(fila.length){
    const atual = fila.shift();
    for(const t of chegandoEm(g, atual)){
      if(vistos.has(t.de)) continue;
      vistos.add(t.de); fila.push(t.de);
    }
  }
  return vistos;
}

/* Todos os caminhos de A até B. Devolve listas de transições, não de nós —
   porque o átomo é a transição, e é ela que carrega o `porque`. */
function caminhos(g, de, para, limite){
  limite = limite || 200;
  const achados = [];
  (function anda(atual, trilha, visitados){
    if(achados.length >= limite) return;
    if(atual === para){ achados.push(trilha.slice()); return; }
    for(const t of saindoDe(g, atual)){
      if(visitados.has(t.para)) continue;          // não repete nó no mesmo caminho
      visitados.add(t.para);
      trilha.push(t);
      anda(t.para, trilha, visitados);
      trilha.pop();
      visitados.delete(t.para);
    }
  })(de, [], new Set([de]));
  return achados;
}

/* O recorte de um mecanismo: TUDO de que o terminal depende. Calculado,
   nunca listado.

   A primeira versão disto era `a jusante da entrada ∩ a montante do
   terminal`, e a Fase A mostrou que essa regra estava errada: ela descarta
   as CO-CAUSAS — o que determina o terminal sem descender da entrada. No
   potencial de repouso isso derrubava a permeabilidade desigual, que é
   justamente o fator de maior peso. Um mecanismo não é uma linha; é uma
   confluência. A `entrada` continua sendo por onde a narrativa começa (e o
   validador exige que o terminal seja alcançável a partir dela), mas quem
   define o recorte é o terminal. */
function subgrafo(g, mecanismoId){
  const m = g.mecanismos[mecanismoId];
  if(!m) return null;
  const nos = aMontante(g, m.terminal);
  nos.add(m.terminal);
  const transicoes = g.transicoes.filter(t=>nos.has(t.de) && nos.has(t.para));
  // raízes: nós do recorte que nada de dentro dele causa. A entrada é uma
  // delas; as outras são as co-causas.
  const raizes = [...nos].filter(n=>!transicoes.some(t=>t.para === n));
  return { mecanismo:m, nos, transicoes, raizes };
}

/* Pré-requisitos SEM bloqueio: outro mecanismo é pré-requisito deste quando
   o TERMINAL dele mora dentro do meu recorte — quando aquilo que ele explica
   é coisa de que eu dependo. Derivado, não escrito, e assimétrico de graça.

   Já tentei trocar isto por posse ("quem usa material de outro depende
   dele") e o resultado foi PIOR: o recorte da LTP tem 45 nós e o da
   transmissão sináptica tem 51, porque a LTP não alcança os ramos tardios
   da sinapse. Pela posse, a LTP virava dona do material da transmissão e a
   transmissão passava a depender da LTP — invertido. "Menor recorte" não
   serve como dono quando dois recortes se sobrepõem sem que um contenha o
   outro, e nenhuma variação simples disso é assimétrica, porque recorte é
   fecho a montante e os dois contêm a entrada um do outro.

   Fica o terminal, que nunca produziu dependência invertida: ele só produz
   dependência FALTANDO, e falta se conserta no conteúdo. Se um mecanismo
   deveria depender de outro e não depende, é porque a conclusão do primeiro
   não é usada pelo segundo — e ou existe uma afirmação verdadeira ligando
   os dois, ou a dependência que eu imaginava não existe. */
function prerequisitos(g, mecanismoId){
  const sg = subgrafo(g, mecanismoId);
  if(!sg) return [];
  return Object.keys(g.mecanismos).filter(id=>
    id !== mecanismoId && sg.nos.has(g.mecanismos[id].terminal));
}

/* Um nó "cruza arquivos" quando as transições que o tocam vêm de arquivos
   diferentes — é a assinatura da composição sem costura. */
function arquivosDoCaminho(caminho){
  return [...new Set(caminho.map(t=>t._arquivo))];
}

/* ---------- perturbação ----------
   Remove uma entidade ou uma transição e DERIVA o que deixa de acontecer.
   Nada aqui é escrito à mão: a consequência é o que some da alcançabilidade.
   É isto que substitui os contrafactuais autorados do NeuroLab.

   LIMITE CONHECIDO — alcançabilidade é OU, nunca E.
   Um nó com dois pais sobrevive se QUALQUER um deles sobrevive. Quando o nó
   só é verdadeiro com os dois juntos, a perturbação subestima o estrago e o
   gabarito sai curto (nunca invertido — isso é o defeito de polaridade, que
   é outro e está barrado no validador).

   Visto em 2026-08-18, no mecanismo 09: `sinal-global-da-credito-especifico`
   exige a marca de elegibilidade E a difusão do sinal. Remover a dopamina
   mata a difusão, o nó continua alcançável pela marca, e a perturbação
   conclui que só dois nós se perdem — quando, de fato, a atribuição de
   crédito inteira para.

   NÃO conserte isso reescrevendo o conteúdo para virar cadeia em série. A
   conjunção é real, e serializá-la para o número ficar bonito é falsificar
   o mecanismo para agradar o motor. O conserto certo é dar conjunção ao
   motor, e até lá o gabarito é conservador: o que ele lista realmente se
   perde, e pode faltar coisa. Ver a seção 10 de tools/valida-grafo.js, que
   avisa quando uma entidade nunca chega a derrubar nada. */
function perturbar(g, alvo, entradaId){
  const mortas = g.transicoes.filter(t=>{
    if(alvo.entidade) return (t.requer||[]).includes(alvo.entidade);
    if(alvo.transicao) return t === alvo.transicao;
    return false;
  });
  const vivas = g.transicoes.filter(t=>!mortas.includes(t));
  const antes = aJusante(g, entradaId);
  const depois = aJusante(Object.assign({}, g, {transicoes:vivas}), entradaId);
  const perdidos = [...antes].filter(n=>!depois.has(n));
  return { mortas, perdidos, restantes: depois };
}

/* Transições que dependem de uma entidade — para saber o que dá para perturbar */
function transicoesQueDependemDe(g, entidadeId){
  return g.transicoes.filter(t=>(t.requer||[]).includes(entidadeId));
}

/* ---------- explicação ----------
   A pergunta e a resposta saem da própria transição: não existe banco de
   perguntas escrito à mão. E `certeza` tem consequência didática — nada
   fora de `consolidado` chega ao estudo sem ressalva junto. */
const RESSALVA = {
  debatido: 'Há disputa na literatura sobre esta etapa. Trate como leitura provável, não como fato fechado.',
  hipotese: 'Isto é hipótese. Não estude como mecanismo estabelecido.'
};
function explicar(g, t){
  const de = g.nos[t.de], para = g.nos[t.para];
  const nome = id => (g.nos[id] && g.nos[id].descricao) || id;
  return {
    pergunta: `Por que "${nome(t.de)}" leva a "${nome(t.para)}"?`,
    resposta: t.porque,
    tipo: t.tipo,
    condicao: t.condicao || null,
    requer: (t.requer||[]).map(id=> (g.entidades[id] && g.entidades[id].nome) || id),
    certeza: t.certeza,
    ressalva: t.certeza === 'consolidado' ? null
            : (RESSALVA[t.certeza] || 'Certeza fora de `consolidado`: não apresente como fato.'),
    _de: de, _para: para
  };
}

/* ---------- reconstrução nos dois sentidos ----------
   Para frente parte das raízes do recorte e pergunta "o que isto causa?".
   Para trás parte do terminal e pergunta "o que precisava ter acontecido?".
   Os dois percursos cobrem exatamente o mesmo conjunto de transições — é
   isso que significa o mecanismo ser reconstruível nas duas direções. */
function reconstruir(g, mecanismoId, sentido){
  const sg = subgrafo(g, mecanismoId);
  if(!sg) return null;
  const paraFrente = sentido !== 'tras';
  const vizinhas = no => sg.transicoes.filter(t => (paraFrente ? t.de : t.para) === no);
  const outroLado = t => paraFrente ? t.para : t.de;
  const nome = id => (g.nos[id] && g.nos[id].descricao) || id;

  const inicio = paraFrente ? sg.raizes.slice() : [sg.mecanismo.terminal];
  const passos = [], vistos = new Set(inicio), fila = inicio.slice();
  while(fila.length){
    const no = fila.shift();
    const ts = vizinhas(no);
    if(ts.length){
      passos.push({
        no,
        pergunta: paraFrente
          ? `Dado "${nome(no)}", o que acontece em seguida — e por quê?`
          : `Para chegar em "${nome(no)}", o que precisava ter acontecido — e por quê?`,
        resposta: ts.map(t=>({ no: outroLado(t), explicacao: explicar(g, t) })),
        transicoes: ts
      });
    }
    for(const t of ts){
      const prox = outroLado(t);
      if(vistos.has(prox)) continue;
      vistos.add(prox); fila.push(prox);
    }
  }
  return { mecanismo: sg.mecanismo, sentido: paraFrente ? 'frente' : 'tras',
           passos, alcancados: vistos,
           transicoesCobertas: new Set(passos.flatMap(p=>p.transicoes)) };
}

/* ---------- projeção por escala ----------
   A escala é atributo do NÓ, e o deslizador é uma projeção do mesmo grafo —
   nunca uma tela nova nem um conteúdo paralelo. Era a condição do plano: se
   cada escala tivesse texto próprio, voltaria a existir conteúdo escrito
   por camada, e a camada viraria dona do material.

   O vocabulário de escalas é DERIVADO do conteúdo, não uma lista fixa. No
   dia em que um mecanismo trouxer escala nova, ela aparece sozinha. */
function escalasDe(g){
  return [...new Set(Object.values(g.nos).map(n=>n.escala).filter(Boolean))].sort();
}

/* A cadeia do mecanismo em ordem causal: das raízes ao terminal, sem
   repetir transição. É a mesma travessia que gera as perguntas — a leitura
   e o estudo não podem discordar sobre a ordem das coisas. */
function cadeiaOrdenada(g, mecanismoId){
  const r = reconstruir(g, mecanismoId, 'frente');
  if(!r) return [];
  const vistas = new Set(), ordem = [];
  r.passos.forEach(p=>p.transicoes.forEach(t=>{
    if(vistas.has(t)) return;
    vistas.add(t); ordem.push(t);
  }));
  return ordem;
}

/* Uma transição pertence a uma escala quando QUALQUER das pontas está nela.
   Assim as pontes entre níveis aparecem nos dois — que é onde mora o que
   interessa, porque é ali que o molecular vira celular.

   `escala` pode ser 'pontes': só as transições cujas pontas discordam. */
function projetar(g, mecanismoId, escala){
  const cadeia = cadeiaOrdenada(g, mecanismoId);
  if(!escala || escala === 'todas') return cadeia;
  if(escala === 'pontes'){
    return cadeia.filter(t=>g.nos[t.de] && g.nos[t.para] &&
      g.nos[t.de].escala !== g.nos[t.para].escala);
  }
  return cadeia.filter(t=>
    (g.nos[t.de] && g.nos[t.de].escala === escala) ||
    (g.nos[t.para] && g.nos[t.para].escala === escala));
}

module.exports = {
  carregar, saindoDe, chegandoEm, aJusante, aMontante, caminhos, subgrafo,
  prerequisitos, arquivosDoCaminho, perturbar, transicoesQueDependemDe,
  explicar, reconstruir, escalasDe, cadeiaOrdenada, projetar, RESSALVA, VERBO,
  TIPOS_DE_TRANSICAO, NIVEIS_DE_CERTEZA, RAIZ, CONTEUDO
};
