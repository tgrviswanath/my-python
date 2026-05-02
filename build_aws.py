import pathlib, os
BASE = pathlib.Path(r"D:\1.projects\AI\my-aws")

def w(rel, lines):
    p = BASE / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(lines), encoding="utf-8")
    print(f"  OK  {rel}")

print("Building AWS Cloud Mastery Repository...")

