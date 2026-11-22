(() => {
  function findPairs() {
    const pairs = [];
    const used = new Set();
    for (const img of document.querySelectorAll('img[src*="captcha.png"]')) {
      if (!img.checkVisibility()) continue;
      const scope = img.closest("form") || document;
      const input = scope.querySelector('input#captcha, input[name="captcha"]');
      if (input?.checkVisibility() && !used.has(input)) {
        used.add(input);
        pairs.push({ img, input });
      }
    }
    return pairs;
  }

  window.taxcapWatchCaptchas({
    portal: "tracuunnt",
    settingKey: "tracuunnt",
    cong: "tracuunnt",
    findPairs,
    readImage: window.taxcapReadCanvasImage,
  });
})();
