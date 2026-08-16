#!/usr/bin/env node
/* =====================================================================
   NeuroLab Profundo · portão das perguntas

   Aqui a operação vira item respondível. É o ponto onde o projeto pode
   trair a própria tese sem ninguém notar: basta a pergunta ficar
   respondível sem saber o mecanismo — por eliminação, por tamanho da
   alternativa, ou marcando tudo. Uma pergunta derivada que qualquer um
   acerta é pior que uma pergunta escrita à mão, porque parece rigor.

     1. DERIVAÇÃO     — enunciado, gabarito e distratores saem do grafo.
     2. DISCRIMINAÇÃO — marcar tudo REPROVA; o gabarito tira 1; sempre há
                        alternativa errada disponível.
     3. DETERMINISMO  — a mesma semente dá a mesma pergunta, e sementes
                        diferentes dão perguntas diferentes.
     4. DEPURAR       — a afirmação errada é exatamente a invertida, e as
                        outras são verdadeiras no grafo como estão.
     5. EVIDÊNCIA     — o que a pergunta exercita tem caixa para receber, e
                        a nota que chega à caixa é a nota da correção.

   Uso: node tools/test-perguntas.js   ·   MOTIVOS=1 mostra as mortes
   ===================================================================== */
const G = require('../src/grafo.js');
const EST = require('../src/estudo.js');
const QQ = require('../src/perguntas.js');

class Falha extends Error {}
let checagens = 0;
const exigir = (cond, msg)=>{ checagens++; if(!cond) throw new Falha(msg); };
const clonar = o => JSON.parse(JSON.stringify(o));

const sujeito = ()=>({ g: G.carregar(), E: EST, Q: QQ });
const clonarSujeito = s => ({ g: clonar(s.g), E: Object.assign({}, s.E), Q: Object.assign({}, s.Q) });

const T0 = Date.UTC(2026, 7, 16, 9, 0, 0);
const SEMENTES = [1, 7, 13, 29, 44, 61, 88, 97];

/* Varre o produto mecanismo × operação × semente. É a única forma honesta
   de testar um gerador: uma pergunta que passa não diz nada sobre as
   outras seiscentas que o sorteio pode produzir. */
function cada(s, visita){
  const idx = s.E.indexar(s.g);
  let vistas = 0;
  Object.keys(s.g.mecanismos).sort().forEach(mec=>{
    s.E.OPERACOES.forEach(op=>{
      SEMENTES.forEach(semente=>{
        const p = s.Q.gerar(s.g, mec, op, semente, idx);
        if(!p) return;
        visita(p, mec, op, semente, idx);
        vistas++;
      });
    });
  });
  return vistas;
}

/* ===================================================================== */
const PROVAS = [];

