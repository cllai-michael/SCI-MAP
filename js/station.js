import { gamesForSubject, publicGames, subjectById } from "./catalog.js";
import { assetPrefix, loadPublicJson } from "./public-data.js";

const subject = subjectById(document.body.dataset.subject);
const list = document.querySelector("#game-list");
const empty = document.querySelector("#empty-state");
const prefix = assetPrefix();

if (!subject) {
  empty.hidden = false;
  empty.textContent = "找不到這個學科。";
} else {
  loadPublicJson("data/games.json")
    .then((catalog) => {
      const games = gamesForSubject(publicGames(catalog), subject.id);
      list.replaceChildren();
      if (games.length === 0) {
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      for (const game of games) {
        const card = document.createElement("article");
        card.className = "game-card";
        const heading = document.createElement("h2");
        heading.textContent = game.name;
        const description = document.createElement("p");
        description.textContent = game.description;
        const link = document.createElement("a");
        link.className = "button";
        link.href = `${prefix}play/?game=${encodeURIComponent(game.id)}`;
        link.textContent = "開始遊玩";
        card.append(heading, description, link);
        list.append(card);
      }
    })
    .catch(() => {
      empty.hidden = false;
      empty.textContent = "暫時未能載入遊戲，請稍後再試。";
    });
}
