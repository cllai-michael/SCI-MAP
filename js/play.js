import { isGameId, publicGames, subjectById } from "./catalog.js";
import { assetPrefix, loadPublicJson } from "./public-data.js";

const SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock";
const frame = document.querySelector("#game-frame");
const stage = document.querySelector(".play-stage");
const title = document.querySelector("#play-title");
const back = document.querySelector("#back-link");
const message = document.querySelector("#play-message");
const fullscreen = document.querySelector("#fullscreen");
const prefix = assetPrefix();

frame.setAttribute("sandbox", SANDBOX);
frame.removeAttribute("srcdoc");

function showMissing(text) {
  stage.hidden = true;
  message.hidden = false;
  message.textContent = text;
  title.textContent = "科學遊戲";
}

fullscreen.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  const request = document.documentElement.requestFullscreen;
  if (typeof request !== "function") return;
  request.call(document.documentElement).catch(() => {});
});

document.addEventListener("fullscreenchange", () => {
  fullscreen.textContent = document.fullscreenElement ? "結束全螢幕" : "全螢幕";
});

const requestedId = new URLSearchParams(location.search).get("game");
if (!isGameId(requestedId)) {
  showMissing("找不到這個遊戲。");
} else {
  loadPublicJson("data/games.json")
    .then((catalog) => {
      const game = publicGames(catalog).find((item) => item.id === requestedId);
      if (!game) {
        showMissing("找不到這個遊戲。");
        return;
      }
      const subject = subjectById(game.subject);
      title.textContent = game.name;
      document.title = `${game.name}｜SCI-MAP`;
      frame.title = game.name;
      frame.src = `${prefix}${game.file}?v=${encodeURIComponent(game.updatedAt)}`;
      if (subject) {
        back.href = `${prefix}${subject.path}`;
        back.textContent = `返回${subject.name}`;
      }
    })
    .catch(() => {
      showMissing("暫時未能載入遊戲，請稍後再試。");
    });
}
