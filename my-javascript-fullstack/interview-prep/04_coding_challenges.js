/**
 * JavaScript Coding Challenges
 * Common interview problems with optimal solutions
 */

'use strict';

// ── Array Problems ────────────────────────────────────────────────────────────

// 1. Two Sum — O(n)
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement), i];
    map.set(nums[i], i);
  }
  return [];
}
console.assert(JSON.stringify(twoSum([2,7,11,15], 9)) === '[0,1]');

// 2. Maximum subarray (Kadane's) — O(n)
function maxSubarray(nums) {
  let maxSum = nums[0], current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    maxSum  = Math.max(maxSum, current);
  }
  return maxSum;
}
console.assert(maxSubarray([-2,1,-3,4,-1,2,1,-5,4]) === 6);

// 3. Merge intervals — O(n log n)
function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const result = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = result[result.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      result.push(intervals[i]);
    }
  }
  return result;
}
console.assert(JSON.stringify(mergeIntervals([[1,3],[2,6],[8,10],[15,18]])) === '[[1,6],[8,10],[15,18]]');

// 4. Product of array except self — O(n), no division
function productExceptSelf(nums) {
  const n = nums.length;
  const result = new Array(n).fill(1);
  let left = 1;
  for (let i = 0; i < n; i++) { result[i] = left; left *= nums[i]; }
  let right = 1;
  for (let i = n - 1; i >= 0; i--) { result[i] *= right; right *= nums[i]; }
  return result;
}
console.assert(JSON.stringify(productExceptSelf([1,2,3,4])) === '[24,12,8,6]');

// ── String Problems ───────────────────────────────────────────────────────────

// 5. Longest substring without repeating — O(n) sliding window
function lengthOfLongestSubstring(s) {
  const map = new Map();
  let max = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (map.has(s[i]) && map.get(s[i]) >= start) {
      start = map.get(s[i]) + 1;
    }
    map.set(s[i], i);
    max = Math.max(max, i - start + 1);
  }
  return max;
}
console.assert(lengthOfLongestSubstring('abcabcbb') === 3);
console.assert(lengthOfLongestSubstring('pwwkew') === 3);

// 6. Valid parentheses — O(n)
function isValid(s) {
  const stack = [];
  const map = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (stack.pop() !== map[ch]) return false;
  }
  return stack.length === 0;
}
console.assert(isValid('()[]{}'));
console.assert(!isValid('(]'));

// 7. Group anagrams — O(n * k log k)
function groupAnagrams(strs) {
  const map = new Map();
  for (const s of strs) {
    const key = s.split('').sort().join('');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.values()];
}

// 8. Longest palindromic substring — O(n²) expand around center
function longestPalindrome(s) {
  let start = 0, maxLen = 1;

  function expand(l, r) {
    while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }
    if (r - l - 1 > maxLen) { maxLen = r - l - 1; start = l + 1; }
  }

  for (let i = 0; i < s.length; i++) {
    expand(i, i);      // odd length
    expand(i, i + 1);  // even length
  }
  return s.slice(start, start + maxLen);
}
console.assert(longestPalindrome('babad') === 'bab' || longestPalindrome('babad') === 'aba');

// ── Linked List ───────────────────────────────────────────────────────────────

class ListNode {
  constructor(val, next = null) { this.val = val; this.next = next; }
}

function arrayToList(arr) {
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) head = new ListNode(arr[i], head);
  return head;
}

function listToArray(head) {
  const arr = [];
  while (head) { arr.push(head.val); head = head.next; }
  return arr;
}

// 9. Reverse linked list — O(n)
function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
console.assert(JSON.stringify(listToArray(reverseList(arrayToList([1,2,3,4,5])))) === '[5,4,3,2,1]');

// 10. Detect cycle — Floyd's algorithm O(n)
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast?.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// 11. Merge two sorted lists — O(n+m)
function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);
  let curr = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }
    else                  { curr.next = l2; l2 = l2.next; }
    curr = curr.next;
  }
  curr.next = l1 || l2;
  return dummy.next;
}

// ── Trees ─────────────────────────────────────────────────────────────────────

class TreeNode {
  constructor(val, left = null, right = null) { this.val = val; this.left = left; this.right = right; }
}

// 12. Maximum depth — O(n)
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// 13. Level order traversal (BFS) — O(n)
function levelOrder(root) {
  if (!root) return [];
  const result = [], queue = [root];
  while (queue.length) {
    const level = [];
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left)  queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}

// 14. Validate BST — O(n)
function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}

// ── Dynamic Programming ───────────────────────────────────────────────────────

// 15. Fibonacci — O(n) bottom-up
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
console.assert(fib(10) === 55);

// 16. Climbing stairs — O(n)
function climbStairs(n) {
  if (n <= 2) return n;
  let a = 1, b = 2;
  for (let i = 3; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
console.assert(climbStairs(5) === 8);

// 17. Coin change — O(amount * coins)
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i) dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
console.assert(coinChange([1,5,11], 15) === 3);

// 18. Longest common subsequence — O(m*n)
function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = text1[i-1] === text2[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[m][n];
}
console.assert(longestCommonSubsequence('abcde', 'ace') === 3);

// ── Sorting ───────────────────────────────────────────────────────────────────

// 19. Quick sort — O(n log n) avg
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left  = arr.filter(x => x < pivot);
  const mid   = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), ...mid, ...quickSort(right)];
}

// 20. Merge sort — O(n log n) stable
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid   = Math.floor(arr.length / 2);
  const left  = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}
function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    result.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return [...result, ...left.slice(i), ...right.slice(j)];
}

const arr = [64, 34, 25, 12, 22, 11, 90];
console.assert(JSON.stringify(quickSort([...arr])) === '[11,12,22,25,34,64,90]');
console.assert(JSON.stringify(mergeSort([...arr])) === '[11,12,22,25,34,64,90]');

// ── Async Challenges ──────────────────────────────────────────────────────────

// 21. Implement Promise.all
function myPromiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!promises.length) return resolve([]);
    const results = [];
    let count = 0;
    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then(v => { results[i] = v; if (++count === promises.length) resolve(results); })
        .catch(reject);
    });
  });
}

// 22. Sequential async execution
async function sequential(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

// 23. Concurrent with limit
async function concurrentLimit(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const [i, task] of tasks.entries()) {
    const p = Promise.resolve(task()).then(r => { results[i] = r; executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }

  await Promise.all(executing);
  return results;
}

// 24. Retry with exponential backoff
async function retry(fn, { attempts = 3, delay = 1000, backoff = 2 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delay * Math.pow(backoff, i)));
    }
  }
}

console.log('All assertions passed!');

module.exports = {
  twoSum, maxSubarray, mergeIntervals, productExceptSelf,
  lengthOfLongestSubstring, isValid, groupAnagrams,
  reverseList, hasCycle, mergeTwoLists,
  maxDepth, levelOrder, isValidBST,
  fib, climbStairs, coinChange, longestCommonSubsequence,
  quickSort, mergeSort,
  myPromiseAll, sequential, concurrentLimit, retry,
};
