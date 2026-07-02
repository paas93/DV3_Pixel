const TILE_PALETTE = [
  ['빨강 타일', 'e86b73'], ['주황 타일', 'fa8735'], ['노랑 타일', 'fccf74'], ['초록 타일', '61cf74'],
  ['파랑 타일', '40defc'], ['연보라 타일', 'd783f1'], ['검정 타일', '5e6376'], ['흰 타일', 'e6d5cd'],
  ['자주 타일', 'ec4581'], ['오렌지 타일', 'f05834'], ['레몬 타일', 'fdce5d'], ['연두 타일', 'a4dd4b'],
  ['하늘 타일', 'b8f1fc'], ['바다 타일', 'a7c5fe'], ['진검정 타일', '3f3f3f'], ['우유 타일', 'f1f1f1'],
  ['보라 타일', '8159c7'], ['카키 타일', 'aaa097'], ['회색 타일', '5d5d5d'], ['대리석 타일', 'b2bac5'],
  ['연회색 타일', 'cbcbcb'], ['바위 타일', 'b9b8be'], ['연카키 타일', 'a9a9a9'], ['자갈바닥 타일', '878787'],
  ['진흙 타일', '767676'], ['콘크리트 타일', '788494'], ['구름 타일', 'dfedf8'], ['크림 타일', 'cdddec'],
  ['점토 타일', '9bb1c6'], ['진청 타일', '5d7697'], ['남색 타일', '3f5f7e'], ['벨벳 타일', '8c1a20'],
  ['황금 타일', 'e6b130'], ['흑갈색 타일', '604838'], ['연녹색 타일', '92aa77'], ['진한 주황색 타일', 'c94121'],
  ['바닐라 타일', 'fdedca'], ['코랄 브라운 타일', 'a3836f'], ['세이지 타일', '699179'], ['벚꽃색 타일', 'f2b1b5'],
  ['황토색 타일', 'fda850'], ['민트색 타일', '8ae4cf'], ['라벤더 타일', 'e4c3ee'], ['장미색 타일', 'fd095d'],
  ['초코우유 타일', 'b17668'], ['점토색 타일', 'b5b4c2'], ['라일락 타일', 'a3a4e0'], ['아이보리 타일', 'fff6ea'],
  ['커피우유 타일', 'c3a49f'], ['다크초코 타일', '661922']
].map(([name, hex]) => ({ name, hex: '#' + hex, rgb: hexToRgb(hex) }));

