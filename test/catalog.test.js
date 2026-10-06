import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decodeBase64Utf8, encodeBase64Utf8 } from "../js/codec.js";
import {
  MAX_HTML_BYTES,
  assertCanWrite,
  assertCatalog,
  buildTreeRequest,
  commitPlan,
  createGameId,
  escapeHtml,
  gamesForSubject,
  moveGame,
  publicGames,
  sessionFromRepo,
  sortGames,
  validateGameInput,
  validateSite
} from "../js/catalog.js";
import { githubPaths } from "../js/github.js";

const root = fileURLToPath(new URL("..", import.meta.url));

function game(overrides = {}) {
  return {
    id: "states-of-matter",
    name: "物質三態",
    description: "判斷物質的狀態。",
    subject: "is",
    order: 1,
    file: "games/states-of-matter/index.html",
    updatedAt: "2026-10-06T00:00:00.000Z",
    ...overrides
  };
}

test("sorts games by order and keeps subjects apart", () => {
  const games = [
    game({ id: "b", name: "乙", order: 2, subject: "chem", file: "games/b/index.html" }),
    game({ id: "a", name: "甲", order: 1, subject: "is" }),
    game({ id: "c", name: "丙", order: 1, subject: "chem", file: "games/c/index.html" })
  ];
  assert.deepEqual(sortGames(games).map((item) => item.id), ["a", "c", "b"]);
  assert.deepEqual(gamesForSubject(games, "chem").map((item) => item.id), ["c", "b"]);
});

test("moves a game only within the same subject", () => {
  const games = [
    game({ id: "a", order: 1 }),
    game({ id: "b", name: "第二題", order: 2, file: "games/b/index.html" }),
    game({ id: "c", name: "化學", subject: "chem", order: 1, file: "games/c/index.html" })
  ];
  const moved = moveGame(games, "a", 1);
  assert.deepEqual(gamesForSubject(moved, "is").map((item) => item.id), ["b", "a"]);
  assert.equal(gamesForSubject(moved, "chem")[0].order, 1);
  assert.equal(moveGame(games, "a", -1), games);
});

test("validates homepage copy and game uploads", () => {
  assert.equal(validateSite({ title: "  科學探險島  ", intro: "歡迎同學。" }).ok, true);
  assert.deepEqual(validateSite({ title: " ", intro: "" }).errors, ["請填寫首頁標題", "請填寫首頁介紹"]);
  assert.equal(validateSite({ title: "題".repeat(81), intro: "介紹" }).ok, false);

  const created = validateGameInput({
    name: "元素符號",
    description: "選出符號",
    subject: "chem",
    file: { name: "Quiz.HTML", size: 128 },
    isNew: true
  });
  assert.equal(created.ok, true);
  assert.equal(validateGameInput({
    name: "元素符號",
    description: "選出符號",
    subject: "chem",
    file: null,
    isNew: true
  }).ok, false);
  assert.equal(validateGameInput({
    name: "元素符號",
    description: "選出符號",
    subject: "chem",
    file: null,
    isNew: false
  }).ok, true);
  assert.equal(validateGameInput({
    name: "元素符號",
    description: "選出符號",
    subject: "chem",
    file: { name: "notes.txt", size: 10 },
    isNew: true
  }).errors.includes("請上傳 HTML 檔"), true);
  assert.equal(validateGameInput({
    name: "元素符號",
    description: "選出符號",
    subject: "space",
    file: { name: "a.html", size: MAX_HTML_BYTES + 1 },
    isNew: true
  }).errors.includes("檔案過大，上限為 8MB"), true);
});

test("escapes text that would be markup", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("builds one commit tree for files and deletions", () => {
  const plan = commitPlan({
    site: { title: "科學探險島", intro: "每一站都有新遊戲。" },
    games: [game()],
    uploads: [{ path: "games/states-of-matter/index.html", html: "<!DOCTYPE html><title>物質三態</title>" }],
    deletePaths: ["games/old-game/index.html"]
  });
  assert.deepEqual(plan.files.map((file) => file.path), [
    "data/site.json",
    "data/games.json",
    "games/states-of-matter/index.html"
  ]);
  assert.equal(JSON.parse(plan.files[0].text).title, "科學探險島");
  const tree = buildTreeRequest("base-sha", [
    { path: plan.files[1].path, sha: "blob-1" }
  ], plan.deletePaths);
  assert.equal(tree.base_tree, "base-sha");
  assert.equal(tree.tree[1].sha, null);
  assert.equal(tree.tree[1].path, "games/old-game/index.html");
  assert.throws(() => commitPlan({ deletePaths: ["../secret.txt"] }), /遊戲路徑不正確/);
  assert.throws(() => commitPlan(), /沒有需要儲存的變更/);
});

test("accepts only a token that can push to this repository", () => {
  assert.equal(sessionFromRepo({
    full_name: "cllai-michael/sci-map",
    permissions: { push: true }
  }).ok, true);
  assert.equal(sessionFromRepo({
    full_name: "cllai-michael/sci-map",
    permissions: { push: false }
  }).ok, false);
  assert.equal(sessionFromRepo({
    full_name: "someone/other",
    permissions: { push: true }
  }).ok, false);
  assert.throws(() => assertCanWrite({ permissionsPush: true, token: "" }), /寫入權限/);
  assert.equal(assertCanWrite({ permissionsPush: true, token: "github_pat_example" }), undefined);
});

test("creates ids that cannot escape the games folder", () => {
  const id = createGameId(["game-fixed-aaaa"], 1, () => 0);
  assert.equal(id, "game-1-aaaa");
  assert.throws(() => createGameId(["game-1-aaaa"], 1, () => 0), /未能建立遊戲編號/);
  assert.equal(publicGames({
    games: [game(), game({ file: "https://evil.example/game.html" }), { id: "../secret" }]
  }).length, 1);
});

test("round-trips traditional Chinese through base64", () => {
  assert.equal(decodeBase64Utf8(encodeBase64Utf8("科學探險島")), "科學探險島");
});

test("uses the GitHub endpoints that can update main", () => {
  const paths = githubPaths();
  assert.equal(paths.ref, "/repos/cllai-michael/sci-map/git/ref/heads/main");
  assert.equal(paths.updateRef, "/repos/cllai-michael/sci-map/git/refs/heads/main");
  assert.equal(paths.contents("data/site.json"), "/repos/cllai-michael/sci-map/contents/data/site.json?ref=main");
});

test("sample catalog matches files that can be published", () => {
  const site = JSON.parse(readFileSync(join(root, "data/site.json"), "utf8"));
  const catalog = JSON.parse(readFileSync(join(root, "data/games.json"), "utf8"));
  assert.equal(validateSite(site).ok, true);
  assert.equal(site.title, "SCI-MAP｜科學探險島");
  assertCatalog(catalog.games);
  for (const item of catalog.games) {
    const html = readFileSync(join(root, item.file), "utf8");
    assert.match(html, new RegExp(item.name));
  }
});
