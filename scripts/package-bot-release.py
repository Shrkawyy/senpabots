"""Package full source without local evidence backups, session files or caches."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / 'SenpaBots_BotAccounts_Follow_Fixed_Nov13.zip'
EXCLUDED_PARTS = {'node_modules', '.git', '__pycache__', '.pytest_cache', '.test'}
ALLOWED_ARTIFACTS = {
    'baseline.json', 'tests-before.txt', 'tests.txt', 'browser-recovery-report.json',
    'browser-verification-report.json', 'validation-report.json', 'rea-findings.json',
    'account-capacity.png',
}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    report = json.loads((ROOT / 'BOT-FIX-VALIDATION-NOV13.json').read_text(encoding='utf-8'))
    assert report['passed'] and not report['liveServerAcceptanceTested']
    files = []
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        if path.name.startswith('.env') or path.name in {'relay.cookie.json', 'relay.config.json', 'RELEASE-SHA256-NOV13.json'}:
            continue
        if rel.parts[0] == 'artifacts' and not (
            rel.parent.as_posix() == 'artifacts/bot-fix-nov13' and path.name in ALLOWED_ARTIFACTS
        ):
            continue
        files.append(path)
    files.sort()
    manifest = {path.relative_to(ROOT).as_posix(): digest(path) for path in files}
    manifest_text = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'RELEASE-SHA256-NOV13.json').write_text(manifest_text, encoding='utf-8')
    with zipfile.ZipFile(OUTPUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, 'senpabots-main/' + path.relative_to(ROOT).as_posix())
        archive.writestr('senpabots-main/RELEASE-SHA256-NOV13.json', manifest_text)
    with zipfile.ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        for name, expected in manifest.items():
            assert hashlib.sha256(archive.read('senpabots-main/' + name)).hexdigest() == expected
    sha = digest(OUTPUT)
    OUTPUT.with_suffix('.zip.sha256').write_text(sha + '  ' + OUTPUT.name + '\n', encoding='ascii')
    print(json.dumps({'archive': str(OUTPUT), 'files': len(files) + 1, 'bytes': OUTPUT.stat().st_size, 'sha256': sha}))


if __name__ == '__main__':
    main()
