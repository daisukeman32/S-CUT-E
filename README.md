# S-CUT-E

Loop Video Frame Cutter & Merger

AI生成ループ動画の先頭/末尾フレームを一括カットし、シームレスに連結するWebツール。

---

## 何を解決するか

AI動画生成ツール（Runway, Kling等）のループ動画は、スタートフレームとエンドフレームが同一画像になっている。
複数クリップを繋げる際、この重複フレームが「もたつき」を生む。

S-CUT-Eは前後1フレームを一括カットし、滑らかなマージを実現する。

## ワークフロー

```
1. MP4ファイルをドラッグ&ドロップ（フォルダ対応）
2. FFmpegが自動プローブ → 正確なFPS/フレーム数を検出
3. CUTボタン → 全ファイルの先頭1フレーム+末尾1フレームを一括カット
4. 個別ダウンロード or ZIP一括ダウンロード
5. MERGEセクション → ドラッグで並び替え → MERGE → 1本のシームレス動画
```

## ユースケース例

```
ループA [0-149] → CUT [1-148] ─┐
ループB [0-149] → CUT [1-148] ─┤
ループC [0-149] → CUT [1-148] ─┼→ MERGE → シームレスな1本の動画
最終シーン [0-149] → CUT [1-148] ─┘
```

- 全クリップのスタートフレームが同一なので、CUT後の繋ぎ目が完全一致
- 最終シーン（非ループ素材）も先頭フレームが共通なら、末尾に配置してシームレスに接続
- MERGE画面でドラッグして順序を自由に変更可能
- FPS/解像度が異なるファイルも自動正規化して連結可能

## 機能一覧

- 複数MP4一括フレームカット（先頭1f + 末尾1f）
- Audio ON/OFF切替（音声トリム対応）
- 個別ダウンロード / ZIP一括ダウンロード
- ドラッグ&ドロップ並び替え + クリップ複製/削除
- FPS/解像度不一致ファイルの自動正規化マージ
- concat filter による正確なタイムスタンプ連結（ラグなし）
- RESETボタン（設定変更して再カット可能）
- Night / Day テーマ切替
- 日本語 / English 切替

## 技術仕様

| 項目 | 内容 |
|------|------|
| FFmpeg | FFmpeg.wasm 0.11.6 (CDN) + @ffmpeg/core 0.11.0 |
| ZIP生成 | JSZip 3.10.1 (CDN) |
| フレームカット | `trim=start_frame=1:end_frame=N-1` (フレーム番号指定) |
| エンコード | libx264 ultrafast CRF23 (速度優先・品質十分) |
| マージ | concat filter + re-encode（正確なタイムスタンプ生成） |
| FPS不一致時 | 事前に個別正規化 → concat filter で連結 |
| メタデータ検出 | FFmpegプローブ (`-c copy -f null -`) |
| FPS仮検出 | HTML5 Video + requestVideoFrameCallback |
| 対応形式 | MP4 (H.264 / H.265入力対応) |
| ファイル上限 | 最大50ファイル（推奨30） |

## 制約・注意事項

- ブラウザ上のWASM実行のため、メモリ上限 ~2GB
- 60fps超のファイルは警告表示（フレーム補間済みの可能性）
- SharedArrayBuffer必須（COOP/COEPヘッダー要）
- FFmpeg.wasm 0.11.xの制約: `ffmpeg.run()` 後にFSが壊れるため、毎回 `exit()` + `load()` でリセット

## ファイル構成

```
S-CUT-E/
├── index.html       # メインHTML
├── styles.css       # Night/Day/Xテーマ対応スタイル
├── app.js           # アプリケーションロジック
├── server.js        # 開発サーバー（COOP/COEPヘッダー付き・port 3001）
├── package.json     # npm scripts
├── _headers         # Netlifyデプロイ用ヘッダー
├── favicon.svg      # ファビコン
└── ffmpeg/          # ローカルWASM（※実行時はCDN使用）
    ├── ffmpeg-core.js
    ├── ffmpeg-core.wasm
    └── ffmpeg-core.worker.js
```

## デザイン

- カラー: 白・黒・グレーのみ（アクセントカラーなし）
- フォント: Google Fonts「Rajdhani」
- テーマ: Night（デフォルト）/ Day トグル
- 言語: 日本語（デフォルト）/ English トグル
- レイアウト: max-width 520px、中央配置

## 起動方法

```bash
npm start
# → http://localhost:3001
```

Netlifyデプロイの場合は `_headers` ファイルがCOOP/COEPヘッダーを設定する。
