// ============================================
// S-CUT-E  Application Logic
// ============================================

(function () {
  'use strict';

  // --- Constants ---
  const MAX_FILES = 50;

  // --- i18n ---
  const i18n = {
    ja: {
      themeBtn_night: 'Day',
      themeBtn_day: 'Night',
      themeBtn_x: 'X:明',
      'themeBtn_x-light': 'Night',
      langBtn: 'English',
      ffmpegLoading: 'FFmpegを読み込み中...',
      ffmpegReady: 'FFmpeg準備完了',
      ffmpegFailed: 'FFmpegの読み込みに失敗しました。SharedArrayBuffer対応ブラウザをご使用ください。',
      step1Title: 'Step 1 : フレームカット',
      dropOverlay: 'MP4ファイルまたはフォルダをドロップ',
      dropText: 'MP4ファイルまたはフォルダをここにドロップ',
      dropSub: 'またはクリックして選択',
      dropLimit: '推奨: 最大約30ファイル',
      audioOff: 'Audio OFF',
      audioOn: 'Audio ON',
      audioNote: '音声もトリムされます（繋ぎ目にノイズが出る可能性あり）',
      fpsWarn: '60fps超: フレーム補間済みの可能性',
      cutBtn: 'CUT',
      resetBtn: 'RESET',
      cutting: 'カット中',
      probing: '解析中',
      cutDone: '完了',
      cutError: 'カットエラー',
      download: 'Download',
      step2Title: 'Step 2 : 連結',
      mergeNote: 'ドラッグで並び替え',
      mergeBtn: 'MERGE',
      mergeDownload: '連結ファイルをダウンロード',
      mergePreparing: 'ファイル準備中...',
      mergeWriting: 'ファイル書き込み中',
      merging: '連結中...',
      mergeComplete: '連結完了',
      mergeFailed: '連結失敗',
      warningMismatch: '解像度/FPSが一致しません。連結が失敗するか映像に問題が出る可能性があります。',
      fileCount: 'ファイル',
      zipDownload: 'ZIP一括ダウンロード',
      zipping: 'ZIP作成中...',
      elapsed: '経過',
      sizeWarn: '大容量ファイルは処理に時間がかかる場合があります',
      oomWarn: 'メモリ上限超過の可能性',
      oomDetail: '高解像度+高FPSの動画はブラウザのメモリ上限(約2GB)を超える場合があります。処理に失敗する可能性があるファイル:',
      oomSkipped: 'メモリ不足でスキップ',
    },
    en: {
      themeBtn_night: 'Day',
      themeBtn_day: 'Night',
      themeBtn_x: 'X:Light',
      'themeBtn_x-light': 'Night',
      langBtn: 'Japanese',
      ffmpegLoading: 'Loading FFmpeg...',
      ffmpegReady: 'FFmpeg ready',
      ffmpegFailed: 'FFmpeg load failed. Use a browser with SharedArrayBuffer support.',
      step1Title: 'Step 1 : Frame Cut',
      dropOverlay: 'Drop MP4 files or folders',
      dropText: 'Drop MP4 files or folders here',
      dropSub: 'or click to select',
      dropLimit: 'Up to ~30 files recommended',
      audioOff: 'Audio OFF',
      audioOn: 'Audio ON',
      audioNote: 'Audio will be trimmed (may cause glitch at joins)',
      fpsWarn: '>60fps: likely frame-interpolated',
      cutBtn: 'CUT',
      resetBtn: 'RESET',
      cutting: 'Cutting',
      probing: 'Probing',
      cutDone: 'Done',
      cutError: 'Cut error',
      download: 'Download',
      step2Title: 'Step 2 : Merge',
      mergeNote: 'Drag to reorder',
      mergeBtn: 'MERGE',
      mergeDownload: 'Download Merged',
      mergePreparing: 'Preparing files...',
      mergeWriting: 'Writing file',
      merging: 'Merging...',
      mergeComplete: 'Merge complete',
      mergeFailed: 'Merge failed',
      warningMismatch: 'Resolution/FPS mismatch detected. Merge may fail or produce artifacts.',
      fileCount: 'file(s)',
      zipDownload: 'Download All (ZIP)',
      zipping: 'Creating ZIP...',
      elapsed: 'elapsed',
      sizeWarn: 'Large files may take longer to process',
      oomWarn: 'Possible memory limit',
      oomDetail: 'High resolution + high FPS videos may exceed browser memory limit (~2GB). Files that may fail:',
      oomSkipped: 'Skipped (out of memory)',
    }
  };

  let currentLang = 'ja';

  function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-i18n');
      if (key === 'themeBtn') {
        const theme = document.documentElement.getAttribute('data-theme');
        elem.textContent = t('themeBtn_' + theme);
      } else {
        elem.textContent = t(key);
      }
    });
    // Update lang toggle button text
    el.langToggle.textContent = t('langBtn');
    // Update audio label
    updateAudioLabel();
    // Update ffmpeg status text if loaded
    if (ffmpegReady) {
      el.ffmpegStatus.classList.add('loaded');
    }
  }

  // --- State ---
  let ffmpeg = null;
  // Read File as Uint8Array (replaces fetchFile for reliability)
  async function readFileAsUint8Array(file) {
    const buf = await file.arrayBuffer();
    return new Uint8Array(buf);
  }
  let ffmpegReady = false;
  let uploadedFiles = [];
  let cutResults = [];
  let mergeOrder = [];
  let draggedItem = null;
  let isProcessing = false;
  let dragCounter = 0;

  // --- DOM Elements ---
  const el = {
    langToggle:        document.getElementById('langToggle'),
    themeToggle:       document.getElementById('themeToggle'),
    ffmpegStatus:      document.getElementById('ffmpegStatus'),
    dropOverlay:       document.getElementById('dropOverlay'),
    dropZone:          document.getElementById('dropZone'),
    fileInput:         document.getElementById('fileInput'),
    audioToggle:       document.getElementById('audioToggle'),
    audioToggleText:   document.getElementById('audioToggleText'),
    audioNote:         document.getElementById('audioNote'),
    fileList:          document.getElementById('fileList'),
    cutActions:        document.getElementById('cutActions'),
    cutBtn:            document.getElementById('cutBtn'),
    resetBtn:          document.getElementById('resetBtn'),
    progressSection:   document.getElementById('progressSection'),
    progressFill:      document.getElementById('progressFill'),
    progressText:      document.getElementById('progressText'),
    cutResults:        document.getElementById('cutResults'),
    mergeSection:      document.getElementById('mergeSection'),
    mergeList:         document.getElementById('mergeList'),
    mergeSummary:      document.getElementById('mergeSummary'),
    mergeWarning:      document.getElementById('mergeWarning'),
    mergeBtn:          document.getElementById('mergeBtn'),
    mergeProgressSection: document.getElementById('mergeProgressSection'),
    mergeProgressFill: document.getElementById('mergeProgressFill'),
    mergeProgressText: document.getElementById('mergeProgressText'),
    mergeResult:       document.getElementById('mergeResult'),
    mergeDownloadBtn:  document.getElementById('mergeDownloadBtn'),
  };

  // ============================================
  // FFmpeg Initialization
  // ============================================

  async function initFFmpeg() {
    try {
      const { createFFmpeg } = FFmpeg;

      ffmpeg = createFFmpeg({
        log: false,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        progress: ({ ratio }) => {
          if (!isProcessing) return;
          const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
          updateProgress(pct);
        }
      });

      await ffmpeg.load();
      ffmpegReady = true;
      el.ffmpegStatus.classList.add('loaded');
      console.log('FFmpeg loaded successfully');

      // Enable CUT button if files already queued
      updateCutButton();

      // Probe any files that were loaded before FFmpeg was ready
      await probeAllPending();
    } catch (err) {
      const statusSpan = el.ffmpegStatus.querySelector('span') || el.ffmpegStatus;
      statusSpan.textContent = t('ffmpegFailed');
      el.ffmpegStatus.querySelector('.loading-spinner-small')?.remove();
      console.error('FFmpeg load error:', err);
    }
  }

  // ============================================
  // Theme Toggle
  // ============================================

  function initTheme() {
    const saved = localStorage.getItem('scute-theme');
    if (saved === 'day') {
      document.documentElement.setAttribute('data-theme', 'day');
    } else if ((saved === 'x' || saved === 'x-light') && localStorage.getItem('scute-xmode') === '1') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    updateThemeButton();

    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      let next;
      if (current === 'x' || current === 'x-light') {
        next = 'night';
        removeXTheme();
      } else {
        next = current === 'night' ? 'day' : 'night';
      }
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('scute-theme', next);
      updateThemeButton();
    });
  }

  function updateThemeButton() {
    const theme = document.documentElement.getAttribute('data-theme');
    el.themeToggle.textContent = t('themeBtn_' + (theme || 'night'));
  }

  // ============================================
  // Language Toggle
  // ============================================

  function initLang() {
    const saved = localStorage.getItem('scute-lang');
    if (saved) {
      currentLang = saved;
      document.documentElement.setAttribute('data-lang', currentLang);
    }
    applyI18n();

    el.langToggle.addEventListener('click', () => {
      currentLang = currentLang === 'ja' ? 'en' : 'ja';
      document.documentElement.setAttribute('data-lang', currentLang);
      localStorage.setItem('scute-lang', currentLang);
      applyI18n();
      updateThemeButton();
      // Re-render dynamic content
      renderFileList();
      if (cutResults.length > 0) renderCutResults();
      if (mergeOrder.length > 0) renderMergeList();
    });
  }

  // ============================================
  // Audio Toggle
  // ============================================

  function initAudioToggle() {
    el.audioToggle.checked = true;  // Default: Audio ON
    updateAudioLabel();
    el.audioToggle.addEventListener('change', updateAudioLabel);
  }

  function updateAudioLabel() {
    const on = el.audioToggle.checked;
    el.audioToggleText.textContent = on ? t('audioOn') : t('audioOff');
    el.audioNote.textContent = on ? t('audioNote') : '';
  }

  // ============================================
  // File Upload
  // ============================================

  function initUpload() {
    el.dropZone.addEventListener('click', (e) => {
      if (e.target === el.fileInput) return;
      el.fileInput.click();
    });

    el.fileInput.addEventListener('change', (e) => {
      collectAndHandle(e.target.files);
      el.fileInput.value = '';
    });

    // Drop zone local (visual feedback only)
    el.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropZone.classList.add('drag-over');
    });
    el.dropZone.addEventListener('dragleave', () => {
      el.dropZone.classList.remove('drag-over');
    });
    el.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.dropZone.classList.remove('drag-over');
    });

    // Full-page drag & drop (external files only)
    function isExternalFileDrag(e) {
      return e.dataTransfer && e.dataTransfer.types &&
        (e.dataTransfer.types.indexOf('Files') !== -1 || e.dataTransfer.types.includes('Files'));
    }

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (!isExternalFileDrag(e)) return;
      dragCounter++;
      el.dropOverlay.classList.remove('hidden');
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!isExternalFileDrag(e)) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        el.dropOverlay.classList.add('hidden');
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!isExternalFileDrag(e)) return;
      dragCounter = 0;
      el.dropOverlay.classList.add('hidden');

      const items = e.dataTransfer.items;
      if (items && items.length > 0 && items[0].webkitGetAsEntry) {
        // Synchronously grab all entries BEFORE any async work
        // (DataTransferItemList is cleared after the event handler returns)
        const entries = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
        const files = await collectFromEntries(entries);
        collectAndHandle(files);
      } else {
        collectAndHandle(e.dataTransfer.files);
      }
    });
  }

  // Recursively collect MP4 from entries (already extracted synchronously)
  async function collectFromEntries(entries) {
    const files = [];

    async function traverseEntry(entry) {
      if (files.length >= MAX_FILES) return;

      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        if (file.name.toLowerCase().endsWith('.mp4')) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const dirEntries = await new Promise((resolve) => {
          const all = [];
          function readBatch() {
            reader.readEntries((batch) => {
              if (batch.length === 0) {
                resolve(all);
              } else {
                all.push(...batch);
                readBatch();
              }
            });
          }
          readBatch();
        });
        for (const child of dirEntries) {
          if (files.length >= MAX_FILES) break;
          await traverseEntry(child);
        }
      }
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      await traverseEntry(entry);
    }

    return files;
  }

  async function collectAndHandle(fileListOrArray) {
    const files = Array.from(fileListOrArray).filter(f =>
      f.name.toLowerCase().endsWith('.mp4')
    );
    if (files.length === 0) return;
    await handleFiles(files);
  }

  async function handleFiles(filesArray) {
    const files = Array.from(filesArray);
    if (files.length === 0) return;

    for (const file of files) {
      if (uploadedFiles.length >= MAX_FILES) break;
      if (!file.name.toLowerCase().endsWith('.mp4')) continue;
      if (uploadedFiles.some(u => u.name === file.name && u.file.size === file.size)) continue;
      uploadedFiles.push({ file, name: file.name, size: file.size, fps: 0, probedFps: 0, totalFrames: 0, width: 0, height: 0, duration: 0, probed: false, fpsWarning: false, cut: false });
    }

    // Quick metadata via HTML5 Video (instant, rough)
    for (const entry of uploadedFiles) {
      if (entry.fps === 0) {
        await detectMetadata(entry);
      }
    }

    renderFileList();
    updateCutButton();

    // Probe with FFmpeg for accurate values (if ready)
    await probeAllPending();
  }

  // Probe all un-probed files with FFmpeg
  async function probeAllPending() {
    if (!ffmpegReady) return;

    const pending = uploadedFiles.filter(e => !e.probed);
    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];
      try {
        const fileData = await readFileAsUint8Array(entry.file);
        const inputName = `probe_${i}.mp4`;
        const probe = await probeFile(fileData, inputName);

        entry.probed = true;
        if (probe.fps > 0) entry.probedFps = probe.fps;
        if (probe.totalFrames > 0) entry.totalFrames = probe.totalFrames;
        if (probe.width > 0) { entry.width = probe.width; entry.height = probe.height; }
        if (probe.totalFrames > 0 && probe.fps > 0) {
          entry.duration = probe.totalFrames / probe.fps;
        }
        entry.hasAudioStream = probe.hasAudioStream;

        // Use probed fps
        entry.fps = entry.probedFps;

        // FPS warning: > 60fps likely frame-interpolated
        if (entry.probedFps > 60) {
          entry.fpsWarning = true;
          console.warn(`[probe] ${entry.name}: ${entry.probedFps}fps - likely frame-interpolated`);
        }

      } catch (err) {
        console.error('Probe error for', entry.name, err);
        entry.probed = true;  // mark as probed to avoid retry
        // Recovery
        try {
          ffmpeg.setLogger(() => {});
          ffmpeg.exit();
        } catch (e) {}
        try {
          await ffmpeg.load();
        } catch (e) {
          ffmpegReady = false;
          break;
        }
      }
    }

    // Update UI with probed values
    renderFileList();
    updateCutButton();
  }

  // ============================================
  // Metadata Detection (HTML5 Video + requestVideoFrameCallback)
  // ============================================

  async function detectMetadata(entry) {
    const meta = await getVideoMeta(entry.file);
    entry.width = meta.width;
    entry.height = meta.height;
    entry.duration = meta.duration;
    entry.fps = meta.fps;
    entry.totalFrames = Math.round(meta.duration * meta.fps);
  }

  function getVideoMeta(file) {
    return new Promise((resolve) => {
      let resolved = false;
      function done(result) {
        if (resolved) return;
        resolved = true;
        resolve(result);
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      const url = URL.createObjectURL(file);
      let fpsTimeout = null;

      // Global timeout: if nothing works in 5s, return defaults
      const globalTimeout = setTimeout(() => {
        cleanup();
        done({ duration: 0, width: 0, height: 0, fps: 30 });
      }, 5000);

      function cleanup() {
        clearTimeout(globalTimeout);
        if (fpsTimeout) clearTimeout(fpsTimeout);
        try { video.pause(); } catch (e) {}
        URL.revokeObjectURL(url);
      }

      video.onloadedmetadata = () => {
        const base = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };

        // Try requestVideoFrameCallback for precise fps (2s timeout)
        if ('requestVideoFrameCallback' in video) {
          let count = 0;
          let firstTime = 0;

          fpsTimeout = setTimeout(() => {
            // fps detection timed out (H.265 can't play, etc.)
            cleanup();
            base.fps = 30;
            done(base);
          }, 2000);

          function onFrame(now, metadata) {
            if (resolved) return;
            if (count === 0) firstTime = metadata.mediaTime;
            count++;
            if (count >= 6) {
              cleanup();
              const elapsed = metadata.mediaTime - firstTime;
              base.fps = elapsed > 0 ? snapFps((count - 1) / elapsed) : 30;
              done(base);
              return;
            }
            video.requestVideoFrameCallback(onFrame);
          }

          video.requestVideoFrameCallback(onFrame);
          video.play().catch(() => {
            cleanup();
            base.fps = 30;
            done(base);
          });
        } else {
          cleanup();
          base.fps = 30;
          done(base);
        }
      };

      video.onerror = () => {
        // Browser can't parse this file at all (H.265 on Firefox, etc.)
        // Still allow upload - FFmpeg can handle it
        cleanup();
        done({ duration: 0, width: 0, height: 0, fps: 30 });
      };

      video.src = url;
    });
  }

  // Snap to nearest standard fps
  function snapFps(raw) {
    const common = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
    let best = 30;
    let bestDiff = Infinity;
    for (const f of common) {
      const diff = Math.abs(raw - f);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = f;
      }
    }
    return best;
  }

  // ============================================
  // File List Rendering
  // ============================================

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  // Estimate if a file will exceed WASM memory (~2GB)
  // Rough: frame decode buffer = W*H*1.5 (YUV420) * active frames in encoder
  // libx264 ultrafast keeps ~4-8 reference frames + working buffers
  const WASM_MEM_LIMIT = 1.5 * 1024 * 1024 * 1024; // 1.5GB conservative
  function estimateMemory(entry) {
    const frameBytes = entry.width * entry.height * 1.5;
    // Encoder working set: ~10 frames decode + ~10 frames encode + input file
    return frameBytes * 20 + (entry.size || 0) * 2;
  }

  function isOomRisk(entry) {
    if (!entry.width || !entry.height) return false;
    return estimateMemory(entry) > WASM_MEM_LIMIT;
  }

  function renderFileList() {
    if (uploadedFiles.length === 0) {
      el.fileList.classList.add('hidden');
      return;
    }

    el.fileList.classList.remove('hidden');

    // Check warnings
    const hasHeavy = uploadedFiles.some(e => e.size > 10 * 1024 * 1024 || (e.probedFps || e.fps) > 30);
    const oomFiles = uploadedFiles.filter(e => isOomRisk(e) && !e.cut);

    el.fileList.innerHTML = uploadedFiles.map((entry, i) => {
      const oomRisk = isOomRisk(entry);
      const statusClass = oomRisk ? ' file-item-warn' : (entry.fpsWarning ? ' file-item-warn' : (entry.cut ? ' file-item-done' : ''));
      const probedLabel = entry.probed ? '' : ' <span class="file-item-probing">...</span>';
      const cutBadge = entry.cut ? ' <span class="file-item-badge">CUT</span>' : '';
      const warnLabel = entry.fpsWarning ? `<div class="file-item-warning">${t('fpsWarn')}</div>` : '';
      const oomLabel = oomRisk && !entry.cut ? `<div class="file-item-warning file-item-oom">${t('oomWarn')}: ${entry.width}x${entry.height}@${entry.probedFps || entry.fps}fps</div>` : '';
      const sizeLabel = entry.size ? formatSize(entry.size) : '';
      return `
        <div class="file-item${statusClass}" data-index="${i}">
          <div class="file-item-info">
            <span class="file-item-name">${escapeHtml(entry.name)}${cutBadge}</span>
            <span class="file-item-meta">
              <span>${entry.width}x${entry.height}</span>
              <span>${entry.probedFps || entry.fps}fps</span>
              <span>${entry.totalFrames}f</span>
              <span>${sizeLabel}</span>
              ${probedLabel}
            </span>
            ${warnLabel}
            ${oomLabel}
          </div>
          <button class="file-item-remove" data-index="${i}">&times;</button>
        </div>
      `;
    }).join('') +
    (oomFiles.length > 0 ? `<div class="file-list-note file-list-oom">${t('oomDetail')}<br>${oomFiles.map(e => e.name).join(', ')}</div>` :
     hasHeavy ? `<div class="file-list-note">${t('sizeWarn')}</div>` : '');

    el.fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        uploadedFiles.splice(idx, 1);
        renderFileList();
        updateCutButton();
      });
    });
  }

  function updateCutButton() {
    const hasUncut = uploadedFiles.some(e => !e.cut);
    const hasCut = uploadedFiles.some(e => e.cut);

    if (uploadedFiles.length > 0) {
      el.cutActions.classList.remove('hidden');
      // CUT button: show if there are uncut files
      if (hasUncut) {
        el.cutBtn.classList.remove('hidden');
        el.cutBtn.disabled = !ffmpegReady;
      } else {
        el.cutBtn.classList.add('hidden');
      }
      // RESET button: show if there are cut files
      if (hasCut) {
        el.resetBtn.classList.remove('hidden');
      } else {
        el.resetBtn.classList.add('hidden');
      }
    } else {
      el.cutActions.classList.add('hidden');
    }
  }

  // ============================================
  // Frame Cut
  // ============================================

  // --- Pass 1: Probe with FFmpeg to get exact fps & frame count ---
  async function probeFile(fileData, inputName) {
    ffmpeg.FS('writeFile', inputName, fileData);

    let probeLog = '';
    ffmpeg.setLogger(({ message }) => { probeLog += message + '\n'; });

    // -c copy -f null - : decode nothing, just count frames
    await ffmpeg.run('-i', inputName, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-');

    ffmpeg.setLogger(() => {});

    // Parse fps from input stream info (e.g. "30 fps" or "23.98 fps")
    const fpsMatch = probeLog.match(/(\d+(?:\.\d+)?)\s*fps/);
    const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;

    // Parse total frame count from final progress line (e.g. "frame=  150")
    const frameMatches = probeLog.match(/frame=\s*(\d+)/g);
    const lastMatch = frameMatches ? frameMatches[frameMatches.length - 1].match(/\d+/) : null;
    const totalFrames = lastMatch ? parseInt(lastMatch[0]) : 0;

    // Parse resolution
    const resMatch = probeLog.match(/(\d{2,5})x(\d{2,5})/);
    const width = resMatch ? parseInt(resMatch[1]) : 0;
    const height = resMatch ? parseInt(resMatch[2]) : 0;

    // Detect audio stream presence
    const hasAudioStream = /Stream.*Audio/.test(probeLog);

    console.log(`[probe] ${inputName}: ${fps}fps, ${totalFrames}frames, ${width}x${height}${hasAudioStream ? ' +audio' : ' no-audio'}`);

    // Reset FS after run
    ffmpeg.setLogger(() => {});
    ffmpeg.exit();
    await ffmpeg.load();

    return { fps, totalFrames, width, height, hasAudioStream };
  }

  async function executeCut() {
    if (isProcessing || uploadedFiles.length === 0 || !ffmpegReady) return;

    // Only cut files that haven't been cut yet
    const uncutFiles = uploadedFiles.filter(e => !e.cut);
    if (uncutFiles.length === 0) return;

    isProcessing = true;
    el.cutBtn.disabled = true;

    el.progressSection.classList.remove('hidden');
    el.mergeResult.classList.add('hidden');

    const includeAudio = el.audioToggle.checked;

    // Elapsed timer — keeps UI alive so user knows it's not frozen
    const cutStartTime = Date.now();
    let currentFileName = '';
    const elapsedTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - cutStartTime) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      const timeStr = min > 0 ? `${min}:${String(s).padStart(2,'0')}` : `${s}s`;
      el.progressText.textContent = currentFileName + ` (${t('elapsed')} ${timeStr})`;
    }, 1000);

    for (let i = 0; i < uncutFiles.length; i++) {
      const entry = uncutFiles[i];
      const pctBase = Math.round((i / uncutFiles.length) * 100);

      try {
        // Guard: need probed data + at least 3 frames
        if (!entry.probed || entry.totalFrames < 3 || entry.fps <= 0) {
          console.warn('Skipping', entry.name, '- not probed or insufficient data');
          setProgress(pctBase, `${t('cutError')}: ${entry.name}`);
          entry.cut = true;  // mark to avoid retry
          continue;
        }

        // Guard: skip files likely to cause OOM
        if (isOomRisk(entry)) {
          console.warn('Skipping', entry.name, `- OOM risk (${entry.width}x${entry.height}@${entry.fps}fps, est ${(estimateMemory(entry) / 1024 / 1024 / 1024).toFixed(1)}GB)`);
          currentFileName = `${t('oomSkipped')}: ${entry.name}`;
          setProgress(pctBase, currentFileName);
          continue;
        }

        currentFileName = `${t('cutting')} ${i + 1}/${uncutFiles.length}: ${entry.name}`;
        setProgress(pctBase, currentFileName);

        const fileData = await readFileAsUint8Array(entry.file);
        const inputName = `input_${i}.mp4`;
        const outputName = `output_${i}.mp4`;

        ffmpeg.FS('writeFile', inputName, fileData);

        const endFrame = entry.totalFrames - 1;  // exclusive: last frame to NOT include

        const args = ['-i', inputName];
        args.push('-vf', `trim=start_frame=1:end_frame=${endFrame},setpts=PTS-STARTPTS`);

        if (includeAudio && entry.hasAudioStream) {
          const frameDur = 1 / entry.fps;
          const duration = entry.totalFrames / entry.fps;
          const aStart = frameDur;
          const aEnd = duration - frameDur;
          args.push('-af', `atrim=start=${aStart.toFixed(6)}:end=${aEnd.toFixed(6)},asetpts=PTS-STARTPTS`);
        } else {
          args.push('-an');
        }

        args.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          outputName
        );

        let cutLog = '';
        ffmpeg.setLogger(({ message }) => { cutLog += message + '\n'; });

        await ffmpeg.run(...args);

        ffmpeg.setLogger(() => {});

        // Parse output frame count from encoding log
        const frameMatches = cutLog.match(/frame=\s*(\d+)/g);
        const lastMatch = frameMatches ? frameMatches[frameMatches.length - 1].match(/\d+/) : null;
        const outFrames = lastMatch ? parseInt(lastMatch[0]) : entry.totalFrames - 2;

        const data = ffmpeg.FS('readFile', outputName);

        // Detect if output actually has audio (source may lack audio stream)
        const hasActualAudio = includeAudio && /Stream.*Audio/.test(cutLog);

        console.log(`[cut] ${entry.name}: ${entry.totalFrames} → ${outFrames} frames (${entry.fps}fps)${hasActualAudio ? ' +audio' : ''}`);

        entry.cut = true;

        cutResults.push({
          name: entry.name.replace(/\.mp4$/i, '_cut.mp4'),
          data: new Uint8Array(data),
          fps: entry.fps,
          width: entry.width,
          height: entry.height,
          frames: outFrames,
          hasAudio: hasActualAudio
        });

        // Reset FS for next file
        ffmpeg.setLogger(() => {});
        ffmpeg.exit();
        await ffmpeg.load();

      } catch (err) {
        console.error('Cut error for', entry.name, err);
        setProgress(pctBase, `${t('cutError')}: ${entry.name}`);
        try {
          ffmpeg.setLogger(() => {});
          ffmpeg.exit();
        } catch (e) {}
        try {
          await ffmpeg.load();
        } catch (e) {
          ffmpegReady = false;
          console.error('FFmpeg recovery failed:', e);
          break;
        }
      }
    }

    clearInterval(elapsedTimer);
    setProgress(100, `${t('cutDone')} - ${cutResults.length} ${t('fileCount')}`);
    isProcessing = false;
    updateCutButton();  // hide CUT if all files are now cut

    renderFileList();
    renderCutResults();

    if (cutResults.length >= 1) {
      showMergeSection();
    }
  }

  // ============================================
  // Cut Results
  // ============================================

  function renderCutResults() {
    if (cutResults.length === 0) {
      el.cutResults.classList.add('hidden');
      return;
    }

    el.cutResults.classList.remove('hidden');
    el.cutResults.innerHTML = cutResults.map((r, i) => `
      <div class="cut-result-item">
        <div class="cut-result-info">
          <span class="cut-result-name">${escapeHtml(r.name)}</span>
          <span class="cut-result-detail">${r.width}x${r.height} / ${r.fps}fps / ${r.frames}f</span>
        </div>
        <button class="btn btn-download btn-small" data-index="${i}">${t('download')}</button>
      </div>
    `).join('') +
    (cutResults.length >= 2 ? `<button class="btn btn-download btn-zip" id="zipDownloadBtn">${t('zipDownload')}</button>` : '');

    el.cutResults.querySelectorAll('.btn-download[data-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        downloadBlob(cutResults[idx].data, cutResults[idx].name);
      });
    });

    const zipBtn = document.getElementById('zipDownloadBtn');
    if (zipBtn) {
      zipBtn.addEventListener('click', downloadZip);
    }
  }

  async function downloadZip() {
    const zipBtn = document.getElementById('zipDownloadBtn');
    if (!zipBtn) return;
    zipBtn.disabled = true;
    zipBtn.textContent = t('zipping');

    try {
      const zip = new JSZip();
      for (const r of cutResults) {
        zip.file(r.name, r.data);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cut_files.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('ZIP error:', err);
    }

    zipBtn.disabled = false;
    zipBtn.textContent = t('zipDownload');
  }

  // ============================================
  // Merge Section
  // ============================================

  function showMergeSection() {
    // Preserve existing order, append new results
    const existingSet = new Set(mergeOrder);
    for (let i = 0; i < cutResults.length; i++) {
      if (!existingSet.has(i)) {
        mergeOrder.push(i);
      }
    }
    el.mergeSection.classList.remove('hidden');
    el.mergeResult.classList.add('hidden');
    el.mergeProgressSection.classList.add('hidden');
    renderMergeList();
    validateMerge();
  }

  function renderMergeList() {
    el.mergeList.innerHTML = mergeOrder.map((idx, pos) => {
      const r = cutResults[idx];
      return `
        <div class="merge-item" draggable="true" data-pos="${pos}">
          <span class="merge-item-grip">&#9776;</span>
          <span class="merge-item-order">${pos + 1}</span>
          <span class="merge-item-name">${escapeHtml(r.name)}</span>
          <span class="merge-item-meta">${r.width}x${r.height} ${r.fps}fps</span>
          <span class="merge-item-actions">
            <button class="merge-item-btn merge-dup-btn" data-pos="${pos}" title="Duplicate">+</button>
            <button class="merge-item-btn merge-del-btn" data-pos="${pos}" title="Remove">&times;</button>
          </span>
        </div>
      `;
    }).join('');

    // Duplicate button
    el.mergeList.querySelectorAll('.merge-dup-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.pos);
        mergeOrder.splice(pos + 1, 0, mergeOrder[pos]);
        renderMergeList();
        validateMerge();
      });
    });

    // Remove button
    el.mergeList.querySelectorAll('.merge-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.pos);
        if (mergeOrder.length <= 1) return;  // keep at least 1
        mergeOrder.splice(pos, 1);
        renderMergeList();
        validateMerge();
      });
    });

    setupMergeDragAndDrop();
    updateMergeSummary();
  }

  function updateMergeSummary() {
    if (mergeOrder.length === 0) {
      el.mergeSummary.textContent = '';
      return;
    }

    let totalFrames = 0;
    let fps = 0;
    for (const idx of mergeOrder) {
      const r = cutResults[idx];
      totalFrames += r.frames;
      if (!fps) fps = r.fps;
    }

    const totalSec = fps > 0 ? totalFrames / fps : 0;
    const min = Math.floor(totalSec / 60);
    const sec = (totalSec % 60).toFixed(1);

    const durationStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    const clipCount = mergeOrder.length;

    el.mergeSummary.innerHTML =
      `${clipCount} clips / ${totalFrames}f &mdash; <span class="merge-summary-duration">${durationStr}</span>`;
  }

  function setupMergeDragAndDrop() {
    const items = el.mergeList.querySelectorAll('.merge-item');

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        items.forEach(it => it.classList.remove('drag-over-top', 'drag-over-bottom'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedItem && draggedItem !== item) {
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;

          if (e.clientY < midY) {
            item.classList.add('drag-over-top');
            item.classList.remove('drag-over-bottom');
          } else {
            item.classList.add('drag-over-bottom');
            item.classList.remove('drag-over-top');
          }
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over-top', 'drag-over-bottom');

        if (draggedItem && draggedItem !== item) {
          const fromPos = parseInt(draggedItem.dataset.pos);
          let toPos = parseInt(item.dataset.pos);

          const rect = item.getBoundingClientRect();
          const dropAfter = e.clientY >= rect.top + rect.height / 2;

          const [moved] = mergeOrder.splice(fromPos, 1);
          // After splice, indices shift if fromPos < toPos
          if (fromPos < toPos) toPos--;
          if (dropAfter) toPos++;
          mergeOrder.splice(toPos, 0, moved);

          renderMergeList();
          validateMerge();
        }
      });
    });
  }

  function validateMerge() {
    if (mergeOrder.length < 2) {
      el.mergeBtn.disabled = true;
      el.mergeWarning.classList.add('hidden');
      return;
    }

    const first = cutResults[mergeOrder[0]];
    let mismatch = false;
    const issues = [];

    for (let i = 1; i < mergeOrder.length; i++) {
      const r = cutResults[mergeOrder[i]];
      if (r.width !== first.width || r.height !== first.height) {
        mismatch = true;
        issues.push(`${r.name}: ${r.width}x${r.height} (expected ${first.width}x${first.height})`);
      }
      if (r.fps !== first.fps) {
        mismatch = true;
        issues.push(`${r.name}: ${r.fps}fps (expected ${first.fps}fps)`);
      }
    }

    if (mismatch) {
      el.mergeWarning.classList.remove('hidden');
      el.mergeWarning.textContent = t('warningMismatch') + '\n' + issues.join('\n');
    } else {
      el.mergeWarning.classList.add('hidden');
    }
    el.mergeBtn.disabled = false;
  }

  // ============================================
  // Merge Execution
  // ============================================

  async function executeMerge() {
    if (isProcessing || mergeOrder.length < 2) return;
    isProcessing = true;
    el.mergeBtn.disabled = true;
    el.mergeResult.classList.add('hidden');

    el.mergeProgressSection.classList.remove('hidden');
    setMergeProgress(0, t('mergePreparing'));

    let mergeLog = '';

    // Elapsed timer for merge
    const mergeStartTime = Date.now();
    let mergeStatusText = t('mergePreparing');
    const mergeElapsedTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - mergeStartTime) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      const timeStr = min > 0 ? `${min}:${String(s).padStart(2,'0')}` : `${s}s`;
      el.mergeProgressText.textContent = mergeStatusText + ` (${t('elapsed')} ${timeStr})`;
    }, 1000);

    try {
      const n = mergeOrder.length;

      // Determine output specs from first clip
      const firstClip = cutResults[mergeOrder[0]];
      const targetFps = Math.round(firstClip.fps);
      const targetW = firstClip.width;
      const targetH = firstClip.height;

      // Check if ALL clips in merge order actually have audio
      const mergeWithAudio = mergeOrder.every(idx => cutResults[idx].hasAudio);

      // Step 1: Pre-normalize any clips with mismatched fps/resolution
      // Each normalization runs as a separate FFmpeg pass for reliability
      const clipData = [];
      for (let i = 0; i < n; i++) {
        const clip = cutResults[mergeOrder[i]];
        const needsNorm = Math.round(clip.fps) !== targetFps ||
                          clip.width !== targetW ||
                          clip.height !== targetH;

        mergeStatusText = `${t('mergeWriting')} ${i + 1}/${n}...`;
        setMergeProgress(Math.round((i / n) * 40), mergeStatusText);

        if (needsNorm) {
          console.log(`[merge] Normalizing clip ${i}: ${clip.fps}fps ${clip.width}x${clip.height} → ${targetFps}fps ${targetW}x${targetH}`);
          ffmpeg.FS('writeFile', 'norm_in.mp4', clip.data);

          const normArgs = [
            '-i', 'norm_in.mp4',
            '-vf', `scale=${targetW}:${targetH},format=yuv420p`,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-r', String(targetFps),
            '-pix_fmt', 'yuv420p',
          ];
          if (mergeWithAudio) {
            normArgs.push('-c:a', 'aac', '-b:a', '128k');
          } else {
            normArgs.push('-an');
          }
          normArgs.push('-movflags', '+faststart', 'norm_out.mp4');

          ffmpeg.setLogger(({ message }) => { mergeLog += message + '\n'; });
          await ffmpeg.run(...normArgs);

          const normData = new Uint8Array(ffmpeg.FS('readFile', 'norm_out.mp4'));
          console.log(`[merge] Normalized clip ${i}: ${normData.length} bytes`);

          // Reset FS for next operation
          ffmpeg.setLogger(() => {});
          ffmpeg.exit();
          await ffmpeg.load();

          clipData.push(normData);
        } else {
          clipData.push(clip.data);
        }
      }

      // Step 2: Write all (now matching) clips to FS
      for (let i = 0; i < n; i++) {
        ffmpeg.FS('writeFile', `merge_${i}.mp4`, clipData[i]);
      }

      mergeStatusText = t('merging');
      setMergeProgress(50, mergeStatusText);

      // Step 3: Concat filter (all clips guaranteed to have same specs)
      const inputs = [];
      for (let i = 0; i < n; i++) {
        inputs.push('-i', `merge_${i}.mp4`);
      }

      let filterGraph;
      if (mergeWithAudio) {
        // Concat filter requires interleaved order: [0:v][0:a][1:v][1:a]...
        const streams = Array.from({length: n}, (_, i) => `[${i}:v][${i}:a]`).join('');
        filterGraph = `${streams}concat=n=${n}:v=1:a=1[outv][outa]`;
      } else {
        const vStreams = Array.from({length: n}, (_, i) => `[${i}:v]`).join('');
        filterGraph = `${vStreams}concat=n=${n}:v=1:a=0[outv]`;
      }

      const args = [
        ...inputs,
        '-filter_complex', filterGraph,
        '-map', '[outv]',
        ...(mergeWithAudio ? ['-map', '[outa]', '-c:a', 'aac', '-b:a', '128k'] : []),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'merged.mp4'
      ];

      console.log('[merge] concat args:', args.join(' '));
      ffmpeg.setLogger(({ message }) => { mergeLog += message + '\n'; });

      await ffmpeg.run(...args);

      ffmpeg.setLogger(() => {});

      const mergedData = new Uint8Array(ffmpeg.FS('readFile', 'merged.mp4'));

      // Reset FFmpeg (FS breaks after run)
      ffmpeg.setLogger(() => {});
      ffmpeg.exit();
      await ffmpeg.load();

      clearInterval(mergeElapsedTimer);
      setMergeProgress(100, t('mergeComplete'));

      el.mergeResult.classList.remove('hidden');
      el.mergeDownloadBtn.onclick = () => {
        downloadBlob(mergedData, 'merged.mp4');
      };

    } catch (err) {
      clearInterval(mergeElapsedTimer);
      console.error('Merge error:', err);
      if (mergeLog) console.error('Merge FFmpeg log:', mergeLog);
      setMergeProgress(0, t('mergeFailed') + ': ' + err.message);
      try {
        ffmpeg.setLogger(() => {});
        ffmpeg.exit();
      } catch (e) {}
      try { await ffmpeg.load(); } catch (e) {}
    }

    isProcessing = false;
    el.mergeBtn.disabled = false;
  }

  // ============================================
  // Progress
  // ============================================

  function updateProgress(pct) {
    el.progressFill.style.width = pct + '%';
  }

  function setProgress(pct, text) {
    el.progressFill.style.width = pct + '%';
    el.progressText.textContent = text;
  }

  function setMergeProgress(pct, text) {
    el.mergeProgressFill.style.width = pct + '%';
    el.mergeProgressText.textContent = text;
  }

  // ============================================
  // Utilities
  // ============================================

  function downloadBlob(data, filename) {
    const blob = new Blob([data], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // X Mode (Easter Egg)
  // ============================================

  const XMODE_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','s','c','u','t','e'];
  let xmodeInput = [];
  let xmodeUnlocked = false;

  function initXMode() {
    // Check if previously unlocked
    xmodeUnlocked = localStorage.getItem('scute-xmode') === '1';
    if (xmodeUnlocked) {
      enableXModeUI();
      // Restore X theme if it was active
      const saved = localStorage.getItem('scute-theme');
      if (saved === 'x' || saved === 'x-light') applyXTheme();
    }

    // Listen for secret code
    document.addEventListener('keydown', (e) => {
      if (isProcessing) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      xmodeInput.push(key);
      // Keep only the last N keys
      if (xmodeInput.length > XMODE_CODE.length) {
        xmodeInput.shift();
      }
      // Check match
      if (xmodeInput.length === XMODE_CODE.length &&
          xmodeInput.every((k, i) => k === XMODE_CODE[i])) {
        xmodeInput = [];
        unlockXMode();
      }
    });
  }

  function playUnlockSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Browser may suspend AudioContext until user gesture
      if (ctx.state === 'suspended') ctx.resume();

      // Retro FM game arpeggio: square wave staccato
      const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
      const speed = 0.1;
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + i * speed;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.01);
        gain.gain.setValueAtTime(0.2, t0 + 0.06);
        gain.gain.linearRampToValueAtTime(0, t0 + speed);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + speed + 0.01);
      });
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  function flashUnlockEffect() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:white;opacity:0.8;pointer-events:none;transition:opacity 0.6s';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 600);
    });
  }

  function unlockXMode() {
    if (xmodeUnlocked) {
      // Already unlocked — just prompt image change
      playUnlockSound();
      promptXImage();
      return;
    }
    xmodeUnlocked = true;
    localStorage.setItem('scute-xmode', '1');
    playUnlockSound();
    flashUnlockEffect();
    enableXModeUI();
    // Delay image prompt slightly so flash effect is visible
    setTimeout(() => promptXImage(), 700);
  }

  function enableXModeUI() {
    // Show X button in top bar (if not already there)
    if (document.getElementById('xModeToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'xModeToggle';
    btn.className = 'top-btn top-btn-x';
    btn.textContent = 'X';
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const img = localStorage.getItem('scute-xmode-img');

      if (!img) {
        promptXImage();
        return;
      }

      if (current === 'x') {
        // dark → light
        document.documentElement.setAttribute('data-theme', 'x-light');
        localStorage.setItem('scute-theme', 'x-light');
        applyXTheme();
      } else if (current === 'x-light') {
        // light → off (night)
        document.documentElement.setAttribute('data-theme', 'night');
        localStorage.setItem('scute-theme', 'night');
        removeXTheme();
      } else {
        // off → dark
        document.documentElement.setAttribute('data-theme', 'x');
        localStorage.setItem('scute-theme', 'x');
        applyXTheme();
      }
      updateThemeButton();
    });
    document.querySelector('.top-bar').insertBefore(btn, document.querySelector('.top-bar').firstChild);
  }

  function promptXImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem('scute-xmode-img', reader.result);
        document.documentElement.setAttribute('data-theme', 'x');
        localStorage.setItem('scute-theme', 'x');
        applyXTheme();
        updateThemeButton();
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  function applyXTheme() {
    const img = localStorage.getItem('scute-xmode-img');
    if (!img) return;
    // Use a fixed overlay div so background doesn't rescale with content height
    let bg = document.getElementById('xmodeBg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'xmodeBg';
      document.body.prepend(bg);
    }
    bg.style.cssText = `
      position: fixed; inset: 0; z-index: -1;
      background-image: url(${img});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    `;
  }

  function removeXTheme() {
    const bg = document.getElementById('xmodeBg');
    if (bg) bg.remove();
  }

  // ============================================
  // Event Bindings & Init
  // ============================================

  function executeReset() {
    if (isProcessing) return;
    // Reset all files to uncut
    for (const entry of uploadedFiles) {
      entry.cut = false;
    }
    // Clear cut results and merge state
    cutResults = [];
    mergeOrder = [];
    // Hide sections
    el.cutResults.classList.add('hidden');
    el.cutResults.innerHTML = '';
    el.mergeSection.classList.add('hidden');
    el.progressSection.classList.add('hidden');
    el.mergeResult.classList.add('hidden');
    el.mergeProgressSection.classList.add('hidden');
    // Update UI
    renderFileList();
    updateCutButton();
  }

  function initEvents() {
    el.cutBtn.addEventListener('click', executeCut);
    el.resetBtn.addEventListener('click', executeReset);
    el.mergeBtn.addEventListener('click', executeMerge);
  }

  function init() {
    initTheme();
    initLang();
    initAudioToggle();
    initUpload();
    initEvents();
    initXMode();
    initFFmpeg();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
