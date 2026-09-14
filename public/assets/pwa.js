/* kkpramod PWA — install prompt + push notifications */
(function () {
  if (!('serviceWorker' in navigator)) return;

  /* Register service worker */
  navigator.serviceWorker.register('/sw.js').catch(function () {});

  /* Install banner */
  var deferredPrompt = null;
  var banner = document.getElementById('pwaBanner');
  var installBtn = document.getElementById('pwaInstall');
  var dismissBtn = document.getElementById('pwaDismiss');

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (banner) banner.classList.add('show');
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; if (banner) banner.classList.remove('show'); });
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      if (banner) banner.classList.remove('show');
      try { sessionStorage.setItem('pwa_dismissed', '1'); } catch (e) {}
    });
  }

  window.addEventListener('appinstalled', function () {
    if (banner) banner.classList.remove('show');
    deferredPrompt = null;
  });

  /* Push notifications */
  var notifBtn = document.getElementById('pwaNotify');
  if (notifBtn) {
    notifBtn.addEventListener('click', function () {
      if (!('Notification' in window)) { alert('Notifications not supported in this browser.'); return; }
      if (Notification.permission === 'granted') {
        alert('Notifications already enabled!');
        return;
      }
      if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Please enable them in browser settings.');
        return;
      }
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          alert('Notifications enabled! You will receive NEPSE updates and aaoms news.');
          if (notifBtn) notifBtn.textContent = '🔔 Notifications On';
        }
      });
    });
    /* Update button state */
    if ('Notification' in window && Notification.permission === 'granted') {
      notifBtn.textContent = '🔔 Notifications On';
    }
  }
})();