#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão do motor

   As quatro propriedades que a Fase A existe para provar:

     1. CAUSALIDADE  — a transição explica por que A leva a B, e o nível de
                       certeza chega junto até a superfície de estudo.
     2. COMPOSIÇÃO   — o fim de uma cadeia vira o início de outra sem costura.
     3. RECONSTRUÇÃO — dá para percorrer o mecanismo para frente e para trás.
     4. PERTURBAÇÃO  — removida uma entidade, o sistema DERIVA o que se perde.

   Cada prova vem com MUTANTES: versões deliberadamente quebradas do grafo
   ou do módulo. A prova tem de passar no original e FALHAR em cada mutante.
   Um mutante que sobrevive não acusa conteúdo errado — acusa teste
   decorativo, e o portão fecha do mesmo jeito.

   Isto não é zelo abstrato: nesta base, cinco testes já passaram com o
   código quebrado, e nenhum foi pego por leitura.

   Uso: node tools/test-motor.js
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const G = require('../src/grafo.js');

/* ---------- utilitários do portão ---------- */
class Falha extends Error {}
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) throw new Falha(msg); };
const clonar = o => JSON.parse(JSON.stringify(o));
const mesmosItens = (a, b)=>{
  const A = [...a], B = [...b];
  return A.length === B.length && A.every(x=>B.includes(x));
};

const brutos = fs.readdirSync(G.CONTEUDO).filter(f=>f.endsWith('.json'))
  .map(f=>({ arquivo:f, dados: JSON.parse(fs.readFileSync(path.join(G.CONTEUDO, f), 'utf8')) }));

const sujeito = ()=>({ g: G.carregar(), brutos: clonar(brutos), M: G });
const sujeitoClonado = s => ({ g: clonar(s.g), brutos: clonar(s.brutos), M: s.M });

/* Um grafo sintético para as regras que o conteúdo real não exercita.
   Todo o conteúdo de hoje é `consolidado` — uma regra sobre `debatido` e
   `hipotese` que só rodasse sobre ele seria vacuamente verdadeira. */
function fixtureCerteza(){
  return {
    entidades: { 'ent-x': { id:'ent-x', nome:'Entidade X' } },
    nos: { a:{id:'a',descricao:'A'}, b:{id:'b',descricao:'B'},
           c:{id:'c',descricao:'C'}, d:{id:'d',descricao:'D'} },
    transicoes: [
      { de:'a', para:'b', tipo:'causa', certeza:'consolidado', requer:['ent-x'],
        porque:'Princípio consolidado o suficiente para ocupar quarenta caracteres de texto.' },
      { de:'b', para:'c', tipo:'causa', certeza:'debatido',
        porque:'Etapa em disputa na literatura, escrita com folga acima do mínimo exigido.' },
      { de:'c', para:'d', tipo:'causa', certeza:'hipotese',
        porque:'Proposta ainda não estabelecida, também acima do mínimo de quarenta caracteres.' }
    ],
    mecanismos: { fix: { id:'fix', entrada:'a', terminal:'d',
                         fenomeno:'fixture', limites:'fixture sintética do portão, sem valor de conteúdo' } },
    origem: {}, arquivos: []
  };
}

/* ===================================================================== */
const PROVAS = [];