/* ---------- 1. DERIVAÇÃO ---------- */
PROVAS.push({
  nome: 'DERIVAÇÃO · enunciado, gabarito e distratores saem do grafo',
  roda(s){
    const { g, E, Q } = s;
    const vistas = cada(s, (p, mec, op, semente, idx)=>{
      const sg = idx[mec];
      const onde = `${mec}/${op}/${semente}`;

      exigir(p.enunciado && p.enunciado.length > 10, `${onde}: enunciado vazio`);
      exigir(p.alternativas.length >= 3, `${onde}: ${p.alternativas.length} alternativas é pouco para discriminar`);
      exigir(p.corretas.length > 0, `${onde}: pergunta sem gabarito`);
      exigir(p.transicoes.length > 0, `${onde}: pergunta que não exercita transição nenhuma`);

      /* Toda alternativa tem de existir no grafo. Distrator inventado seria
         texto autorado entrando pela porta dos fundos. */
      if(p.operacao !== 'depurar'){
        p.alternativas.forEach(a=>{
          exigir(sg.nos.has(a.id), `${onde}: alternativa "${a.id}" não é nó do recorte`);
        });
        p.corretas.forEach(c=>exigir(p.alternativas.some(a=>a.id === c),
          `${onde}: gabarito "${c}" não está entre as alternativas`));
      }

      /* E o gabarito tem de ser VERDADE sobre o grafo, não sobre o gerador. */
      if(p.operacao === 'construir' || p.operacao === 'reconstruir'){
        const frente = p.operacao === 'construir';
        p.corretas.forEach(c=>{
          const existe = sg.transicoes.some(t=>frente ? t.para === c : t.de === c);
          exigir(existe, `${onde}: "${c}" está no gabarito mas nenhuma transição do recorte leva a ele`);
        });
        p.transicoes.forEach(t=>exigir(sg.transicoes.includes(t),
          `${onde}: exercita transição que não é do recorte`));
      }
      if(p.operacao === 'perturbar'){
        const r = G.perturbar(g, { entidade: p.entidade }, sg.mecanismo.entrada);
        p.corretas.forEach(c=>exigir(r.perdidos.includes(c),
          `${onde}: "${c}" está no gabarito mas não some quando "${p.entidade}" é removida`));
        p.alternativas.filter(a=>!p.corretas.includes(a.id)).forEach(a=>{
          exigir(!r.perdidos.includes(a.id),
            `${onde}: "${a.id}" foi apresentado como distrator e na verdade some junto`);
        });
        p.transicoes.forEach(t=>exigir((t.requer||[]).includes(p.entidade),
          `${onde}: exercita transição que não depende de "${p.entidade}"`));
      }

      /* A revelação é o `porque` das próprias transições — nunca texto novo. */
      exigir(p.revelacao.length === p.transicoes.length,
        `${onde}: ${p.revelacao.length} revelações para ${p.transicoes.length} transições`);
      p.revelacao.forEach((r, i)=>{
        exigir(r.porque === p.transicoes[i].porque,
          `${onde}: a revelação não é o \`porque\` da transição — veio de outro lugar`);
        exigir(r.certeza === 'consolidado' ? r.ressalva === null : !!r.ressalva,
          `${onde}: certeza "${r.certeza}" chegou à superfície sem a ressalva devida`);
      });
    });
    exigir(vistas > 50, `só ${vistas} perguntas geradas: a varredura não cobre o gerador`);
  },
  mutantes: [
    { como: 'o gabarito é sorteado em vez de derivado',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p || p.operacao === 'depurar') return p;
          p.corretas = [p.alternativas[p.alternativas.length - 1].id];
          return p;
        }; return m; } },
    { como: 'os distratores vêm de fora do recorte do mecanismo',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p || p.operacao === 'depurar') return p;
          const sg = (idx || m.E.indexar(g))[mec];
          const fora = Object.keys(g.nos).filter(n=>!sg.nos.has(n));
          if(!fora.length) return p;
          p.alternativas = p.alternativas.map(a=>
            p.corretas.includes(a.id) ? a : { id: fora[0], texto: g.nos[fora[0]].descricao });
          return p;
        }; return m; } },
    { como: 'a revelação é texto genérico em vez do `porque` da transição',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p) return p;
          p.revelacao = p.revelacao.map(r=>Object.assign({}, r,
            { porque: 'Esta etapa decorre do mecanismo estudado.' }));
          return p;
        }; return m; } }
  ]
});

/* ---------- 2. DISCRIMINAÇÃO ---------- */
PROVAS.push({
  nome: 'DISCRIMINAÇÃO · marcar tudo reprova, e o gabarito tira nota cheia',
  roda(s){
    const { E, Q } = s;
    let piorMarcandoTudo = 0, vistas = 0;
    cada(s, (p, mec, op, semente)=>{
      const onde = `${mec}/${op}/${semente}`;
      vistas++;

      const certo = Q.corrigir(p, p.corretas);
      exigir(certo.nota === 1, `${onde}: responder o gabarito exato deu ${certo.nota}`);
      exigir(certo.acertou, `${onde}: o gabarito exato não foi considerado acerto`);

      const tudo = Q.corrigir(p, p.alternativas.map(a=>a.id));
      piorMarcandoTudo = Math.max(piorMarcandoTudo, tudo.nota);
      exigir(!tudo.acertou,
        `${onde}: marcar TODAS as alternativas tirou ${tudo.nota.toFixed(2)} e passou. ` +
        `Item que se acerta sem saber nada corrompe o cronograma inteiro.`);

      const nada = Q.corrigir(p, []);
      exigir(nada.nota === 0, `${onde}: não responder nada deu ${nada.nota}`);

      /* Sempre tem de sobrar alternativa errada para escolher — é a
         reserva que impede a degeneração "todas as anteriores". */
      const erradas = p.alternativas.filter(a=>!p.corretas.includes(a.id)).length;
      exigir(erradas >= Q.MIN_ERRADAS,
        `${onde}: só ${erradas} alternativa(s) errada(s); o mínimo é ${Q.MIN_ERRADAS}`);
    });
    exigir(vistas > 50, `só ${vistas} perguntas geradas`);
    exigir(piorMarcandoTudo < E.PASSA,
      `a melhor nota de quem marca tudo foi ${piorMarcandoTudo.toFixed(2)}, e o corte é ${E.PASSA}`);
  },
  mutantes: [
    { como: 'o slate não reserva alternativas erradas (volta a "todas as anteriores")',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p || p.operacao === 'depurar') return p;
          p.alternativas = p.corretas.map(id=>({ id, texto: (g.nos[id] || {}).descricao || id }));
          return p;
        }; return m; } },
    { como: 'a correção conta acertos e ignora os falsos positivos',
      aplicar(s){ const m = clonarSujeito(s);
        m.Q.corrigir = (p, escolhidas)=>{
          const esc = [...new Set(escolhidas || [])], cor = [...new Set(p.corretas)];
          const nota = cor.length ? esc.filter(x=>cor.includes(x)).length / cor.length : 0;
          return { nota, acertou: nota >= m.E.PASSA, faltaram: [], sobraram: [],
                   porTransicao: p.transicoes.map(t=>({ transicao: t, nota })) };
        }; return m; } },
    { como: 'a correção dá nota cheia se acertou pelo menos uma',
      aplicar(s){ const m = clonarSujeito(s);
        m.Q.corrigir = (p, escolhidas)=>{
          const esc = [...new Set(escolhidas || [])], cor = [...new Set(p.corretas)];
          const nota = esc.some(x=>cor.includes(x)) ? 1 : 0;
          return { nota, acertou: nota >= m.E.PASSA, faltaram: [], sobraram: [],
                   porTransicao: p.transicoes.map(t=>({ transicao: t, nota })) };
        }; return m; } }
  ]
});

