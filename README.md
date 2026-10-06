# SCI-MAP｜科學探險島

Science Mission & Adventure Platform

每一站，都是新發現。

黎澤朗老師的科學遊戲平台。學生打開網站就能遊玩綜合科學、化學和生物遊戲，不用登入，也不能修改平台。

啟用 GitHub Pages 後，網站在：

https://cllai-michael.github.io/SCI-MAP/

## 一次設定

日常加遊戲或改文字時，不用做這兩步。

### 1. 發布網站

1. 開啟這個儲存庫的 Settings，進入 Pages。
2. Build and deployment 選 Deploy from a branch。
3. Branch 選 `main`，資料夾選 `/ (root)`，然後儲存。

儲存庫要保持公開，GitHub Pages 才能免費使用。

### 2. 建立管理員權杖

1. 開啟 GitHub 的 Fine-grained personal access tokens 頁面，建立新權杖。
2. Token name 可填 `SCI-MAP`。
3. Repository access 只選 `SCI-MAP`。
4. Repository permissions 裡，把 Contents 設為 Read and write。
5. Expiration 選最長期限。權杖大約一年後過期，到期再建立一把新的即可。
6. 產生權杖並複製。GitHub 只會顯示一次。

這把權杖就是管理鑰匙。不要貼到對話、截圖、電郵，也不要放進這個儲存庫。

直接網址：https://github.com/settings/personal-access-tokens/new

## 日常管理

1. 打開網站首頁最底的「管理員登入」。
2. 貼上權杖，按登入。
3. 可以上傳 HTML 遊戲、修改名稱、介紹和學科、替換或刪除遊戲、調整同一學科裡的順序，以及修改首頁標題和介紹。
4. 看到「已儲存」後，公開頁面通常約一分鐘內更新。學生重新整理即可。

不需要修改程式碼或 JSON，也不需要把網站下載回來再手動上傳到 GitHub。

權杖只留在當時打開的管理頁。重新整理或關閉頁面後，要再貼一次。遊戲和網站在同一個網址，如果把權杖存在瀏覽器裡，遊戲檔案就有機會讀到它。

請上傳一個 `.html` 或 `.htm` 檔，大小不超過 8MB。樣式、程式和圖片請放在同一個檔案裡。

## 學科

- IS：綜合科學
- CHEM：化學
- BIO：生物

## 檢查程式

不需要安裝套件。

```bash
node --test
```
