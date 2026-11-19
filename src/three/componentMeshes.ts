import * as THREE from 'three';
import { ComponentModule3D } from '../data/workbench3dData';
import {
  createMonoPercTexture,
  createNameplateTexture,
  createSilkscreenTexture,
  drawOledCanvas,
} from './proceduralTextures';

export interface BuiltComponent3D {
  id: string;
  group: THREE.Group;
  pinMeshes: Map<string, THREE.Mesh>;
  ledMaterials: THREE.MeshStandardMaterial[];
  oledCanvas?: HTMLCanvasElement;
  oledTexture?: THREE.CanvasTexture;
}

export function buildComponentMesh3D(
  mod: ComponentModule3D,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): BuiltComponent3D {
  const group = new THREE.Group();
  group.name = mod.id;
  group.userData.compId = mod.id;

  const pinMeshes = new Map<string, THREE.Mesh>();
  const ledMaterials: THREE.MeshStandardMaterial[] = [];
  let oledCanvas: HTMLCanvasElement | undefined;
  let oledTexture: THREE.CanvasTexture | undefined;

  const setShadow = (mesh: THREE.Object3D, cast = true, receive = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.userData.compId = mod.id;
    return mesh;
  };

  // Realistic PBR hardware materials
  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.88,
    roughness: 0.24,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    metalness: 0.85,
    roughness: 0.34,
  });
  const goldPinMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.18,
  });
  const blackEpoxyMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.06,
    roughness: 0.58,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.94,
    roughness: 0.18,
  });
  const ceramicCapMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.4,
    metalness: 0.05,
  });

  let nameplatePos: [number, number, number] = [0, 0.25, 0.58];
  let nameplateRotX = -0.75;

  switch (mod.id) {
    case 'pv_panel': {
      // Anodized A-frame tilt bracket + 165Wp Mono PERC module + rear J-box + MC4 pigtails
      const baseRail = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.07, 1.52), darkMetalMat);
      baseRail.position.y = 0.035;
      group.add(setShadow(baseRail));

      for (const sx of [-0.72, 0.72]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.08), aluminumMat);
        strut.position.set(sx, 0.3, -0.35);
        group.add(setShadow(strut));
      }

      const tiltAssembly = new THREE.Group();
      tiltAssembly.position.set(0, 0.58, 0);
      tiltAssembly.rotation.x = 0.36;
      tiltAssembly.rotation.z = -0.08;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.09, 2.38), aluminumMat);
      tiltAssembly.add(setShadow(frame));

      // Corner anodized L-brackets with bolts
      for (const [cx, cz] of [
        [-0.92, -1.14],
        [0.92, -1.14],
        [-0.92, 1.14],
        [0.92, 1.14],
      ]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.11, 8), darkMetalMat);
        bolt.position.set(cx, 0, cz);
        tiltAssembly.add(bolt);
      }

      const percTex = createMonoPercTexture(maxAnisotropy);
      const cellMat = new THREE.MeshPhysicalMaterial({
        map: percTex,
        roughness: 0.12,
        metalness: 0.14,
        clearcoat: isSoftwareGl ? 0.45 : 1.0,
        clearcoatRoughness: 0.06,
      });
      const cellPlate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.022, 2.24), cellMat);
      cellPlate.position.y = 0.046;
      tiltAssembly.add(setShadow(cellPlate, false, true));

      // Rear IP65 Junction Box + MC4 Strain Glands
      const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.38), blackEpoxyMat);
      jBox.position.set(0.58, -0.07, 0);
      tiltAssembly.add(setShadow(jBox));

      group.add(tiltAssembly);

      // Output MC4 terminal junction block grounded at edge
      const termBlock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.94), blackEpoxyMat);
      termBlock.position.set(0.92, 0.14, 0);
      group.add(setShadow(termBlock));

      const redBoot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.06, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
      );
      redBoot.rotation.z = Math.PI / 2;
      redBoot.position.set(0.82, 0.18, -0.35);
      const blkBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.22, 12), blackEpoxyMat);
      blkBoot.rotation.z = Math.PI / 2;
      blkBoot.position.set(0.82, 0.18, 0.35);
      group.add(setShadow(redBoot), setShadow(blkBoot));

      nameplatePos = [0, 0.26, 1.05];
      nameplateRotX = -0.6;
      break;
    }

    case 'battery': {
      // Molded 12V 20Ah Deep Cycle Solar Battery with ABS ribs, carry handle, vent plugs, and brass M6 posts
      const caseMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.56, metalness: 0.08 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 1.16), caseMat);
      body.position.y = 0.39;
      group.add(setShadow(body));

      // Molded vertical side ribs
      for (let rx = -0.58; rx <= 0.58; rx += 0.29) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.64, 1.2), caseMat);
        rib.position.set(rx, 0.38, 0);
        group.add(setShadow(rib));
      }

      const lidMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.38, metalness: 0.12 });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.13, 1.22), lidMat);
      lid.position.y = 0.82;
      group.add(setShadow(lid));

      const stickerTex = createSilkscreenTexture('12V 20Ah', 'DEEP CYCLE SOLAR', '#1e40af', '#f8fafc', maxAnisotropy);
      const sticker = new THREE.Mesh(
        new THREE.PlaneGeometry(1.26, 0.5),
        new THREE.MeshStandardMaterial({ map: stickerTex, roughness: 0.35 })
      );
      sticker.position.set(0, 0.42, 0.605);
      group.add(setShadow(sticker, false, true));

      // 6 Hydro-vent caps with hex slots
      for (let i = 0; i < 6; i++) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.045, 12), copperMat);
        cap.position.set(-0.22 + i * 0.16, 0.89, 0);
        group.add(setShadow(cap));
      }

      // Red + Black Terminal Shrouds + Brass Wingnut Studs
      const posBoot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.095, 0.13, 16),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38 })
      );
      posBoot.position.set(-0.66, 0.9, -0.35);
      const negBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.13, 16), blackEpoxyMat);
      negBoot.position.set(-0.66, 0.9, 0.35);
      const posStud = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 10), goldPinMat);
      posStud.position.set(-0.72, 0.96, -0.35);
      const negStud = posStud.clone();
      negStud.position.z = 0.35;
      group.add(setShadow(posBoot), setShadow(negBoot), setShadow(posStud), setShadow(negStud));

      nameplatePos = [0, 0.25, 0.72];
      nameplateRotX = -0.65;
      break;
    }

    case 'esp32': {
      // Matte black ESP32-WROOM-32 DevKit V1 with RF shield, PCB trace antenna, Micro-USB, EN/BOOT buttons & 30 gold pins
      const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.16 });
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.84), pcbMat);
      pcb.position.y = 0.08;
      group.add(setShadow(pcb));

      // Brushed Aluminum RF Shield Can
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.56), aluminumMat);
      shield.position.set(-0.26, 0.17, 0);
      group.add(setShadow(shield));

      const rfTex = createSilkscreenTexture('ESP-WROOM', '32 WiFi/BT', '#1e293b', '#38bdf8', maxAnisotropy);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.5),
        new THREE.MeshStandardMaterial({ map: rfTex, roughness: 0.35 })
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(-0.26, 0.228, 0);
      group.add(label);

      // Gold Meander PCB Wi-Fi Antenna Tip
      for (let t = 0; t < 4; t++) {
        const trace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.03), goldPinMat);
        trace.position.set(-0.58, 0.12, -0.18 + t * 0.12);
        group.add(trace);
      }

      // Micro-USB Port + CP2102 + AMS1117 + EN/BOOT Buttons
      const usb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.24), aluminumMat);
      usb.position.set(0.65, 0.145, 0);
      const cp2102 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.15), blackEpoxyMat);
      cp2102.position.set(0.28, 0.13, 0);
      const ams1117 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.14), blackEpoxyMat);
      ams1117.position.set(0.1, 0.135, -0.18);

      const enBtn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), aluminumMat);
      enBtn.position.set(0.52, 0.14, -0.2);
      const bootBtn = enBtn.clone();
      bootBtn.position.set(0.52, 0.14, 0.2);
      group.add(setShadow(usb), setShadow(cp2102), setShadow(ams1117), setShadow(enBtn), setShadow(bootBtn));

      // Dual 15-pin Headers + 30 Gold Header Pins
      for (const hz of [-0.35, 0.35]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.075), blackEpoxyMat);
        strip.position.set(0, 0.04, hz);
        group.add(setShadow(strip));
        for (let i = 0; i < 15; i++) {
          const pin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.022), goldPinMat);
          pin.position.set(-0.52 + i * 0.074, 0.09, hz);
          group.add(pin);
        }
      }

      const pwrLedMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.12,
        roughness: 0.25,
      });
      ledMaterials.push(pwrLedMat);
      const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.04), pwrLedMat);
      pwrLed.position.set(0.45, 0.13, -0.14);
      group.add(pwrLed);

      nameplatePos = [0, 0.2, 0.56];
      break;
    }

    case 'arduino': {
      // Arduino Nano Teal PCB + rotated ATmega328P + silver crystal + Mini-USB + ICSP header
      const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4, metalness: 0.16 });
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.07, 0.64), pcbMat);
      pcb.position.y = 0.08;
      group.add(setShadow(pcb));

      const mcu = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.24), blackEpoxyMat);
      mcu.position.set(0.02, 0.13, 0);
      mcu.rotation.y = Math.PI / 4;

      const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.06), aluminumMat);
      crystal.position.set(-0.22, 0.13, 0.12);

      const usb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.22), aluminumMat);
      usb.position.set(-0.52, 0.155, 0);

      const resetBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), aluminumMat);
      resetBtn.position.set(0.28, 0.135, 0);
      group.add(setShadow(mcu), setShadow(crystal), setShadow(usb), setShadow(resetBtn));

      // 6-pin ICSP Header + 2x15 Side Gold Pins
      for (let ix = 0; ix < 2; ix++) {
        for (let iz = -1; iz <= 1; iz++) {
          const icsp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.1, 0.024), goldPinMat);
          icsp.position.set(0.48 + ix * 0.06, 0.14, iz * 0.06);
          group.add(icsp);
        }
      }
      for (const hz of [-0.26, 0.26]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.06, 0.06), blackEpoxyMat);
        strip.position.set(0, 0.04, hz);
        group.add(setShadow(strip));
        for (let i = 0; i < 14; i++) {
          const pin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), goldPinMat);
          pin.position.set(-0.46 + i * 0.071, 0.085, hz);
          group.add(pin);
        }
      }

      const nanoTex = createSilkscreenTexture('ARDUINO NANO', 'Timer1 40kHz', '#0369a1', '#e0f2fe', maxAnisotropy);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.2),
        new THREE.MeshStandardMaterial({ map: nanoTex, roughness: 0.4 })
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(-0.22, 0.118, -0.06);
      group.add(label);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.12,
        roughness: 0.25,
      });
      ledMaterials.push(ledMat);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.04), ledMat);
      led.position.set(0.39, 0.125, 0.12);
      group.add(led);

      nameplatePos = [0, 0.2, 0.48];
      break;
    }

    case 'mosfets': {
      // 3x IRF3205 TO-220AB MOSFETs mounted with M3 hex bolts onto 5-fin anodized heatsinks + tinned bent legs
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.06, 0.72),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
      );
      base.position.y = 0.03;
      group.add(setShadow(base));

      const tags = ['Q1 HIGH', 'Q2 SYNC', 'Q3 BLK'];
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.48;
        const hs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.1), aluminumMat);
        hs.position.set(x, 0.28, -0.08);
        group.add(setShadow(hs));

        for (let f = -2; f <= 2; f++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.1), aluminumMat);
          fin.position.set(x + f * 0.062, 0.28, -0.17);
          group.add(setShadow(fin));
        }

        const pkg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.085), blackEpoxyMat);
        pkg.position.set(x, 0.2, 0.025);
        const tab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), aluminumMat);
        tab.position.set(x, 0.36, 0.0);
        const m3Bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 6), goldPinMat);
        m3Bolt.rotation.x = Math.PI / 2;
        m3Bolt.position.set(x, 0.36, 0.025);
        group.add(setShadow(pkg), setShadow(tab), setShadow(m3Bolt));

        // 3 Tinned TO-220 leads (G, D, S)
        for (const lx of [-0.06, 0, 0.06]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.12, 0.022), aluminumMat);
          leg.position.set(x + lx, 0.09, 0.04);
          group.add(leg);
        }

        const tagTex = createSilkscreenTexture('IRF3205', tags[i], '#0f172a', '#f8fafc', maxAnisotropy);
        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(0.34, 0.15),
          new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.4 })
        );
        plaque.rotation.x = -Math.PI / 2;
        plaque.position.set(x, 0.065, 0.22);
        group.add(plaque);
      }
      nameplatePos = [0, 0.2, 0.54];
      break;
    }

    case 'inductor': {
      // Heavy-duty 47uH T106-26 Powdered-Iron Toroidal Inductor with 20 enameled copper turns
      const mount = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.065, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 })
      );
      mount.position.y = 0.032;
      group.add(setShadow(mount));

      const coreMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.06 });
      const core = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 18, 40), coreMat);
      core.position.set(0, 0.4, 0);
      group.add(setShadow(core));

      for (let w = 0; w < 20; w++) {
        const angle = (w / 20) * Math.PI * 2;
        const turn = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 8, 16), copperMat);
        turn.position.set(Math.cos(angle) * 0.28, 0.4 + Math.sin(angle) * 0.28, 0);
        turn.rotation.y = angle + Math.PI / 2;
        group.add(setShadow(turn));
      }

      // Twin thick copper lead exits
      for (const lx of [-0.34, 0.34]) {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.24, 8), copperMat);
        lead.position.set(lx, 0.15, 0);
        group.add(setShadow(lead));
      }

      nameplatePos = [0, 0.2, 0.55];
      break;
    }

    case 'ir2104': {
      // Teal breakout PCB + Machined DIP-8 socket + IR2104 IC + 1N5819 diode + WIMA film bootstrap cap + 22R resistors
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.06, 0.68),
        new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.42 })
      );
      pcb.position.y = 0.05;
      group.add(setShadow(pcb));

      const socketBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.24), blackEpoxyMat);
      socketBase.position.set(0, 0.1, 0);
      const ic = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.075, 0.19), blackEpoxyMat);
      ic.position.set(0, 0.15, 0);

      // 8 silver DIP leads
      for (let p = 0; p < 4; p++) {
        for (const pz of [-0.11, 0.11]) {
          const pin = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.07, 0.02), aluminumMat);
          pin.position.set(-0.11 + p * 0.074, 0.115, pz);
          group.add(pin);
        }
      }

      const diode = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.18, 12), blackEpoxyMat);
      diode.rotation.z = Math.PI / 2;
      diode.position.set(-0.04, 0.12, -0.22);
      const cathodeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 12), aluminumMat);
      cathodeBand.rotation.z = Math.PI / 2;
      cathodeBand.position.set(0.02, 0.12, -0.22);

      const bootCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.17, 0.095),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32 })
      );
      bootCap.position.set(0.24, 0.15, 0.19);

      const gateRes1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.15, 10),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.45 })
      );
      gateRes1.rotation.z = Math.PI / 2;
      gateRes1.position.set(0.24, 0.11, -0.12);

      group.add(setShadow(socketBase), setShadow(ic), setShadow(diode), setShadow(cathodeBand), setShadow(bootCap), setShadow(gateRes1));

      const lblTex = createSilkscreenTexture('IR2104', 'DRIVER + BOOT', '#0f766e', '#ffffff', maxAnisotropy);
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.16),
        new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.4 })
      );
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(0, 0.19, 0);
      group.add(lbl);

      nameplatePos = [0, 0.2, 0.5];
      break;
    }

    case 'acs_pair': {
      // Dual Royal-Blue ACS712-20A Current Sensor Modules with Screw Terminals + SOIC-8 Hall ICs + Headers
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.06, 0.98),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
      );
      board.position.y = 0.05;
      group.add(setShadow(board));

      const greenTermMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.48 });
      for (const z of [-0.24, 0.24]) {
        const term = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.19, 0.26), greenTermMat);
        term.position.set(-0.26, 0.165, z);
        group.add(setShadow(term));

        // 2 Silver terminal clamping screws per block
        for (const sz of [z - 0.065, z + 0.065]) {
          const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12), aluminumMat);
          screw.position.set(-0.26, 0.265, sz);
          group.add(screw);
        }

        // SOIC-8 Hall Sensor Chip + filter caps
        const chip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), blackEpoxyMat);
        chip.position.set(0.15, 0.1, z);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.04), ceramicCapMat);
        cap.position.set(0.28, 0.095, z);
        group.add(setShadow(chip), setShadow(cap));
      }

      const lblTex = createSilkscreenTexture('ACS712', '20A x2 HALL', '#1d4ed8', '#ffffff', maxAnisotropy);
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36, 0.24),
        new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.4 })
      );
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(0.24, 0.084, 0);
      group.add(lbl);

      nameplatePos = [0, 0.2, 0.64];
      break;
    }

    case 'protection': {
      // Carrier board: 15A translucent blue ATC blade fuse, 15SQ045 Schottky, SMBJ26A TVS, 4 electrolytic caps w/ vents, 1% dividers
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.06, 0.96),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.52 })
      );
      board.position.y = 0.05;
      group.add(setShadow(board));

      const capJacket = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.32, metalness: 0.22 });
      const capSpecs = [
        { x: -0.35, z: -0.22, r: 0.11, h: 0.29 },
        { x: -0.1, z: -0.22, r: 0.11, h: 0.29 },
        { x: 0.2, z: -0.22, r: 0.13, h: 0.34 },
        { x: 0.48, z: -0.22, r: 0.13, h: 0.34 },
      ];
      for (const c of capSpecs) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 18), capJacket);
        cyl.position.set(c.x, 0.08 + c.h / 2, c.z);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.88, c.r * 0.88, 0.015, 18), aluminumMat);
        top.position.set(c.x, 0.08 + c.h + 0.006, c.z);
        group.add(setShadow(cyl), setShadow(top));
      }

      // 15A Blade Fuse inside black socket holder
      const holder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), blackEpoxyMat);
      holder.position.set(-0.56, 0.1, 0.12);
      const fuse = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.22, 0.11),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.25, transparent: true, opacity: 0.82 })
      );
      fuse.position.set(-0.56, 0.21, 0.12);
      group.add(setShadow(holder), setShadow(fuse));

      // 15SQ045 Schottky Diode + 1% Metal Film Voltage Divider Resistors
      const schottky = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12), blackEpoxyMat);
      schottky.rotation.z = Math.PI / 2;
      schottky.position.set(-0.18, 0.14, 0.2);
      group.add(setShadow(schottky));

      const resMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
      for (let r = 0; r < 4; r++) {
        const res = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10), resMat);
        res.rotation.z = Math.PI / 2;
        res.position.set(0.26, 0.1, 0.05 + r * 0.09);
        group.add(setShadow(res));
      }

      nameplatePos = [0, 0.2, 0.64];
      break;
    }

    case 'aux_psu': {
      // LM2596S-ADJ 12V + AMS1117 5V Aux Buck PCB with 330uH drum choke, Bourns trimmer + brass screw, SMD electrolytic caps
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.06, 0.66),
        new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.4 })
      );
      pcb.position.y = 0.05;
      group.add(setShadow(pcb));

      const choke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.28), blackEpoxyMat);
      choke.position.set(-0.22, 0.16, 0);
      const ic = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.18), blackEpoxyMat);
      ic.position.set(0.14, 0.14, -0.08);
      const pot = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38 })
      );
      pot.position.set(0.16, 0.16, 0.18);
      const brassScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12), goldPinMat);
      brassScrew.position.set(0.16, 0.26, 0.18);

      for (const cx of [-0.45, 0.42]) {
        const smdCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 14), aluminumMat);
        smdCap.position.set(cx, 0.16, 0);
        group.add(setShadow(smdCap));
      }

      group.add(setShadow(choke), setShadow(ic), setShadow(pot), setShadow(brassScrew));

      const lblTex = createSilkscreenTexture('LM2596', '12V/5V AUX', '#1e40af', '#ffffff', maxAnisotropy);
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.16),
        new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.4 })
      );
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(0.14, 0.084, -0.22);
      group.add(lbl);

      nameplatePos = [0, 0.2, 0.48];
      break;
    }

    case 'display_temp': {
      // 0.96" OLED I2C module w/ glass bezel, Kapton flex ribbon, 4 gold pins + Stainless DS18B20 Waterproof Probe
      const oledPcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.06, 0.74),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.42 })
      );
      oledPcb.position.y = 0.06;
      group.add(setShadow(oledPcb));

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.54), blackEpoxyMat);
      bezel.position.set(0, 0.09, 0.02);
      group.add(setShadow(bezel));

      oledCanvas = document.createElement('canvas');
      oledCanvas.width = 256;
      oledCanvas.height = 128;
      drawOledCanvas(oledCanvas, false, 0, 24, null);
      oledTexture = new THREE.CanvasTexture(oledCanvas);
      oledTexture.colorSpace = THREE.SRGBColorSpace;
      oledTexture.anisotropy = Math.min(4, maxAnisotropy);

      const glassMat = new THREE.MeshStandardMaterial({
        map: oledTexture,
        emissiveMap: oledTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.7,
        roughness: 0.12,
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.46), glassMat);
      screen.rotation.x = -Math.PI / 2;
      screen.position.set(0, 0.107, 0.02);
      group.add(screen);

      // 4 Gold I2C pins along upper bezel
      for (let i = 0; i < 4; i++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8), goldPinMat);
        pin.position.set(-0.15 + i * 0.1, 0.12, -0.31);
        group.add(pin);
      }

      // Stainless-steel DS18B20 probe + heatshrink boot
      const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.52, 16), aluminumMat);
      probe.rotation.z = Math.PI / 2;
      probe.position.set(-0.08, 0.125, -0.46);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.14, 12), blackEpoxyMat);
      sleeve.rotation.z = Math.PI / 2;
      sleeve.position.set(0.24, 0.125, -0.46);
      group.add(setShadow(probe), setShadow(sleeve));

      nameplatePos = [0, 0.2, 0.54];
      break;
    }
  }

  // Crisp Angled Front 3D Nameplate Plaque on EVERY component (visible on Rack & on PCB!)
  const nameplateTex = createNameplateTexture(mod.shortName.toUpperCase(), mod.category.toUpperCase(), maxAnisotropy);
  const nameplate = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.28, 0.03),
    new THREE.MeshStandardMaterial({ map: nameplateTex, roughness: 0.35 })
  );
  nameplate.position.set(nameplatePos[0], nameplatePos[1], nameplatePos[2]);
  nameplate.rotation.x = nameplateRotX;
  nameplate.userData.compId = mod.id;
  group.add(nameplate);

  // Create clickable 3D brass/color-coded terminal pin nodes on Layer 1
  for (const p of mod.pins) {
    const pinId = `${mod.id}:${p.pinName}`;
    const socketMat = new THREE.MeshStandardMaterial({
      color: p.colorHex,
      emissive: p.colorHex,
      emissiveIntensity: 0.25,
      roughness: 0.24,
      metalness: 0.65,
    });
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 12), socketMat);
    socket.position.set(p.localOffset[0], p.localOffset[1], p.localOffset[2]);
    socket.layers.set(1);
    socket.layers.enable(0);
    socket.userData = {
      pinId,
      compId: mod.id,
      pinName: p.pinName,
      pinLabel: p.label,
      baseColor: p.colorHex,
    };

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.065, 12), goldPinMat);
    collar.position.set(p.localOffset[0], p.localOffset[1] - 0.05, p.localOffset[2]);

    group.add(collar);
    group.add(socket);
    pinMeshes.set(pinId, socket);
  }

  return {
    id: mod.id,
    group,
    pinMeshes,
    ledMaterials,
    oledCanvas,
    oledTexture,
  };
}
