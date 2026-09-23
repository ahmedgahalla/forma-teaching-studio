import { describe, expect, it } from "vitest";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import { addMovement, addOrthodonticRotation, addRotation, anatomicalFrame, applyDentalCommand, emptyPose, isPose, resolveMovement, type Pose, type Tooth, type Transforms, type Vec3 } from "./model";

const tooth: Tooth = {
  id: "11", name: "Upper right central incisor", position: [4, 3, 20],
  buccal: [3, 0, 4], mesial: [-4, 0, 3], calibrated: true,
};

describe("millimetre movement in the case frame", () => {
  it("moves exactly the requested distance even when a stored direction is not normalized", () => {
    const displacement = resolveMovement(tooth, "buccal", 1);
    expect(displacement).toEqual([0.6, 0, 0.8]);
    expect(Math.hypot(...displacement)).toBeCloseTo(1, 12);
    expect(tooth.position).toEqual([4, 3, 20]);
  });

  it("makes opposing directions cancel", () => {
    for (const [forward, backward] of [["buccal", "lingual"], ["mesial", "distal"], ["intrude", "extrude"]] as const) {
      const moved = addMovement(emptyPose(), resolveMovement(tooth, forward, 1.5));
      expect(addMovement(moved, resolveMovement(tooth, backward, 1.5)).translation).toEqual([0, 0, 0]);
    }
  });

  it("retains the v1 demo's occlusal Y direction when no axis is stored", () => {
    expect(resolveMovement(tooth, "intrude", 2)).toEqual([0, -2, 0]);
    expect(resolveMovement(tooth, "extrude", 2)).toEqual([0, 2, 0]);
  });

  it("requires calibration for every anatomical direction, while allowing world axes", () => {
    const imported = { ...tooth, calibrated: false };
    for (const direction of ["buccal", "lingual", "mesial", "distal", "intrude", "extrude"] as const) {
      expect(() => resolveMovement(imported, direction, 1)).toThrow(/calibrated/);
    }
    expect(resolveMovement(imported, "x", -1)).toEqual([-1, 0, 0]);
    expect(resolveMovement(imported, "y", 2)).toEqual([0, 2, 0]);
    expect(resolveMovement(imported, "z", 3)).toEqual([0, 0, 3]);
  });

  it("rejects invalid amounts and invalid direction vectors", () => {
    for (const amount of [NaN, Infinity, -Infinity]) expect(() => resolveMovement(tooth, "x", amount)).toThrow();
    expect(() => resolveMovement({ ...tooth, buccal: [0, 0, 0] }, "buccal", 1)).toThrow();
    expect(() => resolveMovement({ ...tooth, mesial: [NaN, 0, 1] }, "mesial", 1)).toThrow();
    expect(() => resolveMovement(tooth, "unknown" as "x", 1)).toThrow(/Unsupported/);
  });
});