/* ---------- 1. CAUSALIDADE ---------- */
PROVAS.push({
  nome: 'CAUSALIDADE · a explicação sai da própria transição',
  roda(s){
    const { g, M } = s;
    exigir(g.transicoes.length > 0, 'grafo sem transições');
    for(const t of g.transicoes){
      const onde = `${t._arquivo}[${t._i}] ${t.de} → ${t.para}`;
      const ex = M.explicar(g, t);
      exigir(ex.resposta === t.porque,
        `${onde}: a resposta não é o \`porque\` da transição — veio de outro lugar`);
      exigir(ex.resposta.trim().length >= 40, `${onde}: explicação curta demais para reconstruir a relação`);
      exigir(ex.pergunta.includes(g.nos[t.de].descricao) && ex.pergunta.includes(g.nos[t.para].descricao),
        `${onde}: a pergunta gerada não nomeia os dois nós`);
      exigir(ex.tipo === t.tipo, `${onde}: o tipo causal se perdeu no caminho`);
    }
    // as entidades exigidas chegam nomeadas — é o que torna a transição perturbável
    const comRequer = g.transicoes.filter(t=>(t.requer||[]).length);
    exigir(comRequer.length > 0, 'nenhuma transição declara `requer`: nada seria perturbável');
    for(const t of comRequer){
      const ex = M.explicar(g, t);
      exigir(ex.requer.length === t.requer.length,
        `${t.de} → ${t.para}: \`requer\` não chegou à explicação`);
      exigir(ex.requer.every(n=>typeof n === 'string' && n.length > 1),
        `${t.de} → ${t.para}: entidade exigida sem nome legível`);
    }
  },
  mutantes: [
    { como: 'apagar o `porque` de uma transição',
      aplicar(s){ const c = sujeitoClonado(s); c.g.transicoes[0].porque = ''; return c; } },
    { como: 'trocar a resposta por texto de fora da transição',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { explicar:(g,t)=>Object.assign(s.M.explicar(g,t), { resposta:'porque sim' }) });
        return c; } },
    { como: 'esvaziar os `requer` do grafo inteiro',
      aplicar(s){ const c = sujeitoClonado(s); c.g.transicoes.forEach(t=>delete t.requer); return c; } }
  ]
});

/* ---------- 1b. CERTEZA TEM CONSEQUÊNCIA ---------- */
PROVAS.push({
  nome: 'CAUSALIDADE · certeza tem consequência didática',
  roda(s){
    const { M } = s;
    const f = fixtureCerteza();
    const porCerteza = {};
    for(const t of f.transicoes){
      const ex = M.explicar(f, t);
      porCerteza[t.certeza] = ex.ressalva;
      exigir((ex.ressalva === null) === (t.certeza === 'consolidado'),
        `certeza "${t.certeza}" com ressalva ${ex.ressalva === null ? 'ausente' : 'presente'}: ` +
        `só \`consolidado\` pode ser apresentado sem ressalva`);
    }
    exigir(typeof porCerteza.debatido === 'string' && porCerteza.debatido.length > 20,
      '`debatido` sem ressalva legível');
    exigir(typeof porCerteza.hipotese === 'string' && porCerteza.hipotese.length > 20,
      '`hipotese` sem ressalva legível');
    exigir(porCerteza.debatido !== porCerteza.hipotese,
      '`debatido` e `hipotese` recebem a mesma ressalva: a distinção não chega ao estudo');

    // e a ressalva sobrevive até a superfície de estudo, não só à API
    for(const sentido of ['frente','tras']){
      const r = M.reconstruir(f, 'fix', sentido);
      const vistas = [];
      r.passos.forEach(p=>p.resposta.forEach(x=>vistas.push(x)));
      exigir(vistas.length === f.transicoes.length,
        `reconstrução (${sentido}) não apresentou todas as transições da fixture`);
      for(const p of r.passos){
        for(let i = 0; i < p.transicoes.length; i++){
          const t = p.transicoes[i];
          const esperado = M.explicar(f, t);
          exigir(p.resposta[i].explicacao.ressalva === esperado.ressalva,
            `reconstrução (${sentido}) mostra ressalva diferente da que a transição carrega`);
          exigir(p.resposta[i].explicacao.certeza === t.certeza,
            `reconstrução (${sentido}) mostra certeza diferente da que a transição carrega`);
        }
      }
    }
  },
  mutantes: [
    { como: 'apresentar tudo como consolidado (ressalva sempre nula)',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { explicar:(g,t)=>Object.assign(s.M.explicar(g,t), { ressalva:null }) });
        return c; } },
    { como: 'ressalvar até o que é consolidado',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { explicar:(g,t)=>Object.assign(s.M.explicar(g,t), { ressalva:'atenção' }) });
        return c; } },
    { como: 'usar a mesma ressalva para `debatido` e `hipotese`',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { explicar:(g,t)=>{
          const ex = s.M.explicar(g,t);
          if(ex.ressalva) ex.ressalva = 'Isto não é certeza total — leia com alguma reserva.';
          return ex;
        }});
        return c; } }
  ]
});

