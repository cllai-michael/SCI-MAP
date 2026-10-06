import { gamesForSubject, publicGames, validateSite } from "./catalog.js";
import { loadPublicJson } from "./public-data.js";

const title = document.querySelector("#site-title");
const intro = document.querySelector("#site-intro");

loadPublicJson("data/site.json")
  .then((site) => {
    const checked = validateSite(site);
    if (!checked.ok) return;
    title.textContent = checked.value.title;
    intro.textContent = checked.value.intro;
    document.title = checked.value.title;
  })
  .catch(() => {
    intro.textContent = "暫時未能載入介紹，請稍後再試。";
  });

loadPublicJson("data/games.json")
  .then((catalog) => {
    const games = publicGames(catalog);
    for (const node of document.querySelectorAll("[data-count]")) {
      const count = gamesForSubject(games, node.dataset.count).length;
      node.textContent = count === 0 ? "尚未有遊戲" : `${count} 個遊戲`;
    }
  })
  .catch(() => {
    for (const node of document.querySelectorAll("[data-count]")) {
      node.textContent = "稍後再看";
    }
  });
