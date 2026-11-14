"""Validate the Nov13 bot-only release against the user's original archive."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'artifacts' / 'bot-fix-nov13'
SOURCE = ROOT.parent / 'senpabots-main.zip'
PROTECTED = [
    'onyx-senpa-auth.js', 'onyx-bot-accounts.js', 'onyx-ffa-adapter.js',
    'onyx-ffa.js', 'deo.onyx.beautified.js', 'onyx-verification.js',
    'ffa/auth-bridge.js', 'ffa/auth-session-bridge.js', 'ffa/bundle.js',
]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    assert digest(SOURCE) == '966b6fe68715e88065d8c053edbd44c0e22c7d60f9f0d895aa211bcd74cf4984'
    protected, changes = {}, []
    with zipfile.ZipFile(SOURCE) as original:
        files = {}
        for member in original.infolist():
            if member.is_dir():
                continue
            name = member.filename
            if name.startswith('senpabots-main/'):
                name = name[len('senpabots-main/'):]
            files[name] = member
        protected_names = set(PROTECTED) | {name for name in files if name.endswith('.wasm')}
        for name in sorted(protected_names):
            source_hash = hashlib.sha256(original.read(files[name])).hexdigest()
            current_hash = digest(ROOT / name)
            assert source_hash == current_hash, f'Protected source changed: {name}'
            protected[name] = current_hash
        for name, member in files.items():
            current = ROOT / name
            if not current.is_file() or digest(current) != hashlib.sha256(original.read(member)).hexdigest():
                changes.append(name)

    syntax = [
        'onyx-bots.js', 'ffa/onyx-bot-protocol.js', 'ffa/onyx-bot-worker.js',
        'onyx-bot-codec.js', 'kateronyx.user.js', 'kateronyx-local.user.js',
        'scripts/build-codec.cjs', 'scripts/build-bots.cjs',
        'scripts/build-local-bots.cjs', 'scripts/serve-local.cjs',
    ]
    for name in syntax:
        subprocess.run(['node', '--check', str(ROOT / name)], check=True, capture_output=True)

    test_bytes = (ARTIFACTS / 'tests.txt').read_bytes()
    test_text = test_bytes.decode('utf-16' if test_bytes.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    assert re.search(r'pass\s+91\b', test_text) and re.search(r'fail\s+0\b', test_text)
    recovery = json.loads((ARTIFACTS / 'browser-recovery-report.json').read_text(encoding='utf-8'))
    assert recovery['passed'] and not recovery['pageErrors'] and len(recovery['results']) == 6
    verification = json.loads((ROOT / 'artifacts/browser-verification-report.json').read_text(encoding='utf-8'))
    assert len(verification['mainIndependentVerification']) == 2
    assert not verification['botBeforeServerAcceptance']['ready']
    assert verification['botSpawnAfterServerReady'] and not verification['pageErrors']
    (ARTIFACTS / 'browser-verification-report.json').write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')

    hosted = (ROOT / 'kateronyx.user.js').read_text(encoding='utf-8')
    local = (ROOT / 'kateronyx-local.user.js').read_text(encoding='utf-8')
    assert "var DEFAULT_BASE_URL = 'https://senpabots.vercel.app/';" in hosted
    assert "var DEFAULT_BASE_URL = 'http://127.0.0.1:3020/';" in local
    assert '// @updateURL    none' in local and '// @connect      127.0.0.1' in local
    for source in [hosted, local]:
        assert "var VERSION = '2.7.0';" in source
        assert 'diagnosticsSnapshot' in source and 'Spawn missing' in source
    with urllib.request.urlopen('http://127.0.0.1:3020/Onyx-Senpa-Local.user.js') as response:
        assert response.status == 200
        assert response.read() == (ROOT / 'kateronyx-local.user.js').read_bytes()
    with urllib.request.urlopen('http://127.0.0.1:3020/') as response:
        assert b'/Onyx-Senpa-Local.user.js' in response.read()

    report = {
        'version': '2.7.0', 'passed': True,
        'sourceArchive': SOURCE.name, 'sourceArchiveSha256': digest(SOURCE),
        'protectedFilesUnchanged': protected,
        'changedOriginalFiles': sorted(changes),
        'syntaxCheckedFiles': syntax,
        'nodeTests': {'passed': 91, 'failed': 0},
        'browserRecoveryCases': list(recovery['results']),
        'mainAndBotVerificationIsolation': True,
        'localInstallerMatchesBuiltFile': True,
        'liveServerAcceptanceTested': False,
        'limitations': [
            'Browser transport and verification providers are synthetic; no real Facebook login was used.',
            'Four bot characters require the live server to accept the granted slots and any extra connection.',
            'No external deployment was performed.',
        ],
    }
    data = json.dumps(report, indent=2) + '\n'
    (ARTIFACTS / 'validation-report.json').write_text(data, encoding='utf-8')
    (ROOT / 'BOT-FIX-VALIDATION-NOV13.json').write_text(data, encoding='utf-8')
    print(json.dumps({'passed': True, 'nodeTests': 91, 'browserCases': 6, 'protectedFiles': len(protected), 'changedOriginalFiles': sorted(changes)}))


if __name__ == '__main__':
    main()