/* ---------- 3. DETERMINISMO ---------- */
PROVAS.push({
  nome: 'DETERMINISMO · mesma semente dá a mesma pergunta, sementes diferentes variam',
  roda(s){
    const { g, E, Q } = s;
    const idx = E.indexar(g);
    const assinatura = p => p ? [p.enunciado, p.alternativas.map(a=>a.id).join('|'),
                                 p.corretas.slice().sort().join('|')].join('§') : 'nula';
    let comparadas = 0, distintas = new Set(), total = 0;

    Object.keys(g.mecanismos).sort().forEach(mec=>{
      E.OPERACOES.forEach(op=>{
        SEMENTES.forEach(semente=>{
          const a = Q.gerar(g, mec, op, semente, idx);
          const b = Q.gerar(g, mec, op, semente, idx);
          exigir(assinatura(a) === assinatura(b),
            `${mec}/${op}/${semente}: a mesma semente produziu perguntas diferentes — ` +
            `um defeito aqui seria irreproduzível`);
          comparadas++;
          if(a){ distintas.add(mec + op + assinatura(a)); total++; }
        });
      });
    });
    exigir(comparadas > 50, `só ${comparadas} comparações`);
    /* E não pode ser sempre a mesma pergunta: um gerador determinístico que
       ignora a semente é decorável em duas voltas. */
    exigir(distintas.size > total * 0.4,
      `${distintas.size} perguntas distintas em ${total} sorteios: o sorteio quase não varia`);
  },
  mutantes: [
    { como: 'o gerador usa Math.random e ignora a semente',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>
          real(g, mec, op, Math.floor(Math.random() * 1e9) + 1, idx); return m; } },
    { como: 'o gerador produz sempre a mesma pergunta, qualquer que seja a semente',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>real(g, mec, op, 1, idx); return m; } },
    { como: 'o embaralhamento das alternativas escapa do sorteio semeado',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p) return p;
          p.alternativas = p.alternativas.slice().sort(()=>Math.random() - 0.5);
          return p;
        }; return m; } }
  ]
});

