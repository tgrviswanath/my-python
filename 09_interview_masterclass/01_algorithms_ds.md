# Algorithms & Data Structures in Python

## 1. Sorting Algorithms

### Bubble Sort — O(n²) time, O(1) space

```python
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:  # optimization: already sorted
            break
    return arr

# Test
print(bubble_sort([64, 34, 25, 12, 22, 11, 90]))
# [11, 12, 22, 25, 34, 64, 90]
```

### Selection Sort — O(n²) time, O(1) space

```python
def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr
```

### Insertion Sort — O(n²) time, O(1) space; O(n) for nearly sorted

```python
def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
```

### Merge Sort — O(n log n) time, O(n) space

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
# [3, 9, 10, 27, 38, 43, 82]
```

### Quick Sort — O(n log n) avg, O(n²) worst, O(log n) space

```python
def quick_sort(arr, low=0, high=None):
    if high is None:
        high = len(arr) - 1
    if low < high:
        pivot_idx = partition(arr, low, high)
        quick_sort(arr, low, pivot_idx - 1)
        quick_sort(arr, pivot_idx + 1, high)
    return arr

def partition(arr, low, high):
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1
```

### Heap Sort — O(n log n) time, O(1) space

```python
def heap_sort(arr):
    n = len(arr)

    # Build max heap
    for i in range(n // 2 - 1, -1, -1):
        heapify(arr, n, i)

    # Extract elements from heap
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]
        heapify(arr, i, 0)
    return arr

def heapify(arr, n, i):
    largest = i
    left = 2 * i + 1
    right = 2 * i + 2

    if left < n and arr[left] > arr[largest]:
        largest = left
    if right < n and arr[right] > arr[largest]:
        largest = right

    if largest != i:
        arr[i], arr[largest] = arr[largest], arr[i]
        heapify(arr, n, largest)
```

### Sorting Complexity Summary

```
Algorithm      | Best     | Average  | Worst    | Space  | Stable
---------------|----------|----------|----------|--------|-------
Bubble Sort    | O(n)     | O(n²)    | O(n²)    | O(1)   | Yes
Selection Sort | O(n²)    | O(n²)    | O(n²)    | O(1)   | No
Insertion Sort | O(n)     | O(n²)    | O(n²)    | O(1)   | Yes
Merge Sort     | O(n lgn) | O(n lgn) | O(n lgn) | O(n)   | Yes
Quick Sort     | O(n lgn) | O(n lgn) | O(n²)    | O(lgn) | No
Heap Sort      | O(n lgn) | O(n lgn) | O(n lgn) | O(1)   | No
Python sorted()| O(n lgn) | O(n lgn) | O(n lgn) | O(n)   | Yes (Timsort)
```

---

## 2. Searching Algorithms

### Linear Search — O(n)

```python
def linear_search(arr, target):
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1
```

### Binary Search — O(log n), requires sorted array

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2  # avoid overflow
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

# Recursive version
def binary_search_recursive(arr, target, left=0, right=None):
    if right is None:
        right = len(arr) - 1
    if left > right:
        return -1
    mid = (left + right) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, right)
    else:
        return binary_search_recursive(arr, target, left, mid - 1)

# Using bisect module
import bisect
arr = [1, 3, 5, 7, 9, 11]
idx = bisect.bisect_left(arr, 7)  # 3
print(arr[idx] == 7)  # True
```

---

## 3. Data Structures

### Stack

```python
class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self._items.pop()

    def peek(self):
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self._items[-1]

    def is_empty(self):
        return len(self._items) == 0

    def size(self):
        return len(self._items)

    def __repr__(self):
        return f"Stack({self._items})"

# Use case: balanced parentheses
def is_balanced(s):
    stack = Stack()
    pairs = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in '({[':
            stack.push(char)
        elif char in ')}]':
            if stack.is_empty() or stack.pop() != pairs[char]:
                return False
    return stack.is_empty()

print(is_balanced("({[]})"))  # True
print(is_balanced("({[})"))   # False
```

### Queue

```python
from collections import deque

class Queue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, item):
        self._items.append(item)

    def dequeue(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self._items.popleft()  # O(1) with deque

    def peek(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self._items[0]

    def is_empty(self):
        return len(self._items) == 0

    def size(self):
        return len(self._items)
```

