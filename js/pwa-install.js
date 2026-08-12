// Suporte ao botão "Instalar app" no menu inicial. `beforeinstallprompt` só
// dispara em browsers baseados em Chromium (Chrome/Edge/Opera Android e
// desktop) quando os critérios de instalabilidade do PWA são atendidos —
// Safari/iOS e Firefox nunca disparam esse evento, então o botão
// simplesmente nunca aparece nesses navegadores (usuário instala pelo menu
// nativo do browser, como já era antes; ver instalar.html pro passo a passo).
export function initPwaInstall() {
  const btn = document.querySelector('#btn-install');
  if (!btn) {
    return;
  }

  const alreadyInstalled = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (alreadyInstalled) {
    return;
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isso o Chrome mostra o próprio mini-infobar de instalação
    // automaticamente; guardamos o evento pra disparar via nosso botão em
    // vez disso.
    event.preventDefault();
    deferredPrompt = event;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // `.prompt()` só pode ser chamado uma vez por evento — depois de usado
    // (aceito ou recusado) não tem mais serventia.
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferredPrompt = null;
  });
}
