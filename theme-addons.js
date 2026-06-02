(function () {
  "use strict";

  var extraThemes = {
    mark: {
      label: "마가 다락방",
      bg: "assets/back_mark.webp",
      altar: "assets/b_mark.webp",
      color: "#3e2b21",
      position: "center 52%",
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 14V7l6-5 6 5v7"/><path d="M6 14v-4h4v4"/></svg>'
    },
    jonah: {
      label: "요나의 고래뱃속",
      bg: "assets/back_jonah.webp",
      altar: "assets/b_jonah.webp",
      color: "#000204",
      position: "center calc(50% - 8vh)",
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M6 3.5l2 2.5 2-2.5"/><path d="M2 11.5c2-1 3-1 5 0s3 1 5 0"/><path d="M2 13c2-1 3-1 5 0s3 1 5 0"/><circle cx="13" cy="8" r=".5" fill="currentColor" stroke="none"/></svg>'
    },
    sinal: {
      label: "모세의 시내산",
      bg: "assets/back_sinal.webp",
      altar: "assets/b_sinal.webp",
      color: "#536a83",
      position: "center calc(50% - 30vh)",
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 13l4.5-9 2 4"/><path d="M6.5 8l2.5-5 4 10"/><path d="M10 2l-1.5 2.5h2.5l-2 3"/></svg>'
    }
  };

  var baseThemeLabels = ["사막의 제단", "겟세마네 동산", "어두운 밤", "여름 녹음"];
  var activeExtraTheme = "";
  var seeded = false;
  var cleanupTimers = [];
  var sinalBackgroundSize = { width: 2912, height: 1632 };
  var sinalPeakAnchor = { x: 0.54, y: 0.415 };
  var themeClassByExtraTheme = {
    mark: "codex-theme-mark",
    jonah: "codex-theme-jonah",
    sinal: "codex-theme-sinal"
  };
  var allThemeClasses = [
    "codex-theme-desert",
    "codex-theme-gethsemane",
    "codex-theme-night",
    "codex-theme-summer",
    "codex-theme-mark",
    "codex-theme-jonah",
    "codex-theme-sinal"
  ];
  var THEME_ASSET_VERSION = "theme-assets-12";
  var THEME_SWAP_DELAY = 600;
  var backgroundRequestId = 0;
  var imageLoadCache = {};
  var sinalLightningTimeouts = [];
  var lightningSources = [
    { src: "assets/lightning/lightning_05.png", width: 299, height: 362, dx: -80, dy: 25, rotate: -6 },
    { src: "assets/lightning/lightning_06.png", width: 317, height: 388, dx: -25, dy: 15, rotate: -2 },
    { src: "assets/lightning/lightning_07.png", width: 290, height: 362, dx: 30, dy: 20, rotate: 3 },
    { src: "assets/lightning/lightning_08.png", width: 320, height: 374, dx: 90, dy: 28, rotate: 8 }
  ];

  function normalizeAssetSrc(src) {
    return String(src || "").split("?")[0];
  }

  function versionedAssetSrc(src) {
    var base = normalizeAssetSrc(src);
    if (!base) return "";
    return base + "?v=" + THEME_ASSET_VERSION;
  }

  function preloadImage(src) {
    var url = versionedAssetSrc(src);
    if (!url) return Promise.reject(new Error("Missing image source"));
    if (imageLoadCache[url]) return imageLoadCache[url];
    imageLoadCache[url] = new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(url);
      };
      image.onerror = function () {
        delete imageLoadCache[url];
        reject(new Error("Failed to load " + url));
      };
      image.src = url;
    });
    return imageLoadCache[url];
  }

  function preloadThemeImages() {
    Object.keys(extraThemes).forEach(function (theme) {
      preloadImage(extraThemes[theme].bg).catch(function () {});
    });
  }

  function setBackgroundFrame(background, config) {
    background.style.backgroundPosition = config.position;
    background.style.backgroundColor = config.color;
    background.style.backgroundSize = "cover";
    background.style.backgroundRepeat = "no-repeat";
    background.style.opacity = "1";
  }

  function applyLoadedBackground(theme, config) {
    var requestId = ++backgroundRequestId;
    var background = findBackgroundNode();
    if (!background) return;
    background.dataset.codexThemeBackground = "true";
    background.dataset.codexBackgroundPending = theme;
    setBackgroundFrame(background, config);

    preloadImage(config.bg).then(function () {
      var target = document.querySelector('[data-codex-background-pending="' + theme + '"]') || background;
      if (requestId !== backgroundRequestId || activeExtraTheme !== theme || !target) return;
      target.style.backgroundImage = 'url("' + versionedAssetSrc(config.bg) + '")';
      target.removeAttribute("data-codex-background-pending");
      if (theme === "sinal") syncSinalLightningAnchor();
    }).catch(function () {
      var target = document.querySelector('[data-codex-background-pending="' + theme + '"]') || background;
      if (requestId !== backgroundRequestId || !target) return;
      target.style.backgroundImage = 'url("' + versionedAssetSrc(config.bg) + '")';
      target.removeAttribute("data-codex-background-pending");
      if (theme === "sinal") syncSinalLightningAnchor();
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function getText(node) {
    return (node && node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findBackgroundNode() {
    var marked = document.querySelector('[data-codex-theme-background="true"]');
    if (marked) return marked;
    var nodes = Array.from(document.querySelectorAll("#root div"));
    return nodes.find(function (node) {
      var bg = node.style && node.style.backgroundImage;
      return bg && bg.indexOf("assets/back_") !== -1;
    }) || nodes.find(function (node) {
      var style = node.style || {};
      return style.backgroundSize === "cover" || style.backgroundPosition;
    }) || null;
  }

  function createLayers() {
    var root = document.getElementById("root");
    if (!root) return;
    Object.keys(extraThemes).forEach(function (theme) {
      var id = theme + "-theme-layer";
      if (document.getElementById(id)) return;
      var layer = document.createElement("div");
      layer.id = id;
      layer.setAttribute("aria-hidden", "true");
      if (theme === "sinal") {
        ["left", "right"].forEach(function (side) {
          var cloud = document.createElement("span");
          cloud.className = "sinal-top-cloud sinal-top-cloud-" + side;
          layer.appendChild(cloud);
        });
      }
      document.body.insertBefore(layer, root);
    });

    // 번개용 별도 레이어 (overflow 잘림 방지)
    if (!document.getElementById("sinal-lightning-layer")) {
      var lightningLayer = document.createElement("div");
      lightningLayer.id = "sinal-lightning-layer";
      lightningLayer.setAttribute("aria-hidden", "true");

      var flash = document.createElement("span");
      flash.className = "sinal-lightning-flash";
      lightningLayer.appendChild(flash);

      var peakGlow = document.createElement("span");
      peakGlow.className = "sinal-peak-glow";
      lightningLayer.appendChild(peakGlow);

      lightningSources.forEach(function (source, index) {
        var lightning = document.createElement("span");
        lightning.className = "sinal-lightning sinal-lightning-" + (index + 1);
        lightning.dataset.sourceWidth = String(source.width);
        lightning.dataset.sourceHeight = String(source.height);
        lightning.style.backgroundImage = 'url("' + source.src + '")';
        lightningLayer.appendChild(lightning);
      });

      document.body.insertBefore(lightningLayer, root);
    }
  }

  function parseCssLength(value, axisSize) {
    var input = String(value || "").trim();
    if (!input || input === "center") return axisSize * 0.5;
    if (input === "top" || input === "left") return 0;
    if (input === "bottom" || input === "right") return axisSize;
    if (input.indexOf("calc(") === 0) {
      input = input.slice(5, -1).replace(/\s+/g, "");
      var match = input.match(/^(-?\d+(?:\.\d+)?)%([+-])(-?\d+(?:\.\d+)?)(vh|vw|px)$/);
      if (match) {
        var base = axisSize * (parseFloat(match[1]) / 100);
        var amount = parseFloat(match[3]);
        var unit = match[4];
        var delta = unit === "vh" ? window.innerHeight * amount / 100 : unit === "vw" ? window.innerWidth * amount / 100 : amount;
        return match[2] === "-" ? base - delta : base + delta;
      }
    }
    if (input.indexOf("%") !== -1) return axisSize * parseFloat(input) / 100;
    if (input.indexOf("vh") !== -1) return window.innerHeight * parseFloat(input) / 100;
    if (input.indexOf("vw") !== -1) return window.innerWidth * parseFloat(input) / 100;
    if (input.indexOf("px") !== -1 || /^-?\d/.test(input)) return parseFloat(input);
    return axisSize * 0.5;
  }

  function getBackgroundPositionParts(position) {
    var parts = String(position || "center center").trim().match(/calc\([^)]+\)|[^\s]+/g) || ["center", "center"];
    if (parts.length === 1) parts.push("center");
    return parts;
  }

  function syncSinalLightningAnchor() {
    if (activeExtraTheme !== "sinal") return;
    var layer = document.getElementById("sinal-theme-layer");
    var lightningLayer = document.getElementById("sinal-lightning-layer");
    var background = findBackgroundNode();
    if (!layer || !background) return;
    var rect = background.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var scale = Math.max(rect.width / sinalBackgroundSize.width, rect.height / sinalBackgroundSize.height);
    var renderedWidth = sinalBackgroundSize.width * scale;
    var renderedHeight = sinalBackgroundSize.height * scale;
    var position = getBackgroundPositionParts(background.style.backgroundPosition || getComputedStyle(background).backgroundPosition);
    var offsetX = parseCssLength(position[0], rect.width - renderedWidth);
    var offsetY = parseCssLength(position[1], rect.height - renderedHeight);
    var peakX = rect.left + offsetX + renderedWidth * sinalPeakAnchor.x;
    var peakY = rect.top + offsetY + renderedHeight * sinalPeakAnchor.y;
    layer.style.setProperty("--sinal-peak-x", peakX.toFixed(2) + "px");
    layer.style.setProperty("--sinal-peak-y", peakY.toFixed(2) + "px");
    layer.style.setProperty("--sinal-bg-scale", scale.toFixed(4));
    if (lightningLayer) {
      lightningLayer.style.setProperty("--sinal-peak-x", peakX.toFixed(2) + "px");
      lightningLayer.style.setProperty("--sinal-peak-y", peakY.toFixed(2) + "px");
      lightningLayer.style.setProperty("--sinal-bg-scale", scale.toFixed(4));
    }
    var allLightnings = Array.from((lightningLayer || layer).querySelectorAll(".sinal-lightning"));
    allLightnings.forEach(function (lightning) {
      var width = parseFloat(lightning.dataset.sourceWidth || "0");
      var height = parseFloat(lightning.dataset.sourceHeight || "0");
      if (!width || !height) return;
      lightning.style.width = (width * scale * 1.0).toFixed(2) + "px";
      lightning.style.height = (height * scale * 1.0).toFixed(2) + "px";
    });
  }

  function startLightningEffect() {
    stopLightningEffect();
    if (activeExtraTheme !== "sinal") return;
    var lightningLayer = document.getElementById("sinal-lightning-layer");
    if (!lightningLayer) return;
    var bolts = Array.from(lightningLayer.querySelectorAll(".sinal-lightning"));
    var flash = lightningLayer.querySelector(".sinal-lightning-flash");
    var peakGlow = lightningLayer.querySelector(".sinal-peak-glow");

    function strike() {
      if (activeExtraTheme !== "sinal") return;
      var count = Math.random() < 0.4 ? 1 : 2;
      var shuffled = bolts.slice().sort(function () { return Math.random() - 0.5; });
      var picked = shuffled.slice(0, count);

      if (peakGlow) peakGlow.classList.add("active");

      picked.forEach(function (bolt, index) {
        var delay = index === 0 ? 0 : (60 + Math.random() * 90);
        bolt.style.setProperty("--rx", (Math.random() * 70 - 35).toFixed(1) + "px");
        bolt.style.setProperty("--ry", (Math.random() * 50 - 25).toFixed(1) + "px");
        bolt.style.setProperty("--rr", (Math.random() * 14 - 7).toFixed(1) + "deg");
        var t1 = window.setTimeout(function () {
          if (activeExtraTheme !== "sinal") return;
          bolt.classList.add("flash");
        }, delay);
        var t2 = window.setTimeout(function () {
          if (activeExtraTheme !== "sinal") return;
          bolt.classList.remove("flash");
          bolt.style.removeProperty("--rx");
          bolt.style.removeProperty("--ry");
          bolt.style.removeProperty("--rr");
        }, delay + 550);
        sinalLightningTimeouts.push(t1, t2);
      });

      var flashDuration = 60 + Math.random() * 80;
      var t3 = window.setTimeout(function () {
        if (activeExtraTheme !== "sinal") return;
        if (flash) flash.classList.remove("active");
        if (peakGlow) peakGlow.classList.remove("active");
      }, flashDuration);
      sinalLightningTimeouts.push(t3);

      var nextDelay = 2500 + Math.random() * 3000;
      var t4 = window.setTimeout(function () {
        if (activeExtraTheme !== "sinal") return;
        strike();
      }, nextDelay);
      sinalLightningTimeouts.push(t4);
    }

    var initialDelay = 1200 + Math.random() * 1600;
    var t0 = window.setTimeout(strike, initialDelay);
    sinalLightningTimeouts.push(t0);
  }

  function stopLightningEffect() {
    sinalLightningTimeouts.forEach(function (id) { window.clearTimeout(id); });
    sinalLightningTimeouts = [];
    var lightningLayer = document.getElementById("sinal-lightning-layer");
    if (!lightningLayer) return;
    lightningLayer.querySelectorAll(".sinal-lightning").forEach(function (bolt) {
      bolt.classList.remove("flash");
      bolt.style.removeProperty("--rx");
      bolt.style.removeProperty("--ry");
      bolt.style.removeProperty("--rr");
    });
    var flash = lightningLayer.querySelector(".sinal-lightning-flash");
    var peakGlow = lightningLayer.querySelector(".sinal-peak-glow");
    if (flash) flash.classList.remove("active");
    if (peakGlow) peakGlow.classList.remove("active");
  }

  function seedLayer(layerId, className, count, options) {
    var layer = document.getElementById(layerId);
    var seedAttribute = "data-seeded-" + className;
    if (!layer || layer.hasAttribute(seedAttribute)) return;
    layer.setAttribute(seedAttribute, "true");
    for (var i = 0; i < count; i += 1) {
      var dot = document.createElement("span");
      dot.className = className;
      dot.style.setProperty("--x", (options.xMin + Math.random() * (options.xMax - options.xMin)).toFixed(2) + "%");
      dot.style.setProperty("--y", (options.yMin + Math.random() * (options.yMax - options.yMin)).toFixed(2) + "%");
      dot.style.setProperty("--size", (options.sizeMin + Math.random() * (options.sizeMax - options.sizeMin)).toFixed(2) + "px");
      dot.style.setProperty("--duration", (options.durationMin + Math.random() * (options.durationMax - options.durationMin)).toFixed(2) + "s");
      dot.style.setProperty("--delay", (-Math.random() * options.delayMax).toFixed(2) + "s");
      if (options.widthMin) dot.style.setProperty("--w", (options.widthMin + Math.random() * (options.widthMax - options.widthMin)).toFixed(2) + "px");
      if (options.heightMin) dot.style.setProperty("--h", (options.heightMin + Math.random() * (options.heightMax - options.heightMin)).toFixed(2) + "px");
      if (options.windXMin) dot.style.setProperty("--wind-x", (options.windXMin + Math.random() * (options.windXMax - options.windXMin)).toFixed(2) + "px");
      if (options.windYMin) dot.style.setProperty("--wind-y", (options.windYMin + Math.random() * (options.windYMax - options.windYMin)).toFixed(2) + "px");
      layer.appendChild(dot);
    }
  }

  function isPrayerActive() {
    return Array.from(document.querySelectorAll("button")).some(function (button) {
      var label = getText(button);
      return label.indexOf("기도 중") !== -1 || label.indexOf("기도중") !== -1;
    });
  }

  function syncPrayerState() {
    document.body.dataset.prayerState = isPrayerActive() ? "praying" : "waiting";
  }

  function seedEffects() {
    // seeded 플래그 제거: data-seeded-* 속성으로 중복 방지

    seedLayer("mark-theme-layer", "mark-dust", 34, {
      xMin: 4, xMax: 84, yMin: 14, yMax: 86, sizeMin: 1.2, sizeMax: 3.2, durationMin: 11, durationMax: 19, delayMax: 20,
      windXMin: 86, windXMax: 172, windYMin: -42, windYMax: -12
    });
    seedLayer("jonah-theme-layer", "jonah-particle", 36, {
      xMin: 4, xMax: 84, yMin: 12, yMax: 88, sizeMin: 1.3, sizeMax: 3.6, durationMin: 12, durationMax: 22, delayMax: 24,
      windXMin: 72, windXMax: 154, windYMin: -48, windYMax: -16
    });
    seedLayer("sinal-theme-layer", "sinal-mist", 5, {
      xMin: 0, xMax: 86, yMin: 50, yMax: 82, sizeMin: 1, sizeMax: 2, durationMin: 28, durationMax: 46, delayMax: 24, widthMin: 180, widthMax: 340, heightMin: 56, heightMax: 110
    });
    seedLayer("sinal-theme-layer", "sinal-air-dust", 14, {
      xMin: 8, xMax: 92, yMin: 14, yMax: 84, sizeMin: 0.8, sizeMax: 1.9, durationMin: 32, durationMax: 52, delayMax: 32
    });
    // 시내산 산지 먼지 (가까운 레이어)
    seedLayer("sinal-theme-layer", "sinal-mountain-dust-near", 50, {
      xMin: 2, xMax: 70, yMin: 6, yMax: 86, sizeMin: 2.5, sizeMax: 4.5, durationMin: 10, durationMax: 18, delayMax: 20,
      windXMin: 150, windXMax: 350, windYMin: -15, windYMax: 18
    });
    // 시내산 산지 먼지 (먼 레이어)
    seedLayer("sinal-theme-layer", "sinal-mountain-dust-far", 60, {
      xMin: 0, xMax: 80, yMin: 10, yMax: 90, sizeMin: 2, sizeMax: 3.5, durationMin: 14, durationMax: 24, delayMax: 24,
      windXMin: 100, windXMax: 280, windYMin: -12, windYMax: 14
    });
  }

  function updateThemeLabels(label) {
    Array.from(document.querySelectorAll("#root span, #root div")).forEach(function (node) {
      if (node.closest && node.closest("button")) return;
      if (!node.childElementCount && /^(사막의 제단|겟세마네 동산|어두운 밤|여름 녹음|마가 다락방|요나의 고래뱃속|모세의 시내산)$/.test(getText(node))) {
        node.textContent = label;
      }
    });
  }

  function updateMenuActive(theme) {
    Array.from(document.querySelectorAll("button[data-codex-theme]")).forEach(function (button) {
      button.classList.toggle("codex-theme-active", button.dataset.codexTheme === theme);
      button.toggleAttribute("aria-current", button.dataset.codexTheme === theme);
    });
    if (!theme) return;
    Array.from(document.querySelectorAll("button")).forEach(function (button) {
      if (button.dataset.codexTheme) return;
      var label = getText(button);
      if (!baseThemeLabels.some(function (themeLabel) { return label.indexOf(themeLabel) !== -1; })) return;
      button.classList.remove("bg-white/20", "text-amber-300");
      button.classList.add("text-white/70", "hover:bg-white/10", "hover:text-white");
      Array.from(button.querySelectorAll("div")).forEach(function (node) {
        var className = typeof node.className === "string" ? node.className : "";
        if (className.indexOf("bg-amber-400") !== -1) node.remove();
      });
    });
  }

  function clearScheduledWork() {
    cleanupTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    cleanupTimers = [];
  }

  function removeThemeEffectState() {
    ["mark", "jonah", "sinal"].forEach(function (theme) {
      var layer = document.getElementById(theme + "-theme-layer");
      if (!layer) return;
      layer.removeAttribute("data-active");
      layer.removeAttribute("data-codex-background-pending");
    });
    allThemeClasses.forEach(function (className) {
      document.body.classList.remove(className);
    });
    document.body.removeAttribute("data-theme");
    document.body.removeAttribute("data-extra-theme");
  }

  function markExtraThemeClass(theme) {
    allThemeClasses.forEach(function (className) {
      document.body.classList.remove(className);
    });
    if (themeClassByExtraTheme[theme]) document.body.classList.add(themeClassByExtraTheme[theme]);
  }

  function closeThemeMenuSoon(sourceButton) {
    var menu = sourceButton && sourceButton.parentElement;
    var wrapper = menu && menu.parentElement;
    if (!wrapper) return;
    var toggle = Array.from(wrapper.children).find(function (node) {
      return node.tagName === "BUTTON" && !node.dataset.codexTheme && getText(node).length === 0;
    });
    if (!toggle) return;
    cleanupTimers.push(window.setTimeout(function () {
      toggle.click();
    }, 40));
  }

  function applyExtraTheme(theme) {
    var config = extraThemes[theme];
    if (!config) return;
    clearScheduledWork();
    removeThemeEffectState();
    activeExtraTheme = theme;
    document.body.dataset.theme = theme;
    document.body.dataset.currentTheme = config.label;
    document.body.removeAttribute("data-extra-theme");
    markExtraThemeClass(theme);
    document.body.style.backgroundColor = config.color;

    applyLoadedBackground(theme, config);

    cleanupTimers.push(window.setTimeout(function () {
      if (activeExtraTheme !== theme) return;
      var altar = document.querySelector('img[alt="altar"]');
      if (!altar) return;
      var altarSrc = (altar.getAttribute("src") || "").split("?")[0];
      if (altarSrc !== config.altar) altar.setAttribute("src", config.altar);
      altar.style.removeProperty("transform");
      altar.style.removeProperty("filter");
      altar.style.removeProperty("width");
      altar.style.removeProperty("max-width");
      altar.style.removeProperty("height");
      altar.style.removeProperty("max-height");
      altar.style.removeProperty("margin-left");
      altar.style.removeProperty("margin-right");
      altar.style.removeProperty("transition");
      altar.style.removeProperty("animation");
    }, THEME_SWAP_DELAY));

    updateThemeLabels(config.label);
    updateMenuActive(theme);
    syncPrayerState();
    if (theme === "sinal") {
      syncSinalLightningAnchor();
      window.setTimeout(syncSinalLightningAnchor, 80);
      window.setTimeout(syncSinalLightningAnchor, 260);
      window.setTimeout(startLightningEffect, 600);
    }
  }

  function clearExtraThemeSoon() {
    stopLightningEffect();
    clearScheduledWork();
    activeExtraTheme = "";
    updateMenuActive("");
    removeThemeEffectState();
    document.body.style.backgroundColor = "";
    cleanupTimers.push(window.setTimeout(function () {
      var background = document.querySelector('[data-codex-theme-background="true"]');
      if (background) {
        background.removeAttribute("data-codex-theme-background");
        background.removeAttribute("data-codex-background-pending");
      }
      var altar = document.querySelector('img[alt="altar"]');
      if (altar) {
        altar.style.removeProperty("filter");
        altar.style.removeProperty("width");
        altar.style.removeProperty("max-width");
        altar.style.removeProperty("margin-left");
        altar.style.removeProperty("margin-right");
      }
    }, 40));
  }

  function makeThemeButton(theme) {
    var config = extraThemes[theme];
    var button = document.createElement("button");
    button.type = "button";
    button.dataset.codexTheme = theme;
    button.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 text-white/70 hover:bg-white/10 hover:text-white";
    button.innerHTML = '<span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;opacity:.78">' + (config.icon || '✦') + '</span><span>' + config.label + '</span>';
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (document.body.dataset.themeTransitioning === "true") return;
      document.dispatchEvent(new CustomEvent("codex-extra-theme-change", { detail: { theme: theme } }));
      cleanupTimers.push(window.setTimeout(function () {
        applyExtraTheme(theme);
        document.dispatchEvent(new CustomEvent("codex-bgm-theme-change", { detail: { theme: theme } }));
      }, THEME_SWAP_DELAY));
      closeThemeMenuSoon(button);
    });
    return button;
  }

  var menuOrderMap = {
    "사막의 제단": 1,
    "모세의 시내산": 2,
    "마가 다락방": 3,
    "여름 녹음": 4,
    "요나의 고래뱃속": 5,
    "어두운 밤": 6,
    "겟세마네 동산": 7
  };

  function reorderMenuButtons(menu) {
    if (!menu) return;
    menu.style.display = "flex";
    menu.style.flexDirection = "column";
    Array.from(menu.children).forEach(function (child) {
      if (child.tagName !== "BUTTON") return;
      var label = getText(child);
      var order = 99;
      Object.keys(menuOrderMap).forEach(function (key) {
        if (label.indexOf(key) !== -1) order = menuOrderMap[key];
      });
      var themeAttr = child.dataset && child.dataset.codexTheme;
      if (themeAttr && extraThemes[themeAttr]) {
        order = menuOrderMap[extraThemes[themeAttr].label] || 99;
      }
      child.style.order = String(order);
    });
  }

  function injectDisclaimer(menu) {
    if (!menu) return;
    var disclaimerId = "codex-ai-disclaimer";
    if (menu.querySelector("#" + disclaimerId)) return;
    var disclaimer = document.createElement("div");
    disclaimer.id = disclaimerId;
    disclaimer.className = "codex-ai-disclaimer";
    disclaimer.textContent = "일부 이미지·음악은 AI 도구를 활용해 제작되었습니다.";
    disclaimer.style.order = "100";
    menu.appendChild(disclaimer);
  }

  function injectMenuButtons() {
    var desertButton = Array.from(document.querySelectorAll("button")).find(function (button) {
      return getText(button).indexOf("사막의 제단") !== -1;
    });
    if (!desertButton || !desertButton.parentElement) return;
    var menu = desertButton.parentElement;
    Object.keys(extraThemes).forEach(function (theme) {
      if (!menu.querySelector('[data-codex-theme="' + theme + '"]')) {
        menu.appendChild(makeThemeButton(theme));
      }
    });
    reorderMenuButtons(menu);
    injectDisclaimer(menu);
    updateMenuActive(activeExtraTheme);
  }

  function scheduleMenuInjection() {
    [40, 160, 420, 900, 1800].forEach(function (delay) {
      window.setTimeout(injectMenuButtons, delay);
    });
  }

  ready(function () {
    createLayers();
    preloadThemeImages();
    seedEffects();
    syncPrayerState();
    window.addEventListener("resize", function () {
      syncSinalLightningAnchor();
    });
    scheduleMenuInjection();
    window.setTimeout(seedEffects, 800);
    window.setTimeout(seedEffects, 1800);
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      var label = getText(button);
      if (baseThemeLabels.some(function (themeLabel) { return label.indexOf(themeLabel) !== -1; })) {
        clearExtraThemeSoon();
      }
      if (label.length < 2 || label === "CCM") {
        scheduleMenuInjection();
    window.setTimeout(seedEffects, 800);
    window.setTimeout(seedEffects, 1800);
      }
      window.setTimeout(syncPrayerState, 40);
      window.setTimeout(syncPrayerState, 240);
    });
    var root = document.getElementById("root");
    if (root) {
      new MutationObserver(function () {
        syncPrayerState();
        updateMenuActive(activeExtraTheme);
        if (activeExtraTheme === "sinal") syncSinalLightningAnchor();
        var menu = document.querySelector('button[data-codex-theme]') && document.querySelector('button[data-codex-theme]').parentElement;
        if (!menu) {
          var desertBtn = Array.from(document.querySelectorAll("button")).find(function (b) { return getText(b).indexOf("사막의 제단") !== -1; });
          menu = desertBtn && desertBtn.parentElement;
        }
        if (menu) reorderMenuButtons(menu);
        if (menu) injectDisclaimer(menu);
      }).observe(root, { childList: true, subtree: true, characterData: true });
    }
    document.addEventListener("codex-extra-theme-change", function (event) {
      if (!event.detail || event.detail.theme === "base") {
        clearExtraThemeSoon();
      }
    });
  });
})();
