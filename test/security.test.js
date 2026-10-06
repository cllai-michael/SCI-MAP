import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const publicPages = [
  "index.html",
  "is/index.html",
  "chem/index.html",
  "bio/index.html",
  "play/index.html"
];

test("public pages do not load the admin writer", () => {
  for (const page of publicPages) {
    const html = read(page);
    assert.doesNotMatch(html, /admin\.js/);
    assert.doesNotMatch(html, /github\.js/);
    assert.doesNotMatch(html, /localStorage/);
    assert.doesNotMatch(html, /sessionStorage/);
  }
});

test("admin keeps the token out of browser storage", () => {
  for (const path of ["js/admin.js", "js/github.js", "js/play.js", "js/home.js", "js/station.js"]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /sessionStorage/);
    assert.doesNotMatch(source, /document\.cookie/);
    assert.doesNotMatch(source, /innerHTML/);
  }
});

test("games run without the parent page origin", () => {
  const play = read("play/index.html");
  const script = read("js/play.js");
  assert.match(play, /sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"/);
  assert.doesNotMatch(play, /allow-same-origin/);
  assert.match(script, /allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock/);
  assert.doesNotMatch(script, /allow-same-origin/);
});

test("only the homepage offers admin login", () => {
  assert.match(read("index.html"), /管理員登入/);
  for (const page of ["is/index.html", "chem/index.html", "bio/index.html", "play/index.html"]) {
    assert.doesNotMatch(read(page), /管理員登入/);
  }
});
