import type { Vec3 } from '../model';
export const add = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v + b[i]) as Vec3;
export const sub = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
export const scale = (a: Vec3, s: number): Vec3 => a.map(v => v * s) as Vec3;
export const dot = (a: Vec3, b: Vec3) => a.reduce((v, n, i) => v + n * b[i], 0);
export const norm = (a: Vec3) => Math.hypot(...a);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function unit(a: Vec3): Vec3 {
  const length = norm(a);
  if (length < 1e-9 || !Number.isFinite(length))
    throw new Error('A mechanical direction has zero or invalid length.');
  return scale(a, 1 / length);
}
export const zeros = (n: number) => Array.from({ length: n }, () => 0);
export const matrix = (n: number) => Array.from({ length: n }, () => zeros(n));
export function multiply(a: number[][], x: number[]) {
  return a.map(row => row.reduce((sum, v, j) => sum + v * x[j], 0));
}
/** Cholesky solve with diagonal equilibration; singular/indefinite systems are rejected. */
export function solvePositive(a: number[][], b: number[]): number[] {
  const n = b.length,
    diagonal = a.map((row, i) => Math.sqrt(row[i]));
  if (diagonal.some(v => !Number.isFinite(v) || v <= 0))
    throw new Error('The mechanical system is unconstrained or invalid.');
  const l = matrix(n),
    rhs = b.map((v, i) => v / diagonal[i]);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let value = a[i][j] / (diagonal[i] * diagonal[j]);
      for (let k = 0; k < j; k++) value -= l[i][k] * l[j][k];
      if (i === j) {
        if (value < 1e-12 || !Number.isFinite(value))
          throw new Error('The mechanical system is singular or unstable.');
        l[i][j] = Math.sqrt(value);
      } else l[i][j] = value / l[j][j];
    }
  const y = zeros(n),
    x = zeros(n);
  for (let i = 0; i < n; i++) {
    let value = rhs[i];
    for (let j = 0; j < i; j++) value -= l[i][j] * y[j];
    y[i] = value / l[i][i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let value = y[i];
    for (let j = i + 1; j < n; j++) value -= l[j][i] * x[j];
    x[i] = value / l[i][i];
  }
  return x.map((v, i) => v / diagonal[i]);
}
