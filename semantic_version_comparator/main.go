package main

import "fmt"

func main() {
	fmt.Println("=== Semantic Version Comparator (run only, no assertions) ===\n")

	cases := []struct{ a, b string }{
		{"1.0.0", "1.0.0"},
		{"1.2.3", "1.2.4"},
		{"2.0.0", "1.9.9"},
		{"1.0", "1.0.0"},
		{"1.0.0-alpha", "1.0.0"},
		{"", "1.0.0"},
		{"1", "1.0.1"},
	}

	for _, tc := range cases {
		result := Compare(tc.a, tc.b)
		fmt.Printf("Compare(%q, %q) = %d\n", tc.a, tc.b, result)
	}
}