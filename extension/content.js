const GIST_BASE_URL = "https://www.youtubegist.com/watch?v="; // TODO: 若站点路径不同，可在此调整
const PANEL_ID = "ygist-panel";
const PANEL_HIDDEN_CLASS = "ygist-hidden";
const PANEL_COLLAPSED_CLASS = "ygist-collapsed";
const PANEL_EXPANDED_CLASS = "ygist-expanded";
const PANEL_STATE_STORAGE_KEY = "ygistExpanded";
const HAS_CHROME_STORAGE =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

let currentVideoId = null;
let panelEl;
let toggleBtnEl;
let bodyEl;
let iframeEl;
let statusEl;
let locationCheckTimer;
let mountCheckTimer;
let embedStatusTimer;
let isExpanded = true;

(function init() {
  if (typeof document === "undefined") {
    return;
  }

  const bootstrap = () => {
    ensurePanel();
    attachPanel();
    handleLocationChange();

    // YouTube 是单页应用，下列事件帮助我们在导航时更新侧栏内容。
    window.addEventListener("yt-navigate-finish", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    document.addEventListener("yt-page-data-updated", handleLocationChange);

    // 兜底轮询，避免极端情况下事件未触发。
    locationCheckTimer = window.setInterval(() => {
      attachPanel();
      const resolvedId = extractYouTubeVideoId(window.location.href);
      if (resolvedId !== currentVideoId) {
        handleLocationChange();
      }
    }, 800);

    window.addEventListener("beforeunload", () => {
      clearTimers();
    });
  };

  const startWhenReady = () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
    } else {
      bootstrap();
    }
  };

  if (HAS_CHROME_STORAGE) {
    chrome.storage.local.get({ [PANEL_STATE_STORAGE_KEY]: isExpanded }, (result) => {
      if (!chrome.runtime || !chrome.runtime.lastError) {
        const stored = result ? result[PANEL_STATE_STORAGE_KEY] : undefined;
        if (typeof stored === "boolean") {
          isExpanded = stored;
        }
      } else {
        console.warn("YouTubeGist: 读取面板状态失败", chrome.runtime.lastError);
      }
      startWhenReady();
    });
  } else {
    startWhenReady();
  }
})();

function clearTimers() {
  if (locationCheckTimer) {
    window.clearInterval(locationCheckTimer);
    locationCheckTimer = undefined;
  }
  if (mountCheckTimer) {
    window.clearInterval(mountCheckTimer);
    mountCheckTimer = undefined;
  }
  if (embedStatusTimer) {
    window.clearTimeout(embedStatusTimer);
    embedStatusTimer = undefined;
  }
}

function ensurePanel() {
  if (panelEl || !document.body) {
    return;
  }

  panelEl = document.createElement("section");
  panelEl.id = PANEL_ID;
  panelEl.classList.add(PANEL_HIDDEN_CLASS);
  if (isExpanded) {
    panelEl.classList.add(PANEL_EXPANDED_CLASS);
  } else {
    panelEl.classList.add(PANEL_COLLAPSED_CLASS);
  }

  toggleBtnEl = document.createElement("button");
  toggleBtnEl.id = "ygist-toggle";
  toggleBtnEl.type = "button";
  toggleBtnEl.textContent = "YouTubeGist";
  toggleBtnEl.disabled = true;
  toggleBtnEl.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  toggleBtnEl.addEventListener("click", () => {
    if (isExpanded) {
      collapsePanel();
    } else {
      expandPanel();
    }
  });
  panelEl.appendChild(toggleBtnEl);

  bodyEl = document.createElement("div");
  bodyEl.className = "ygist-panel-body";

  statusEl = document.createElement("div");
  statusEl.id = "ygist-status";
  statusEl.style.display = "none";
  bodyEl.appendChild(statusEl);

  const frameShell = document.createElement("div");
  frameShell.id = "ygist-frame-shell";

  iframeEl = document.createElement("iframe");
  iframeEl.id = "ygist-frame";
  iframeEl.title = "YouTubeGist 页面";
  iframeEl.referrerPolicy = "no-referrer";
  iframeEl.addEventListener("load", () => {
    iframeEl.dataset.loaded = "true";
    setStatus("");
  });

  frameShell.appendChild(iframeEl);
  bodyEl.appendChild(frameShell);

  panelEl.appendChild(bodyEl);
  document.body.appendChild(panelEl);
}

