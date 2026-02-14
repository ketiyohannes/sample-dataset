The provided Python script implements a deterministic, single-process data processing workflow that loads a collection of records, performs string normalization and aggregation, computes summary statistics, and prints a formatted report to standard output. The script uses only the Python standard library and performs all work in memory. While functionally correct, the implementation is intentionally inefficient and poorly structured.

Your task is to refactor and optimize the script while preserving its externally observable behavior. The optimized version must significantly reduce algorithmic time complexity from quadratic or cubic behavior to linear or near-linear where feasible, and reduce memory overhead by eliminating redundant data structures and repeated computations. Specifically: name normalization must run in O(n) time instead of O(n²), statistics computation must use a single pass over the records in O(n) instead of a nested O(n²) self-join, report generation must use join-based string assembly instead of repeated O(n·m²) concatenation, and report analysis must compute character-pair occurrences in O(n) using frequency counting instead of the O(n²) double loop. Performance improvements should explicitly address time complexity, space complexity, allocation behavior, and data traversal frequency. The refactored code must clearly separate data loading, processing, aggregation, and reporting into distinct, independently testable units. The final implementation must remain deterministic, free of third-party dependencies, and include a comprehensive test suite that validates correctness and performance characteristics.


Current Codebase:

import sys

GLOBAL_RECORDS = []
GLOBAL_NORMALIZED = []

def load_records():
    for i in range(400):
        GLOBAL_RECORDS.append({
            "id": i,
            "name": "Record_" + str(i),
            "value": i % 7
        })

def normalize_names():
    for record in GLOBAL_RECORDS:
        name = record["name"]
        new_name = ""
        for ch in name:
            new_name = new_name + ch.lower()
        GLOBAL_NORMALIZED.append(new_name)

        for existing in GLOBAL_NORMALIZED:
            if existing == new_name:
                pass

def compute_statistics():
    total = 0
    count = 0

    for record in GLOBAL_RECORDS:
        for record2 in GLOBAL_RECORDS:
            if record["id"] == record2["id"]:
                total = total + record["value"]
                count = count + 1

    return total, count

def generate_report(total, count):
    report = ""

    for name in GLOBAL_NORMALIZED:
        for ch in name:
            report = report + ch

    report = report + "\nTOTAL=" + str(total)
    report = report + "\nCOUNT=" + str(count)

    return report

def analyze_report(report):
    occurrences = 0

    for i in range(len(report)):
        for j in range(len(report)):
            if report[i] == report[j]:
                occurrences = occurrences + 1

    if occurrences > 0:
        print("Analysis count:", occurrences)

def main():
    print("Starting analysis...")

    load_records()
    normalize_names()
    total, count = compute_statistics()
    report = generate_report(total, count)
    print(report)
    analyze_report(report)

    print("Analysis finished.")

if __name__ == "__main__":
    main()


Constraints
Implementation language: Python. No third-party libraries, no concurrency, no caching layers, no external frameworks — standard library only.

Shared mutable globals (GLOBAL_RECORDS, GLOBAL_NORMALIZED) must be removed or tightly scoped; functions must accept inputs and return outputs.

The unused `import sys` and all dead code or no-op loops must be removed.
All string assembly must use join or equivalent — no repeated concatenation in loops.

Memory usage must scale linearly with input size; no redundant intermediate data structures.

Definition of done
The refactored script produces byte-identical console output to the original.
Every function runs at its target complexity: load O(n), normalize O(n), statistics O(n), report O(n), analysis O(n).
Each processing stage is independently testable with no shared mutable state.
A comprehensive test suite passes and validates all of the above.
No runtime errors or warnings.

Requirements

The refactored script must produce identical console output, including content, ordering, and formatting, to the original script.

Name normalization must run in O(n) time by removing the inner scan of the normalized list and using str.lower() directly instead of character-by-character concatenation.

Statistics computation must use a single O(n) pass over the records instead of the O(n²) nested self-join.

Report generation must use join-based string assembly instead of repeated concatenation, reducing complexity from O(n·m²) to O(n·m).

Report analysis must compute the character-pair occurrence count in O(n) using character frequency counting instead of the O(n²) double loop.

Shared mutable state (GLOBAL_RECORDS, GLOBAL_NORMALIZED) must be eliminated; all functions must accept inputs and return outputs to ensure deterministic execution and test isolation.

Intermediate data structures must be minimized so that memory usage scales linearly with input size.

The refactored code must clearly separate data loading, processing, aggregation, and reporting logic into distinct functions that can be tested in isolation.

All redundant computations, dead code, and no-op loops must be removed.

The solution must rely exclusively on the Python standard library and must not introduce concurrency, caching layers, or external frameworks.

A comprehensive test suite must validate output correctness, verify that shared mutable state is eliminated, and confirm that each processing stage can be tested in isolation.