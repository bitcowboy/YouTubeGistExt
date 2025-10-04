const GIST_BASE_URL = "https://www.youtubegist.com/watch?v="; // TODO: 按实际的 youtubegist 页面路径调整

const statusEl = document.getElementById("status");
const linkEl = document.getElementById("gist-link");

init().catch((error) => {
  console.error(error);
  setStatus("加载扩展时出错，请重试。" + (error?.message ? `\n${error.message}` : ""));
});

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    setStatus("未找到当前标签页信息。");
    return;
  }

  const videoId = extractYouTubeVideoId(tab.url);

  if (!videoId) {
    setStatus("请在 YouTube 视频页面中使用此扩展。");
    return;
  }

  const gistUrl = `${GIST_BASE_URL}${videoId}`;
  linkEl.href = gistUrl;
  linkEl.textContent = "打开对应的 YouTubeGist 页面";
  linkEl.classList.remove("hidden");
  setStatus("");
}

function setStatus(message) {
  if (!message) {
    statusEl.textContent = "";
    statusEl.classList.add("hidden");
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
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
    console.warn("无法解析当前链接", error);
  }

  return null;
}
