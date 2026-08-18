/* O app é estático: um servidor de arquivos na raiz do repositório serve o
   mesmo conjunto que o GitHub Pages serve. Sem build, sem dependência.

   Viewport de celular porque é onde o app é usado — testar em desktop
   esconderia exatamente a classe de defeito que este arquivo existe para
   pegar (botão fora da dobra, alvo de toque pequeno demais). */
module.exports = {
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },     // um celular comum
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium-celular', use: { browserName: 'chromium' } }
  ],
  webServer: {
    command: 'npx --yes http-server . -p 4173 -c-1 --silent',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
};