describe("anatomical frames and orthodontic rotations", () => {
  const upper: Tooth = { ...tooth, buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, -1, 0] };
  const lower: Tooth = { ...upper, id: "41", occlusal: [0, 1, 0] };
  const quaternion = (pose: Pose) => new Quaternion().setFromEuler(new Euler(...pose.rotation.map(MathUtils.degToRad) as Vec3, "XYZ"));
  const expectSameRotation = (a: Quaternion, b: Quaternion) => expect(Math.abs(a.dot(b))).toBeCloseTo(1, 10);

  it("extrudes upper and lower teeth toward the occlusal plane", () => {
    expect(resolveMovement(upper, "extrude", 0.5)).toEqual([0, -0.5, 0]);
    expect(resolveMovement(lower, "extrude", 0.5)).toEqual([0, 0.5, 0]);
    expect(resolveMovement(upper, "intrude", 0.5)).toEqual([0, 0.5, 0]);
    expect(resolveMovement(lower, "intrude", 0.5)).toEqual([0, -0.5, 0]);
  });

  it("normalizes imported frames but rejects skew or invalid axes", () => {
    expect(anatomicalFrame({ ...upper, occlusal: [0, -2, 0] }).occlusal).toEqual([0, -1, 0]);
    for (const bad of [
      { ...upper, buccal: [0, 0, 0] as Vec3 },
      { ...upper, mesial: [1, 0, 1] as Vec3 },
      { ...upper, occlusal: [1, -1, 0] as Vec3 },
      { ...upper, occlusal: [0, Infinity, 0] as Vec3 },
      { ...upper, calibrated: false },
    ]) {
      expect(() => resolveMovement(bad, "buccal", 1)).toThrow();
      expect(() => addOrthodonticRotation(emptyPose(), bad, "torque", 3)).toThrow();
      expect(resolveMovement(bad, "x", 1)).toEqual([1, 0, 0]);
    }
  });

  it("uses the declared local tip, torque and long axes and preserves translation", () => {
    for (const [movement, axis] of [["tip", upper.buccal], ["torque", upper.mesial], ["rotate", upper.occlusal!]] as const) {
      const original = { translation: [1, 2, 3] as Vec3, rotation: [0, 0, 0] as Vec3 };
      const rotated = addOrthodonticRotation(original, upper, movement, 30);
      expectSameRotation(quaternion(rotated), new Quaternion().setFromAxisAngle(new Vector3(...axis), Math.PI / 6));
      expect(rotated.translation).toEqual(original.translation);
      expect(original.rotation).toEqual([0, 0, 0]);
    }
  });

  it("respects mirrored mesial frames and opposite upper/lower long axes", () => {
    const opposite = { ...upper, id: "21", mesial: [-1, 0, 0] as Vec3 };
    expectSameRotation(quaternion(addOrthodonticRotation(emptyPose(), opposite, "torque", 12)), quaternion(addOrthodonticRotation(emptyPose(), upper, "torque", -12)));
    expectSameRotation(quaternion(addOrthodonticRotation(emptyPose(), lower, "rotate", 12)), quaternion(addOrthodonticRotation(emptyPose(), upper, "rotate", -12)));
  });

  it("composes in command order around fixed reference axes, including an exact inverse sequence", () => {
    const tipped = addOrthodonticRotation(emptyPose(), upper, "tip", 25);
    const torqued = addOrthodonticRotation(tipped, upper, "torque", -17);
    const rotated = addOrthodonticRotation(torqued, upper, "rotate", 42);
    const expected = new Quaternion().setFromAxisAngle(new Vector3(...upper.occlusal!), MathUtils.degToRad(42))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(...upper.mesial), MathUtils.degToRad(-17)))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(...upper.buccal), MathUtils.degToRad(25)));
    expectSameRotation(quaternion(rotated), expected);
    const otherOrder = addOrthodonticRotation(addOrthodonticRotation(emptyPose(), upper, "torque", -17), upper, "tip", 25);
    expect(Math.abs(quaternion(torqued).dot(quaternion(otherOrder)))).toBeLessThan(0.9999);
    const restored = addOrthodonticRotation(addOrthodonticRotation(addOrthodonticRotation(rotated, upper, "rotate", -42), upper, "torque", 17), upper, "tip", -25);
    expectSameRotation(quaternion(restored), new Quaternion());
  });

  it("also composes explicit world rotations about fixed axes after mixed movements", () => {
    const initial = addMovement(emptyPose(), [1, 2, 3]);
    const result = addRotation(addRotation(initial, "z", 35), "x", -22);
    const expected = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(-22))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(35)));
    expectSameRotation(quaternion(result), expected);
    const inverse = addRotation(addRotation(result, "x", 22), "z", -35);
    expectSameRotation(quaternion(inverse), new Quaternion());
    expect(inverse.translation).toEqual([1, 2, 3]);
    // Euler triples remain the saved representation; existing v1 poses retain their orientation.
    const saved: Pose = { translation: [0, 0, 0], rotation: [17, -31, 42] };
    const incremented = addRotation(saved, "y", 10);
    expectSameRotation(quaternion(incremented), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(10)).multiply(quaternion(saved)));
  });
});

