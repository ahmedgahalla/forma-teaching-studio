'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  dentalBackdrop,
  dentalStagePalette,
  dentalSurface,
  updateDentalBackdrop,
} from '@/lib/dental-surface';
import { download, type DentalCase } from '@/lib/geometry';
import type { Pose, Transforms, Vec3 } from '@/lib/model';
import { createMechanicsVisuals } from '@/lib/mechanics-view';
import type { MechanicsExperiment } from '@/lib/mechanics/types';
import type { PointedReference } from '@/lib/mechanics-commands';
import { createAttachmentGeometry } from '@/lib/attachments';
import { createApplianceKit, orderedArchIds, toothArch, type Landmark } from '@/lib/appliances';
import { toothMatrix } from '@/lib/analysis';
import { perspectiveFitDistance } from '@/lib/camera-fit';
import { sameViewerGeometry } from '@/lib/viewer-model';
import {
  createWorkflowAppliances,
  workflowFixedVisibility,
  type WorkflowViewState,
} from '@/lib/workflow-appliances';
import {
  anatomyCutawayTooth,
  createTeachingAnatomy,
  layoutAnatomyLabels,
  type AnatomyViewState,
} from '@/lib/teaching-anatomy';
import { createRenderBarrier } from '@/lib/render-barrier';
import { createRemovableRetainer } from '@/lib/removable-retainer';
import { useStudioTheme } from '../shared/StudioTheme';
import {
  cameraViewDirection,
  displayedToothBounds,
  isToothVisible,
  layoutToothLabels,
  selectionContourMaterial,
  type ToothLabelAnchor,
} from '@/lib/viewer-presentation';
import './teaching-anatomy.css';

export type ViewName = 'perspective' | 'occlusal' | 'front' | 'right' | 'left';
export type ArchView = 'both' | 'upper' | 'lower';
export type ViewerCamera = {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  view: ViewName;
  far: number;
  maxDistance: number;
};
export type ViewerHandle = {
  setView: (view: ViewName) => void;
  fit: () => void;
  focus: () => void;
  snapshot: () => void;
  getCamera: () => ViewerCamera | null;
  restoreCamera: (camera: ViewerCamera) => void;
  whenRendered: (signal: AbortSignal) => Promise<void>;
};
type Props = {
  model: DentalCase;
  transforms: Transforms;
  selected: string;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  ghost: boolean;
  gums: boolean;
  labels: boolean;
  grid: boolean;
  arch: ArchView;
  braces: boolean;
  roots: boolean;
  bracketStyle: 'metal' | 'ceramic';
  ligatureColor: string;
  opening: number;
  measureMode: boolean;
  landmarks: Landmark[];
  onLandmark: (landmark: Landmark) => void;
  intersections: string[];
  attachments: boolean;
  tool: 'orbit' | 'translate' | 'rotate';
  onPosePreview: (id: string, pose: Pose) => void;
  onPoseCommit: (id: string, pose: Pose) => void;
  workflow?: WorkflowViewState;
  paused?: boolean;
  anatomy?: AnatomyViewState;
  ghostTransforms?: Transforms;
  lockedIds?: string[];
  traceFrom?: Transforms;
  archCurve?: Vec3[];
  removableRetainer?: boolean;
  isolateSelection?: boolean;
  mechanics?: MechanicsExperiment | null;
  mechanicsForces?: boolean;
  mechanicsRevealed?: boolean;
  pointed?: PointedReference | null;
  pointing?: boolean;
  onPoint?: (point: PointedReference | null) => void;
  onReferenceInteraction?: () => void;
};