function handleLocationChange() {
  ensurePanel();
  attachPanel();

  if (!panelEl) {
    return;
  }

  const videoId = extractYouTubeVideoId(window.location.href);

  if (!videoId) {
    currentVideoId = null;
    hidePanel();
    return;
  }

  showPanel();

  const videoChanged = videoId !== currentVideoId;
  currentVideoId = videoId;

  if (!isExpanded) {
    clearEmbed();
    setStatus("");
    return;
  }

  const currentSrc = iframeEl.getAttribute("src");
  if (videoChanged || !currentSrc) {
    loadCurrentVideo();
  }
}

function showPanel() {
  panelEl.classList.remove(PANEL_HIDDEN_CLASS);
  toggleBtnEl.disabled = false;

  if (isExpanded) {
    panelEl.classList.add(PANEL_EXPANDED_CLASS);
    panelEl.classList.remove(PANEL_COLLAPSED_CLASS);
  } else {
    panelEl.classList.add(PANEL_COLLAPSED_CLASS);
    panelEl.classList.remove(PANEL_EXPANDED_CLASS);
  }

  toggleBtnEl.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function hidePanel() {
  if (!panelEl) {
    return;
  }

  panelEl.classList.add(PANEL_HIDDEN_CLASS);
  toggleBtnEl.disabled = true;
  clearEmbed();
  setStatus("");
}

function attachPanel() {
  if (!panelEl) {
    return;
  }

  const host = findPanelHost();

  if (!host) {
    if (!mountCheckTimer) {
      mountCheckTimer = window.setInterval(() => {
        if (findPanelHost()) {
          attachPanel();
        }
      }, 500);
    }
    return;
  }

  if (mountCheckTimer) {
    window.clearInterval(mountCheckTimer);
    mountCheckTimer = undefined;
  }

  if (panelEl.parentElement !== host) {
    host.insertBefore(panelEl, host.firstChild);
  }
}

function findPanelHost() {
  const selectors = [
    "#secondary-inner",
    "#secondary",
    "ytd-watch-flexy #secondary-inner",
    "ytd-watch-flexy #secondary"
  ];

  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
  }

  return document.body || null;
}

function extractYouTubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      return url.searchParams.get("v");
    }

    if (host === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (host === "youtube-nocookie.com") {
      const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
      return embedMatch ? embedMatch[1] : null;
    }
  } catch (error) {
    console.warn("YouTubeGist: 无法解析当前链接", error);
  }

  return null;
}

function expandPanel() {
  if (!panelEl) {
    return;
  }

  isExpanded = true;
  panelEl.classList.add(PANEL_EXPANDED_CLASS);
  panelEl.classList.remove(PANEL_COLLAPSED_CLASS);
  toggleBtnEl.setAttribute("aria-expanded", "true");
  persistPanelState();
  loadCurrentVideo();
}

function collapsePanel() {
  if (!panelEl) {
    return;
  }

  isExpanded = false;
  panelEl.classList.add(PANEL_COLLAPSED_CLASS);
  panelEl.classList.remove(PANEL_EXPANDED_CLASS);
  toggleBtnEl.setAttribute("aria-expanded", "false");
  persistPanelState();
  clearEmbed();
  setStatus("");
}

function loadCurrentVideo() {
  if (!currentVideoId) {
    setStatus("请在 YouTube 视频页面中使用 YouTubeGist 面板。");
    return;
  }

  const gistUrl = `${GIST_BASE_URL}${currentVideoId}`;
  iframeEl.dataset.loaded = "false";
  setStatus("正在加载对应的 YouTubeGist 页面...");
  iframeEl.src = gistUrl;

  if (embedStatusTimer) {
    window.clearTimeout(embedStatusTimer);
  }

  embedStatusTimer = window.setTimeout(() => {
    if (iframeEl.dataset.loaded !== "true") {
      setStatus("如果页面无法正常显示，请点击上方链接在新标签页打开。");
    }
  }, 3500);
}

function clearEmbed() {
  if (!iframeEl) {
    return;
  }

  if (embedStatusTimer) {
    window.clearTimeout(embedStatusTimer);
    embedStatusTimer = undefined;
  }

  iframeEl.removeAttribute("src");
  iframeEl.dataset.loaded = "false";
}

function setStatus(message) {
  if (!statusEl) {
    return;
  }

  if (!message) {
    statusEl.textContent = "";
    statusEl.style.display = "none";
    return;
  }

  statusEl.textContent = message;
  statusEl.style.display = "block";
}

function persistPanelState() {
  if (!HAS_CHROME_STORAGE) {
    return;
  }

  chrome.storage.local.set({ [PANEL_STATE_STORAGE_KEY]: isExpanded }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn("YouTubeGist: 保存面板状态失败", chrome.runtime.lastError);
    }
  });
}
