import { decodeBase64Utf8, encodeBase64Utf8 } from "./codec.js";
import { buildTreeRequest, sessionFromRepo } from "./catalog.js";
import { SCIMAP } from "./config.js";

const API_ORIGIN = "https://api.github.com";

export class GithubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

export function githubPaths(config = SCIMAP) {
  const root = `/repos/${config.owner}/${config.repo}`;
  return {
    repo: root,
    user: "/user",
    ref: `${root}/git/ref/heads/${config.branch}`,
    updateRef: `${root}/git/refs/heads/${config.branch}`,
    blobs: `${root}/git/blobs`,
    trees: `${root}/git/trees`,
    commits: `${root}/git/commits`,
    contents(path) {
      const encoded = String(path).split("/").map((part) => encodeURIComponent(part)).join("/");
      return `${root}/contents/${encoded}?ref=${encodeURIComponent(config.branch)}`;
    },
    commit(sha) {
      return `${root}/git/commits/${sha}`;
    }
  };
}

export async function githubRequest(token, path, { method = "GET", body } = {}) {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) {
    throw new GithubError("拒絕連線", 0);
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new GithubError("無法連線到 GitHub，請檢查網絡後再試。", 0);
    }
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new GithubError("GitHub 沒有完成這個操作", response.status);
  }
  return data;
}

export async function loginWithToken(token) {
  const cleaned = typeof token === "string" ? token.trim() : "";
  if (!cleaned) return { ok: false, error: "請貼上 GitHub 存取權杖" };
  try {
    const repo = await githubRequest(cleaned, githubPaths().repo);
    const session = sessionFromRepo(repo);
    if (!session.ok) return session;
    let login = "";
    try {
      const user = await githubRequest(cleaned, githubPaths().user);
      login = typeof user?.login === "string" ? user.login : "";
    } catch {
      login = "";
    }
    return { ok: true, token: cleaned, login, permissionsPush: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return { ok: false, error: "權杖無效或沒有此儲存庫的寫入權限" };
    }
    return { ok: false, error: "無法連線到 GitHub，請檢查網絡後再試。" };
  }
}

export async function readRepoJson(token, path) {
  const data = await githubRequest(token, githubPaths().contents(path));
  if (!data || data.type !== "file" || typeof data.content !== "string") {
    throw new GithubError("讀取檔案失敗", 0);
  }
  return JSON.parse(decodeBase64Utf8(data.content));
}

export async function publishPlan(token, plan, message) {
  if (typeof token !== "string" || token.length === 0) {
    throw new GithubError("請先登入具有寫入權限的管理員權杖", 401);
  }
  const files = plan.files.map((file) => ({
    path: file.path,
    base64: file.base64 || encodeBase64Utf8(file.text ?? "")
  }));
  return commitChanges(token, { message, files, deletePaths: plan.deletePaths });
}

export async function commitChanges(token, { message, files, deletePaths }) {
  const paths = githubPaths();
  let blobs = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const ref = await githubRequest(token, paths.ref);
      const headSha = ref.object.sha;
      const current = await githubRequest(token, paths.commit(headSha));
      if (!blobs) {
        const created = [];
        for (const file of files) {
          const blob = await githubRequest(token, paths.blobs, {
            method: "POST",
            body: { content: file.base64, encoding: "base64" }
          });
          created.push({ path: file.path, sha: blob.sha });
        }
        blobs = created;
      }
      const tree = await githubRequest(token, paths.trees, {
        method: "POST",
        body: buildTreeRequest(current.tree.sha, blobs, deletePaths)
      });
      const createdCommit = await githubRequest(token, paths.commits, {
        method: "POST",
        body: { message, tree: tree.sha, parents: [headSha] }
      });
      await githubRequest(token, paths.updateRef, {
        method: "PATCH",
        body: { sha: createdCommit.sha }
      });
      return createdCommit.sha;
    } catch (error) {
      lastError = error;
      const retry = attempt === 0 && (error.status === 422 || error.status === 409);
      if (!retry) throw error;
    }
  }
  throw lastError;
}
