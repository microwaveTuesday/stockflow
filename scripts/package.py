"""Create a clean shareable source archive using the repository's ignore rules."""
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root
).decode().split('\0')
output = root.parent / 'stockflow-source.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in sorted(set(files)):
        if name and (root / name).is_file():
            bundle.write(root / name, 'stockflow/' + name)
with zipfile.ZipFile(output) as bundle:
    assert not any('/.local/' in n or '/node_modules/' in n or '/bin/' in n or '/obj/' in n for n in bundle.namelist())
    assert bundle.testzip() is None
print(f'Created {output.name}: {output.stat().st_size:,} bytes, {len(set(files))-1} source entries')
