import { encodeBase64 } from "./codec.js";
import {
  SUBJECTS,
  assertCanWrite,
  commitPlan,
  createGameId,
  gamesForSubject,
  moveGame,
  nextOrder,
  publicGames,
  toGameRecord,
  validateGameInput,
  validateSite
} from "./catalog.js";
import { loginWithToken, publishPlan, readRepoJson } from "./github.js";

const SAVED = "已儲存。GitHub Pages 通常於一分鐘內更新。";
const NEW_FILE_HINT = "請上傳一個完整的 HTML 檔。樣式、程式及圖片請內嵌在檔案內。上限 8MB。";
const EDIT_FILE_HINT = "不選擇檔案則保留現有遊戲。如要替換，請上傳一個完整的 HTML 檔，上限 8MB。";

let session = null;
let games = [];
let editingId = null;
let orderDirty = false;
let busy = false;

const loginPanel = document.querySelector("#login-panel");
const adminPanel = document.querySelector("#admin-panel");
const loginForm = document.querySelector("#login-form");
const tokenInput = document.querySelector("#token");
const toggleToken = document.querySelector("#toggle-token");
const loginErrors = document.querySelector("#login-errors");
const sessionLabel = document.querySelector("#session-label");
const notice = document.querySelector("#notice");
const siteForm = document.querySelector("#site-form");
const siteTitle = document.querySelector("#site-title");
const siteIntro = document.querySelector("#site-intro");
const siteErrors = document.querySelector("#site-errors");
const gameAdmin = document.querySelector("#game-admin");
const saveOrder = document.querySelector("#save-order");
const orderNote = document.querySelector("#order-note");
const gameForm = document.querySelector("#game-form");
const gameFormTitle = document.querySelector("#game-form-title");
const gameName = document.querySelector("#game-name");
const gameDescription = document.querySelector("#game-description");
const gameSubject = document.querySelector("#game-subject");
const gameFile = document.querySelector("#game-file");
const fileHint = document.querySelector("#file-hint");
const gameErrors = document.querySelector("#game-errors");
const gameSubmit = document.querySelector("#game-submit");
const gameCancel = document.querySelector("#game-cancel");

function setErrors(list, errors) {
  list.replaceChildren();
  if (!errors || errors.length === 0) {
    list.hidden = true;
    return;
  }
  list.hidden = false;
  for (const error of errors) {
    const item = document.createElement("li");
    item.textContent = error;
    list.append(item);
  }
}

function showNotice(text, kind) {
  notice.textContent = text;
  if (kind) notice.dataset.kind = kind;
  else delete notice.dataset.kind;
}

function errorText(error) {
  const token = session?.token || "";
  const message = typeof error?.message === "string" ? error.message : "";
  if (token && message.includes(token)) return "儲存失敗，請稍後再試";
  if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
    return "權杖無效或沒有此儲存庫的寫入權限";
  }
  if (error?.status === 422 || error?.status === 409) return "內容剛被更新，請再試一次";
  if (error instanceof TypeError || error?.status === 0) return "無法連線到 GitHub，請檢查網絡後再試。";
  if (message.startsWith("請") || message.startsWith("沒有") || message.startsWith("找不到") || message.startsWith("缺少")) {
    return message;
  }
  return "儲存失敗，請稍後再試";
}

function setBusy(next) {
  busy = next;
  for (const control of adminPanel.querySelectorAll("button, input, textarea, select")) {
    control.disabled = next;
  }
}

async function withBusy(task) {
  if (busy) return;
  setBusy(true);
  try {
    assertCanWrite(session);
    await task();
  } catch (error) {
    showNotice(errorText(error), "error");
  } finally {
    setBusy(false);
    renderGames();
  }
}

function makeButton(label, className, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function renderGames() {
  gameAdmin.replaceChildren();
  saveOrder.hidden = !orderDirty;
  orderNote.hidden = !orderDirty;
  for (const subject of SUBJECTS) {
    const block = document.createElement("section");
    block.className = "subject-block";
    const heading = document.createElement("h3");
    heading.textContent = `${subject.code}　${subject.name}`;
    const list = document.createElement("div");
    list.className = "admin-list";
    const items = gamesForSubject(games, subject.id);
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "尚未有遊戲";
      list.append(empty);
    }
    items.forEach((game, index) => {
      const card = document.createElement("article");
      card.className = "admin-card";
      const name = document.createElement("h4");
      name.textContent = game.name;
      const description = document.createElement("p");
      description.textContent = game.description;
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      const up = makeButton("上移", "button button-quiet", () => shift(game.id, -1));
      const down = makeButton("下移", "button button-quiet", () => shift(game.id, 1));
      const edit = makeButton("編輯", "button button-quiet", () => startEdit(game.id));
      const remove = makeButton("刪除", "button button-danger", () => removeGame(game.id));
      up.disabled = index === 0;
      down.disabled = index === items.length - 1;
      actions.append(up, down, edit, remove);
      card.append(name, description, actions);
      list.append(card);
    });
    block.append(heading, list);
    gameAdmin.append(block);
  }
}

function shift(id, direction) {
  if (busy) return;
  const next = moveGame(games, id, direction);
  if (next === games) return;
  games = next;
  orderDirty = true;
  renderGames();
}

