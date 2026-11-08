import * as THREE from 'three';

const RADIUS = 1.65;
const UP = new THREE.Vector3(0, 1, 0);

function decahedron() {
  const vertices = [];
  const top = new THREE.Vector3(0, RADIUS, 0);
  const bottom = new THREE.Vector3(0, -RADIUS, 0);
  const ring = Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5;
    return new THREE.Vector3(Math.cos(angle) * RADIUS, 0, Math.sin(angle) * RADIUS);
  });
  for (let i = 0; i < 5; i++) {
    for (const vertex of [top, ring[i], ring[(i + 1) % 5], bottom, ring[(i + 1) % 5], ring[i]]) {
      vertices.push(vertex.x, vertex.y, vertex.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function geometryFor(sides) {
  const geometry = {
    4: () => new THREE.TetrahedronGeometry(RADIUS, 0),
    6: () => new THREE.BoxGeometry(2.35, 2.35, 2.35),
    8: () => new THREE.OctahedronGeometry(RADIUS, 0),
    10: decahedron,
    12: () => new THREE.DodecahedronGeometry(RADIUS, 0),
    20: () => new THREE.IcosahedronGeometry(RADIUS, 0),
  }[sides]();
  if (geometry.index) {
    const expanded = geometry.toNonIndexed();
    geometry.dispose();
    return expanded;
  }
  return geometry;
}

export function groupedFaces(geometry) {
  const positions = geometry.getAttribute('position');
  const faces = [];
  for (let i = 0; i < positions.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i);
    const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.dot(center) < 0) normal.negate();
    const found = faces.find((face) => face.normal.dot(normal) > 0.999);
    if (found) { found.center.add(center); found.count++; }
    else faces.push({ normal, center, count: 1 });
  }
  return faces.map((face) => ({ normal: face.normal, center: face.center.divideScalar(face.count) }));
}

export function faceIndicesFor(sides, value) {
  return sides === 100
    ? [Math.floor(value / 10) % 10, value % 10]
    : [value - 1];
}

function numberTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff0d4';
  context.font = `bold ${String(value).length > 2 ? 110 : String(value).length > 1 ? 138 : 165}px Georgia, serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#ffffff55';
  context.shadowBlur = 10;
  context.fillText(String(value), 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function model(sides, labels) {
  const geometry = geometryFor(sides);
  const faces = groupedFaces(geometry);
  if (faces.length !== labels.length) throw new Error(`D${sides}: faces incorretas`);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x6740a4, metalness: 0.32, roughness: 0.30, flatShading: true, side: THREE.DoubleSide,
  })));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xffd69a, transparent: true, opacity: 0.95 })));
  faces.forEach((face, index) => {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(labels[index] === '00' ? 0.82 : 0.73, 0.73),
      new THREE.MeshBasicMaterial({ map: numberTexture(labels[index]), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    label.position.copy(face.center).addScaledVector(face.normal, 0.03);
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
    group.add(label);
  });
  group.rotation.set(0.18, 0.48, 0.12);
  return { group, faces, settled: false };
}

export function createDiceStage(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 5.1, 8.2);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.AmbientLight(0xa8a4e6, 2));
  const key = new THREE.DirectionalLight(0xffdfae, 5);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9877ec, 4);
  rim.position.set(5, 2, -4);
  scene.add(rim);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.55;
    container.append(renderer.domElement);
  } catch {
    const fallback = document.createElement('div');
    fallback.textContent = '✦ DADOS ✦';
    fallback.style.cssText = 'height:100%;display:grid;place-items:center;font:700 58px Cinzel,serif;color:#d7ad77';
    container.append(fallback);
  }

  let currentSides = 0;
  let models = [];
  let animation = null;

  function disposeModel(entry) {
    scene.remove(entry.group);
    entry.group.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
      }
    });
  }

  function setDice(sides) {
    if (currentSides === sides) return;
    models.forEach(disposeModel);
    animation = null;
    if (sides === 100) {
      models = [model(10, ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90']), model(10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])];
      models[0].group.position.x = -1.15;
      models[1].group.position.x = 1.15;
      models.forEach((entry) => entry.group.scale.setScalar(0.75));
    } else {
      models = [model(sides, Array.from({ length: sides }, (_, i) => i + 1))];
    }
    models.forEach((entry) => scene.add(entry.group));
    currentSides = sides;
  }

  function target(entry, index) {
    return new THREE.Quaternion().setFromUnitVectors(entry.faces[index].normal, UP)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(UP, 0.25));
  }

  function settle(sides, value) {
    setDice(sides);
    animation = null;
    const indices = faceIndicesFor(sides, value);
    models.forEach((entry, i) => {
      entry.group.quaternion.copy(target(entry, indices[i]));
      entry.group.position.y = 0;
      entry.settled = true;
    });
  }

  function roll(sides, value, duration) {
    setDice(sides);
    const indices = faceIndicesFor(sides, value);
    animation = {
      start: performance.now(),
      duration: Math.max(150, duration),
      entries: models.map((entry, i) => ({ entry, from: entry.group.quaternion.clone(), to: target(entry, indices[i]) })),
    };
    models.forEach((entry) => { entry.settled = false; });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!renderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width && height && (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio()))) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    if (animation) {
      const t = Math.min((now - animation.start) / animation.duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      animation.entries.forEach(({ entry, from, to }, i) => {
        entry.group.quaternion.copy(from).slerp(to, ease);
        const spin = (1 - ease) * Math.PI * (8 + i);
        entry.group.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin * 0.65, spin, spin * 0.28)));
        entry.group.position.y = Math.sin(Math.PI * t) * 0.55;
      });
      if (t === 1) {
        animation.entries.forEach(({ entry, to }) => { entry.group.quaternion.copy(to); entry.group.position.y = 0; entry.settled = true; });
        animation = null;
      }
    } else if (currentSides) {
      models.forEach((entry, i) => {
        if (!entry.settled) entry.group.rotation.y += 0.0022 * (i % 2 ? -1 : 1);
      });
    }
    renderer.render(scene, camera);
  }

  setDice(20);
  requestAnimationFrame(frame);
  return { setDice, roll, settle };
}