const PRESETS = [[16,16], [24,24], [32,32], [48,48], [64,64], [96,96], [128,128], [160,160], [192,192]];
const imageInput = document.getElementById('imageInput');
const convertBtn = document.getElementById('convertBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadUsageCsvBtn = document.getElementById('downloadUsageCsvBtn');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const copyUsageBtn = document.getElementById('copyUsageBtn');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const gridWidthInput = document.getElementById('gridWidth');
const gridHeightInput = document.getElementById('gridHeight');
const showGridInput = document.getElementById('showGrid');
const showLabelsInput = document.getElementById('showLabels');
const ditherInput = document.getElementById('dither');
const showOnlyUsedInput = document.getElementById('showOnlyUsed');
const sortByUsageInput = document.getElementById('sortByUsage');
const statusText = document.getElementById('statusText');
const hoverInfo = document.getElementById('hoverInfo');
const presetGrid = document.getElementById('presetGrid');
const fileDrop = document.querySelector('.file-drop');
const canvasWrap = document.getElementById('canvasWrap');
const usageList = document.getElementById('usageList');
const usageSummary = document.getElementById('usageSummary');
const usageSearch = document.getElementById('usageSearch');
const zoomText = document.getElementById('zoomText');

let sourceImage = null;
let convertedTiles = [];
let cellSize = 12;
let usageRows = [];
let activeHighlight = null;
let zoom = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0, left: 0, top: 0 };

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}
function colorDistance(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
}
function nearestTile(rgb) {
  let best = TILE_PALETTE[0];
  let bestDistance = Infinity;
  for (const tile of TILE_PALETTE) {
    const distance = colorDistance(rgb, tile.rgb);
    if (distance < bestDistance) { bestDistance = distance; best = tile; }
  }
  return best;
}
function initPresets() {
  PRESETS.forEach(([w, h]) => {
    const btn = document.createElement('button');
    btn.textContent = `${w}×${h}`;
    btn.addEventListener('click', () => {
      gridWidthInput.value = w;
      gridHeightInput.value = h;
      document.querySelectorAll('.preset-grid button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (sourceImage) convertImage();
    });
    if (w === 48 && h === 48) btn.classList.add('active');
    presetGrid.appendChild(btn);
  });
}
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    convertBtn.disabled = false;
    activeHighlight = null;
    statusText.textContent = `${file.name} 업로드 완료 · ${img.width}×${img.height}px`;
    convertImage();
  };
  img.src = URL.createObjectURL(file);
}
function convertImage() {
  if (!sourceImage) return;
  const width = clamp(parseInt(gridWidthInput.value, 10) || 48, 1, 300);
  const height = clamp(parseInt(gridHeightInput.value, 10) || 48, 1, 300);
  gridWidthInput.value = width;
  gridHeightInput.value = height;
  cellSize = Math.max(4, Math.min(22, Math.floor(900 / Math.max(width, height))));

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true;
  const fit = getContainRect(sourceImage.width, sourceImage.height, width, height);
  sctx.clearRect(0, 0, width, height);
  sctx.drawImage(sourceImage, fit.x, fit.y, fit.w, fit.h);
  let data = sctx.getImageData(0, 0, width, height);

  convertedTiles = Array.from({ length: height }, () => Array(width));
  if (ditherInput.checked) applyDither(data, width, height);

  const usage = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data.data[i + 3];
      if (alpha < 10) { convertedTiles[y][x] = null; continue; }
      const tile = nearestTile({ r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] });
      convertedTiles[y][x] = tile;
      usage.set(tile.name, (usage.get(tile.name) || 0) + 1);
    }
  }
  usageRows = TILE_PALETTE.map(tile => ({ ...tile, count: usage.get(tile.name) || 0 }));
  activeHighlight = null;
  drawOutput();
  renderUsageList();
  setDownloadState(true);
  statusText.textContent = `변환 완료 · ${width}×${height} 그리드 · 사용 색상 ${usageRows.filter(r => r.count > 0).length}개`;
}
function drawOutput() {
  if (!convertedTiles.length) return;
  const height = convertedTiles.length;
  const width = convertedTiles[0].length;
  outputCanvas.width = width * cellSize;
  outputCanvas.height = height * cellSize;
  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  ctx.font = `${Math.max(7, Math.floor(cellSize * 0.38))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = convertedTiles[y][x];
      ctx.fillStyle = tile ? tile.hex : '#ffffff';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      if (activeHighlight && (!tile || tile.name !== activeHighlight)) {
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      if (tile && showLabelsInput.checked && cellSize >= 12) {
        ctx.fillStyle = luminance(tile.rgb) > 155 ? 'rgba(0,0,0,.62)' : 'rgba(255,255,255,.78)';
        ctx.fillText(tile.name.replace(' 타일', '').slice(0, 2), x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
      }
    }
  }
  if (showGridInput.checked && cellSize >= 6) drawGrid(width, height);
  applyZoom();
}
function renderUsageList() {
  const query = usageSearch.value.trim().toLowerCase();
  let rows = [...usageRows];
  if (showOnlyUsedInput.checked) rows = rows.filter(row => row.count > 0);
  if (query) rows = rows.filter(row => row.name.toLowerCase().includes(query) || row.hex.toLowerCase().includes(query));
  if (sortByUsageInput.checked) rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
  else rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  usageList.innerHTML = '';
  const template = document.getElementById('usageItemTemplate');
  rows.forEach(row => {
    const node = template.content.cloneNode(true);
    const item = node.querySelector('.usage-item');
    item.dataset.name = row.name;
    if (activeHighlight === row.name) item.classList.add('active');
    node.querySelector('.swatch').style.background = row.hex;
    node.querySelector('.usage-name').textContent = row.name;
    node.querySelector('.usage-hex').textContent = row.hex.toUpperCase();
    node.querySelector('.usage-count').textContent = `${row.count.toLocaleString()}개`;
    item.addEventListener('click', () => {
      activeHighlight = activeHighlight === row.name ? null : row.name;
      drawOutput();
      renderUsageList();
    });
    usageList.appendChild(node);
  });
  const used = usageRows.filter(row => row.count > 0);
  const total = used.reduce((sum, row) => sum + row.count, 0);
  usageSummary.textContent = `총 타일 ${total.toLocaleString()}개 · 사용 색상 ${used.length.toLocaleString()}개`;
}
function setDownloadState(enabled) {
  [downloadPngBtn, downloadCsvBtn, downloadUsageCsvBtn, downloadExcelBtn, copyUsageBtn].forEach(btn => btn.disabled = !enabled);
}
function applyDither(imageData, width, height) {
  const d = imageData.data;
  const addError = (x, y, er, eg, eb, factor) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    if (d[i + 3] < 10) return;
    d[i] = clamp(d[i] + er * factor, 0, 255);
    d[i + 1] = clamp(d[i + 1] + eg * factor, 0, 255);
    d[i + 2] = clamp(d[i + 2] + eb * factor, 0, 255);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (d[i + 3] < 10) continue;
      const old = { r: d[i], g: d[i + 1], b: d[i + 2] };
      const tile = nearestTile(old);
      const er = old.r - tile.rgb.r, eg = old.g - tile.rgb.g, eb = old.b - tile.rgb.b;
      d[i] = tile.rgb.r; d[i + 1] = tile.rgb.g; d[i + 2] = tile.rgb.b;
      addError(x + 1, y, er, eg, eb, 7 / 16);
      addError(x - 1, y + 1, er, eg, eb, 3 / 16);
      addError(x, y + 1, er, eg, eb, 5 / 16);
      addError(x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
}
function drawGrid(width, height) {
  ctx.strokeStyle = 'rgba(0,0,0,.16)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x++) { ctx.beginPath(); ctx.moveTo(x * cellSize + .5, 0); ctx.lineTo(x * cellSize + .5, height * cellSize); ctx.stroke(); }
  for (let y = 0; y <= height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cellSize + .5); ctx.lineTo(width * cellSize, y * cellSize + .5); ctx.stroke(); }
}
function getContainRect(srcW, srcH, destW, destH) {
  const scale = Math.min(destW / srcW, destH / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return { x: Math.floor((destW - w) / 2), y: Math.floor((destH - h) / 2), w, h };
}
function luminance(rgb) { return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}
function downloadPng() {
  const previousHighlight = activeHighlight;
  activeHighlight = null;
  drawOutput();
  const a = document.createElement('a');
  a.download = `pixel-tile-${gridWidthInput.value}x${gridHeightInput.value}.png`;
  a.href = outputCanvas.toDataURL('image/png');
  a.click();
  activeHighlight = previousHighlight;
  drawOutput();
}
function downloadMapCsv() {
  if (!convertedTiles.length) return;
  const rows = convertedTiles.map(row => row.map(tile => tile ? `"${tile.name}"` : '"빈 칸"').join(','));
  downloadBlob(`pixel-tile-map-${gridWidthInput.value}x${gridHeightInput.value}.csv`, '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8;');
}
function usageCsvContent() {
  const rows = ['색상명,HEX,개수'];
  usageRows.filter(row => row.count > 0).sort((a,b) => b.count - a.count).forEach(row => {
    rows.push(`"${row.name}",${row.hex},${row.count}`);
  });
  return '\ufeff' + rows.join('\n');
}
function downloadUsageCsv() {
  downloadBlob(`pixel-tile-usage-${gridWidthInput.value}x${gridHeightInput.value}.csv`, usageCsvContent(), 'text/csv;charset=utf-8;');
}
function downloadExcel() {
  const rows = usageRows.filter(row => row.count > 0).sort((a,b) => b.count - a.count);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const html = `\ufeff<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>색상명</th><th>HEX</th><th>개수</th></tr>${rows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${row.hex}</td><td>${row.count}</td></tr>`).join('')}<tr><td colspan="2">총 타일</td><td>${total}</td></tr></table></body></html>`;
  downloadBlob(`pixel-tile-usage-${gridWidthInput.value}x${gridHeightInput.value}.xls`, html, 'application/vnd.ms-excel;charset=utf-8;');
}
async function copyUsage() {
  const text = usageRows.filter(row => row.count > 0).sort((a,b) => b.count - a.count).map(row => `${row.name} ${row.count.toLocaleString()}개`).join('\n');
  await navigator.clipboard.writeText(text);
  copyUsageBtn.textContent = '복사 완료';
  setTimeout(() => copyUsageBtn.textContent = '수량 목록 복사', 1200);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}
function applyZoom() {
  outputCanvas.style.transform = `scale(${zoom})`;
  outputCanvas.style.marginRight = `${outputCanvas.width * (zoom - 1)}px`;
  outputCanvas.style.marginBottom = `${outputCanvas.height * (zoom - 1)}px`;
  zoomText.textContent = `${Math.round(zoom * 100)}%`;
}
function setZoom(next) { zoom = clamp(next, 0.5, 8); applyZoom(); }

outputCanvas.addEventListener('mousemove', (event) => {
  if (!convertedTiles.length) return;
  const rect = outputCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * outputCanvas.width / cellSize);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * outputCanvas.height / cellSize);
  const tile = convertedTiles[y]?.[x];
  if (tile) hoverInfo.textContent = `타일명: ${tile.name} · ${tile.hex.toUpperCase()} · 좌표 ${x + 1},${y + 1}`;
  else if (x >= 0 && y >= 0 && y < convertedTiles.length && x < convertedTiles[0].length) hoverInfo.textContent = `빈 칸 · 좌표 ${x + 1},${y + 1}`;
});
outputCanvas.addEventListener('mouseleave', () => hoverInfo.textContent = '타일명: -');
canvasWrap.addEventListener('wheel', (event) => { event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15)); }, { passive: false });
canvasWrap.addEventListener('mousedown', (event) => {
  isDragging = true;
  canvasWrap.classList.add('dragging');
  dragStart = { x: event.clientX, y: event.clientY, left: canvasWrap.scrollLeft, top: canvasWrap.scrollTop };
});
window.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  canvasWrap.scrollLeft = dragStart.left - (event.clientX - dragStart.x);
  canvasWrap.scrollTop = dragStart.top - (event.clientY - dragStart.y);
});
window.addEventListener('mouseup', () => { isDragging = false; canvasWrap.classList.remove('dragging'); });