function startEdit(id) {
  const game = games.find((item) => item.id === id);
  if (!game || busy) return;
  editingId = id;
  gameFormTitle.textContent = "修改遊戲";
  gameName.value = game.name;
  gameDescription.value = game.description;
  gameSubject.value = game.subject;
  gameFile.value = "";
  gameSubmit.textContent = "儲存變更";
  gameCancel.hidden = false;
  fileHint.textContent = EDIT_FILE_HINT;
  setErrors(gameErrors, []);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gameForm.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function resetGameForm() {
  editingId = null;
  gameForm.reset();
  gameFormTitle.textContent = "新增遊戲";
  gameSubmit.textContent = "上傳遊戲";
  gameCancel.hidden = true;
  fileHint.textContent = NEW_FILE_HINT;
  setErrors(gameErrors, []);
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return encodeBase64(bytes);
}

async function openAdmin() {
  const siteData = await readRepoJson(session.token, "data/site.json");
  const gameData = await readRepoJson(session.token, "data/games.json");
  const checked = validateSite(siteData);
  if (!checked.ok) throw new Error(checked.errors[0]);
  const loaded = publicGames(gameData);
  games = loaded;
  siteTitle.value = checked.value.title;
  siteIntro.value = checked.value.intro;
  sessionLabel.textContent = session.login
    ? `已登入 GitHub 帳號 ${session.login}`
    : "已登入，可以管理這個平台。";
  orderDirty = false;
  resetGameForm();
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  renderGames();
  if (Array.isArray(gameData.games) && loaded.length !== gameData.games.length) {
    showNotice("有部分遊戲資料未能讀取，儲存遊戲時不會保留那些項目。", "error");
  } else {
    showNotice("");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  setErrors(loginErrors, []);
  const entered = tokenInput.value;
  busy = true;
  loginForm.querySelector("button[type=submit]").disabled = true;
  try {
    const result = await loginWithToken(entered);
    if (!result.ok) {
      session = null;
      setErrors(loginErrors, [result.error]);
      return;
    }
    session = { token: result.token, login: result.login, permissionsPush: true };
    await openAdmin();
    tokenInput.value = "";
  } catch (error) {
    session = null;
    setErrors(loginErrors, [errorText(error)]);
  } finally {
    busy = false;
    loginForm.querySelector("button[type=submit]").disabled = false;
  }
});

toggleToken.addEventListener("click", () => {
  const showing = tokenInput.type === "text";
  tokenInput.type = showing ? "password" : "text";
  toggleToken.textContent = showing ? "顯示權杖" : "隱藏權杖";
});

document.querySelector("#logout").addEventListener("click", () => {
  if (orderDirty && !window.confirm("順序尚未儲存，確定要登出？")) return;
  session = null;
  games = [];
  editingId = null;
  orderDirty = false;
  tokenInput.value = "";
  adminPanel.hidden = true;
  loginPanel.hidden = false;
  gameAdmin.replaceChildren();
  showNotice("");
  setErrors(loginErrors, []);
});

siteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const checked = validateSite({ title: siteTitle.value, intro: siteIntro.value });
  setErrors(siteErrors, checked.errors);
  if (!checked.ok) return;
  withBusy(async () => {
    const plan = commitPlan({ site: checked.value });
    await publishPlan(session.token, plan, "更新首頁標題及介紹");
    showNotice(SAVED, "ok");
  });
});

saveOrder.addEventListener("click", () => {
  withBusy(async () => {
    const plan = commitPlan({ games });
    await publishPlan(session.token, plan, "調整遊戲順序");
    orderDirty = false;
    showNotice(SAVED, "ok");
  });
});

gameCancel.addEventListener("click", () => {
  if (busy) return;
  resetGameForm();
});

gameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const file = gameFile.files[0] || null;
  const isNew = !editingId;
  const checked = validateGameInput({
    name: gameName.value,
    description: gameDescription.value,
    subject: gameSubject.value,
    file,
    isNew
  });
  setErrors(gameErrors, checked.errors);
  if (!checked.ok) return;
  withBusy(async () => {
    const now = new Date().toISOString();
    let record;
    const uploads = [];
    let nextGames;
    if (isNew) {
      const id = createGameId(games.map((game) => game.id));
      record = toGameRecord({
        id,
        name: checked.value.name,
        description: checked.value.description,
        subject: checked.value.subject,
        order: nextOrder(games, checked.value.subject),
        updatedAt: now
      });
      uploads.push({ path: record.file, base64: await fileToBase64(file) });
      nextGames = [...games, record];
    } else {
      const current = games.find((game) => game.id === editingId);
      if (!current) throw new Error("找不到這個遊戲");
      const order = current.subject === checked.value.subject
        ? current.order
        : nextOrder(games.filter((game) => game.id !== current.id), checked.value.subject);
      record = toGameRecord({
        ...current,
        name: checked.value.name,
        description: checked.value.description,
        subject: checked.value.subject,
        order,
        updatedAt: now
      });
      if (file) uploads.push({ path: record.file, base64: await fileToBase64(file) });
      nextGames = games.map((game) => (game.id === current.id ? record : game));
    }
    const plan = commitPlan({ games: nextGames, uploads });
    const message = isNew ? `新增遊戲：${record.name}` : `更新遊戲：${record.name}`;
    await publishPlan(session.token, plan, message);
    games = nextGames;
    orderDirty = false;
    resetGameForm();
    showNotice(SAVED, "ok");
  });
});

async function removeGame(id) {
  if (busy) return;
  const game = games.find((item) => item.id === id);
  if (!game) return;
  if (!window.confirm(`確定要刪除「${game.name}」？此動作無法在網站上還原。`)) return;
  await withBusy(async () => {
    const nextGames = games.filter((item) => item.id !== id);
    const plan = commitPlan({ games: nextGames, deletePaths: [game.file] });
    await publishPlan(session.token, plan, `刪除遊戲：${game.name}`);
    games = nextGames;
    orderDirty = false;
    if (editingId === id) resetGameForm();
    showNotice(SAVED, "ok");
  });
}

window.addEventListener("beforeunload", (event) => {
  if (!orderDirty) return;
  event.preventDefault();
  event.returnValue = "";
});