/* ---------- 4. DEPURAR ---------- */
PROVAS.push({
  nome: 'DEPURAR · a afirmação errada é a invertida, e as outras são verdadeiras',
  roda(s){
    const { g, E, Q } = s;
    const idx = E.indexar(g);
    let vistas = 0;

    Object.keys(g.mecanismos).sort().forEach(mec=>{
      SEMENTES.forEach(semente=>{
        const p = Q.gerar(g, mec, 'depurar', semente, idx);
        if(!p) return;
        vistas++;
        const onde = `${mec}/depurar/${semente}`;

        exigir(p.tipoDeResposta === 'unica', `${onde}: depurar deveria ter resposta única`);
        exigir(p.corretas.length === 1, `${onde}: ${p.corretas.length} respostas certas para uma escolha só`);
        exigir(p.alternativas.length >= 2, `${onde}: nada a escolher`);

        const chaveErrada = p.corretas[0];
        const [de, para] = chaveErrada.split('>');
        const t = g.transicoes.find(x=>x.de === de && x.para === para);
        exigir(!!t, `${onde}: a resposta aponta para transição inexistente`);

        /* A regra que sustenta a operação: inverter só é ERRO se a inversa
           não for verdade em algum lugar do grafo. */
        exigir(!g.transicoes.some(o=>o.de === t.para && o.para === t.de),
          `${onde}: a transição escolhida TEM inversa no grafo, então a afirmação ` +
          `invertida é verdadeira e a pergunta não tem gabarito`);

        const verbo = G.VERBO[t.tipo] || t.tipo;
        const nome = id => (g.nos[id] && g.nos[id].descricao) || id;
        const item = p.alternativas.find(a=>a.id === chaveErrada);
        exigir(!!item, `${onde}: o gabarito não está entre as alternativas`);
        exigir(item.texto === `${nome(t.para)} ${verbo} ${nome(t.de)}`,
          `${onde}: a alternativa errada não está invertida — está escrita como o grafo diz`);
        exigir(p.correcao === `${nome(t.de)} ${verbo} ${nome(t.para)}`,
          `${onde}: a correção mostrada não é a afirmação verdadeira`);

        /* E cada uma das OUTRAS tem de ser verdadeira como está. */
        p.alternativas.filter(a=>a.id !== chaveErrada).forEach(a=>{
          const [d2, p2] = a.id.split('>');
          const outra = g.transicoes.find(x=>x.de === d2 && x.para === p2);
          exigir(!!outra, `${onde}: alternativa "${a.id}" não corresponde a transição nenhuma`);
          exigir(a.texto === `${nome(outra.de)} ${G.VERBO[outra.tipo] || outra.tipo} ${nome(outra.para)}`,
            `${onde}: uma alternativa que deveria estar CERTA foi apresentada invertida`);
        });
      });
    });
    exigir(vistas > 10, `só ${vistas} perguntas de depurar geradas`);
  },
  mutantes: [
    { como: 'depurar apresenta a afirmação certa em vez da invertida',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p || p.operacao !== 'depurar') return p;
          const [de, para] = p.corretas[0].split('>');
          const t = g.transicoes.find(x=>x.de === de && x.para === para);
          const nome = id => (g.nos[id] || {}).descricao || id;
          p.alternativas = p.alternativas.map(a=>a.id === p.corretas[0]
            ? { id: a.id, texto: `${nome(t.de)} ${G.VERBO[t.tipo] || t.tipo} ${nome(t.para)}` } : a);
          return p;
        }; return m; } },
    { como: 'depurar inverte também uma das alternativas que deveriam estar certas',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p || p.operacao !== 'depurar') return p;
          const outra = p.alternativas.find(a=>a.id !== p.corretas[0]);
          if(!outra) return p;
          const [de, para] = outra.id.split('>');
          const t = g.transicoes.find(x=>x.de === de && x.para === para);
          const nome = id => (g.nos[id] || {}).descricao || id;
          outra.texto = `${nome(t.para)} ${G.VERBO[t.tipo] || t.tipo} ${nome(t.de)}`;
          return p;
        }; return m; } },
    { como: 'depurar aceita transição que tem inversa verdadeira no grafo',
      aplicar(s){ const m = clonarSujeito(s);
        /* acrescenta a inversa da transição escolhida: a afirmação
           "invertida" passa a ser verdade, e o item fica sem gabarito */
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = s.Q.gerar(g, mec, op, semente, idx);
          if(!p || p.operacao !== 'depurar') return p;
          const [de, para] = p.corretas[0].split('>');
          const t = g.transicoes.find(x=>x.de === de && x.para === para);
          if(!g.transicoes.some(o=>o.de === t.para && o.para === t.de)){
            g.transicoes.push({ de: t.para, para: t.de, tipo: 'modula', certeza: 'consolidado',
              porque: 'Retroalimentação sintética acrescentada pelo mutante, longa o bastante.',
              _arquivo: 'mutante.json', _i: 0 });
          }
          return p;
        }; return m; } }
  ]
});