describe("atomic whole-selection operations", () => {
  const teeth: Tooth[] = [
    { ...tooth, id: "11", buccal: [-0.6, 0, 0.8], mesial: [0.8, 0, 0.6], occlusal: [0, -1, 0] },
    { ...tooth, id: "21", buccal: [0.6, 0, 0.8], mesial: [-0.8, 0, 0.6], occlusal: [0, -1, 0] },
  ];

  it("moves every selected tooth the specified distance along its own reference direction", () => {
    const original: Transforms = { "11": emptyPose(), "21": emptyPose() };
    const result = applyDentalCommand(original, teeth, { type: "move_group", teeth: ["11", "21", "11"], direction: "buccal", amount: 1 });
    expect(result["11"].translation).toEqual([-0.6, 0, 0.8]);
    expect(result["21"].translation).toEqual([0.6, 0, 0.8]);
    for (const pose of Object.values(result)) expect(Math.hypot(...pose.translation)).toBeCloseTo(1, 12);
    expect(original).toEqual({ "11": emptyPose(), "21": emptyPose() });
  });

  it("does not mutate even the first tooth when a later selected tooth fails calibration", () => {
    const original: Transforms = { "11": addMovement(emptyPose(), [0.1, 0.2, 0.3]) };
    const saved = JSON.stringify(original);
    for (const command of [
      { type: "move_group" as const, teeth: ["11", "21"], direction: "buccal" as const, amount: 1 },
      { type: "orthodontic" as const, teeth: ["11", "21"], movement: "tip" as const, amount: 5 },
    ]) {
      expect(() => applyDentalCommand(original, [teeth[0], { ...teeth[1], calibrated: false }], command)).toThrow(/calibrated/);
      expect(JSON.stringify(original)).toBe(saved);
    }
  });

  it("rejects missing members, empty groups, invalid poses and out-of-range direct calls", () => {
    expect(() => applyDentalCommand({}, teeth, { type: "reset", teeth: ["11", "41"] })).toThrow(/not present/);
    expect(() => applyDentalCommand({}, teeth, { type: "reset", teeth: [] })).toThrow(/at least/);
    expect(() => applyDentalCommand({ "21": { translation: [0, NaN, 0], rotation: [0, 0, 0] } }, teeth, { type: "move_group", teeth: ["11", "21"], direction: "x", amount: 1 })).toThrow(/finite/);
    for (const amount of [0, 11, -11, Infinity, NaN]) expect(() => applyDentalCommand({}, teeth, { type: "move_group", teeth: ["11", "21"], direction: "x", amount })).toThrow();
    for (const amount of [0, 181, -181, Infinity, NaN]) expect(() => applyDentalCommand({}, teeth, { type: "orthodontic", teeth: ["11", "21"], movement: "torque", amount })).toThrow();
  });

  it("resets only requested teeth and handles group world rotation without requiring calibration", () => {
    const initial: Transforms = { "11": addMovement(emptyPose(), [1, 2, 3]), "21": addMovement(emptyPose(), [3, 2, 1]) };
    const reset = applyDentalCommand(initial, teeth, { type: "reset", teeth: ["11"] });
    expect(reset["11"]).toEqual(emptyPose());
    expect(reset["21"]).toEqual(initial["21"]);
    const rotated = applyDentalCommand(initial, teeth.map(t => ({ ...t, calibrated: false })), { type: "rotate_group", teeth: ["11", "21"], axis: "x", amount: 5 });
    expect(rotated["11"].rotation).toEqual([5, 0, 0]);
    expect(rotated["21"].rotation).toEqual([5, 0, 0]);
    expect(applyDentalCommand(initial, teeth, { type: "appliance", visible: true })).toBe(initial);
  });
});

describe("immutable poses for history", () => {
  it("keeps rotations and translations independent and preserves previous snapshots", () => {
    const original = emptyPose();
    const moved = addMovement(original, [1, 2, 3]);
    const rotated = addRotation(moved, "y", 5);
    expect(original).toEqual({ translation: [0, 0, 0], rotation: [0, 0, 0] });
    expect(moved).toEqual({ translation: [1, 2, 3], rotation: [0, 0, 0] });
    expect(rotated.translation).toEqual([1, 2, 3]);
    expect(rotated.rotation[0]).toBeCloseTo(0, 12);
    expect(rotated.rotation[1]).toBeCloseTo(5, 12);
    expect(rotated.rotation[2]).toBeCloseTo(0, 12);
    rotated.translation[0] = 99;
    rotated.rotation[0] = 99;
    expect(moved).toEqual({ translation: [1, 2, 3], rotation: [0, 0, 0] });
  });

  it("returns independent zero poses and rejects arithmetic overflow", () => {
    const first = emptyPose();
    first.translation[0] = 10;
    expect(emptyPose().translation).toEqual([0, 0, 0]);
    expect(() => addMovement({ translation: [Number.MAX_VALUE, 0, 0], rotation: [0, 0, 0] }, [Number.MAX_VALUE, 0, 0])).toThrow();
    expect(() => addRotation(emptyPose(), "x", Infinity)).toThrow();
  });

  it("validates complete saved poses and rejects corrupted input before an operation", () => {
    expect(isPose(emptyPose())).toBe(true);
    for (const value of [null, {}, { translation: [1, 2], rotation: [0, 0, 0] }, { translation: [0, 0, 0], rotation: ["1", 0, 0] }, { translation: [0, Infinity, 0], rotation: [0, 0, 0] }]) {
      expect(isPose(value)).toBe(false);
      expect(() => addMovement(value as Pose, [1, 0, 0])).toThrow();
      expect(() => addRotation(value as Pose, "x", 5)).toThrow();
    }
  });
});