### Linked List

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class LinkedList:
    def __init__(self):
        self.head = None
        self._size = 0

    def append(self, val):
        node = ListNode(val)
        if not self.head:
            self.head = node
        else:
            curr = self.head
            while curr.next:
                curr = curr.next
            curr.next = node
        self._size += 1

    def prepend(self, val):
        node = ListNode(val, self.head)
        self.head = node
        self._size += 1

    def delete(self, val):
        if not self.head:
            return
        if self.head.val == val:
            self.head = self.head.next
            self._size -= 1
            return
        curr = self.head
        while curr.next:
            if curr.next.val == val:
                curr.next = curr.next.next
                self._size -= 1
                return
            curr = curr.next

    def to_list(self):
        result = []
        curr = self.head
        while curr:
            result.append(curr.val)
            curr = curr.next
        return result

    def reverse(self):
        prev = None
        curr = self.head
        while curr:
            next_node = curr.next
            curr.next = prev
            prev = curr
            curr = next_node
        self.head = prev

    def __len__(self):
        return self._size
```

### Binary Search Tree

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class BST:
    def __init__(self):
        self.root = None

    def insert(self, val):
        self.root = self._insert(self.root, val)

    def _insert(self, node, val):
        if not node:
            return TreeNode(val)
        if val < node.val:
            node.left = self._insert(node.left, val)
        elif val > node.val:
            node.right = self._insert(node.right, val)
        return node

    def search(self, val):
        return self._search(self.root, val)

    def _search(self, node, val):
        if not node or node.val == val:
            return node
        if val < node.val:
            return self._search(node.left, val)
        return self._search(node.right, val)

    def inorder(self):
        result = []
        self._inorder(self.root, result)
        return result

    def _inorder(self, node, result):
        if node:
            self._inorder(node.left, result)
            result.append(node.val)
            self._inorder(node.right, result)

    def height(self):
        return self._height(self.root)

    def _height(self, node):
        if not node:
            return 0
        return 1 + max(self._height(node.left), self._height(node.right))
```

### Heap (Min-Heap)

```python
import heapq

class MinHeap:
    def __init__(self):
        self._heap = []

    def push(self, val):
        heapq.heappush(self._heap, val)

    def pop(self):
        if not self._heap:
            raise IndexError("Heap is empty")
        return heapq.heappop(self._heap)

    def peek(self):
        if not self._heap:
            raise IndexError("Heap is empty")
        return self._heap[0]

    def __len__(self):
        return len(self._heap)

# Max heap using negation
class MaxHeap:
    def __init__(self):
        self._heap = []

    def push(self, val):
        heapq.heappush(self._heap, -val)

    def pop(self):
        return -heapq.heappop(self._heap)

    def peek(self):
        return -self._heap[0]

# K largest elements
def k_largest(nums, k):
    return heapq.nlargest(k, nums)

# K smallest elements
def k_smallest(nums, k):
    return heapq.nsmallest(k, nums)
```

---

## 4. Common Patterns

### Two Pointers

```python
# Two Sum (sorted array)
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        elif total < target:
            left += 1
        else:
            right -= 1
    return []

# Remove duplicates from sorted array
def remove_duplicates(nums):
    if not nums:
        return 0
    slow = 0
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]
    return slow + 1

# Reverse a string
def reverse_string(s):
    chars = list(s)
    left, right = 0, len(chars) - 1
    while left < right:
        chars[left], chars[right] = chars[right], chars[left]
        left += 1
        right -= 1
    return ''.join(chars)
```

### Sliding Window

```python
# Maximum sum subarray of size k
def max_sum_subarray(nums, k):
    if len(nums) < k:
        return 0
    window_sum = sum(nums[:k])
    max_sum = window_sum
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum

# Longest substring without repeating characters
def length_of_longest_substring(s):
    char_set = set()
    left = 0
    max_len = 0
    for right in range(len(s)):
        while s[right] in char_set:
            char_set.remove(s[left])
            left += 1
        char_set.add(s[right])
        max_len = max(max_len, right - left + 1)
    return max_len

print(length_of_longest_substring("abcabcbb"))  # 3
print(length_of_longest_substring("pwwkew"))    # 3
```

### Fast/Slow Pointers

```python
# Detect cycle in linked list
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False

# Find middle of linked list
def find_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
```

---

## 5. Interview Coding Problems

### Problem 1: Two Sum

```python
def two_sum(nums, target):
    """Find indices of two numbers that add to target. O(n) time, O(n) space."""
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
print(two_sum([3, 2, 4], 6))        # [1, 2]
```

### Problem 2: Valid Parentheses

```python
def is_valid(s):
    """Check if parentheses are balanced. O(n) time, O(n) space."""
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in '({[':
            stack.append(char)
        elif char in ')}]':
            if not stack or stack[-1] != pairs[char]:
                return False
            stack.pop()
    return len(stack) == 0

print(is_valid("()[]{}"))  # True
print(is_valid("([)]"))    # False
```

