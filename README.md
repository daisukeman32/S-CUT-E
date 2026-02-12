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
4. MERGEセクション → ドラッグで並び替え → MERGE → 1本のシームレス動画
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

## 技術仕様

| 項目 | 内容 |
|------|------|
| FFmpeg | FFmpeg.wasm 0.11.6 (CDN) + @ffmpeg/core 0.11.0 |
| フレームカット | `trim=start_frame=1:end_frame=N-1` (フレーム番号指定) |
| エンコード | libx264 ultrafast CRF23 (速度優先・品質十分) |
| マージ | concat demuxer + `-c copy` (再エンコード不要) |
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
├── styles.css       # Night/Dayテーマ対応スタイル
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

---

## 開発経緯

### Phase 1: 基本実装
- WEBLOP (`/04_LOP/WEBLOP/`) のFFmpeg.wasm実装パターンを参考に新規作成
- HTML/CSS/JSの3ファイル構成、server.js + _headers でインフラ整備
- ファイルドロップ、FFmpeg初期化、フレームカット、マージの基本フロー実装

### Phase 2: FFmpeg.wasm障害対応
- ディレクトリ名の特殊ダッシュ（U+2010）がローカルcorePathを破壊 → CDN使用に切替
- `-f null -` プローブがEmscripten FSを破壊 → HTML5 Video検出に切替
- `ffmpeg.run()` 後にFS全体が壊れる問題 → 毎回 `exit()` + `load()` サイクルで対処
- `setLogger(null)` が `exit()` 内部でクラッシュ → `setLogger(() => {})` に修正

### Phase 3: フレームカット精度
- 時間ベースtrim (`trim=start=0.033:end=7.967`) → 精度不足でフレームが削れない
- FFmpegプローブ導入: `-c copy -f null -` で正確なfps/フレーム数を取得
- フレーム番号ベースtrim (`trim=start_frame=1:end_frame=N-1`) に切替 → 正確にカット

### Phase 4: UX改善
- プローブをファイル読み込み時に移動（CUT前に正確なメタデータ表示）
- 60fps超の警告表示（フレーム補間済みコンテンツ検出）
- ドラッグ並び替え時にドロップオーバーレイが出るバグ修正（内部ドラッグ vs 外部ファイルドロップの判別）
- FPSセレクタ（Auto/24/30）→ Autoのみで十分と判断し簡素化
- CUT済みファイルの追加対応（結果保持のまま追加分だけ再カット）
- エンコード設定を `fast CRF18` → `ultrafast CRF23` に変更（速度5-10倍向上・サイズ適正化）

### 解決した主要バグ一覧
1. `setLogger(null)` → exit()クラッシュ
2. `fps: 0` → 1/0=Infinity でtrim値破壊
3. ドラッグ並び替えのoff-by-one
4. FFmpeg復旧失敗時の無限ループ
5. `Blob([data.buffer])` → オフセットずれリスク
6. 時間ベースtrimの精度問題 → フレーム番号ベースに切替
7. 内部ドラッグでドロップオーバーレイ表示
