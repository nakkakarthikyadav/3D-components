import * as THREE from 'three';

function applyTextureDefaults(tex: THREE.CanvasTexture, maxAnisotropy: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createWorkbenchMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#182235';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ESD lab mat metric grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Metric border ruler ticks
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  ctx.fillStyle = 'rgba(203, 213, 225, 0.52)';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ESD ANTI-STATIC WORKBENCH MAT · 165Wp MONO PERC MPPT HARDWARE ASSEMBLY', 28, 490);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function createPerfboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Classic FR4 emerald-green solder mask
  ctx.fillStyle = '#134e2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle woven fiberglass grain
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < canvas.height; y += 6) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  // Copper pad matrix
  const step = 24;
  for (let x = 28; x < canvas.width - 20; x += step) {
    for (let y = 28; y < canvas.height - 20; y += step) {
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(x, y, 4.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Silkscreen section outlines
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(18, 18, 988, 604);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('SOLAR MPPT 150W/165W PCB · CLICK TOP COMPONENTS TO PLACE INTO NAMED SLOTS', 32, 42);
  ctx.fillText('POWER BUS: FUSE -> ACS712 -> IRF3205 -> 47uH TOROID -> BATTERY   |   CTRL: IR2104 / MCU / OLED', 32, 612);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function createSlotFootprintTexture(
  slotTitle: string,
  slotSub: string,
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(10, 10, 492, 236);
  ctx.setLineDash([]);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(slotTitle, 256, 108);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(slotSub, 256, 166);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function createNameplateTexture(
  name: string,
  role: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(name, 256, 58);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(role, 256, 98);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function createMonoPercTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Crisp white EVA backsheet visible through diamond spaces
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 4;
  const rows = 9;
  const padX = 14;
  const padY = 14;
  const cellW = (canvas.width - padX * (cols + 1)) / cols;
  const cellH = (canvas.height - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cellW + padX);
      const y = padY + r * (cellH + padY);

      // Deep dark-indigo monocrystalline PERC silicon cell
      const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      grad.addColorStop(0, '#07112e');
      grad.addColorStop(0.5, '#0f2352');
      grad.addColorStop(1, '#081434');
      ctx.fillStyle = grad;

      ctx.beginPath();
      const ch = 10; // Chamfered mono corner
      ctx.moveTo(x + ch, y);
      ctx.lineTo(x + cellW - ch, y);
      ctx.lineTo(x + cellW, y + ch);
      ctx.lineTo(x + cellW, y + cellH - ch);
      ctx.lineTo(x + cellW - ch, y + cellH);
      ctx.lineTo(x + ch, y + cellH);
      ctx.lineTo(x, y + cellH - ch);
      ctx.lineTo(x, y + ch);
      ctx.closePath();
      ctx.fill();

      // Silver micro-fingers & 5-busbar PERC lines
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.24)';
      ctx.lineWidth = 1;
      for (let fy = y + 5; fy < y + cellH - 4; fy += 6) {
        ctx.beginPath();
        ctx.moveTo(x + 2, fy);
        ctx.lineTo(x + cellW - 2, fy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 1.5;
      for (let b = 1; b <= 4; b++) {
        const bx = x + (cellW * b) / 5;
        ctx.beginPath();
        ctx.moveTo(bx, y + 2);
        ctx.lineTo(bx, y + cellH - 2);
        ctx.stroke();
      }
    }
  }

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function createSilkscreenTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  fgHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = fgHex;
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 114);

  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = fgHex;
  ctx.fillText(subtitle, 256, 178);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas), maxAnisotropy);
}

export function drawOledCanvas(
  canvas: HTMLCanvasElement,
  poweredOn: boolean,
  wiredCount: number,
  requiredCount: number,
  faultText: string | null
) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!poweredOn) {
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('OLED STANDBY', 56, 56);
    ctx.font = '14px monospace';
    ctx.fillText('Wire & Click Power On', 40, 86);
    return;
  }

  if (faultText) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('WIRING FAULT!', 16, 36);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '14px monospace';
    ctx.fillText(faultText.slice(0, 26), 16, 68);
    return;
  }

  if (wiredCount < Math.min(10, requiredCount)) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('WIRE INCOMPLETE', 16, 38);
    ctx.fillStyle = '#fde68a';
    ctx.font = '15px monospace';
    ctx.fillText(`${wiredCount}/${requiredCount} nets wired`, 16, 70);
    return;
  }

  // Live energized OLED telemetry for 165Wp Mono PERC
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 0, canvas.width, 28);
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('165W PERC · PV-SCOPE', 14, 20);

  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('18.7V  8.8A  164W', 14, 62);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('d2I:0.41  ESR:24mΩ', 14, 96);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '14px monospace';
  ctx.fillText('Bat:13.6V  D:72%  OK', 14, 120);
}