/* ---------- 5. EVIDÊNCIA ---------- */
PROVAS.push({
  nome: 'EVIDÊNCIA · o que a pergunta exercita tem caixa, e a nota chega inteira',
  roda(s){
    const { g, E, Q } = s;
    const idx = E.indexar(g);
    const estado = E.novoEstado();
    Object.keys(g.mecanismos).sort().forEach(id=>E.semear(g, estado, id, T0, idx));

    let vistas = 0;
    cada(s, (p, mec, op, semente)=>{
      vistas++;
      const onde = `${mec}/${op}/${semente}`;
      /* Toda transição exercitada precisa de caixa daquela operação. Se a
         pergunta exercitasse algo sem caixa, o estudo aconteceria e o
         cronograma não ficaria sabendo. */
      p.transicoes.forEach(t=>{
        exigir(!!estado.caixas[E.chaveDaCaixa(t, p.operacao)],
          `${onde}: exercita ${t.de} → ${t.para} em "${p.operacao}", e não há caixa para receber`);
      });
    });
    exigir(vistas > 50, `só ${vistas} perguntas geradas`);

    /* Uma pergunta respondida vira exatamente uma decisão de intervalo por
       caixa, com a nota da correção — nem mais, nem outra. */
    const p = Q.gerar(g, 'potencial-de-acao', 'reconstruir', 7, idx);
    exigir(!!p, 'a pergunta usada no teste de evidência não foi gerada');
    const meias = p.corretas.slice(0, Math.max(1, p.corretas.length - 1))
      .concat(p.alternativas.filter(a=>!p.corretas.includes(a.id)).slice(0, 1).map(a=>a.id));
    const c = Q.corrigir(p, meias);
    exigir(c.nota > 0 && c.nota < 1, `a resposta parcial deu ${c.nota}; o teste precisa de nota intermediária`);

    const lote = E.iniciarLote();
    const quantas = Q.anotarNoLote(lote, p, c);
    exigir(quantas === p.transicoes.length,
      `${quantas} anotações para ${p.transicoes.length} transições exercitadas`);
    const r = E.fecharLote(g, estado, lote, T0);
    exigir(r.ignoradas.length === 0, `caixa faltando para: ${r.ignoradas.join(', ')}`);
    exigir(r.decididas.length === p.transicoes.length,
      `${r.decididas.length} decisões de intervalo para ${p.transicoes.length} transições`);
    r.decididas.forEach(d=>{
      exigir(Math.abs(d.nota - c.nota) < 1e-9,
        `a caixa "${d.chave}" recebeu nota ${d.nota}, e a correção deu ${c.nota}`);
      exigir(E.lerChave(d.chave).operacao === p.operacao,
        `a evidência de "${p.operacao}" foi parar na caixa de "${E.lerChave(d.chave).operacao}"`);
    });
  },
  mutantes: [
    { como: 'a evidência é anotada na operação errada',
      aplicar(s){ const m = clonarSujeito(s);
        m.Q.anotarNoLote = (lote, p, c)=>{
          const outra = m.E.OPERACOES.find(o=>o !== p.operacao);
          c.porTransicao.forEach(x=>m.E.anotar(lote, x.transicao, outra, x.nota));
          return c.porTransicao.length;
        }; return m; } },
    { como: 'a evidência entra como acerto cheio, seja qual for a nota',
      aplicar(s){ const m = clonarSujeito(s);
        m.Q.anotarNoLote = (lote, p, c)=>{
          c.porTransicao.forEach(x=>m.E.anotar(lote, x.transicao, p.operacao, 1));
          return c.porTransicao.length;
        }; return m; } },
    { como: 'a pergunta exercita transições que estão fora do recorte (e sem caixa)',
      aplicar(s){ const m = clonarSujeito(s); const real = s.Q.gerar;
        m.Q.gerar = (g, mec, op, semente, idx)=>{
          const p = real(g, mec, op, semente, idx);
          if(!p) return p;
          const sg = (idx || m.E.indexar(g))[mec];
          const fora = g.transicoes.find(t=>!sg.transicoes.includes(t));
          if(fora) p.transicoes = p.transicoes.concat([fora]);
          return p;
        }; return m; } }
  ]
});

/* ===================================================================== */
const base = sujeito();
let falhou = false, mutantesMortos = 0, mutantesVivos = 0;

{
  let n = 0;
  cada(base, ()=>{ n++; });
  console.log(`perguntas: ${n} geradas sobre ${Object.keys(base.g.mecanismos).length} mecanismos ` +
              `× ${base.E.OPERACOES.length} operações × ${SEMENTES.length} sementes\n`);
}

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
  console.error(`Perguntas: FALHOU (${mutantesVivos} mutante(s) vivo(s))`);
  process.exit(1);
}
console.log(`Perguntas: ok — ${PROVAS.length} propriedades, ${checagens} checagens, ${mutantesMortos} mutantes mortos`);