const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(props, ref) {
  const { theme } = useStudioTheme();
  const liveTheme = useRef(theme);
  liveTheme.current = theme;
  const host = useRef<HTMLDivElement>(null),
    labelsHost = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const renderBarrierRef = useRef<ReturnType<typeof createRenderBarrier> | null>(null);
  if (!renderBarrierRef.current) renderBarrierRef.current = createRenderBarrier();
  const renderBarrier = renderBarrierRef.current;
  const commands = useRef<Omit<ViewerHandle, 'whenRendered'>>({
    setView: () => {},
    fit: () => {},
    focus: () => {},
    snapshot: () => {},
    getCamera: () => null,
    restoreCamera: () => {},
  });
  const savedCamera = useRef<{
    model: DentalCase;
    position: THREE.Vector3;
    target: THREE.Vector3;
    up: THREE.Vector3;
    aspect: number;
    far: number;
    maxDistance: number;
    view: ViewName;
  } | null>(null);
  const [error, setError] = useState('');
  useImperativeHandle(
    ref,
    () => ({
      setView: v => commands.current.setView(v),
      fit: () => commands.current.fit(),
      focus: () => commands.current.focus(),
      snapshot: () => commands.current.snapshot(),
      getCamera: () => commands.current.getCamera(),
      restoreCamera: camera => commands.current.restoreCamera(camera),
      whenRendered: signal =>
        live.current.paused ? Promise.resolve() : renderBarrier.wait(signal),
    }),
    [renderBarrier],
  );
  useEffect(() => () => renderBarrier.dispose(), [renderBarrier]);
  useEffect(() => {
    renderBarrier.reset();
    const container = host.current!,
      labelContainer = labelsHost.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      const message = 'The 3D viewer requires WebGL. Enable hardware acceleration in your browser.';
      renderBarrier.fail(new Error(message));
      setError(message);
      return;
    }
    setError('');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    let renderedTheme = liveTheme.current;
    const palette = dentalStagePalette[renderedTheme];
    renderer.setClearColor(palette.clear, 1);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000);
    const backdrop = dentalBackdrop(renderedTheme);
    scene.background = backdrop;
    scene.environmentIntensity = 0.65;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target),
      scenePass = new RenderPass(scene, camera),
      ao = new GTAOPass(scene, camera, 1, 1),
      outputPass = new OutputPass();
    ao.blendIntensity = 0.48;
    ao.updateGtaoMaterial({
      radius: 2.2,
      thickness: 1.2,
      distanceExponent: 2,
      distanceFallOff: 1,
      samples: 12,
      screenSpaceRadius: false,
    });
    ao.updatePdMaterial({ radius: 4, samples: 12, depthPhi: 2, normalPhi: 4 });
    composer.addPass(scenePass);
    composer.addPass(ao);
    composer.addPass(outputPass);
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.11;
    controls.minDistance = 10;
    controls.maxDistance = 3000;
    scene.add(new THREE.HemisphereLight(0xf8fbff, 0x56647d, 0.28));
    const key = new THREE.DirectionalLight(0xfff6e8, 1.7);
    key.position.set(-48, 65, 75);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90 });
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.08;
    key.shadow.radius = 3;
    scene.add(key);
    // A modest camera-relative fill keeps lingual and occlusal details readable during orbit.
    const fill = new THREE.DirectionalLight(0xf0f5ff, 0.7);
    fill.position.set(40, 15, 65);
    fill.target.position.set(0, 0, -1);
    camera.add(fill, fill.target);
    scene.add(camera);
    const rim = new THREE.DirectionalLight(0xd7eaff, 1.1);
    rim.position.set(25, 45, -65);
    scene.add(rim);
    const enamel = new THREE.MeshPhysicalMaterial({
      color: props.model.demo ? 0xffffff : 0xf0ebdf,
      vertexColors: props.model.demo,
      roughness: 0.38,
      metalness: 0,
      ior: 1.5,
      clearcoat: 0.12,
      clearcoatRoughness: 0.38,
    });
    const contourMaterial = selectionContourMaterial(palette.selected);
    const lockedMaterial = enamel.clone();
    lockedMaterial.color.set(palette.locked);
    const contactMaterial = enamel.clone();
    contactMaterial.color.set(palette.contact);
    const rootMaterial = new THREE.MeshStandardMaterial({
      color: props.model.demo ? 0xffffff : 0xe2cba7,
      vertexColors: props.model.demo,
      roughness: 0.52,
    });
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: palette.ghost,
      opacity: palette.ghostOpacity,
      transparent: true,
      depthWrite: false,
    });
    const gumMaterial = new THREE.MeshPhysicalMaterial({
      color: props.model.demo ? 0xffffff : 0xb8757b,
      vertexColors: props.model.demo,
      roughness: 0.6,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const attachmentMaterial = new THREE.MeshStandardMaterial({ color: 0xf1b762, roughness: 0.4 });
    const kit = createApplianceKit();
    const workflowKit = createWorkflowAppliances(props.model);
    scene.add(workflowKit.group);
    const removableKit = createRemovableRetainer(props.model);
    scene.add(removableKit.group);
    const anatomyKit = createTeachingAnatomy(props.model);
    scene.add(anatomyKit.group);
    const anatomyOverlay = document.createElement('div');
    anatomyOverlay.className = 'anatomy-overlay';
    anatomyOverlay.hidden = true;
    container.appendChild(anatomyOverlay);
    const anatomyLines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    anatomyLines.setAttribute('aria-hidden', 'true');
    anatomyOverlay.appendChild(anatomyLines);
    const anatomyLabels = new Map<
      string,
      { element: HTMLDivElement; line: SVGLineElement; dot: SVGCircleElement }
    >();
    const anatomyCaption = document.createElement('p');
    anatomyCaption.className = 'anatomy-caption';
    anatomyCaption.textContent =
      'Schematic section · PDL enlarged for visibility · support tissues stay fixed';
    anatomyOverlay.appendChild(anatomyCaption);
    const displayGeometry: THREE.BufferGeometry[] = [];
    const surface = (
      geometry: THREE.BufferGeometry,
      axis: Vec3,
      tissue: 'enamel' | 'root' | 'gingiva',
    ) => {
      if (!props.model.demo) return geometry;
      const tinted = dentalSurface(geometry, axis, tissue);
      displayGeometry.push(tinted);
      return tinted;
    };
    const groups = new Map<string, THREE.Group>(),
      crowns = new Map<string, THREE.Mesh>(),
      roots = new Map<string, THREE.Mesh>(),
      brackets = new Map<string, THREE.Group>(),
      attachments = new Map<string, THREE.Mesh>(),
      ghosts = new Map<string, THREE.Mesh>(),
      rootGhosts = new Map<string, THREE.Mesh>(),
      labels = new Map<string, HTMLButtonElement>(),
      contours = new Map<string, { crown: THREE.Mesh; root?: THREE.Mesh }>();
    for (const tooth of props.model.teeth) {
      const group = new THREE.Group();
      group.position.fromArray(tooth.position);
      scene.add(group);
      groups.set(tooth.id, group);
      const crown = new THREE.Mesh(
        surface(tooth.geometry, tooth.occlusal || [0, -1, 0], 'enamel'),
        enamel,
      );
      crown.castShadow = true;
      crown.receiveShadow = true;
      crown.userData.tooth = tooth.id;
      group.add(crown);
      crowns.set(tooth.id, crown);
      const outline = new THREE.Mesh(tooth.geometry, contourMaterial);
      outline.renderOrder = 1;
      outline.frustumCulled = false;
      group.add(outline);
      contours.set(tooth.id, { crown: outline });
      if (tooth.rootGeometry) {
        const root = new THREE.Mesh(
          surface(tooth.rootGeometry, tooth.occlusal || [0, -1, 0], 'root'),
          rootMaterial,
        );
        root.castShadow = true;
        root.receiveShadow = true;
        group.add(root);
        roots.set(tooth.id, root);
        const originalRoot = new THREE.Mesh(tooth.rootGeometry, ghostMaterial);
        scene.add(originalRoot);
        rootGhosts.set(tooth.id, originalRoot);
      }
      if (tooth.rootGeometry) {
        const outline = new THREE.Mesh(tooth.rootGeometry, contourMaterial);
        outline.renderOrder = 1;
        outline.frustumCulled = false;
        group.add(outline);
        contours.get(tooth.id)!.root = outline;
      }
      const bracket = kit.bracket(tooth);
      if (bracket) {
        bracket.userData.basePosition = bracket.position.clone();
        group.add(bracket);
        brackets.set(tooth.id, bracket);
      }
      if (tooth.attachment) {
        try {
          const mesh = new THREE.Mesh(
            createAttachmentGeometry(tooth, tooth.attachment),
            attachmentMaterial,
          );
          mesh.castShadow = true;
          group.add(mesh);
          attachments.set(tooth.id, mesh);
        } catch {
          setError(
            `Attachment on ${tooth.id} could not be placed. Adjust its position in Appliances.`,
          );
        }
      }
      const ghost = new THREE.Mesh(tooth.geometry, ghostMaterial);
      ghost.position.fromArray(tooth.position);
      scene.add(ghost);
      ghosts.set(tooth.id, ghost);
      const label = document.createElement('button');
      label.className = 'tooth-label';
      label.textContent = tooth.id;
      label.setAttribute('aria-label', `Select tooth ${tooth.id}`);
      label.onclick = e => live.current.onSelect(tooth.id, e.shiftKey || e.ctrlKey || e.metaKey);
      labelContainer.appendChild(label);
      labels.set(tooth.id, label);
    }
    const gumMeshes = props.model.gums.map(gum => {
      const mesh = new THREE.Mesh(
        surface(gum.geometry, [0, gum.arch === 'upper' ? -1 : 1, 0], 'gingiva'),
        gumMaterial,
      );
      mesh.position.fromArray(gum.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { mesh, gum };
    });
    const grid = new THREE.GridHelper(150, 30, palette.gridMajor, palette.gridMinor);
    grid.position.y = -33;
    scene.add(grid);
    const mechanicsKit = createMechanicsVisuals(props.model);
    scene.add(mechanicsKit.group);
    let lastMechanics: MechanicsExperiment | null | undefined,
      lastMechanicsPoses: Transforms | undefined,
      mechanicsDisplayKey = '';
    const wireMeshes = new Map<string, THREE.Mesh>();
    const markerGeometry = new THREE.SphereGeometry(0.55, 16, 10),
      markerMaterial = new THREE.MeshBasicMaterial({ color: palette.marker, depthTest: false });
    const markers = [
      new THREE.Mesh(markerGeometry, markerMaterial),
      new THREE.Mesh(markerGeometry, markerMaterial),
    ];
    markers.forEach(m => {
      m.renderOrder = 4;
      scene.add(m);
    });
    const targetGeometry = new THREE.RingGeometry(0.75, 1.05, 32),
      targetMaterial = new THREE.MeshBasicMaterial({
        color: '#18c6b0',
        side: THREE.DoubleSide,
        depthTest: false,
      });
    const targetMarker = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMarker.renderOrder = 6;
    scene.add(targetMarker);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const measureLine = new THREE.Line(
      lineGeometry,
      new THREE.LineDashedMaterial({
        color: palette.measurement,
        dashSize: 0.6,
        gapSize: 0.35,
        depthTest: false,
      }),
    );
    measureLine.renderOrder = 3;
    scene.add(measureLine);
    const traceGeometry = new THREE.BufferGeometry();
    traceGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(props.model.teeth.length * 6), 3),
    );
    const traceLines = new THREE.LineSegments(
      traceGeometry,
      new THREE.LineBasicMaterial({ color: palette.trace, depthTest: false }),
    );
    traceLines.frustumCulled = false;
    traceLines.renderOrder = 3;
    scene.add(traceLines);
    const curveGeometry = new THREE.BufferGeometry(),
      curveLine = new THREE.Line(
        curveGeometry,
        new THREE.LineDashedMaterial({ color: palette.curve, dashSize: 1, gapSize: 0.7 }),
      );
    scene.add(curveLine);
    let lastCurve: Vec3[] | undefined;
    const updateStageTheme = () => {
      if (renderedTheme === liveTheme.current) return;
      renderedTheme = liveTheme.current;
      const next = dentalStagePalette[renderedTheme];
      updateDentalBackdrop(backdrop, renderedTheme);
      renderer.setClearColor(next.clear, 1);
      contourMaterial.uniforms.color.value.set(next.selected);
      lockedMaterial.color.set(next.locked);
      contactMaterial.color.set(next.contact);
      ghostMaterial.color.set(next.ghost);
      ghostMaterial.opacity = next.ghostOpacity;
      markerMaterial.color.set(next.marker);
      measureLine.material.color.set(next.measurement);
      traceLines.material.color.set(next.trace);
      curveLine.material.color.set(next.curve);
      const positions = grid.geometry.getAttribute('position'),
        colors = grid.geometry.getAttribute('color');
      const major = new THREE.Color(next.gridMajor),
        minor = new THREE.Color(next.gridMinor);
      for (let i = 0; i < positions.count; i += 2) {
        const central =
          (positions.getX(i) === 0 && positions.getX(i + 1) === 0) ||
          (positions.getZ(i) === 0 && positions.getZ(i + 1) === 0);
        const color = central ? major : minor;
        colors.setXYZ(i, color.r, color.g, color.b);
        colors.setXYZ(i + 1, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
    };
    const previousCamera = savedCamera.current,
      restoreCamera = previousCamera && sameViewerGeometry(previousCamera.model, props.model);
    let currentView: ViewName = restoreCamera ? previousCamera.view : 'perspective',
      snapshotRequested = false,
      disposed = false,
      pendingCamera: ViewerCamera | null = null;
    const cancelCameraRestore = () => {
      pendingCamera = null;
    };
    const onCameraInteraction = () => {
      cancelCameraRestore();
      live.current.onReferenceInteraction?.();
    };
    controls.addEventListener('start', onCameraInteraction);
    if (restoreCamera) {
      camera.position.copy(previousCamera.position);
      camera.up.copy(previousCamera.up);
      camera.aspect = previousCamera.aspect;
      camera.far = previousCamera.far;
      controls.target.copy(previousCamera.target);
      controls.maxDistance = previousCamera.maxDistance;
      camera.updateProjectionMatrix();
      controls.update();
    }
    const cutawayTooth = () =>
      anatomyCutawayTooth(props.model, live.current.anatomy, live.current.selected);
    const selection = () =>
      live.current.selectedIds.length ? live.current.selectedIds : [live.current.selected];
    const isolationKey = () =>
      live.current.isolateSelection ? [...selection()].sort().join(',') : 'all';
    const visible = (id: string) =>
      isToothVisible(id, {
        arch: live.current.arch,
        selectedIds: selection(),
        isolateSelection: live.current.isolateSelection,
        cutawayId: cutawayTooth()?.id,
      });
    const shownAnatomy = () =>
      live.current.isolateSelection && !cutawayTooth() ? undefined : live.current.anatomy;
    try {
      anatomyKit.update(live.current.transforms, shownAnatomy(), {
        selected: live.current.selected,
        arch: live.current.arch,
        opening: live.current.opening,
        roots: live.current.roots,
        gums: live.current.gums,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'The teaching anatomy could not be displayed.',
      );
    }
    const visibleBounds = (selectedOnly = false) => {
      const ids = props.model.teeth
        .filter(tooth => visible(tooth.id) && (!selectedOnly || selection().includes(tooth.id)))
        .map(tooth => tooth.id);
      const bounds = displayedToothBounds(
        props.model,
        live.current.transforms,
        ids,
        live.current.roots,
        live.current.opening,
      );
      if (!selectedOnly && live.current.gums && !cutawayTooth() && !live.current.isolateSelection)
        for (const gum of props.model.gums) {
          if (gum.arch && live.current.arch !== 'both' && gum.arch !== live.current.arch) continue;
          gum.geometry.computeBoundingBox();
          const box = gum.geometry
            .boundingBox!.clone()
            .translate(new THREE.Vector3(...gum.position));
          if (gum.arch === 'lower') box.translate(new THREE.Vector3(0, -live.current.opening, 0));
          bounds.union(box);
        }
      if ((!selectedOnly || cutawayTooth()) && (!live.current.isolateSelection || cutawayTooth()))
        bounds.union(anatomyKit.bounds);
      return bounds;
    };
    const positionCamera = (bounds: THREE.Box3, direction: THREE.Vector3, margin: number) => {
      if (bounds.isEmpty()) return;
      direction.normalize();
      const center = bounds.getCenter(new THREE.Vector3());
      const distance = Math.max(
        controls.minDistance,
        perspectiveFitDistance(bounds, direction, camera.up, camera.fov, camera.aspect, margin),
      );
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.maxDistance = Math.max(3000, distance * 2);
      camera.far = Math.max(10000, distance * 4);
      camera.updateProjectionMatrix();
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.target.copy(center);
      controls.update();
      controls.enableDamping = damping;
    };
    const fit = (view: ViewName, section = false) => {
      currentView = view;
      const bounds = visibleBounds();
      if (bounds.isEmpty()) return;
      const tooth = cutawayTooth();
      const direction =
        section && tooth
          ? new THREE.Vector3(...tooth.buccal).add(new THREE.Vector3(0.04, 0.06, 0))
          : cameraViewDirection(view, live.current.arch);
      camera.up.set(0, 1, 0);
      positionCamera(bounds, direction, tooth ? 1.48 : 1.18);
    };
    commands.current = {
      setView: view => {
        cancelCameraRestore();
        fit(view, view === 'perspective' && !!cutawayTooth());
      },
      fit: () => {
        cancelCameraRestore();
        fit(currentView, !!cutawayTooth());
      },
      focus: () => {
        cancelCameraRestore();
        const direction = camera.position.clone().sub(controls.target).normalize();
        positionCamera(visibleBounds(true), direction, 1.25);
      },
      snapshot: () => {
        snapshotRequested = true;
      },
      getCamera: () =>
        pendingCamera
          ? {
              ...pendingCamera,
              position: [...pendingCamera.position],
              target: [...pendingCamera.target],
              up: [...pendingCamera.up],
            }
          : {
              position: camera.position.toArray(),
              target: controls.target.toArray(),
              up: camera.up.toArray(),
              view: currentView,
              far: camera.far,
              maxDistance: controls.maxDistance,
            },
      restoreCamera: value => {
        pendingCamera = {
          ...value,
          position: [...value.position],
          target: [...value.target],
          up: [...value.up],
        };
      },
    };
    let renderWidth = 0,
      renderHeight = 0;
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      if (width === renderWidth && height === renderHeight) return;
      const before = camera.aspect,
        next = width / height,
        direction = camera.position.clone().sub(controls.target),
        bounds = visibleBounds();
      // Preserve orbit and relative zoom while matching the changed horizontal FOV.
      if (direction.lengthSq() && !bounds.isEmpty()) {
        const oldFit = perspectiveFitDistance(bounds, direction, camera.up, camera.fov, before);
        const newFit = perspectiveFitDistance(bounds, direction, camera.up, camera.fov, next);
        camera.position.copy(controls.target).addScaledVector(direction, newFit / oldFit);
        controls.maxDistance = Math.max(3000, newFit * 2);
        camera.far = Math.max(10000, newFit * 4);
      }
      camera.aspect = next;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      contourMaterial.uniforms.viewport.value.set(width, height);
      controls.update();
      renderWidth = width;
      renderHeight = height;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    if (!restoreCamera) fit('perspective', !!cutawayTooth());
    const gizmo = new TransformControls(camera, renderer.domElement),
      pivot = new THREE.Object3D();
    scene.add(pivot);
    scene.add(gizmo.getHelper());
    gizmo.setSpace('world');
    gizmo.setSize(0.85);
    gizmo.setTranslationSnap(0.1);
    gizmo.setRotationSnap(THREE.MathUtils.degToRad(1));
    let dragging = false,
      dragTooth = '',
      skipPick = false;
    const gizmoPose = (): Pose => {
      const t = props.model.teeth.find(t => t.id === dragTooth)!;
      const translation = pivot.position.clone().sub(new THREE.Vector3(...t.position));
      if (toothArch(t.id) === 'lower') translation.y += live.current.opening;
      const e = new THREE.Euler().setFromQuaternion(pivot.quaternion, 'XYZ');
      return {
        translation: translation.toArray() as Vec3,
        rotation: [e.x, e.y, e.z].map(THREE.MathUtils.radToDeg) as Vec3,
      };
    };
    gizmo.addEventListener('mouseDown', () => {
      dragging = true;
      dragTooth = live.current.selected;
      skipPick = true;
      controls.enabled = false;
    });
    gizmo.addEventListener('objectChange', () => {
      if (dragging) live.current.onPosePreview(dragTooth, gizmoPose());
    });
    gizmo.addEventListener('mouseUp', () => {
      const changed = dragging,
        tooth = dragTooth,
        pose = changed ? gizmoPose() : null;
      dragging = false;
      controls.enabled = true;
      if (changed && pose) live.current.onPoseCommit(tooth, pose);
    });
    const cancelDrag = () => {
      if (!dragging) return;
      gizmo.reset();
      gizmo.pointerUp(null);
      skipPick = false;
    };
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      if (skipPick) {
        skipPick = false;
        return;
      }
      if (event.button !== 0 || Math.hypot(down.x - event.clientX, down.y - event.clientY) > 5)
        return;
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        (-(event.clientY - box.top) / box.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const toothSurfaces = [...crowns.values(), ...roots.values()].filter(
        c => c.visible && c.parent!.visible,
      );
      const hit = ray.intersectObjects(
        live.current.measureMode
          ? toothSurfaces
          : [
              ...toothSurfaces,
              ...gumMeshes.filter(item => item.mesh.visible).map(item => item.mesh),
            ],
      )[0];
      if (!hit) {
        live.current.onPoint?.(null);
        return;
      }
      const gum = gumMeshes.find(item => item.mesh === hit.object)?.gum;
      const id = gum
        ? [...groups]
            .filter(([id, group]) => group.visible && toothArch(id) === gum.arch)
            .sort(
              (a, b) =>
                a[1].getWorldPosition(new THREE.Vector3()).distanceToSquared(hit.point) -
                b[1].getWorldPosition(new THREE.Vector3()).distanceToSquared(hit.point),
            )[0]?.[0]
        : [...groups].find(([, group]) => group === hit.object.parent)?.[0];
      if (!id) return;
      if (live.current.measureMode) {
        const local = hit.object.worldToLocal(hit.point.clone());
        live.current.onLandmark({ tooth: id, local: local.toArray() as Vec3 });
      } else {
        const localPoint = groups.get(id)!.worldToLocal(hit.point.clone()).toArray() as Vec3;
        const worldPoint = hit.point.clone();
        if (toothArch(id) === 'lower') worldPoint.y += live.current.opening;
        live.current.onPoint?.({
          tooth: id,
          localPoint,
          worldPoint: worldPoint.toArray() as Vec3,
          surface: gum ? 'gingiva' : roots.get(id) === hit.object ? 'root' : 'crown',
        });
        if (!live.current.pointing)
          live.current.onSelect(id, event.shiftKey || event.ctrlKey || event.metaKey);
      }
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      const message = 'Graphics were interrupted. Save your case, then reload the viewer.';
      renderBarrier.fail(new Error(message));
      setError(message);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDrag);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    const projected = new THREE.Vector3(),
      inverseCamera = new THREE.Quaternion();
    let frame = 0,
      wireState = '',
      workflowState = '',
      removableState = '',
      lastTransforms: Transforms | undefined,
      lastWorkflowTransforms: Transforms | undefined,
      lastRemovableTransforms: Transforms | undefined,
      lastArch = live.current.arch,
      lastRoots = live.current.roots,
      lastGums = live.current.gums,
      lastOpening = live.current.opening;
    let anatomyState = '',
      lastAnatomyTransforms: Transforms | undefined,
      lastAnatomyFit = props.model.demo
        ? `${live.current.anatomy?.bone}/${live.current.anatomy?.ligament}/${cutawayTooth()?.id || ''}`
        : '';
    let lastIsolation = isolationKey();
    function render() {
      if (live.current.paused) {
        frame = requestAnimationFrame(render);
        return;
      }
      updateStageTheme();
      // Resize before drawing, rather than letting a later ResizeObserver callback
      // change the camera after history has captured this frame.
      resize();
      const p = live.current;
      const {
        transforms,
        selectedIds,
        ghost,
        gums,
        braces,
        labels: showLabels,
        roots: showRoots,
        opening,
      } = p;
      const cutaway = cutawayTooth(),
        nextAnatomyState = `${p.anatomy?.bone}/${p.anatomy?.opacity}/${p.anatomy?.cutaway}/${p.anatomy?.ligament}/${p.selected}/${p.arch}/${opening}/${showRoots}/${gums}/${!!p.isolateSelection}`;
      if (lastAnatomyTransforms !== transforms || anatomyState !== nextAnatomyState) {
        try {
          anatomyKit.update(transforms, shownAnatomy(), {
            selected: p.selected,
            arch: p.arch,
            opening,
            roots: showRoots,
            gums,
          });
        } catch (error) {
          setError(
            error instanceof Error ? error.message : 'The teaching anatomy could not be displayed.',
          );
        }
        lastAnatomyTransforms = transforms;
        anatomyState = nextAnatomyState;
      }
      const workflow = props.model.demo ? p.workflow : undefined;
      const fixed = workflowFixedVisibility(workflow, braces);
      if (p.mechanics) {
        fixed.brackets = false;
        fixed.wires = false;
      }
      kit.update(p.bracketStyle, p.ligatureColor);
      for (const tooth of props.model.teeth) {
        const group = groups.get(tooth.id)!,
          pose = transforms[tooth.id],
          isLower = toothArch(tooth.id) === 'lower';
        group.position.fromArray(tooth.position);
        group.quaternion.identity();
        if (isLower) group.position.y -= opening;
        if (pose) {
          group.position.add(new THREE.Vector3(...pose.translation));
          group.quaternion.setFromEuler(
            new THREE.Euler(...(pose.rotation.map(THREE.MathUtils.degToRad) as Vec3)),
          );
        }
        group.visible = visible(tooth.id);
        group.updateMatrixWorld(true);
        crowns.get(tooth.id)!.material = p.intersections.includes(tooth.id)
          ? contactMaterial
          : p.lockedIds?.includes(tooth.id)
            ? lockedMaterial
            : enamel;
        const contour = contours.get(tooth.id)!,
          highlighted = selectedIds.includes(tooth.id) || (!!cutaway && tooth.id === p.selected);
        contour.crown.visible = highlighted;
        if (contour.root) contour.root.visible = highlighted && showRoots;
        if (roots.has(tooth.id)) roots.get(tooth.id)!.visible = showRoots;
        if (brackets.has(tooth.id)) {
          const bracket = brackets.get(tooth.id)!;
          bracket.visible = p.mechanics
            ? braces && !!p.mechanics.config.brackets[tooth.id]
            : fixed.brackets;
          bracket.children[6].visible = p.mechanics ? true : fixed.ligatures;
          bracket.position.copy(bracket.userData.basePosition);
          if (p.mechanics?.config.brackets[tooth.id])
            bracket.position.add(
              new THREE.Vector3(...p.mechanics.config.brackets[tooth.id]).sub(
                bracket.userData.anchor,
              ),
            );
        }
        if (attachments.has(tooth.id)) attachments.get(tooth.id)!.visible = p.attachments;
        const original = ghosts.get(tooth.id)!,
          reference = p.ghostTransforms?.[tooth.id];
        original.position.fromArray(tooth.position);
        original.quaternion.identity();
        if (isLower) original.position.y -= opening;
        if (reference) {
          original.position.add(new THREE.Vector3(...reference.translation));
          original.quaternion.setFromEuler(
            new THREE.Euler(...(reference.rotation.map(THREE.MathUtils.degToRad) as Vec3)),
          );
        }
        original.visible =
          group.visible &&
          ghost &&
          (original.position.distanceToSquared(group.position) > 1e-8 ||
            original.quaternion.angleTo(group.quaternion) > 1e-5);
        const originalRoot = rootGhosts.get(tooth.id);
        if (originalRoot) {
          originalRoot.position.copy(original.position);
          originalRoot.quaternion.copy(original.quaternion);
          originalRoot.visible = original.visible && showRoots;
        }
        const label = labels.get(tooth.id)!;
        label.textContent = `${tooth.id}${p.lockedIds?.includes(tooth.id) ? ' · locked' : ''}`;
        label.style.display = 'none';
        label.classList.toggle('selected', selectedIds.includes(tooth.id));
      }
      traceLines.visible = !!p.traceFrom;
      if (p.traceFrom) {
        const positions = traceGeometry.getAttribute('position');
        props.model.teeth.forEach((tooth, index) => {
          const from = toothMatrix(tooth, p.traceFrom!).elements,
            to = groups.get(tooth.id)!.position,
            offset = toothArch(tooth.id) === 'lower' ? opening : 0;
          positions.setXYZ(index * 2, from[12], from[13] - offset, from[14]);
          positions.setXYZ(
            index * 2 + 1,
            visible(tooth.id) ? to.x : from[12],
            visible(tooth.id) ? to.y : from[13] - offset,
            visible(tooth.id) ? to.z : from[14],
          );
        });
        positions.needsUpdate = true;
      }
      curveLine.visible = !!p.archCurve?.length && !cutaway && !p.isolateSelection;
      if (lastCurve !== p.archCurve) {
        curveGeometry.setFromPoints((p.archCurve || []).map(point => new THREE.Vector3(...point)));
        curveLine.computeLineDistances();
        lastCurve = p.archCurve;
      }
      gumMaterial.opacity = showRoots && !cutaway ? 0.22 : 1;
      gumMaterial.depthWrite = !showRoots || !!cutaway;
      gumMaterial.clippingPlanes = anatomyKit.gumPlanes;
      if (!dragging) {
        const active = groups.get(p.selected);
        if (
          p.tool !== 'orbit' &&
          !p.measureMode &&
          !p.lockedIds?.includes(p.selected) &&
          p.selectedIds.length === 1 &&
          active?.visible
        ) {
          pivot.position.copy(active.position);
          pivot.quaternion.copy(active.quaternion);
          gizmo.setMode(p.tool);
          if (!gizmo.object) gizmo.attach(pivot);
        } else if (gizmo.object) gizmo.detach();
      }
      gumMeshes.forEach(({ mesh, gum }) => {
        mesh.castShadow = !showRoots && !cutaway;
        mesh.visible =
          gums &&
          (cutaway
            ? gum.arch === toothArch(cutaway.id)
            : !p.isolateSelection && (!gum.arch || p.arch === 'both' || gum.arch === p.arch));
        mesh.position.fromArray(gum.position);
        if (gum.arch === 'lower') mesh.position.y -= opening;
      });
      grid.visible = p.grid && !cutaway;
      const nextWireState = `${fixed.wires}/${p.arch}/${opening}/${cutaway?.id || ''}/${!!p.isolateSelection}`;
      if (lastTransforms !== transforms || wireState !== nextWireState) {
        wireMeshes.forEach(mesh => {
          scene.remove(mesh);
          mesh.geometry.dispose();
        });
        wireMeshes.clear();
        if (fixed.wires && !p.isolateSelection)
          for (const arch of ['upper', 'lower'] as const) {
            if (cutaway ? toothArch(cutaway.id) !== arch : p.arch !== 'both' && p.arch !== arch)
              continue;
            const ids = orderedArchIds([...brackets.keys()].filter(visible), arch);
            const points = ids.map(id =>
              groups.get(id)!.localToWorld(brackets.get(id)!.userData.anchor.clone()),
            );
            if (cutaway && points.length === 1) {
              const axis = new THREE.Vector3(...cutaway.mesial).applyQuaternion(
                  groups.get(cutaway.id)!.quaternion,
                ),
                center = points[0];
              points.splice(
                0,
                1,
                center.clone().addScaledVector(axis, -2.8),
                center.clone().addScaledVector(axis, 2.8),
              );
            }
            if (points.length > 1) {
              const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
              const geometry = new THREE.TubeGeometry(
                curve,
                Math.max(24, points.length * 10),
                0.2,
                8,
                false,
              );
              const wire = new THREE.Mesh(geometry, kit.wireMaterial);
              wire.castShadow = true;
              scene.add(wire);
              wireMeshes.set(arch, wire);
            }
          }
        lastTransforms = transforms;
        wireState = nextWireState;
      }
      const nextWorkflowState = workflow
        ? `${workflow.appliance}/${workflow.phase}/${workflow.progress}/${workflow.arrows}/${workflow.palate}/${p.arch}/${opening}/${cutaway?.id || ''}/${!!p.isolateSelection}`
        : 'none';
      if (lastWorkflowTransforms !== transforms || workflowState !== nextWorkflowState) {
        try {
          workflowKit.update(transforms, cutaway || p.isolateSelection ? undefined : workflow, {
            arch: p.arch,
            opening,
          });
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : 'The teaching appliance could not be displayed.',
          );
        }
        lastWorkflowTransforms = transforms;
        workflowState = nextWorkflowState;
      }
      const nextRemovableState = `${!!p.removableRetainer}/${p.arch}/${opening}/${!!cutaway}/${!!p.isolateSelection}`;
      if (lastRemovableTransforms !== transforms || removableState !== nextRemovableState) {
        try {
          removableKit.update(transforms, {
            visible: !!p.removableRetainer && !p.isolateSelection,
            arch: p.arch,
            opening,
            cutaway: !!cutaway,
          });
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : 'The clear-retainer illustration could not be displayed.',
          );
        }
        lastRemovableTransforms = transforms;
        removableState = nextRemovableState;
      }
      const mechanicsKey = `${p.arch}/${opening}/${!!cutaway}/${isolationKey()}/${p.mechanicsForces}/${p.mechanicsRevealed}/${braces}`;
      if (
        lastMechanics !== p.mechanics ||
        lastMechanicsPoses !== transforms ||
        mechanicsDisplayKey !== mechanicsKey
      ) {
        mechanicsKit.update(braces ? p.mechanics : null, transforms, {
          arch: p.arch,
          opening,
          forces: !!p.mechanicsForces,
          revealed: p.mechanicsRevealed !== false,
          visible,
        });
        lastMechanics = p.mechanics;
        lastMechanicsPoses = transforms;
        mechanicsDisplayKey = mechanicsKey;
      }
      const activePoints = p.landmarks
        .map(l => groups.get(l.tooth)?.localToWorld(new THREE.Vector3(...l.local)))
        .filter((point): point is THREE.Vector3 => !!point);
      targetMarker.visible = !!p.pointed && visible(p.pointed.tooth);
      if (p.pointed && groups.has(p.pointed.tooth)) {
        if (p.pointed.surface === 'gingiva') {
          targetMarker.position.fromArray(p.pointed.worldPoint);
          if (toothArch(p.pointed.tooth) === 'lower') targetMarker.position.y -= opening;
        } else
          targetMarker.position.copy(
            groups.get(p.pointed.tooth)!.localToWorld(new THREE.Vector3(...p.pointed.localPoint)),
          );
        targetMarker.quaternion.copy(camera.quaternion);
      }
      markers.forEach((marker, i) => {
        marker.visible = !!activePoints[i] && visible(p.landmarks[i].tooth);
        if (activePoints[i]) marker.position.copy(activePoints[i]);
      });
      measureLine.visible = activePoints.length === 2 && markers.every(m => m.visible);
      if (measureLine.visible) {
        const positions = lineGeometry.getAttribute('position');
        activePoints.forEach((point, i) => positions.setXYZ(i, point.x, point.y, point.z));
        positions.needsUpdate = true;
        lineGeometry.computeBoundingSphere();
        measureLine.computeLineDistances();
      }
      const anatomyFit = props.model.demo
        ? `${p.anatomy?.bone}/${p.anatomy?.ligament}/${cutaway?.id || ''}`
        : '';
      const isolated = isolationKey();
      if (
        lastArch !== p.arch ||
        lastRoots !== showRoots ||
        lastGums !== gums ||
        lastOpening !== opening ||
        lastAnatomyFit !== anatomyFit ||
        lastIsolation !== isolated
      ) {
        fit(currentView, !!cutaway);
        lastArch = p.arch;
        lastRoots = showRoots;
        lastGums = gums;
        lastOpening = opening;
        lastAnatomyFit = anatomyFit;
        lastIsolation = isolated;
      }
      if (pendingCamera) {
        // Drain residual orbit damping before assigning an exact undo snapshot.
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();
        camera.position.fromArray(pendingCamera.position);
        camera.up.fromArray(pendingCamera.up);
        camera.far = pendingCamera.far;
        controls.target.fromArray(pendingCamera.target);
        controls.maxDistance = pendingCamera.maxDistance;
        currentView = pendingCamera.view;
        camera.updateProjectionMatrix();
        controls.update();
        controls.enableDamping = damping;
        pendingCamera = null;
      }
      controls.update();
      inverseCamera.copy(camera.quaternion).invert();
      camera.updateMatrixWorld();
      anatomyOverlay.hidden = !cutaway;
      if (showLabels && !cutaway) {
        const anchors: ToothLabelAnchor[] = [];
        for (const [id, group] of groups)
          if (group.visible) {
            projected
              .copy(group.position)
              .add(new THREE.Vector3(0, toothArch(id) === 'lower' ? -6 : 6, 2))
              .project(camera);
            anchors.push({
              id,
              x: ((projected.x + 1) * renderWidth) / 2,
              y: ((1 - projected.y) * renderHeight) / 2,
              depth: projected.z,
              selected: selectedIds.includes(id),
              locked: !!p.lockedIds?.includes(id),
            });
          }
        for (const label of layoutToothLabels(anchors, renderWidth, renderHeight)) {
          const element = labels.get(label.id)!;
          element.style.display = 'block';
          element.style.transform = `translate(-50%, -50%) translate(${label.x}px,${label.y}px)`;
        }
      }
      anatomyCaption.textContent = p.anatomy?.ligament
        ? 'Schematic section · PDL enlarged for visibility · support tissues stay fixed'
        : 'Schematic section · support tissues stay fixed';
      anatomyLabels.forEach(item => {
        item.element.hidden = true;
        item.line.style.display = item.dot.style.display = 'none';
      });
      if (cutaway)
        for (const label of layoutAnatomyLabels(
          anatomyKit.labels,
          camera,
          container.clientWidth,
          container.clientHeight,
        )) {
          let item = anatomyLabels.get(label.name);
          if (!item) {
            const element = document.createElement('div');
            element.className = 'anatomy-label';
            element.textContent = label.name;
            anatomyOverlay.appendChild(element);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'),
              dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', '2.5');
            anatomyLines.append(line, dot);
            item = { element, line, dot };
            anatomyLabels.set(label.name, item);
          }
          const shown = label.depth > -1 && label.depth < 1;
          item.element.hidden = !shown;
          item.line.style.display = item.dot.style.display = shown ? '' : 'none';
          item.element.style.cssText = `left:${label.x}px;top:${label.y}px;width:${label.width}px;--tissue:${label.color}`;
          item.line.setAttribute(
            'x1',
            String(label.side === 'left' ? label.x + label.width : label.x),
          );
          item.line.setAttribute('y1', String(label.y + 14));
          item.line.setAttribute('x2', String(label.anchorX));
          item.line.setAttribute('y2', String(label.anchorY));
          item.line.setAttribute('stroke', label.color);
          item.dot.setAttribute('cx', String(label.anchorX));
          item.dot.setAttribute('cy', String(label.anchorY));
          item.dot.setAttribute('fill', label.color);
        }
      for (const [axis, vector] of [
        ['x', new THREE.Vector3(1, 0, 0)],
        ['y', new THREE.Vector3(0, 1, 0)],
        ['z', new THREE.Vector3(0, 0, 1)],
      ] as const) {
        const element = container.parentElement?.querySelector<HTMLElement>(`.axis-${axis}`);
        if (!element) continue;
        vector.applyQuaternion(inverseCamera);
        element.style.left = `${24 + vector.x * 20}px`;
        element.style.top = `${24 - vector.y * 20}px`;
      }
      // Screen-space occlusion is confined to opaque views: cutaway clipping and
      // transparent roots/overlays must never cast fictitious screen-space shadows.
      ao.enabled =
        !showRoots &&
        !ghost &&
        !cutaway &&
        !p.removableRetainer &&
        !p.anatomy?.bone &&
        !p.anatomy?.ligament &&
        !(workflow?.palate && p.arch !== 'lower') &&
        p.tool === 'orbit' &&
        !p.measureMode;
      try {
        composer.render();
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error('The 3D frame could not be rendered.');
        renderBarrier.fail(failure);
        setError(failure.message);
        return;
      }
      renderBarrier.rendered();
      if (snapshotRequested) {
        snapshotRequested = false;
        renderer.domElement.toBlob(blob => {
          if (blob) download('forma-teaching-view.png', blob, 'image/png');
          else if (!disposed)
            setError('The view could not be captured. Try taking the snapshot again.');
        }, 'image/png');
      }
      frame = requestAnimationFrame(render);
    }
    render();
    return () => {
      savedCamera.current = {
        model: props.model,
        position: camera.position.clone(),
        target: controls.target.clone(),
        up: camera.up.clone(),
        aspect: camera.aspect,
        far: camera.far,
        maxDistance: controls.maxDistance,
        view: currentView,
      };
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('start', onCameraInteraction);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      gizmo.detach();
      gizmo.dispose();
      attachments.forEach(mesh => mesh.geometry.dispose());
      anatomyKit.dispose();
      anatomyOverlay.remove();
      mechanicsKit.dispose();
      workflowKit.dispose();
      removableKit.dispose();
      kit.dispose();
      environment.dispose();
      backdrop.dispose();
      ao.dispose();
      scenePass.dispose();
      outputPass.dispose();
      composer.dispose();
      displayGeometry.forEach(geometry => geometry.dispose());
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.forEach(label => label.remove());
      [
        enamel,
        contourMaterial,
        lockedMaterial,
        contactMaterial,
        rootMaterial,
        ghostMaterial,
        gumMaterial,
        attachmentMaterial,
        markerMaterial,
        measureLine.material as THREE.Material,
        traceLines.material,
        curveLine.material,
        grid.material as THREE.Material,
      ].forEach(m => m.dispose());
      targetGeometry.dispose();
      targetMaterial.dispose();
      [
        grid.geometry,
        markerGeometry,
        lineGeometry,
        traceGeometry,
        curveGeometry,
        ...[...wireMeshes.values()].map(m => m.geometry),
      ].forEach(g => g.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional dep subset: the effect must not re-run on the excluded values
  }, [props.model]);
  return (
    <>
      <div
        ref={host}
        className={`three-canvas ${props.measureMode ? 'measuring' : ''}`}
        aria-label="Interactive orthodontic model. Drag to orbit, shift-click to multi-select, or use the tooth chart."
        role="img"
      />
      <div ref={labelsHost} className="tooth-labels" />
      {error && (
        <div className="viewer-error" role="alert">
          {error}
        </div>
      )}
    </>
  );
});
export default Viewer;
