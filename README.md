# LyricPair — GitHub Pages + 私人 API

瀏覽器網址始終維持：

```text
https://帳號.github.io/專案名稱/PRIVATE_PATH/
```

Spotify Client ID 與 Client Secret 只放在 Render 後端環境變數。使用者不需要登入 Spotify，也不會跳離 GitHub Pages。

## 1. 先部署 Render 後端

1. 把整個專案上傳到 GitHub。
2. 在 Render 選 `New → Blueprint`，連接此 Repository；它會讀取 `render.yaml`。
3. 填入：

```text
SPOTIFY_CLIENT_ID=你的 Spotify Client ID
SPOTIFY_CLIENT_SECRET=你的 Spotify Client Secret
ALLOWED_ORIGIN=https://你的帳號.github.io
```

`ALLOWED_ORIGIN` 只有網域，不包含 Repository、秘密路徑或最後的 `/`。

4. 部署後記下網址，例如：

```text
https://lyricpair-api.onrender.com
```

## 2. GitHub Actions 變數

前往 `Settings → Secrets and variables → Actions`。

### Secret

```text
PRIVATE_PATH=至少 12 個英數字、底線或連字號
```

### Variable

```text
API_BASE_URL=https://lyricpair-api.onrender.com
```

網址不要加最後的 `/`，也不要加入 `/api`。

## 3. 發布 GitHub Pages

1. `Settings → Pages → Source` 選擇 `GitHub Actions`。
2. 執行 `Deploy private-path GitHub Pages`。
3. 根網址只顯示 404；真正網址是：

```text
https://帳號.github.io/專案名稱/PRIVATE_PATH的值/
```

此版本不再使用 Spotify Redirect URI 或 Spotify 使用者登入，可以刪除先前設定的 Redirect URI。
