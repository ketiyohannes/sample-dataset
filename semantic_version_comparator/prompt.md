Write unit tests for a semantic version comparator in Go. The function compares two version strings (e.g. "1.2.3", "2.0.0") and returns -1 if a < b, 0 if equal, 1 if a > b. Stdlib only.

Focus your tests on standard version comparisons: test that equal versions return 0, older versions return -1, and newer versions return 1. Include tests for versions with different component counts where missing components are treated as zero (e.g., "1.0" equals "1.0.0" because missing patch is 0). Test that pre-release suffixes are stripped before comparison (e.g., "1.0.0-alpha" equals "1.0.0"). For invalid inputs, ensure the function handles them gracefully without panicking. Test a few common invalid cases like empty strings or versions with letters, but focus primarily on valid version comparisons.

Use one or more t.Run subtests with a single slice of {name, a, b, want int}; each case name must state the scenario and expected result (e.g. "equal_1.0.0_1.0.0_0" or "a_less_than_b_1.2.3_1.2.4_-1"). Group subtests by outcome: equals (0), less-than (-1), greater-than (1), then invalid/edge.

Constraints

Stdlib only — testing and standard library only; no third-party packages.
Do not change the implementation — Test Compare and parse as given; do not modify semver.go.
Table-driven only — All cases must come from a table (slice of structs); no ad-hoc t.Run with hardcoded single calls.
One assertion per case — Each row: call Compare(a, b), assert result equals want; no multiple checks per case.
Invalid inputs — For invalid/edge cases, tests must not panic (use recover or avoid calling Compare in a way that panics in the test framework).

Implementation:

// semver.go
package semver

import "strings"

func Compare(a, b string) int {
	partsA := parse(a)
	partsB := parse(b)
	limit := 3
	if len(partsA) < limit {
		limit = len(partsA)
	}
	if len(partsB) < limit {
		limit = len(partsB)
	}
	for i := 0; i < limit; i++ {
		va := 0
		vb := 0
		if i < len(partsA) {
			va = partsA[i]
		}
		if i < len(partsB) {
			vb = partsB[i]
		}
		if va < vb {
			return -1
		}
		if va > vb {
			return 1
		}
	}
	return 0
}

func parse(s string) []int {
	s = strings.TrimSpace(s)
	if idx := strings.Index(s, "-"); idx >= 0 {
		s = s[:idx]
	}
	parts := strings.Split(s, ".")
	var nums []int
	for _, p := range parts {
		n := 0
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			}
		}
		nums = append(nums, n)
	}
	return nums
}

Definition of done

Equality (0), less-than (-1), and greater-than (1) covered with representative version pairs.
Same version with different component lengths (e.g. "1.0" vs "1.0.0") treated as equal.
Prerelease suffix stripped; e.g. "1.0.0-alpha" compares equal to "1.0.0".
At least one invalid or edge input (empty, non-numeric) with defined, non-panicking behavior.
All of the above scenarios present in the table and passing.




Requirement

Implementation language: Go; stdlib only. Use the `testing` package for tests.

Tests must cover the comparator that returns -1 if a < b, 0 if equal, 1 if a > b.

Cases must use `t.Run` subtests; each case name must state the scenario and expected result.
  
Cases must be grouped by outcome: equals (0), less-than (-1), greater-than (1), then invalid/edge.

Implementation must not be changed; tests must exercise the provided code as given.

All cases must come from a table (slice of structs with name, a, b, want); no ad-hoc `t.Run` with hardcoded single calls. Each case must perform one call to `Compare(a, b)` and assert result equals `want`; no multiple assertions per case.

For invalid/edge cases, tests must not panic (use recover or avoid calling Compare in a way that panics in the test framework).

Equality (0), less-than (-1), and greater-than (1) must be covered with representative version pairs. Same version with different component lengths (e.g. "1.0" vs "1.0.0") must be treated as equal; missing components as zero.

Prerelease suffix (e.g. "1.0.0-alpha") must be stripped before comparison; numeric part must compare equal to "1.0.0".  At least one invalid or edge input (empty, non-numeric) must be tested with defined, non-panicking behavior.

All required scenarios must be covered and passing.