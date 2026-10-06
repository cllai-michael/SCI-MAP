import { SCIMAP } from "./config.js";

export const MAX_HTML_BYTES = 8 * 1024 * 1024;

export const SUBJECTS = [
  {
    id: "is",
    code: "IS",
    name: "綜合科學",
    blurb: "從日常生活走進科學",
    path: "is/"
  },
  {
    id: "chem",
    code: "CHEM",
    name: "化學",
    blurb: "認識物質與變化",
    path: "chem/"
  },
  {
    id: "bio",
    code: "BIO",
    name: "生物",
    blurb: "探索生命的構造",
    path: "bio/"
  }
];

const GAME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function subjectById(id) {
  return SUBJECTS.find((subject) => subject.id === id) || null;
}

export function isGameId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 80 && GAME_ID.test(id);
}

export function isHtmlFilename(name) {
  return typeof name === "string" && /\.html?$/i.test(name);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sortGames(games) {
  return [...games].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function gamesForSubject(games, subject) {
  return sortGames(games.filter((game) => game.subject === subject));
}

export function nextOrder(games, subject) {
  const related = games.filter((game) => game.subject === subject);
  if (related.length === 0) return 1;
  return Math.max(...related.map((game) => game.order)) + 1;
}

export function toGameRecord(game) {
  if (!game || typeof game !== "object") {
    throw new Error("遊戲資料不正確");
  }
  return {
    id: String(game.id || ""),
    name: cleanText(game.name),
    description: cleanText(game.description),
    subject: String(game.subject || ""),
    order: game.order,
    file: `games/${String(game.id || "")}/index.html`,
    updatedAt: String(game.updatedAt || "")
  };
}

export function assertGamePath(path) {
  const match = /^games\/([^/]+)\/index\.html$/.exec(path);
  if (!match || !isGameId(match[1])) {
    throw new Error("遊戲路徑不正確");
  }
}

export function assertCatalog(games) {
  const seen = new Set();
  for (const game of games) {
    if (!isGameId(game.id)) throw new Error("遊戲編號不正確");
    if (seen.has(game.id)) throw new Error("遊戲編號重複");
    seen.add(game.id);
    if (!game.name || game.name.length > 40) throw new Error("遊戲名稱不正確");
    if (!game.description || game.description.length > 200) throw new Error("遊戲介紹不正確");
    if (!subjectById(game.subject)) throw new Error("學科不正確");
    if (!Number.isInteger(game.order) || game.order < 1 || game.order > 9999) {
      throw new Error("遊戲順序不正確");
    }
    if (game.file !== `games/${game.id}/index.html`) throw new Error("遊戲路徑不正確");
    assertGamePath(game.file);
    if (!game.updatedAt) throw new Error("遊戲更新時間不正確");
  }
}

export function validateSite(site) {
  const title = cleanText(site?.title);
  const intro = cleanText(site?.intro);
  const errors = [];
  if (!title) errors.push("請填寫首頁標題");
  else if (title.length > 80) errors.push("首頁標題請少於 80 字");
  if (!intro) errors.push("請填寫首頁介紹");
  else if (intro.length > 500) errors.push("首頁介紹請少於 500 字");
  return { ok: errors.length === 0, errors, value: { title, intro } };
}

export function validateGameInput({ name, description, subject, file, isNew }) {
  const cleanedName = cleanText(name);
  const cleanedDescription = cleanText(description);
  const errors = [];
  if (!cleanedName) errors.push("請填寫遊戲名稱");
  else if (cleanedName.length > 40) errors.push("遊戲名稱請少於 40 字");
  if (!cleanedDescription) errors.push("請填寫遊戲介紹");
  else if (cleanedDescription.length > 200) errors.push("遊戲介紹請少於 200 字");
  if (!subjectById(subject)) errors.push("請選擇學科");
  if (isNew && !file) errors.push("請上傳 HTML 檔");
  if (file) {
    if (!isHtmlFilename(file.name)) errors.push("請上傳 HTML 檔");
    else if (file.size === 0) errors.push("檔案是空的");
    else if (file.size > MAX_HTML_BYTES) errors.push("檔案過大，上限為 8MB");
  }
  return {
    ok: errors.length === 0,
    errors,
    value: { name: cleanedName, description: cleanedDescription, subject }
  };
}

export function moveGame(games, id, direction) {
  const current = games.find((game) => game.id === id);
  if (!current) return games;
  const siblings = gamesForSubject(games, current.subject);
  const index = siblings.findIndex((game) => game.id === id);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return games;
  const reordered = siblings.slice();
  const [item] = reordered.splice(index, 1);
  reordered.splice(target, 0, item);
  const orderById = new Map(reordered.map((game, position) => [game.id, position + 1]));
  return games.map((game) => (
    orderById.has(game.id)
      ? toGameRecord({ ...game, order: orderById.get(game.id) })
      : game
  ));
}

export function createGameId(existingIds, now = Date.now(), random = defaultRandom) {
  const taken = new Set(existingIds);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < 4; index += 1) {
      suffix += alphabet[Math.floor(random() * alphabet.length)];
    }
    const id = `game-${now.toString(36)}-${suffix}`;
    if (!taken.has(id) && isGameId(id)) return id;
  }
  throw new Error("未能建立遊戲編號");
}

function defaultRandom() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4294967296;
}

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function commitPlan({ site, games, uploads = [], deletePaths = [] } = {}) {
  const files = [];
  if (site) {
    const checked = validateSite(site);
    if (!checked.ok) throw new Error(checked.errors[0]);
    files.push({ path: "data/site.json", text: jsonText(checked.value) });
  }
  if (games) {
    const records = sortGames(games.map((game) => toGameRecord(game)));
    assertCatalog(records);
    files.push({ path: "data/games.json", text: jsonText({ games: records }) });
  }
  for (const upload of uploads) {
    assertGamePath(upload.path);
    if (typeof upload.base64 === "string" && upload.base64.length > 0) {
      files.push({ path: upload.path, base64: upload.base64 });
    } else if (typeof upload.html === "string" && upload.html.length > 0) {
      files.push({ path: upload.path, text: upload.html });
    } else {
      throw new Error("缺少遊戲檔案");
    }
  }
  const removals = [];
  for (const path of deletePaths) {
    assertGamePath(path);
    removals.push(path);
  }
  if (files.length === 0 && removals.length === 0) {
    throw new Error("沒有需要儲存的變更");
  }
  return { files, deletePaths: removals };
}

export function buildTreeRequest(baseTree, blobs, deletePaths = []) {
  return {
    base_tree: baseTree,
    tree: [
      ...blobs.map((blob) => ({
        path: blob.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      })),
      ...deletePaths.map((path) => ({
        path,
        mode: "100644",
        type: "blob",
        sha: null
      }))
    ]
  };
}

export function sessionFromRepo(repo) {
  const expected = `${SCIMAP.owner}/${SCIMAP.repo}`;
  if (!repo || repo.full_name !== expected || repo.permissions?.push !== true) {
    return { ok: false, error: "權杖無效或沒有此儲存庫的寫入權限" };
  }
  return { ok: true, permissionsPush: true };
}

export function assertCanWrite(session) {
  if (!session || session.permissionsPush !== true || typeof session.token !== "string" || session.token.length === 0) {
    throw new Error("請先登入具有寫入權限的管理員權杖");
  }
}

export function publicGames(data) {
  if (!data || !Array.isArray(data.games)) return [];
  const games = [];
  const seen = new Set();
  for (const game of data.games) {
    try {
      const record = toGameRecord(game);
      assertCatalog([record]);
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      games.push(record);
    } catch {
      continue;
    }
  }
  return games;
}