### Problem 3: Maximum Subarray (Kadane's Algorithm)

```python
def max_subarray(nums):
    """Find maximum sum contiguous subarray. O(n) time, O(1) space."""
    max_sum = current_sum = nums[0]
    for num in nums[1:]:
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)
    return max_sum

print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))  # 6
```

### Problem 4: Reverse Linked List

```python
def reverse_list(head):
    """Reverse a linked list. O(n) time, O(1) space."""
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
    return prev
```

### Problem 5: Binary Search

```python
def search(nums, target):
    """Binary search. O(log n) time, O(1) space."""
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

### Problem 6: Climbing Stairs (Dynamic Programming)

```python
def climb_stairs(n):
    """Count ways to climb n stairs (1 or 2 steps). O(n) time, O(1) space."""
    if n <= 2:
        return n
    prev2, prev1 = 1, 2
    for _ in range(3, n + 1):
        curr = prev1 + prev2
        prev2, prev1 = prev1, curr
    return prev1

print(climb_stairs(5))  # 8
```

### Problem 7: Valid Anagram

```python
from collections import Counter

def is_anagram(s, t):
    """Check if t is an anagram of s. O(n) time, O(1) space (26 chars)."""
    return Counter(s) == Counter(t)

# Alternative: sort
def is_anagram_sort(s, t):
    return sorted(s) == sorted(t)

print(is_anagram("anagram", "nagaram"))  # True
print(is_anagram("rat", "car"))          # False
```

### Problem 8: Merge Two Sorted Lists

```python
def merge_two_lists(l1, l2):
    """Merge two sorted linked lists. O(n+m) time, O(1) space."""
    dummy = ListNode(0)
    curr = dummy
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 or l2
    return dummy.next
```

### Problem 9: Number of Islands (BFS/DFS)

```python
def num_islands(grid):
    """Count islands using DFS. O(m*n) time and space."""
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '0'  # mark visited
        dfs(r + 1, c); dfs(r - 1, c)
        dfs(r, c + 1); dfs(r, c - 1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1
    return count

grid = [
    ['1','1','0','0','0'],
    ['1','1','0','0','0'],
    ['0','0','1','0','0'],
    ['0','0','0','1','1']
]
print(num_islands(grid))  # 3
```

### Problem 10: Longest Common Subsequence (DP)

```python
def lcs(text1, text2):
    """Longest common subsequence. O(m*n) time and space."""
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i-1] == text2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]

print(lcs("abcde", "ace"))  # 3
```

### Problem 11: Word Break (DP)

```python
def word_break(s, word_dict):
    """Check if s can be segmented using words in dict. O(n²) time."""
    word_set = set(word_dict)
    n = len(s)
    dp = [False] * (n + 1)
    dp[0] = True
    for i in range(1, n + 1):
        for j in range(i):
            if dp[j] and s[j:i] in word_set:
                dp[i] = True
                break
    return dp[n]

print(word_break("leetcode", ["leet", "code"]))  # True
```

### Problem 12: Coin Change (DP)

```python
def coin_change(coins, amount):
    """Minimum coins to make amount. O(amount * len(coins)) time."""
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for coin in coins:
        for x in range(coin, amount + 1):
            dp[x] = min(dp[x], dp[x - coin] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1

print(coin_change([1, 5, 11], 15))  # 3 (5+5+5)
print(coin_change([2], 3))          # -1
```

### Problem 13: Top K Frequent Elements

```python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    """Find k most frequent elements. O(n log k) time."""
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)

print(top_k_frequent([1,1,1,2,2,3], 2))  # [1, 2]
```

### Problem 14: Rotate Array

```python
def rotate(nums, k):
    """Rotate array right by k steps. O(n) time, O(1) space."""
    n = len(nums)
    k = k % n

    def reverse(left, right):
        while left < right:
            nums[left], nums[right] = nums[right], nums[left]
            left += 1
            right -= 1

    reverse(0, n - 1)
    reverse(0, k - 1)
    reverse(k, n - 1)

nums = [1, 2, 3, 4, 5, 6, 7]
rotate(nums, 3)
print(nums)  # [5, 6, 7, 1, 2, 3, 4]
```

### Problem 15: Trapping Rain Water

```python
def trap(height):
    """Calculate trapped rain water. O(n) time, O(1) space."""
    left, right = 0, len(height) - 1
    left_max = right_max = 0
    water = 0
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                water += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                water += right_max - height[right]
            right -= 1
    return water

print(trap([0,1,0,2,1,0,1,3,2,1,2,1]))  # 6
```