/* ---------- 2. COMPOSIÇÃO ---------- */
PROVAS.push({
  nome: 'COMPOSIÇÃO · a cadeia atravessa arquivos sem ninguém ter costurado',
  roda(s){
    const { g, brutos, M } = s;
    exigir(brutos.length >= 2, 'a prova precisa de pelo menos dois arquivos de conteúdo');

    // (a) ninguém declarou ligação entre arquivos
    for(const b of brutos){
      exigir(!('liga' in b.dados || 'importa' in b.dados || 'depende' in b.dados ||
               'requer_arquivo' in b.dados || 'continua' in b.dados),
        `${b.arquivo}: declara ligação explícita com outro arquivo — a composição seria costurada à mão`);
      for(const m of (b.dados.mecanismos||[])){
        for(const k of ['nos','cadeia','passos','etapas','transicoes','elos','ordem']){
          exigir(!(k in m), `${b.arquivo} mecanismo "${m.id}": lista "${k}" à mão — a cadeia tem de ser calculada`);
        }
      }
    }

    // (b) existe transição cujos nós foram escritos em OUTRO arquivo
    const cruzam = g.transicoes.filter(t=>
      g.origem[t.de] !== t._arquivo || g.origem[t.para] !== t._arquivo);
    exigir(cruzam.length > 0,
      'nenhuma transição toca nó de outro arquivo: os arquivos são ilhas, não um grafo');

    // (c) e a cadeia de ponta a ponta existe, atravessando os dois arquivos
    const cs = M.caminhos(g, 'atp-disponivel', 'potencial-de-repouso');
    exigir(cs.length > 0, 'não há caminho de `atp-disponivel` até `potencial-de-repouso`');
    const multiarquivo = cs.filter(c=>M.arquivosDoCaminho(c).length >= 2);
    exigir(multiarquivo.length > 0,
      'todos os caminhos ficam dentro de um arquivo só: a composição não aconteceu');
    const arqs = M.arquivosDoCaminho(multiarquivo[0]);
    exigir(arqs.includes('01-gradiente-eletroquimico.json') && arqs.includes('02-potencial-de-membrana.json'),
      `o caminho encontrado não passa pelos dois arquivos: ${arqs.join(' + ')}`);

    // (d) a composição é assimétrica e derivada: o pré-requisito sai da travessia
    exigir(mesmosItens(M.prerequisitos(g, 'potencial-de-membrana'), ['gradiente-eletroquimico']),
      'o pré-requisito de `potencial-de-membrana` não foi derivado');
    exigir(M.prerequisitos(g, 'gradiente-eletroquimico').length === 0,
      '`gradiente-eletroquimico` ganhou pré-requisito: a dependência deveria ser de mão única');
  },
  mutantes: [
    { como: 'cada arquivo redeclara seus próprios ids em vez de reusar',
      aplicar(s){
        const c = sujeitoClonado(s);
        const alvo = '02-potencial-de-membrana.json';
        c.g.transicoes.forEach(t=>{
          if(t._arquivo !== alvo) return;
          for(const lado of ['de','para']){
            if(c.g.origem[t[lado]] !== alvo){
              const novo = t[lado] + '--copia';
              c.g.nos[novo] = Object.assign({}, c.g.nos[t[lado]], { id:novo });
              c.g.origem[novo] = alvo;
              t[lado] = novo;
            }
          }
        });
        return c;
      } },
    { como: 'um mecanismo lista a própria cadeia à mão',
      aplicar(s){ const c = sujeitoClonado(s);
        c.brutos[0].dados.mecanismos[0].cadeia = ['a','b','c']; return c; } },
    { como: 'um arquivo declara que depende do outro',
      aplicar(s){ const c = sujeitoClonado(s);
        c.brutos[1].dados.depende = ['01-gradiente-eletroquimico.json']; return c; } }
  ]
});

