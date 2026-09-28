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
import { createAttachmentGeometry } from '@/lib/attachments';
import { createApplianceKit, orderedArchIds, toothArch } from '@/lib/appliances';
import { LECTURE_CAMERA_MARGIN, perspectiveFitFrame } from '@/lib/camera-fit';
import { sameViewerGeometry } from '@/lib/viewer-model';
import { createWorkflowAppliances, workflowFixedVisibility } from '@/lib/workflow-appliances';
import { anatomyCutawayTooth, createTeachingAnatomy } from '@/lib/teaching-anatomy';
import { createRenderBarrier } from '@/lib/render-barrier';
import { createDentalMaterials } from '@/lib/viewer-materials';
import { observePixelRatio } from '@/lib/pixel-ratio';
import { createRemovableRetainer } from '@/lib/removable-retainer';
import { useStudioTheme } from '../shared/StudioTheme';
import {
  cameraViewDirection,
  displayedToothBounds,
  displayedFitPoints,
  isToothVisible,
} from '@/lib/viewer-presentation';
import './teaching-anatomy.css';
import './tooth-study-labels.css';
import { createToothStudyPresentation } from './tooth-study-presentation';
import { createToothLabelPresentation } from './tooth-label-presentation';
import { createAnatomyLabelPresentation } from './anatomy-label-presentation';
import { createPublicOverlaySource } from './public-overlays';
import { createCameraMotion } from './camera-motion';
import { createViewerResize } from './viewer-resize';
import { TOOTH_STUDY_CAMERA_MARGIN } from '@/lib/tooth-study/camera';
import { createToothPoseUpdater } from './tooth-pose';
import { createMovementTrailRenderer } from './movement-trail-renderer';
import {
  createSelectionFramingKey,
  createTeachingFocusMaterials,
  isTeachingSelected,
  teachingFocusActive,
  TEACHING_FOCUS_MARGIN,
} from './teaching-focus';

export type { ViewName, ArchView, ViewerCamera, ViewerHandle } from './viewer-types';
import type { ViewName, ViewerCamera, ViewerHandle, ViewerProps as Props } from './viewer-types';

