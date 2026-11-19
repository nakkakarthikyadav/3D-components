import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Box,
  Cable,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Layers,
  Power,
  RotateCcw,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';
import {
  COMPONENT_MODULES_3D,
  ComponentModule3D,
  getRequiredWires3D,
  RequiredWire3D,
} from '../data/workbench3dData';
import {
  createPerfboardTexture,
  createSilkscreenTexture,
  createSlotFootprintTexture,
  createWorkbenchMatTexture,
  drawOledCanvas,
} from '../three/proceduralTextures';
import { buildComponentMesh3D, BuiltComponent3D } from '../three/componentMeshes';
import { RawConnectionDiagram } from './RawConnectionDiagram';
import { VirtualScopePanel } from './VirtualScopePanel';
import { PcbLayoutPanel } from './PcbLayoutPanel';
import { ProteusIsisCanvas } from './ProteusIsisCanvas';

interface UserWire3D {
  id: string;
  fromPin: string;
  toPin: string;
  colorHex: number;
  status: 'valid' | 'custom' | 'fault';
  message: string;
}

type CameraPreset = 'iso' | 'top' | 'power' | 'rack';

interface Proteus3DWorkbenchProps {
  platform: ControllerPlatform;
  onChangePlatform: (p: ControllerPlatform) => void;
}

// Reusable module-scope math helpers (zero GC inside render loop)
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _vMid = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.26);
const _planeHit = new THREE.Vector3();

function sameNetPair(a1: string, a2: string, b1: string, b2: string): boolean {
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

function evaluateWireConnection(
  fromPin: string,
  toPin: string,
  platform: ControllerPlatform
): { status: 'valid' | 'custom' | 'fault'; colorHex: number; message: string } {
  if (fromPin === toPin) {
    return { status: 'fault', colorHex: 0xef4444, message: 'Cannot wire a pin to itself.' };
  }

  const isGnd = (p: string) => p.endsWith(':GND') || p.endsWith(':PV-') || p.endsWith(':BAT-');
  const isHighPower = (p: string) =>
    p.endsWith(':PV+') || p.endsWith(':IN_PV+') || p.endsWith(':BUS_PV+') || p.endsWith(':BAT+') || p.endsWith(':Q3_D');
  const isMcuPin = (p: string) => p.startsWith('esp32:') || p.startsWith('arduino:');

  if ((isGnd(fromPin) && isHighPower(toPin)) || (isGnd(toPin) && isHighPower(fromPin))) {
    return {
      status: 'fault',
      colorHex: 0xef4444,
      message: 'SHORT CIRCUIT FAULT: Positive power bus wired directly to Ground!',
    };
  }
  if ((isHighPower(fromPin) && isMcuPin(toPin)) || (isHighPower(toPin) && isMcuPin(fromPin))) {
    return {
      status: 'fault',
      colorHex: 0xef4444,
      message: 'OVERVOLTAGE FAULT: Never connect 12V–24V PV/Battery directly to an MCU GPIO! Use the divider.',
    };
  }

  const rules = getRequiredWires3D(platform);
  const match = rules.find((r) => sameNetPair(fromPin, toPin, r.fromPin, r.toPin));
  if (match) {
    return { status: 'valid', colorHex: match.colorHex, message: `Verified: ${match.label}` };
  }

  return {
    status: 'custom',
    colorHex: 0xf59e0b,
    message: 'Custom jumper connected (check Raw Block Diagram on the right to verify).',
  };
}

function buildPhysicalJumperCurve(start: THREE.Vector3, end: THREE.Vector3, liftOffset = 0): THREE.CatmullRomCurve3 {
  const dist = start.distanceTo(end);
  const arch = Math.min(1.48, 0.28 + dist * 0.2 + liftOffset);
  const midY = Math.max(start.y, end.y) + arch;
  return new THREE.CatmullRomCurve3([
    start.clone(),
    new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.28),
      THREE.MathUtils.lerp(start.y, midY, 0.85),
      THREE.MathUtils.lerp(start.z, end.z, 0.28)
    ),
    new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.72),
      THREE.MathUtils.lerp(end.y, midY, 0.85),
      THREE.MathUtils.lerp(start.z, end.z, 0.72)
    ),
    end.clone(),
  ]);
}

