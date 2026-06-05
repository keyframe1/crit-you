"use client";

import * as THREE from "three";

// ─── Face-forward settle ─────────────────────────────────────────────────────
//
// The result number is a CSS overlay centred over the canvas (see
// components/ResultNumber), so a roll only reads cleanly if the die lands with a
// FACE flat-on to the camera — never an edge or a vertex pointing at the lens.
// These helpers compute the minimal final-pose correction that guarantees that:
// at the end of the tumble, pick the face whose normal is most camera-facing and
// rotate it to point exactly at the camera. PolyDie slerps to the result so the
// number stamps onto a settled flat face.

// The die's distinct face normals, in local (geometry) space. Three's polyhedron
// geometries are non-indexed, flat-shaded triangle soups, so every triangle of a
// multi-triangle face (e.g. a dodecahedron pentagon) carries the same normal; we
// dedupe by direction to get one normal per physical face. Computed once per die.
export function uniqueFaceNormals(geom: THREE.BufferGeometry): THREE.Vector3[] {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return [];
  const index = geom.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.lengthSq() < 1e-12) continue; // skip degenerate triangles
    n.normalize();
    let dup = false;
    for (const m of out) {
      if (m.dot(n) > 0.999) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(n.clone());
  }
  return out;
}

// Scratch objects reused across calls. Face-forward runs once per roll, on a
// single die at a time, so shared scratch is safe and keeps the roll allocation-
// free.
const _diePos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _adj = new THREE.Vector3();
const _best = new THREE.Vector3();
const _qCorr = new THREE.Quaternion();

// From the die's CURRENT orientation, find the face whose (mesh-scale-adjusted)
// normal is most aligned with the camera, then return the orientation that
// rotates that normal to point EXACTLY at the camera — the minimal rotation that
// rests a flat face flat-on to the lens. Writes into and returns `out`. If the
// normals aren't available yet, `out` is left at the current orientation (no-op).
export function faceForwardQuaternion(
  group: THREE.Object3D,
  localNormals: THREE.Vector3[],
  meshScale: [number, number, number] | undefined,
  camera: THREE.Camera,
  out: THREE.Quaternion
): THREE.Quaternion {
  out.copy(group.quaternion);
  if (localNormals.length === 0) return out;

  // World-space direction from the die's centre toward the camera. A face whose
  // normal aligns with this is perpendicular to the view ray through the centre,
  // i.e. flat-on to the lens.
  group.updateWorldMatrix(true, false);
  group.getWorldPosition(_diePos);
  _camDir.copy(camera.position).sub(_diePos).normalize();

  // A non-uniform mesh scale (the d10's taller body) skews face normals by the
  // inverse scale; we renormalise before orienting by the die's rotation.
  const sx = meshScale ? meshScale[0] : 1;
  const sy = meshScale ? meshScale[1] : 1;
  const sz = meshScale ? meshScale[2] : 1;

  let bestDot = -Infinity;
  for (const local of localNormals) {
    _adj.set(local.x / sx, local.y / sy, local.z / sz).normalize().applyQuaternion(group.quaternion);
    const d = _adj.dot(_camDir);
    if (d > bestDot) {
      bestDot = d;
      _best.copy(_adj);
    }
  }

  // The most camera-facing face has a positive dot for any convex solid, so this
  // is always a small (< 90°) correction and never the ill-conditioned 180° case.
  _qCorr.setFromUnitVectors(_best, _camDir);
  out.copy(_qCorr).multiply(group.quaternion);
  return out;
}