const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(props, ref) {
  const { theme } = useStudioTheme();
  const liveTheme = useRef(theme);
  liveTheme.current = theme;
  const host = useRef<HTMLDivElement>(null),
    labelsHost = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const trailRenderer = useRef<ReturnType<typeof createMovementTrailRenderer> | null>(null);
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
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    let renderedTheme = liveTheme.current;
    const palette = dentalStagePalette[renderedTheme];
    renderer.setClearColor(palette.clear, 1);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000);
    const backdrop = dentalBackdrop(renderedTheme);
    scene.background = backdrop;
    scene.environmentIntensity = 0.55;
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
    const stopPixelRatio = observePixelRatio(window, ratio => {
      renderer.setPixelRatio(ratio);
      composer.setPixelRatio(ratio);
    });
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const controls = new OrbitControls(camera, renderer.domElement);
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cameraMotion = createCameraMotion(camera, controls, () => motionPreference.matches);
    const toothStudy = createToothStudyPresentation(
      props.model,
      labelContainer,
      camera,
      cameraMotion.move,
    );
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
    const {
      enamel,
      contourMaterial,
      lockedMaterial,
      contactMaterial,
      rootMaterial,
      ghostMaterial,
      gumMaterial,
      attachmentMaterial,
    } = createDentalMaterials(!!props.model.demo, renderedTheme);
    const focusMaterials = createTeachingFocusMaterials([
      enamel,
      rootMaterial,
      lockedMaterial,
      contactMaterial,
    ]);
    const kit = createApplianceKit();
    const workflowKit = createWorkflowAppliances(props.model);
    scene.add(workflowKit.group);
    const removableKit = createRemovableRetainer(props.model);
    scene.add(removableKit.group);
    const anatomyKit = createTeachingAnatomy(props.model);
    scene.add(anatomyKit.group);
    const anatomyLabels = createAnatomyLabelPresentation(container, camera);
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
    }
    const toothLabels = createToothLabelPresentation(
      props.model,
      groups,
      labelContainer,
      camera,
      (id, additive) => live.current.onSelect(id, additive),
    );
    const publicOverlays = createPublicOverlaySource(renderer.domElement, {
      teeth: toothLabels.labels,
      surfaces: toothStudy.labels,
      anatomy: anatomyLabels.labels,
    });
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
    const trails = createMovementTrailRenderer(camera);
    trails.setPalette(palette);
    trails.setTrail(live.current.movementTrail);
    trailRenderer.current = trails;
    scene.add(trails.group);
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
      focusMaterials.sync();
      ghostMaterial.color.set(next.ghost);
      ghostMaterial.opacity = next.ghostOpacity;
      markerMaterial.color.set(next.marker);
      measureLine.material.color.set(next.measurement);
      trails.setPalette(next);
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
      graphicsLost = false,
      restoringSavedStudy = !!restoreCamera,
      pendingCamera: ViewerCamera | null = null;
    const cancelCameraRestore = () => {
      pendingCamera = null;
    };
    const onCameraInteraction = () => {
      cancelCameraRestore();
      cameraMotion.cancel();
      live.current.onReferenceInteraction?.();
    };
    controls.addEventListener('start', onCameraInteraction);
    if (restoreCamera) {
      cameraMotion.move(
        {
          position: previousCamera.position.toArray(),
          target: previousCamera.target.toArray(),
          up: previousCamera.up.toArray(),
        },
        true,
      );
      camera.aspect = previousCamera.aspect;
      camera.far = previousCamera.far;
      controls.maxDistance = previousCamera.maxDistance;
      camera.updateProjectionMatrix();
    }
    const cutawayTooth = () =>
      anatomyCutawayTooth(props.model, live.current.anatomy, live.current.selected);
    const selection = () =>
      live.current.selectedIds.length ? live.current.selectedIds : [live.current.selected];
    const selectionKey = createSelectionFramingKey();
    const isolationKey = () => selectionKey(live.current);
    const focusSelection = () => teachingFocusActive(live.current, !!cutawayTooth());
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
    const visibleIds = (selectedOnly = false) =>
      props.model.teeth
        .filter(tooth => visible(tooth.id) && (!selectedOnly || selection().includes(tooth.id)))
        .map(tooth => tooth.id);
    const visiblePoints = (selectedOnly = false) =>
      cutawayTooth()
        ? undefined
        : displayedFitPoints(
            props.model,
            live.current.transforms,
            visibleIds(selectedOnly),
            live.current.roots,
            live.current.opening,
            !selectedOnly && live.current.gums && !live.current.isolateSelection,
          );
    const visibleBounds = (selectedOnly = false) => {
      const bounds = displayedToothBounds(
        props.model,
        live.current.transforms,
        visibleIds(selectedOnly),
        live.current.roots,
        live.current.opening,
      );
      // Exact visible tooth/gum points drive ordinary framing; cutaway uses support bounds.
      if (cutawayTooth()) bounds.union(anatomyKit.bounds);
      return bounds;
    };
    const positionCamera = (
      bounds: THREE.Box3,
      direction: THREE.Vector3,
      margin: Parameters<typeof perspectiveFitFrame>[5],
      up = camera.up,
      instant = false,
      selectedOnly = false,
    ) => {
      if (bounds.isEmpty()) return;
      direction.normalize();
      const framing = perspectiveFitFrame(
        bounds,
        direction,
        up,
        camera.fov,
        camera.aspect,
        margin,
        visiblePoints(selectedOnly),
      );
      const center = framing.target,
        distance = Math.max(controls.minDistance, framing.distance);
      controls.maxDistance = Math.max(3000, distance * 2);
      camera.far = Math.max(10000, distance * 4);
      camera.updateProjectionMatrix();
      cameraMotion.move(
        {
          position: center.clone().addScaledVector(direction, distance).toArray(),
          target: center.toArray(),
          up: up.toArray(),
        },
        instant,
      );
    };
    const fit = (view: ViewName, section = false, instant = false) => {
      currentView = view;
      const focused = focusSelection(),
        bounds = visibleBounds(focused);
      if (bounds.isEmpty()) return;
      const tooth = cutawayTooth();
      const direction =
        section && tooth
          ? new THREE.Vector3(...tooth.buccal).add(new THREE.Vector3(0.04, 0.06, 0))
          : cameraViewDirection(view, live.current.arch);
      positionCamera(
        bounds,
        direction,
        tooth ? 1.48 : focused ? TEACHING_FOCUS_MARGIN : LECTURE_CAMERA_MARGIN,
        new THREE.Vector3(0, 1, 0),
        instant,
        focused,
      );
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
        const { position, target, up } = cameraMotion.pose;
        positionCamera(visibleBounds(true), position.clone().sub(target), 1.25, up, false, true);
      },
      snapshot: () => {
        snapshotRequested = true;
      },
      getCamera: () => cameraMotion.read(currentView, pendingCamera),
      restoreCamera: value => {
        cameraMotion.cancel();
        pendingCamera = cameraMotion.read(currentView, value);
      },
    };
    const sizing = createViewerResize(
      container,
      camera,
      controls,
      renderer,
      composer,
      contourMaterial.uniforms.viewport.value,
      cameraMotion.finish,
      (direction, aspect) => {
        const focused = focusSelection(),
          bounds = visibleBounds(focused),
          study = live.current.toothStudy;
        return bounds.isEmpty()
          ? null
          : perspectiveFitFrame(
              bounds,
              direction,
              camera.up,
              camera.fov,
              aspect,
              study
                ? TOOTH_STUDY_CAMERA_MARGIN
                : focused
                  ? TEACHING_FOCUS_MARGIN
                  : LECTURE_CAMERA_MARGIN,
              study ? undefined : visiblePoints(focused),
            );
      },
    );
    sizing.resize();
    if (!restoreCamera) fit('perspective', !!cutawayTooth(), true);
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
      graphicsLost = true;
      const message = 'Graphics were interrupted. Save your case, then reload the viewer.';
      publicOverlays.clear();
      renderBarrier.fail(new Error(message));
      setError(message);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDrag);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    const inverseCamera = new THREE.Quaternion();
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
    const updateToothPose = createToothPoseUpdater(groups, ghosts, rootGhosts, roots);
    function render() {
      if (graphicsLost) return;
      if (live.current.paused) {
        frame = requestAnimationFrame(render);
        return;
      }
      updateStageTheme();
      // Resize before drawing, rather than letting a later ResizeObserver callback
      // change the camera after history has captured this frame.
      sizing.resize();
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
      const focused = teachingFocusActive(p, !!cutaway);
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
          faded = focused && !isTeachingSelected(p, tooth.id);
        group.visible = visible(tooth.id);
        updateToothPose(tooth, p);
        focusMaterials.apply(
          crowns.get(tooth.id)!,
          p.intersections.includes(tooth.id)
            ? contactMaterial
            : p.lockedIds?.includes(tooth.id)
              ? lockedMaterial
              : enamel,
          faded,
        );
        const contour = contours.get(tooth.id)!,
          highlighted = selectedIds.includes(tooth.id) || (!!cutaway && tooth.id === p.selected);
        contour.crown.visible = highlighted;
        if (contour.root) contour.root.visible = highlighted && showRoots;
        const root = roots.get(tooth.id);
        if (root) focusMaterials.apply(root, rootMaterial, faded);
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
      toothStudy.prepare(p.toothStudy, transforms, opening, !!pendingCamera || restoringSavedStudy);
      restoringSavedStudy = false;
      if (pendingCamera) {
        cameraMotion.move(pendingCamera, true);
        camera.far = pendingCamera.far;
        controls.maxDistance = pendingCamera.maxDistance;
        currentView = pendingCamera.view;
        camera.updateProjectionMatrix();
        pendingCamera = null;
      }
      cameraMotion.update();
      inverseCamera.copy(camera.quaternion).invert();
      camera.updateMatrixWorld();
      trails.update(
        p,
        groups.get(p.selected),
        sizing.width,
        sizing.height,
        dragging || !!p.toothStudy,
      );
      toothStudy.render(sizing.width, sizing.height);
      toothLabels.render(
        showLabels && !cutaway,
        selectedIds,
        p.lockedIds,
        sizing.width,
        sizing.height,
      );
      anatomyLabels.render(
        !!cutaway,
        anatomyKit.labels,
        !!p.anatomy?.ligament,
        container.clientWidth,
        container.clientHeight,
      );
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
        !focused &&
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
        publicOverlays.clear();
        renderBarrier.fail(failure);
        setError(failure.message);
        return;
      }
      if (graphicsLost) return;
      publicOverlays.frame.width = sizing.width;
      publicOverlays.frame.height = sizing.height;
      publicOverlays.frame.ready = true;
      publicOverlays.frame.studyCaption = toothStudy.caption;
      publicOverlays.frame.anatomyCaption = anatomyLabels.caption;
      publicOverlays.publish();
      renderBarrier.rendered(!cameraMotion.active);
      if (snapshotRequested && !cameraMotion.active) {
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
      cameraMotion.finish();
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
      sizing.dispose();
      stopPixelRatio();
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
      toothStudy.dispose();
      anatomyLabels.dispose();
      mechanicsKit.dispose();
      trails.dispose();
      if (trailRenderer.current === trails) trailRenderer.current = null;
      workflowKit.dispose();
      removableKit.dispose();
      kit.dispose();
      focusMaterials.dispose();
      environment.dispose();
      backdrop.dispose();
      ao.dispose();
      scenePass.dispose();
      outputPass.dispose();
      composer.dispose();
      displayGeometry.forEach(geometry => geometry.dispose());
      key.shadow.dispose();
      publicOverlays.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      toothLabels.dispose();
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
        curveLine.material,
        grid.material as THREE.Material,
      ].forEach(m => m.dispose());
      targetGeometry.dispose();
      targetMaterial.dispose();
      [
        grid.geometry,
        markerGeometry,
        lineGeometry,
        curveGeometry,
        ...[...wireMeshes.values()].map(m => m.geometry),
      ].forEach(g => g.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional dep subset: the effect must not re-run on the excluded values
  }, [props.model]);
  useEffect(() => {
    trailRenderer.current?.setTrail(props.movementTrail);
  }, [props.movementTrail]);
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