export function Proteus3DWorkbench({ platform, onChangePlatform }: Proteus3DWorkbenchProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const activeModules = useMemo(
    () => COMPONENT_MODULES_3D.filter((m) => m.platforms.includes(platform)),
    [platform]
  );

  const requiredWires = useMemo(() => getRequiredWires3D(platform), [platform]);

  // All components start on Top Tray so user accesses & places them into named PCB slots
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [wires, setWires] = useState<UserWire3D[]>([]);
  const [selectedPin, setSelectedPin] = useState<{
    pinId: string;
    label: string;
  } | null>(null);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [guideWire, setGuideWire] = useState<RequiredWire3D | null>(null);
  const [lastStatus, setLastStatus] = useState<string>(
    'Click any component at the TOP to put it into its named slot, then click two pins while holding the physical jumper wire to connect.'
  );
  const [poweredOn, setPoweredOn] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [workbenchView, setWorkbenchView] = useState<'isis' | '3d' | 'pcb'>('3d');
  const [webglError, setWebglError] = useState<string | null>(null);

  const liveDragRef = useRef<{
    active: boolean;
    point: THREE.Vector3;
    snapPinId: string | null;
  }>({
    active: false,
    point: new THREE.Vector3(),
    snapPinId: null,
  });

  const stateRef = useRef({
    platform,
    placedIds,
    wires,
    selectedPinId: selectedPin?.pinId ?? null,
    hoveredPinId: null as string | null,
    guideWire,
    poweredOn,
    activeModuleIds: activeModules.map((m) => m.id),
    requiredCount: requiredWires.length,
  });

  stateRef.current = {
    platform,
    placedIds,
    wires,
    selectedPinId: selectedPin?.pinId ?? null,
    hoveredPinId: stateRef.current.hoveredPinId,
    guideWire,
    poweredOn,
    activeModuleIds: activeModules.map((m) => m.id),
    requiredCount: requiredWires.length,
  };

  const cameraTargetRef = useRef<{
    pos: [number, number, number];
    lookAt: [number, number, number];
    active: boolean;
  }>({
    pos: [0, 6.4, 8.1],
    lookAt: [0, 0.55, -0.95],
    active: false,
  });

  const sceneSyncRef = useRef<(() => void) | null>(null);
  const liveWireSyncRef = useRef<(() => void) | null>(null);

  const applyCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    if (preset === 'iso') {
      cameraTargetRef.current = { pos: [0, 6.4, 8.1], lookAt: [0, 0.55, -0.95], active: true };
    } else if (preset === 'top') {
      cameraTargetRef.current = { pos: [0, 10.2, 0.9], lookAt: [0, 0.1, -0.3], active: true };
    } else if (preset === 'power') {
      cameraTargetRef.current = { pos: [0.4, 3.2, 3.5], lookAt: [0.3, 0.2, -0.6], active: true };
    } else {
      cameraTargetRef.current = { pos: [0, 5.4, 6.5], lookAt: [0, 2.0, -3.1], active: true };
    }
    sceneSyncRef.current?.();
  };

  const togglePlaceComponent = (compId: string) => {
    setPlacedIds((prev) => {
      const exists = prev.includes(compId);
      const next = exists ? prev.filter((id) => id !== compId) : [...prev, compId];
      const mod = COMPONENT_MODULES_3D.find((m) => m.id === compId);
      if (mod) {
        setLastStatus(
          exists
            ? `Returned ${mod.shortName} back to the Top 3D Component Tray.`
            : `Placed ${mod.shortName} into its named slot — click a pin to grab a physical jumper wire!`
        );
      }
      return next;
    });
  };

  const handlePlaceAll = () => {
    setPlacedIds(activeModules.map((m) => m.id));
    setLastStatus(
      `Placed all ${activeModules.length} realistic 3D components in their named places. Click any pin to pull a physical wire to its destination!`
    );
  };

  const handleReturnAllToTop = () => {
    setPlacedIds([]);
    setWires([]);
    setSelectedPin(null);
    liveDragRef.current.active = false;
    setGuideWire(null);
    setPoweredOn(false);
    setLastStatus('Returned all 3D components to the Top Component Tray.');
  };

  const handleAutoWire = () => {
    setPlacedIds(activeModules.map((m) => m.id));
    const generated: UserWire3D[] = requiredWires.map((rw) => ({
      id: rw.id,
      fromPin: rw.fromPin,
      toPin: rw.toPin,
      colorHex: rw.colorHex,
      status: 'valid',
      message: `Verified: ${rw.label}`,
    }));
    setWires(generated);
    setSelectedPin(null);
    liveDragRef.current.active = false;
    setGuideWire(null);
    setLastStatus(
      `Connected all ${generated.length} default ${PLATFORM_META[platform].shortLabel} wires! Click "Power On 3D" to see live current flow.`
    );
  };

  const handleHighlightGuideWire = (rule: RequiredWire3D) => {
    const c1 = rule.fromPin.split(':')[0];
    const c2 = rule.toPin.split(':')[0];
    setPlacedIds((prev) => Array.from(new Set([...prev, c1, c2])));
    setGuideWire(rule);
    setLastStatus(
      `Guide highlighted in gold: click one gold pin to grab a jumper wire, then plug into the second gold pin.`
    );
  };

  const handleConnectSingleRule = (rule: RequiredWire3D) => {
    const c1 = rule.fromPin.split(':')[0];
    const c2 = rule.toPin.split(':')[0];
    setPlacedIds((prev) => Array.from(new Set([...prev, c1, c2])));
    setWires((prev) => {
      if (prev.some((w) => sameNetPair(w.fromPin, w.toPin, rule.fromPin, rule.toPin))) return prev;
      return [
        ...prev,
        {
          id: `uw-${rule.id}-${Date.now()}`,
          fromPin: rule.fromPin,
          toPin: rule.toPin,
          colorHex: rule.colorHex,
          status: 'valid',
          message: `Verified: ${rule.label}`,
        },
      ];
    });
    if (guideWire?.id === rule.id) setGuideWire(null);
    setLastStatus(`Connected: ${rule.label}`);
  };

  const handleClearWires = () => {
    setWires([]);
    setSelectedPin(null);
    liveDragRef.current.active = false;
    setGuideWire(null);
    setPoweredOn(false);
    setLastStatus('Removed all 3D jumper wires.');
  };

  useEffect(() => {
    const validModIds = new Set(activeModules.map((m) => m.id));
    setWires((prev) =>
      prev.filter((w) => {
        const c1 = w.fromPin.split(':')[0];
        const c2 = w.toPin.split(':')[0];
        return validModIds.has(c1) && validModIds.has(c2);
      })
    );
    setSelectedPin(null);
    liveDragRef.current.active = false;
    setGuideWire(null);
    sceneSyncRef.current?.();
  }, [platform, activeModules]);

  useEffect(() => {
    sceneSyncRef.current?.();
  }, [placedIds, wires, poweredOn, selectedPin, guideWire, platform]);

  // Mount isolated Three.js WebGL Scene once with resilient WebGL error handling
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isSoftwareGl = true;
    try {
      const probeGl = document.createElement('canvas').getContext('webgl2');
      if (probeGl) {
        const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
        const gpu = String(probeGl.getParameter(param));
        probeGl.getExtension('WEBGL_lose_context')?.loseContext();
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      }
    } catch {
      isSoftwareGl = true;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'WebGL 3D context could not be initialized on this browser.'
      );
      return;
    }

    const initW = Math.max(320, container.clientWidth);
    const initH = Math.max(400, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(initW, initH);
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1322');
    scene.fog = new THREE.Fog('#0c1322', 17, 38);

    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback to direct studio light rig if PMREM fails on constrained GPU
    }

    const camera = new THREE.PerspectiveCamera(43, initW / initH, 0.1, 60);
    camera.position.set(0, 6.4, 8.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.0;
    controls.maxDistance = 17;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0.55, -0.95);
    controls.update();

    controls.addEventListener('start', () => {
      cameraTargetRef.current.active = false;
    });

    // Studio Hardware Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.05);
    keyLight.position.set(5.5, 9.8, 6.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.78);
    rimLight.position.set(-6, 5.5, -6);
    scene.add(rimLight);

    // ESD Lab Bench + Brushed Aluminum Edge Trim + Emerald FR4 Perfboard
    const matTex = createWorkbenchMatTexture(maxAnisotropy);
    const deskMat = new THREE.Mesh(
      new THREE.BoxGeometry(15.4, 0.16, 10.8),
      new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.78, metalness: 0.08 })
    );
    deskMat.position.set(0, -0.08, -0.9);
    deskMat.receiveShadow = true;
    scene.add(deskMat);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
    const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.18, 0.12), trimMat);
    frontTrim.position.set(0, -0.07, 4.52);
    scene.add(frontTrim);

    const perfTex = createPerfboardTexture(maxAnisotropy);
    const perfboard = new THREE.Mesh(
      new THREE.BoxGeometry(7.7, 0.09, 4.5),
      new THREE.MeshStandardMaterial({ map: perfTex, roughness: 0.42, metalness: 0.12 })
    );
    perfboard.position.set(0.25, 0.045, 0.15);
    perfboard.receiveShadow = true;
    scene.add(perfboard);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.18 });
    for (const [sx, sz] of [
      [-3.4, -1.9],
      [3.9, -1.9],
      [-3.4, 2.2],
      [3.9, 2.2],
    ]) {
      const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.095, 14), brassMat);
      standoff.position.set(sx, 0.045, sz);
      scene.add(standoff);
    }

    // Elevated Top 3D Component Rack
    const rackGroup = new THREE.Group();
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.4 });
    const shelfUpper = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.1, 1.78), rackMat);
    shelfUpper.position.set(0, 2.28, -3.55);
    shelfUpper.receiveShadow = true;
    rackGroup.add(shelfUpper);

    for (const px of [-6.3, 0, 6.3]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.24), rackMat);
      pillar.position.set(px, 1.15, -4.25);
      rackGroup.add(pillar);
    }

    const rackSignTex = createSilkscreenTexture(
      'TOP 3D COMPONENT TRAY (CLICK TO PLACE)',
      'PICK PART -> PUT ON NAMED SLOT -> CONNECT PINS',
      '#0f172a',
      '#38bdf8',
      maxAnisotropy
    );
    const rackSign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 0.46),
      new THREE.MeshStandardMaterial({ map: rackSignTex, roughness: 0.35 })
    );
    rackSign.position.set(0, 2.8, -4.2);
    rackGroup.add(rackSign);
    scene.add(rackGroup);

    // Named Silkscreen PCB Slots
    const slotMap = new Map<string, THREE.Mesh>();
    const raycastTargets: THREE.Object3D[] = [];

    COMPONENT_MODULES_3D.forEach((mod, idx) => {
      const isOffBoard = mod.id === 'pv_panel' || mod.id === 'battery';
      const slotW = isOffBoard ? 1.85 : 1.38;
      const slotD = isOffBoard ? 1.55 : 0.88;
      const slotTex = createSlotFootprintTexture(
        `${idx + 1}. ${mod.shortName.toUpperCase()}`,
        'CLICK TO PLACE HERE',
        isOffBoard ? '#f59e0b' : '#38bdf8',
        maxAnisotropy
      );
      const slotPad = new THREE.Mesh(
        new THREE.PlaneGeometry(slotW, slotD),
        new THREE.MeshStandardMaterial({ map: slotTex, roughness: 0.55 })
      );
      slotPad.rotation.x = -Math.PI / 2;
      slotPad.position.set(mod.boardPos[0], isOffBoard ? 0.01 : 0.094, mod.boardPos[2]);
      slotPad.layers.set(1);
      slotPad.layers.enable(0);
      slotPad.userData = { slotCompId: mod.id };
      scene.add(slotPad);
      slotMap.set(mod.id, slotPad);
      raycastTargets.push(slotPad);
    });

    // Build all 11 Realistic Composite 3D Components
    const builtMap = new Map<string, BuiltComponent3D>();
    const pinLookup = new Map<string, THREE.Mesh>();

    for (const mod of COMPONENT_MODULES_3D) {
      const built = buildComponentMesh3D(mod, maxAnisotropy, isSoftwareGl);
      const isPlaced = stateRef.current.placedIds.includes(mod.id);
      const p = isPlaced ? mod.boardPos : mod.trayPos;
      built.group.position.set(p[0], p[1], p[2]);
      scene.add(built.group);
      builtMap.set(mod.id, built);

      built.pinMeshes.forEach((mesh, pinId) => {
        pinLookup.set(pinId, mesh);
        raycastTargets.push(mesh);
      });

      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.72, 1.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.position.set(0, 0.34, 0);
      proxy.layers.set(1);
      proxy.userData = { trayCompId: mod.id };
      built.group.add(proxy);
      raycastTargets.push(proxy);
    }

    // Completed Physical Jumper Wires Group (Dupont Boots + Silicone Cable + Current Pulses)
    const wireGroup = new THREE.Group();
    scene.add(wireGroup);

    // Live Physical Wire-in-Hand Group (Rubber-bands from Start Pin to Mouse/Snapped Pin!)
    const liveWireGroup = new THREE.Group();
    scene.add(liveWireGroup);

    const dupontBootGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.14, 10);
    const dupontHousingMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.42,
      metalness: 0.15,
    });
    const pulseGeo = new THREE.SphereGeometry(0.05, 10, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const activeCurves: { curve: THREE.CatmullRomCurve3; dot: THREE.Mesh; offset: number }[] = [];

    const addDupontBoot = (targetGroup: THREE.Group, pos: THREE.Vector3, lookToward: THREE.Vector3, isTipBrass = false) => {
      const boot = new THREE.Mesh(dupontBootGeo, isTipBrass ? brassMat : dupontHousingMat);
      boot.position.copy(pos);
      _vDir.copy(lookToward).sub(pos).normalize();
      if (_vDir.lengthSq() > 0.0001) {
        boot.quaternion.setFromUnitVectors(_upAxis, _vDir);
      }
      boot.position.addScaledVector(_vDir, 0.05);
      targetGroup.add(boot);
    };

    const disposeGroupChildren = (grp: THREE.Group, sharedMats: Set<THREE.Material>, sharedGeos: Set<THREE.BufferGeometry>) => {
      while (grp.children.length > 0) {
        const child = grp.children[0] as THREE.Mesh;
        if (child.geometry && !sharedGeos.has(child.geometry)) {
          child.geometry.dispose();
        }
        if (child.material instanceof THREE.Material && !sharedMats.has(child.material)) {
          child.material.dispose();
        }
        grp.remove(child);
      }
    };

    const sharedStaticMats = new Set<THREE.Material>([dupontHousingMat, brassMat, pulseMat]);
    const sharedStaticGeos = new Set<THREE.BufferGeometry>([dupontBootGeo, pulseGeo]);

    const rebuildLiveCursorWire = () => {
      disposeGroupChildren(liveWireGroup, sharedStaticMats, sharedStaticGeos);

      const cur = stateRef.current;
      if (!cur.selectedPinId || !liveDragRef.current.active) return;

      const mStart = pinLookup.get(cur.selectedPinId);
      if (!mStart) return;

      mStart.getWorldPosition(_vStart);

      let snapStatus: 'idle' | 'valid' | 'custom' | 'fault' = 'idle';
      if (liveDragRef.current.snapPinId && liveDragRef.current.snapPinId !== cur.selectedPinId) {
        const mEnd = pinLookup.get(liveDragRef.current.snapPinId);
        if (mEnd) {
          mEnd.getWorldPosition(_vEnd);
          snapStatus = evaluateWireConnection(cur.selectedPinId, liveDragRef.current.snapPinId, cur.platform).status;
        } else {
          _vEnd.copy(liveDragRef.current.point);
        }
      } else {
        _vEnd.copy(liveDragRef.current.point);
      }

      const liveColor =
        snapStatus === 'valid'
          ? 0x22c55e
          : snapStatus === 'fault'
            ? 0xef4444
            : snapStatus === 'custom'
              ? 0xf59e0b
              : 0x38bdf8;

      const curve = buildPhysicalJumperCurve(_vStart, _vEnd, 0.14);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.028, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: liveColor,
        emissive: liveColor,
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.2,
      });
      liveWireGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

      // Black molded Dupont plug on Start Pin + Brass crimp tip at cursor end!
      addDupontBoot(liveWireGroup, _vStart, _vEnd, false);
      addDupontBoot(liveWireGroup, _vEnd, _vStart, true);
    };

    const rebuildWires = () => {
      disposeGroupChildren(wireGroup, sharedStaticMats, sharedStaticGeos);
      activeCurves.length = 0;

      const cur = stateRef.current;

      for (let i = 0; i < cur.wires.length; i++) {
        const w = cur.wires[i];
        const mA = pinLookup.get(w.fromPin);
        const mB = pinLookup.get(w.toPin);
        if (!mA || !mB) continue;

        mA.getWorldPosition(_vStart);
        mB.getWorldPosition(_vEnd);

        const curve = buildPhysicalJumperCurve(_vStart, _vEnd, (i % 4) * 0.055);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.027, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: w.colorHex,
          roughness: 0.36,
          metalness: 0.18,
          emissive: w.status === 'fault' ? 0xdc2626 : 0x000000,
          emissiveIntensity: w.status === 'fault' ? 0.55 : 0,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = !isSoftwareGl;
        wireGroup.add(tubeMesh);

        // Physical black Dupont connector boots gripping BOTH ends of every completed wire
        addDupontBoot(wireGroup, _vStart, _vEnd, false);
        addDupontBoot(wireGroup, _vEnd, _vStart, false);

        if (cur.poweredOn && w.status === 'valid') {
          const dot = new THREE.Mesh(pulseGeo, pulseMat);
          wireGroup.add(dot);
          activeCurves.push({ curve, dot, offset: (i * 0.17) % 1 });
        }
      }

      // Highlighted guide preview wire from Raw Block Diagram
      if (cur.guideWire) {
        const mA = pinLookup.get(cur.guideWire.fromPin);
        const mB = pinLookup.get(cur.guideWire.toPin);
        if (mA && mB) {
          mA.getWorldPosition(_vStart);
          mB.getWorldPosition(_vEnd);
          const guideCurve = buildPhysicalJumperCurve(_vStart, _vEnd, 0.25);
          const guideGeo = new THREE.TubeGeometry(guideCurve, 24, 0.022, 8, false);
          const guideMat = new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.78,
          });
          wireGroup.add(new THREE.Mesh(guideGeo, guideMat));
        }
      }
    };

    const syncSceneFromState = () => {
      const cur = stateRef.current;
      const activeSet = new Set(cur.activeModuleIds);

      for (const mod of COMPONENT_MODULES_3D) {
        const isActive = activeSet.has(mod.id);
        const isPlaced = cur.placedIds.includes(mod.id);

        const built = builtMap.get(mod.id);
        if (built) {
          built.group.visible = isActive;
          const anyFault = cur.wires.some((w) => w.status === 'fault');
          for (const lm of built.ledMaterials) {
            lm.emissiveIntensity = cur.poweredOn && !anyFault ? 1.85 : 0.12;
          }
          if (built.oledCanvas && built.oledTexture) {
            const faultWire = cur.wires.find((w) => w.status === 'fault');
            const validCount = cur.wires.filter((w) => w.status === 'valid').length;
            drawOledCanvas(
              built.oledCanvas,
              cur.poweredOn,
              validCount,
              cur.requiredCount,
              faultWire ? faultWire.message : null
            );
            built.oledTexture.needsUpdate = true;
          }
        }

        const slotPad = slotMap.get(mod.id);
        if (slotPad) {
          slotPad.visible = isActive && !isPlaced;
        }
      }

      pinLookup.forEach((mesh, pinId) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isSel = cur.selectedPinId === pinId;
        const isHov = cur.hoveredPinId === pinId;
        const isGuide =
          cur.guideWire?.fromPin === pinId || cur.guideWire?.toPin === pinId;
        mesh.scale.setScalar(isSel || isGuide ? 1.65 : isHov ? 1.4 : 1.0);
        mat.emissive.setHex(
          isSel || isGuide ? 0xfacc15 : isHov ? 0xffffff : mesh.userData.baseColor
        );
        mat.emissiveIntensity = isSel || isGuide ? 1.5 : isHov ? 1.05 : 0.3;
      });

      rebuildWires();
      rebuildLiveCursorWire();
      requestRender();
    };

    sceneSyncRef.current = syncSceneFromState;
    liveWireSyncRef.current = () => {
      rebuildLiveCursorWire();
      requestRender();
    };

    // Layer-1 Raycasting + Live Physical Wire Rubber-Banding on Mouse Move
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastMoveCheck = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      const holdingWire = Boolean(stateRef.current.selectedPinId);
      if (now - lastMoveCheck < (holdingWire ? 24 : 45)) return;
      lastMoveCheck = now;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);

      let foundPin: { id: string; label: string } | null = null;
      let foundClickable = false;
      for (const h of hits) {
        if (h.object.userData.pinId && h.object.parent?.visible) {
          foundPin = { id: h.object.userData.pinId, label: h.object.userData.pinLabel };
          break;
        }
        if (h.object.userData.trayCompId && h.object.parent?.visible) {
          foundClickable = true;
        }
        if (h.object.userData.slotCompId && h.object.visible) {
          foundClickable = true;
        }
      }

      if (holdingWire) {
        if (foundPin) {
          liveDragRef.current.active = true;
          liveDragRef.current.snapPinId = foundPin.id;
        } else if (raycaster.ray.intersectPlane(_dragPlane, _planeHit)) {
          liveDragRef.current.active = true;
          liveDragRef.current.snapPinId = null;
          liveDragRef.current.point.copy(_planeHit);
        }
        rebuildLiveCursorWire();
        requestRender();
      }

      const nextHover = foundPin ? foundPin.id : null;
      if (stateRef.current.hoveredPinId !== nextHover) {
        stateRef.current.hoveredPinId = nextHover;
        setHoveredPin(foundPin ? foundPin.label : null);
        syncSceneFromState();
      }
      renderer.domElement.style.cursor = holdingWire
        ? foundPin
          ? 'cell'
          : 'crosshair'
        : foundPin || foundClickable
          ? 'pointer'
          : 'grab';
    };

    let downX = 0;
    let downY = 0;
    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);

      let pinHit: THREE.Object3D | null = null;
      let compHit: string | null = null;
      let slotHit: string | null = null;
      for (const h of hits) {
        if (h.object.userData.pinId && h.object.parent?.visible) {
          pinHit = h.object;
          break;
        }
        if (h.object.userData.trayCompId && h.object.parent?.visible && !compHit) {
          compHit = h.object.userData.trayCompId;
        }
        if (h.object.userData.slotCompId && h.object.visible && !slotHit) {
          slotHit = h.object.userData.slotCompId;
        }
      }

      if (pinHit) {
        const clickedId: string = pinHit.userData.pinId;
        const clickedLabel: string = pinHit.userData.pinLabel;
        const compId = pinHit.userData.compId;

        if (!stateRef.current.placedIds.includes(compId)) {
          togglePlaceComponent(compId);
          return;
        }

        setSelectedPin((prev) => {
          if (!prev) {
            pinHit.getWorldPosition(liveDragRef.current.point);
            liveDragRef.current.active = true;
            liveDragRef.current.snapPinId = clickedId;
            setLastStatus(`Holding wire from ${clickedLabel} — move mouse & click destination pin to plug it in!`);
            return { pinId: clickedId, label: clickedLabel };
          }
          if (prev.pinId === clickedId) {
            liveDragRef.current.active = false;
            setLastStatus('Dropped jumper wire.');
            return null;
          }

          liveDragRef.current.active = false;

          const exists = stateRef.current.wires.some((w) =>
            sameNetPair(w.fromPin, w.toPin, prev.pinId, clickedId)
          );
          if (exists) {
            setLastStatus(`Wire between ${prev.label} and ${clickedLabel} is already plugged in.`);
            return null;
          }

          const verdict = evaluateWireConnection(prev.pinId, clickedId, stateRef.current.platform);
          const newWire: UserWire3D = {
            id: `uw-${Date.now()}`,
            fromPin: prev.pinId,
            toPin: clickedId,
            colorHex: verdict.colorHex,
            status: verdict.status,
            message: verdict.message,
          };
          setWires((wList) => [...wList, newWire]);
          setLastStatus(verdict.message);
          if (
            stateRef.current.guideWire &&
            sameNetPair(
              stateRef.current.guideWire.fromPin,
              stateRef.current.guideWire.toPin,
              prev.pinId,
              clickedId
            )
          ) {
            setGuideWire(null);
          }
          return null;
        });
        return;
      }

      if (compHit && !stateRef.current.placedIds.includes(compHit)) {
        togglePlaceComponent(compHit);
        return;
      }

      if (slotHit && !stateRef.current.placedIds.includes(slotHit)) {
        togglePlaceComponent(slotHit);
        return;
      }

      // Clicking empty bench cancels holding wire cleanly
      if (stateRef.current.selectedPinId) {
        liveDragRef.current.active = false;
        setSelectedPin(null);
        setLastStatus('Wire cancelled. Click any brass pin to start connecting.');
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        gl.flush();
        const poll = () => {
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function stepScene(now: number): boolean {
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      let needsAnotherFrame = false;

      let movedAnyComponent = false;
      for (const mod of COMPONENT_MODULES_3D) {
        const built = builtMap.get(mod.id);
        if (!built) continue;
        const target = stateRef.current.placedIds.includes(mod.id) ? mod.boardPos : mod.trayPos;
        const dx = Math.abs(built.group.position.x - target[0]);
        const dy = Math.abs(built.group.position.y - target[1]);
        const dz = Math.abs(built.group.position.z - target[2]);
        if (dx > 0.004 || dy > 0.004 || dz > 0.004) {
          built.group.position.x = THREE.MathUtils.damp(built.group.position.x, target[0], 8, delta);
          built.group.position.y = THREE.MathUtils.damp(built.group.position.y, target[1], 8, delta);
          built.group.position.z = THREE.MathUtils.damp(built.group.position.z, target[2], 8, delta);
          movedAnyComponent = true;
          needsAnotherFrame = true;
        }
      }
      if (movedAnyComponent) {
        rebuildWires();
        rebuildLiveCursorWire();
      }

      if (cameraTargetRef.current.active) {
        const { pos, lookAt } = cameraTargetRef.current;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, pos[0], 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, pos[1], 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, pos[2], 7, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, lookAt[0], 7, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, lookAt[1], 7, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, lookAt[2], 7, delta);

        if (
          Math.abs(camera.position.x - pos[0]) < 0.02 &&
          Math.abs(camera.position.y - pos[1]) < 0.02 &&
          Math.abs(camera.position.z - pos[2]) < 0.02
        ) {
          cameraTargetRef.current.active = false;
        } else {
          needsAnotherFrame = true;
        }
      }

      if (stateRef.current.poweredOn && activeCurves.length > 0) {
        const t = (now * 0.00055) % 1;
        for (const item of activeCurves) {
          const u = (t + item.offset) % 1;
          item.curve.getPointAt(u, _vMid);
          item.dot.position.copy(_vMid);
        }
        needsAnotherFrame = true;
      }

      if (controls.update()) {
        needsAnotherFrame = true;
      }
      return needsAnotherFrame;
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const keepGoing = stepScene(now);
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || keepGoing) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);

    const onResize = () => {
      if (!container) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(container);

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Continue cleanly without blocking initial render
      }
    }
    syncSceneFromState();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();

      disposeGroupChildren(wireGroup, sharedStaticMats, sharedStaticGeos);
      disposeGroupChildren(liveWireGroup, sharedStaticMats, sharedStaticGeos);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
      pulseGeo.dispose();
      pulseMat.dispose();
      dupontBootGeo.dispose();
      dupontHousingMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const validWireCount = wires.filter((w) => w.status === 'valid').length;
  const faultWireCount = wires.filter((w) => w.status === 'fault').length;
  const placedCount = placedIds.filter((id) => activeModules.some((m) => m.id === id)).length;

  return (
    <section id="workbench-3d" className="scroll-mt-16 space-y-3">
      {/* Compact Top Title + Platform Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-semibold">
            01. Proteus-Style Interactive 3D Hardware Builder (165Wp Mono PERC MPPT)
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Top 3D Component Rack, Physical Jumper Wiring &amp; Raw Block Diagram
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Proteus ISIS / 3D Visualizer / ARES View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setWorkbenchView('isis')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workbenchView === 'isis'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
              ISIS Schematic &amp; VSM
            </button>
            <button
              type="button"
              onClick={() => setWorkbenchView('3d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workbenchView === '3d'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Box className="w-3.5 h-3.5" aria-hidden="true" />
              3D Hardware Bench
            </button>
            <button
              type="button"
              onClick={() => setWorkbenchView('pcb')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workbenchView === 'pcb'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              ARES 2D PCB &amp; Gerber
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 border border-slate-200 rounded-lg">
            {(['esp32', 'arduino', 'hybrid'] as ControllerPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChangePlatform(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  platform === p
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {PLATFORM_META[p].shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3D Component Tray Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-sky-400 font-semibold">
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            TOP 3D COMPONENT TRAY — CLICK PART TO PLACE ON NAMED SLOT ({placedCount}/{activeModules.length} PLACED)
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span>Drag = Orbit 360°</span>
            <span>·</span>
            <span>Scroll = Zoom</span>
            <span>·</span>
            <span>Click Pin = Grab Wire</span>
            <span>·</span>
            <span>Click 2nd Pin = Plug In</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {activeModules.map((mod: ComponentModule3D, idx: number) => {
            const isPlaced = placedIds.includes(mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => togglePlaceComponent(mod.id)}
                title={mod.summary}
                className={`px-2.5 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${
                  isPlaced
                    ? 'bg-slate-800 border-emerald-500/70 text-white'
                    : 'bg-slate-950 border-slate-700 hover:border-sky-400 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold truncate">
                    {idx + 1}. {mod.shortName}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      isPlaced ? 'bg-emerald-950 text-emerald-300' : 'bg-sky-950 text-sky-300'
                    }`}
                  >
                    {isPlaced ? 'On PCB' : 'Top Tray'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {mod.pins.length} pins · {mod.category}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FIRST-SCREEN SPLIT WORKSPACE: 3D Physical Bench OR ARES 2D PCB (Left 8 cols) + Raw Block Diagram (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Persistent 3D Physical Hardware Wiring Bench (hidden via CSS when PCB tab is active to keep WebGL alive) */}
        <div
          className={
            workbenchView === '3d'
              ? 'lg:col-span-8 relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden'
              : 'hidden'
          }
        >
          {webglError ? (
            <div className="w-full h-[540px] lg:h-[630px] flex flex-col items-center justify-center p-6 text-center text-slate-300">
              <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">3D WebGL Viewport Unavailable</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {webglError} Enable hardware/WebGL graphics in your browser, or use the Raw Block Diagram on the right and interactive 2D Schematic below.
              </p>
            </div>
          ) : (
            <div
              ref={mountRef}
              className="w-full h-[540px] lg:h-[630px] touch-none select-none"
              aria-label="Interactive 3D MPPT Hardware Assembly and Physical Wiring Viewport"
            />
          )}

          {/* Top-Left Pin & Status Overlay (Zero backdrop-filter) */}
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md pointer-events-none">
            <div className="bg-slate-900/95 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 shadow-lg">
              <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
                <span className="text-sky-300 font-semibold truncate">
                  {hoveredPin
                    ? `PIN: ${hoveredPin}`
                    : selectedPin
                      ? `HOLDING WIRE: ${selectedPin.label}`
                      : `${PLATFORM_META[platform].shortLabel} · ${validWireCount}/${requiredWires.length} Connected`}
                </span>
                {faultWireCount > 0 ? (
                  <span className="text-red-400 flex items-center gap-1 font-semibold shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    {faultWireCount} Fault
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Safe
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">{lastStatus}</div>
            </div>
          </div>

          {/* Collapsible Bottom Control Dock (Zero backdrop-filter) */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-[96%] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((c) => !c)}
              className="px-3 py-1 text-[10px] font-mono font-semibold text-slate-200 bg-slate-900 border border-slate-700 border-b-0 rounded-t-md hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  Show Workbench Controls
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  Hide Controls
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xl">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-mono text-slate-400 mr-1 flex items-center gap-1">
                    <Eye className="w-3 h-3" aria-hidden="true" />
                    View:
                  </span>
                  {(
                    [
                      { id: 'iso', label: 'Bench Iso' },
                      { id: 'top', label: 'Top PCB' },
                      { id: 'power', label: 'Power Stage' },
                      { id: 'rack', label: 'Top Tray' },
                    ] as { id: CameraPreset; label: string }[]
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => applyCameraPreset(cam.id)}
                      className={`px-2 py-1 text-[10px] font-medium rounded cursor-pointer transition-colors ${
                        cameraPreset === cam.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReturnAllToTop}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded cursor-pointer"
                  >
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    Reset Top
                  </button>

                  <button
                    type="button"
                    onClick={handlePlaceAll}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Place All Parts
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoWire}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
                  >
                    <Cable className="w-3 h-3" aria-hidden="true" />
                    Auto-Wire Default
                  </button>

                  <button
                    type="button"
                    onClick={handleClearWires}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    Clear Wires
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoweredOn((p) => !p)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                      poweredOn
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    }`}
                  >
                    {poweredOn ? (
                      <>
                        <Zap className="w-3 h-3" aria-hidden="true" />
                        Powered ON
                      </>
                    ) : (
                      <>
                        <Power className="w-3 h-3" aria-hidden="true" />
                        Power On 3D
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Left Alternate View 1: Proteus ISIS Classic Live Schematic Capture & SPICE Export */}
        {workbenchView === 'isis' && (
          <div className="lg:col-span-8">
            <ProteusIsisCanvas
              platform={platform}
              poweredOn={poweredOn}
              onTogglePower={setPoweredOn}
              validWireCount={validWireCount}
              requiredCount={requiredWires.length}
              faultCount={faultWireCount}
              onAutoWire={handleAutoWire}
            />
          </div>
        )}

        {/* Left Alternate View 2: Proteus ARES 2D Copper PCB Layout & Gerber Export */}
        {workbenchView === 'pcb' && (
          <div className="lg:col-span-8">
            <PcbLayoutPanel platform={platform} wiredIds={wires} onAutoWire={handleAutoWire} />
          </div>
        )}

        {/* Right: Raw Default Block Diagram & Pin-to-Pin Guide on the First Screen! */}
        <div className="lg:col-span-4">
          <RawConnectionDiagram
            platform={platform}
            wires={wires}
            guideWireId={guideWire?.id ?? null}
            onHighlightGuideWire={handleHighlightGuideWire}
            onConnectSingleRule={handleConnectSingleRule}
          />
        </div>
      </div>

      {/* Proteus VSM-Style 4-Channel Virtual Digital Oscilloscope & Probe Meters */}
      <VirtualScopePanel
        platform={platform}
        poweredOn={poweredOn}
        validWireCount={validWireCount}
        requiredCount={requiredWires.length}
        faultCount={faultWireCount}
      />
    </section>
  );
}
