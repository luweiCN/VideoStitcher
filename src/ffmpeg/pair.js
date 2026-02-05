function buildPairs(A, B) {
  const n = A.length;
  const m = B.length;
  if (n === 0 || m === 0) return [];

  const pairs = [];
  if (m >= n) {
    for (let i = 0; i < m; i++) {
      pairs.push({ a: A[i % n], b: B[i], index: i });
    }
  } else {
    for (let i = 0; i < n; i++) {
      pairs.push({ a: A[i], b: B[i % m], index: i });
    }
  }
  return pairs;
}

module.exports = { buildPairs };