imageInput.addEventListener('change', e => loadFile(e.target.files[0]));
convertBtn.addEventListener('click', convertImage);
downloadPngBtn.addEventListener('click', downloadPng);
downloadCsvBtn.addEventListener('click', downloadMapCsv);
downloadUsageCsvBtn.addEventListener('click', downloadUsageCsv);
downloadExcelBtn.addEventListener('click', downloadExcel);
copyUsageBtn.addEventListener('click', copyUsage);
document.getElementById('zoomOutBtn').addEventListener('click', () => setZoom(zoom - 0.25));
document.getElementById('zoomInBtn').addEventListener('click', () => setZoom(zoom + 0.25));
document.getElementById('resetViewBtn').addEventListener('click', () => { setZoom(1); canvasWrap.scrollLeft = 0; canvasWrap.scrollTop = 0; });
[gridWidthInput, gridHeightInput, showGridInput, showLabelsInput, ditherInput].forEach(el => el.addEventListener('change', () => sourceImage && convertImage()));
[showOnlyUsedInput, sortByUsageInput, usageSearch].forEach(el => el.addEventListener('input', renderUsageList));
['dragenter', 'dragover'].forEach(type => fileDrop.addEventListener(type, e => { e.preventDefault(); fileDrop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(type => fileDrop.addEventListener(type, e => { e.preventDefault(); fileDrop.classList.remove('dragover'); }));
fileDrop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

initPresets();
renderUsageList();
setDownloadState(false);
