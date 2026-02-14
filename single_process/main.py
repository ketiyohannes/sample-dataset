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