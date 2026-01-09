// smartsupp.js
// Production-ready Smartsupp loader (widget-page only)

(function () {
  if (window.__smartsuppLoaded) return;
  window.__smartsuppLoaded = true;

  function loadSmartsupp() {
    const script = document.createElement('script');
    script.src =
      'https://widget-page.smartsupp.com/widget/1d61c626cecbd6d35d0987b2ff1de9587836ed5e';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }

  // Load after DOM is ready
  if (document.readyState === 'complete') {
    loadSmartsupp();
  } else {
    window.addEventListener('load', loadSmartsupp);
  }
})();