/* ---------- 3. RECONSTRUÇÃO ---------- */
PROVAS.push({
  nome: 'RECONSTRUÇÃO · o mecanismo percorre para frente e para trás',
  roda(s){
    const { g, M } = s;
    exigir(Object.keys(g.mecanismos).length > 0, 'nenhum mecanismo declarado');
    for(const id of Object.keys(g.mecanismos)){
      const sg = M.subgrafo(g, id);
      exigir(sg.transicoes.length > 0, `mecanismo "${id}": recorte vazio`);

      const frente = M.reconstruir(g, id, 'frente');
      const tras   = M.reconstruir(g, id, 'tras');
      exigir(frente.passos.length > 0, `mecanismo "${id}": reconstrução para frente sem passos`);
      exigir(tras.passos.length   > 0, `mecanismo "${id}": reconstrução para trás sem passos`);

      // os dois sentidos cobrem exatamente as mesmas transições
      exigir(mesmosItens(frente.transicoesCobertas, sg.transicoes),
        `mecanismo "${id}": a ida cobre ${frente.transicoesCobertas.size} de ${sg.transicoes.length} transições`);
      exigir(mesmosItens(tras.transicoesCobertas, sg.transicoes),
        `mecanismo "${id}": a volta cobre ${tras.transicoesCobertas.size} de ${sg.transicoes.length} transições`);

      // e chegam onde têm de chegar
      exigir(frente.alcancados.has(g.mecanismos[id].terminal),
        `mecanismo "${id}": indo para frente não se chega ao terminal`);
      exigir(tras.alcancados.has(g.mecanismos[id].entrada),
        `mecanismo "${id}": voltando não se chega à entrada`);

      // toda pergunta gerada tem resposta derivada, e as duas direções perguntam coisas diferentes
      for(const p of frente.passos.concat(tras.passos)){
        exigir(p.resposta.length === p.transicoes.length,
          `mecanismo "${id}": passo em "${p.no}" com resposta incompleta`);
        exigir(p.pergunta.includes(g.nos[p.no].descricao),
          `mecanismo "${id}": pergunta gerada não nomeia o nó "${p.no}"`);
      }
      const pf = frente.passos.map(p=>p.pergunta), pt = tras.passos.map(p=>p.pergunta);
      exigir(pf.every(q=>!pt.includes(q)),
        `mecanismo "${id}": ida e volta fazem a mesma pergunta — não são dois percursos`);
    }
  },
  mutantes: [
    { como: 'inverter uma transição no meio da cadeia',
      aplicar(s){ const c = sujeitoClonado(s);
        const t = c.g.transicoes.find(x=>x.para === 'potencial-de-equilibrio-do-k');
        const d = t.de; t.de = t.para; t.para = d; return c; } },
    { como: 'plantar um ciclo sem raiz dentro do recorte',
      aplicar(s){ const c = sujeitoClonado(s);
        c.g.nos['ciclo-x'] = { id:'ciclo-x', descricao:'X' };
        c.g.nos['ciclo-y'] = { id:'ciclo-y', descricao:'Y' };
        const base = { tipo:'causa', certeza:'consolidado', porque:'mutante', _arquivo:'mutante', _i:0 };
        c.g.transicoes.push(Object.assign({ de:'ciclo-x', para:'ciclo-y' }, base));
        c.g.transicoes.push(Object.assign({ de:'ciclo-y', para:'ciclo-x' }, base));
        c.g.transicoes.push(Object.assign({ de:'ciclo-y', para:'potencial-de-repouso' }, base));
        return c; } },
    { como: 'a volta reusar as perguntas da ida',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { reconstruir:(g,id)=>s.M.reconstruir(g,id,'frente') });
        return c; } }
  ]
});

