import "@testing-library/jest-dom/vitest";

// Vitest compares typed arrays element by element and formats a diff on
// mismatch. Several tests compare retained multi-megabyte Buffers with
// toEqual, which pushed a worker past 3 GB of heap in the acceptance lane.
// Compare same-type byte views with one native memcmp instead.
const byteTag = (value: unknown) => ArrayBuffer.isView(value) && !(value instanceof DataView) ? Object.prototype.toString.call(value) : null;
expect.addEqualityTesters([
  (left: unknown, right: unknown) => {
    const leftTag = byteTag(left), rightTag = byteTag(right);
    if (leftTag === null || rightTag === null) return undefined;
    if (leftTag !== rightTag) return false;
    const a = left as ArrayBufferView, b = right as ArrayBufferView;
    return a.byteLength === b.byteLength && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
  },
]);
