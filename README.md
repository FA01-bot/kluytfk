# LyricPair — 純 GitHub Pages 版

不使用 Render、Vercel、Cloudflare或其他後端，也不要求使用者登入 Spotify。

網站位於：

```text
https://帳號.github.io/專案名稱/PRIVATE_PATH/
```

GitHub Actions 使用保存在 Secrets 的 Spotify Client ID／Client Secret 取得約一小時有效的 App Access Token，再把短效 Token 放進 Pages。工作流程每 30 分鐘重新建置一次。Client Secret 不會進入網頁；短效 Token 會存在前端，因此知道完整網址的人仍可能在有效期間內讀取及使用它。

## GitHub Actions Secrets

前往：

```text
Repository → Settings → Secrets and variables → Actions → Secrets
```

建立三個 Repository secrets：

```text
PRIVATE_PATH
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
```

- `PRIVATE_PATH`：12–80 個英文字母、數字、底線或連字號。
- Spotify 兩項只貼值本身，不要加引號或 `KEY=`。
- 不再需要 `API_BASE_URL` Variable，可以刪除。
- 不再需要 Spotify Redirect URI，可以刪除。

## 發布

1. 上傳本專案全部檔案。
2. `Settings → Pages → Source` 選 `GitHub Actions`。
3. 前往 Actions 手動執行 `Deploy private-path GitHub Pages`。
4. 之後 GitHub 會在每小時第 7、37 分自動刷新短效 Token。

根網址只顯示 404，真正網址是：

```text
https://帳號.github.io/專案名稱/PRIVATE_PATH的值/
```

若 GitHub 排程延遲，短效 Token 可能暫時過期；到 Actions 手動執行工作流程即可恢復。
