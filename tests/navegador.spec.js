/* =====================================================================
   NeuroLab Deep · o portão que precisa de navegador de verdade

   Os seis portões de `tools/` rodam em Node, com um DOM stubado. Eles
   provam que a LÓGICA está certa — e não têm como provar que a página abre.
   CSS que não carrega, botão fora da dobra, `localStorage` bloqueado,
   service worker que não registra: nada disso aparece num stub, e tudo isso
   deixa o app inutilizável no celular.

   Este arquivo cobre exatamente a diferença. Roda só no CI (o Termux não
   tem navegador headless), e por isso é curto e vai ao essencial:
   a página abre, o estudo funciona, e o progresso sobrevive.

   Uso: npx playwright test
   ===================================================================== */
const { test, expect } = require('@playwright/test');

test('a página abre e mostra o percurso do grafo real', async ({ page }) => {
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));

  await page.goto('/');

  /* O título vem do conteúdo, não de placeholder */
  await expect(page.locator('h1')).toHaveText('NeuroLab Deep');

  /* As etapas são CALCULADAS: se o grafo carregou, elas existem. Uma página
     que carregasse o motor mas não o conteúdo mostraria zero etapas. */
  await expect(page.getByRole('heading', { name: 'Etapa 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Etapa 7' })).toBeVisible();

  /* E o número de caixas, que só existe se o cronograma rodou.
     Afirmado por FORMA, não por redação: a versão anterior exigia o texto
     "caixas de revisão" e quebrou quando a linha passou a distinguir novas
     de vencidas — teste vermelho sem defeito nenhum no app. O que importa é
     que o número apareça, não como ele é apresentado. */
  const resumo = await page.locator('p.sub').first().textContent();
  expect(resumo, `a linha de resumo não traz contagem de caixas: "${resumo}"`)
    .toMatch(/\d+\s+caixas/);
  expect(resumo, `a linha de resumo não traz contagem de transições: "${resumo}"`)
    .toMatch(/\d+\s+transições/);

  expect(erros, 'a página lançou erro de JavaScript').toEqual([]);
});

test('o botão de estudar está visível sem rolar a página', async ({ page }) => {
  /* No v2 um botão ficou fora da dobra e só apareceu porque alguém olhou.
     O rodapé é fixo justamente para isso, e isto é o que confere. */
  await page.goto('/');
  const acao = page.locator('#acao');
  await expect(acao).toBeVisible();
  const caixa = await acao.boundingBox();
  const altura = page.viewportSize().height;
  expect(caixa.y + caixa.height, 'o botão de ação está abaixo da dobra').toBeLessThanOrEqual(altura);
});

const CHAVE = 'neurolab-profundo/estado/v1';
const lerEstado = page => page.evaluate(k => localStorage.getItem(k), CHAVE);

