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
  ['초코우유 타일', 'b17668'], ['점토색 타일', 'b5b4c2'], ['라일락 타일', 'a3a4e0']
].map(([name, hex]) => ({ name, hex: '#' + hex, rgb: hexToRgb(hex) }));

const PRESETS = [[16,16], [24,24], [32,32], [48,48], [64,64], [96,96], [128,128], [160,160], [192,192]];
const imageInput = document.getElementById('imageInput');
const convertBtn = document.getElementById('convertBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const gridWidthInput = document.getElementById('gridWidth');
const gridHeightInput = document.getElementById('gridHeight');
const showGridInput = document.getElementById('showGrid');
const showLabelsInput = document.getElementById('showLabels');
const ditherInput = document.getElementById('dither');
const statusText = document.getElementById('statusText');
const hoverInfo = document.getElementById('hoverInfo');
const presetGrid = document.getElementById('presetGrid');
const legend = document.getElementById('legend');
const fileDrop = document.querySelector('.file-drop');

let sourceImage = null;
let convertedTiles = [];
let cellSize = 12;

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
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

function renderLegend() {
  const template = document.getElementById('legendItemTemplate');
  TILE_PALETTE.forEach(tile => {
    const node = template.content.cloneNode(true);
    const item = node.querySelector('.legend-item');
    node.querySelector('.swatch').style.background = tile.hex;
    node.querySelector('.legend-name').textContent = tile.name;
    node.querySelector('.legend-hex').textContent = tile.hex.toUpperCase();
    item.title = `${tile.name} ${tile.hex}`;
    legend.appendChild(node);
  });
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    convertBtn.disabled = false;
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

  // 원본 이미지를 커스텀 그리드 안에 'contain' 방식으로 배치합니다.
  // 가로/세로 비율이 다른 그리드를 선택해도 이미지는 찌그러지지 않고,
  // 남는 칸은 빈 칸으로 남겨 타일 변환/CSV에서 구분되도록 처리합니다.
  const fit = getContainRect(sourceImage.width, sourceImage.height, width, height);
  sctx.clearRect(0, 0, width, height);
  sctx.drawImage(sourceImage, fit.x, fit.y, fit.w, fit.h);
  let data = sctx.getImageData(0, 0, width, height);

  convertedTiles = Array.from({ length: height }, () => Array(width));
  if (ditherInput.checked) applyDither(data, width, height);

  outputCanvas.width = width * cellSize;
  outputCanvas.height = height * cellSize;
  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  ctx.font = `${Math.max(7, Math.floor(cellSize * 0.38))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const usage = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data.data[i + 3];
      if (alpha < 10) {
        convertedTiles[y][x] = null;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        continue;
      }
      const tile = nearestTile({ r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] });
      convertedTiles[y][x] = tile;
      usage.set(tile.name, (usage.get(tile.name) || 0) + 1);
      ctx.fillStyle = tile.hex;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      if (showLabelsInput.checked && cellSize >= 12) {
        ctx.fillStyle = luminance(tile.rgb) > 155 ? 'rgba(0,0,0,.62)' : 'rgba(255,255,255,.78)';
        ctx.fillText(tile.name.replace(' 타일', '').slice(0, 2), x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
      }
    }
  }
  if (showGridInput.checked && cellSize >= 6) drawGrid(width, height);
  downloadPngBtn.disabled = false;
  downloadCsvBtn.disabled = false;
  statusText.textContent = `변환 완료 · ${width}×${height} 그리드 · 사용 색상 ${usage.size}개`;
}

function applyDither(imageData, width, height) {
  const d = imageData.data;
  const addError = (x, y, er, eg, eb, factor) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    d[i] = clamp(d[i] + er * factor, 0, 255);
    d[i + 1] = clamp(d[i + 1] + eg * factor, 0, 255);
    d[i + 2] = clamp(d[i + 2] + eb * factor, 0, 255);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
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
  for (let x = 0; x <= width; x++) {
    ctx.beginPath(); ctx.moveTo(x * cellSize + .5, 0); ctx.lineTo(x * cellSize + .5, height * cellSize); ctx.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * cellSize + .5); ctx.lineTo(width * cellSize, y * cellSize + .5); ctx.stroke();
  }
}
function getContainRect(srcW, srcH, destW, destH) {
  const scale = Math.min(destW / srcW, destH / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return {
    x: Math.floor((destW - w) / 2),
    y: Math.floor((destH - h) / 2),
    w,
    h
  };
}
function luminance(rgb) { return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function downloadPng() {
  const a = document.createElement('a');
  a.download = `pixel-tile-${gridWidthInput.value}x${gridHeightInput.value}.png`;
  a.href = outputCanvas.toDataURL('image/png');
  a.click();
}
function downloadCsv() {
  if (!convertedTiles.length) return;
  const rows = convertedTiles.map(row => row.map(tile => tile ? `"${tile.name}"` : '"빈 칸"').join(','));
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.download = `pixel-tile-map-${gridWidthInput.value}x${gridHeightInput.value}.csv`;
  a.href = URL.createObjectURL(blob);
  a.click();
}

outputCanvas.addEventListener('mousemove', (event) => {
  if (!convertedTiles.length) return;
  const rect = outputCanvas.getBoundingClientRect();
  const scaleX = outputCanvas.width / rect.width;
  const scaleY = outputCanvas.height / rect.height;
  const x = Math.floor(((event.clientX - rect.left) * scaleX) / cellSize);
  const y = Math.floor(((event.clientY - rect.top) * scaleY) / cellSize);
  const tile = convertedTiles[y]?.[x];
  if (tile) {
    hoverInfo.textContent = `타일명: ${tile.name} · ${tile.hex.toUpperCase()} · 좌표 ${x + 1},${y + 1}`;
  } else if (x >= 0 && y >= 0 && y < convertedTiles.length && x < convertedTiles[0].length) {
    hoverInfo.textContent = `빈 칸 · 좌표 ${x + 1},${y + 1}`;
  }
});
outputCanvas.addEventListener('mouseleave', () => hoverInfo.textContent = '타일명: -');

imageInput.addEventListener('change', e => loadFile(e.target.files[0]));
convertBtn.addEventListener('click', convertImage);
downloadPngBtn.addEventListener('click', downloadPng);
downloadCsvBtn.addEventListener('click', downloadCsv);
[gridWidthInput, gridHeightInput, showGridInput, showLabelsInput, ditherInput].forEach(el => el.addEventListener('change', () => sourceImage && convertImage()));
['dragenter', 'dragover'].forEach(type => fileDrop.addEventListener(type, e => { e.preventDefault(); fileDrop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(type => fileDrop.addEventListener(type, e => { e.preventDefault(); fileDrop.classList.remove('dragover'); }));
fileDrop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

initPresets();
renderLegend();
