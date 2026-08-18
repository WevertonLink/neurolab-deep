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

  /* E o número de caixas, que só existe se o cronograma rodou */
  await expect(page.locator('p.sub').first()).toContainText('caixas de revisão');

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

test('estudar uma sessão faz o progresso subir, e ele sobrevive a recarregar', async ({ page }) => {
  await page.goto('/');

  const antes = await page.evaluate(() => localStorage.getItem('neurolab-profundo/estado/v1'));
  expect(antes, 'o estado deveria ser semeado na primeira abertura').not.toBeNull();

  await page.locator('#acao').click();

  /* A tela de pergunta: um enunciado e alternativas clicáveis */
  await expect(page.locator('h2')).toBeVisible();
  const alternativas = page.locator('button.alt');
  await expect(alternativas.first()).toBeVisible();

  /* Responder marcando UMA alternativa. Acertar ou errar não importa aqui —
     o que se verifica é que a resposta chega ao cronograma. */
  await alternativas.first().click();
  await expect(page.locator('#acao')).toBeEnabled();
  await page.locator('#acao').click();

  /* A revelação aparece, com o `porque` da transição */
  await expect(page.locator('.cartao')).toBeVisible();

  const depois = await page.evaluate(() => localStorage.getItem('neurolab-profundo/estado/v1'));
  expect(depois, 'responder não mudou o estado guardado').not.toBe(antes);

  /* E o progresso sobrevive a recarregar — que é a diferença entre estudar
     e brincar. Este é o teste que `file://` reprovaria. */
  await page.reload();
  const apos = await page.evaluate(() => localStorage.getItem('neurolab-profundo/estado/v1'));
  expect(apos, 'o progresso não sobreviveu a recarregar').toBe(depois);
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