test('uma sessão inteira grava o progresso, e ele sobrevive a recarregar', async ({ page }) => {
  await page.goto('/');

  /* Nada é gravado só por abrir, e isso é de propósito: as respostas entram
     num LOTE e viram uma decisão de intervalo por caixa quando a sessão
     fecha. Semear acontece em memória a cada carga, e é idempotente. */
  expect(await lerEstado(page), 'abrir não deveria gravar nada').toBeNull();

  await page.locator('#acao').click();
  await expect(page.locator('button.alt').first()).toBeVisible();

  /* Percorre a sessão inteira até o botão virar "Voltar ao percurso", que é
     quando o lote fechou. Acertar ou errar não importa aqui — o que se
     verifica é que a resposta chega ao cronograma e é gravada. */
  /* O laço não depende de RÓTULO de botão: ele olha o estado da tela. Se há
     alternativa para escolher, escolhe; depois avança. Termina quando a tela
     de fechamento aparece. Amarrar o teste ao texto do botão é o mesmo
     acoplamento que já quebrou a asserção do resumo. */
  const acao = page.locator('#acao');
  const fechou = page.getByRole('heading', { name: 'Sessão fechada' });
  for(let i = 0; i < 40; i++){
    if(await fechou.isVisible()) break;
    const alternativas = page.locator('button.alt:not([disabled])');
    if(await alternativas.count() > 0) await alternativas.first().click();
    await expect(acao).toBeEnabled();
    await acao.click();
  }
  await expect(fechou, 'a sessão não chegou ao fim em 40 passos').toBeVisible();

  const gravado = await lerEstado(page);
  expect(gravado, 'a sessão fechou e nada foi gravado').not.toBeNull();

  /* E o progresso sobrevive a recarregar — que é a diferença entre estudar e
     brincar. É este o teste que `file://` reprovaria, e a razão de o app ter
     deixado de ser arquivo solto. */
  await page.reload();
  expect(await lerEstado(page), 'o progresso não sobreviveu a recarregar').toBe(gravado);

  /* E o estado guardado é o do cronograma, com caixas de verdade */
  const caixas = JSON.parse(gravado).caixas;
  expect(Object.keys(caixas).length, 'nenhuma caixa no estado gravado').toBeGreaterThan(100);
  const tocadas = Object.values(caixas).filter(c => c.tentativas > 0);
  expect(tocadas.length, 'nenhuma caixa registrou tentativa').toBeGreaterThan(0);
});

test('dá para sair da pergunta, e sair no meio guarda o que foi respondido', async ({ page }) => {
  /* A tela de pergunta era uma armadilha: entrou, só saía fechando o app.
     Ficar preso é coisa que só aparece num navegador de verdade, com o
     usuário procurando a saída — nenhum DOM stubado sente isso. */
  await page.goto('/');
  await page.locator('#acao').click();
  await expect(page.locator('button.alt').first()).toBeVisible();

  const saida = page.locator('button.fantasma').filter({ hasText: /voltar ao percurso|sair e guardar/i });
  await expect(saida.first(), 'não há saída na tela de pergunta').toBeVisible();

  /* responde UMA e sai pelo meio */
  await page.locator('button.alt').first().click();
  await page.locator('#acao').click();
  await expect(page.locator('button.fantasma').filter({ hasText: /sair e guardar/i }).first(),
    'depois de responder, a saída ainda promete apenas "voltar"').toBeVisible();
  await page.locator('button.fantasma').filter({ hasText: /sair e guardar/i }).first().click();

  const guardado = await page.evaluate(() => localStorage.getItem('neurolab-profundo/estado/v1'));
  expect(guardado, 'saiu no meio e a resposta se perdeu').not.toBeNull();
  const tocadas = Object.values(JSON.parse(guardado).caixas).filter(c => c.tentativas > 0);
  expect(tocadas.length, 'saiu no meio e nenhuma caixa registrou tentativa').toBeGreaterThan(0);
});

test('o service worker registra e o app é instalável', async ({ page, baseURL }) => {
  await page.goto('/');

  const registrado = await page.evaluate(async () => {
    if(!('serviceWorker' in navigator)) return 'sem suporte';
    const r = await navigator.serviceWorker.getRegistration();
    if(r) return 'ok';
    await new Promise(res => setTimeout(res, 2000));
    return (await navigator.serviceWorker.getRegistration()) ? 'ok' : 'não registrou';
  });
  expect(registrado, 'sem service worker o app não abre em modo avião').toBe('ok');

  /* O manifest tem de ser servido como JSON e ter os ícones que declara —
     um manifest quebrado faz o Android recusar a instalação, em silêncio. */
  const resp = await page.request.get(new URL('manifest.webmanifest', baseURL).href);
  expect(resp.status()).toBe(200);
  const manifest = await resp.json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for(const icone of manifest.icons){
    const r = await page.request.get(new URL(icone.src, baseURL).href);
    expect(r.status(), `ícone ausente: ${icone.src}`).toBe(200);
  }
  expect(manifest.icons.some(i => i.purpose === 'maskable'),
    'sem ícone maskable o Android desenha a arte dentro de um quadrado branco').toBe(true);
});