/* ---------- 4. PERTURBAÇÃO ---------- */
PROVAS.push({
  nome: 'PERTURBAÇÃO · a consequência é derivada, não escrita',
  roda(s){
    const { g, M } = s;

    // (a) remover a bomba colapsa tudo que descende dela
    const semBomba = M.perturbar(g, { entidade:'bomba-na-k' }, 'atp-disponivel');
    exigir(semBomba.mortas.length > 0, 'remover a bomba não matou transição alguma');
    exigir(semBomba.perdidos.includes('potencial-de-repouso'),
      'sem bomba, o potencial de repouso continuou alcançável');
    exigir(semBomba.perdidos.includes('potencial-de-equilibrio-do-k'),
      'sem bomba, o potencial de equilíbrio do K⁺ continuou alcançável');
    exigir(semBomba.restantes.size === 0,
      `sem bomba ainda sobram ${semBomba.restantes.size} nós alcançáveis a partir do ATP`);

    // (b) alvos diferentes produzem perdas diferentes — a resposta é calculada, não constante
    const semCanalNa = M.perturbar(g, { entidade:'canal-vazamento-na' }, 'atp-disponivel');
    exigir(!mesmosItens(semCanalNa.perdidos, semBomba.perdidos),
      'perturbar entidades diferentes produziu a mesma perda: a resposta é constante');
    exigir(!semCanalNa.perdidos.includes('potencial-de-equilibrio-do-k'),
      'tirar o canal de Na⁺ derrubou o equilíbrio do K⁺, que não depende dele');

    // (c) o que ninguém exige não perturba nada
    const nada = M.perturbar(g, { entidade:'entidade-inexistente' }, 'atp-disponivel');
    exigir(nada.mortas.length === 0 && nada.perdidos.length === 0,
      'perturbar entidade inexistente produziu consequência');

    // (d) `mortas` e `transicoesQueDependemDe` são dois caminhos para a mesma verdade
    for(const e of Object.keys(g.entidades)){
      const p = M.perturbar(g, { entidade:e }, 'atp-disponivel');
      exigir(mesmosItens(p.mortas, M.transicoesQueDependemDe(g, e)),
        `entidade "${e}": as transições mortas não batem com as que a exigem`);
      exigir(p.mortas.every(t=>(t.requer||[]).includes(e)),
        `entidade "${e}": matou transição que não a exige`);
    }

    // (e) e a derivação não lê prosa: apagar todo `se_falhar` não muda nada
    const semProsa = sujeitoClonado(s);
    Object.values(semProsa.g.entidades).forEach(e=>delete e.se_falhar);
    const depois = M.perturbar(semProsa.g, { entidade:'bomba-na-k' }, 'atp-disponivel');
    exigir(mesmosItens(depois.perdidos, semBomba.perdidos),
      'a consequência mudou ao apagar o texto `se_falhar`: ela estava sendo lida da prosa');
  },
  mutantes: [
    { como: 'esvaziar os `requer` — a perturbação perde o que morder',
      aplicar(s){ const c = sujeitoClonado(s); c.g.transicoes.forEach(t=>delete t.requer); return c; } },
    { como: 'toda transição exigir toda entidade (perda constante)',
      aplicar(s){ const c = sujeitoClonado(s);
        const todas = Object.keys(c.g.entidades);
        c.g.transicoes.forEach(t=>{ t.requer = todas.slice(); });
        return c; } },
    { como: 'perturbar sempre devolvendo a perda máxima',
      aplicar(s){ const c = sujeitoClonado(s);
        c.M = Object.assign({}, s.M, { perturbar:(g,alvo,entrada)=>{
          const antes = s.M.aJusante(g, entrada);
          return { mortas:g.transicoes.slice(), perdidos:[...antes], restantes:new Set() };
        }});
        return c; } }
  ]
});

/* ===================================================================== */
const base = sujeito();
let falhou = false, mutantesMortos = 0, mutantesVivos = 0;

console.log(`grafo: ${Object.keys(base.g.nos).length} nós · ${base.g.transicoes.length} transições · ` +
            `${Object.keys(base.g.mecanismos).length} mecanismos · ${base.brutos.length} arquivos\n`);

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
      // MOTIVOS=1 mostra POR QUE cada mutante morreu. Um mutante que morre de
      // `exceção:` em vez de asserção morreu por acidente, e a propriedade
      // continua sem prova.
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
  console.error(`Motor: FALHOU (${mutantesVivos} mutante(s) vivo(s))`);
  process.exit(1);
}
console.log(`Motor: ok — ${PROVAS.length} propriedades, ${checagens} checagens, ${mutantesMortos} mutantes mortos`);
