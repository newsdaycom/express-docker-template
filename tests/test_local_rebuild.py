"""Offline native-local rebuild contract tests; Docker calls and env loading are mocked.

Copies helper files into disposable directories; never builds images, starts
services, contacts a cluster or loads developer credentials. Run with unittest.
"""
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

MOCK = r'''#!/usr/bin/env bash
set -eu
printf '%s|ENV=%s|PLATFORM=%s|BUILDER=%s|BUILD_PLATFORMS=%s\n' "$*" "${ENV:-}" "${DOCKER_DEFAULT_PLATFORM:-}" "${BUILDX_BUILDER:-}" "${BUILD_PLATFORMS:-}" >> "$MOCK_LOG"
if [[ "${1:-}" == compose ]]; then
  shift
  while [[ "${1:-}" == -p || "${1:-}" == --profile ]]; do shift 2; done
  set -- compose "$@"
fi
case "$*" in
  'context show') [[ "${MOCK_FAIL_CONTEXT:-0}" == 0 ]] || exit 5; echo default ;;
  'context inspect '*) echo "${MOCK_ENDPOINT:-unix:///var/run/docker.sock}" ;;
  'version --format '*) echo "${MOCK_ARCH:-amd64}" ;;
  'compose config --services') echo fixture ;;
  'compose config') printf 'services:\n  fixture:\n    platform: %s\nnetworks:\n  default:\n    external: true\n    name: special-projects\n' "${MOCK_PLATFORM:-$DOCKER_DEFAULT_PLATFORM}" ;;
  'network inspect '*) [[ "${MOCK_MISSING_NETWORK:-0}" == 0 ]] ;;
  'compose build'*|'compose run '*--build*) [[ "${MOCK_FAIL_BUILD:-0}" == 0 ]] || exit 17 ;;
esac
'''


class LocalRebuildTests(unittest.TestCase):
    """Exercise every developer helper without service or infrastructure effects."""

    @classmethod
    def setUpClass(cls):
        cls.custody = tempfile.TemporaryDirectory(prefix='native-rebuild-fixture-')
        cls.temp = Path(cls.custody.name)
        cls.source = cls.temp / 'source'
        cls.source.mkdir()
        cls.scripts = [p for p in ROOT.rglob('rebuild') if p.is_file()
                       and not any(part in {'.git', 'node_modules', 'vendor'} for part in p.relative_to(ROOT).parts)]
        for path in cls.scripts:
            target = cls.source / path.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            (target.parent / '.env').write_text('')
        library = cls.source / 'scripts/dev/lib/prod-retrieval-env.sh'
        library.parent.mkdir(parents=True, exist_ok=True)
        library.write_text('load_prod_retrieval_env() { :; }\n')
        cls.bin = cls.temp / 'bin'
        cls.bin.mkdir()
        (cls.bin / 'docker').write_text(MOCK)
        (cls.bin / 'docker').chmod(0o700)
        cls.log = cls.temp / 'docker.log'

    @classmethod
    def tearDownClass(cls):
        cls.custody.cleanup()

    def run_helper(self, path, **extra):
        self.log.write_text('')
        env = {'PATH': str(self.bin) + ':/usr/bin:/bin', 'HOME': str(self.temp),
               'MOCK_LOG': str(self.log), 'DOCKER_DEFAULT_PLATFORM': 'linux/386',
               'BUILD_PLATFORMS': 'linux/amd64,linux/arm64', 'BUILDX_BUILDER': 'remote-release-builder',
               'BUILD_OUTPUT': 'push', 'PAYROLL_ALLOW_LEGACY': '1', **extra}
        result = subprocess.run(['bash', str(self.source / path.relative_to(ROOT))],
                                cwd=self.temp, env=env, text=True, capture_output=True, timeout=10)
        return result, re.sub(r'compose (?:-p|--profile) [^ |]+ ', 'compose ', self.log.read_text())

    def test_every_helper_passes_shell_syntax(self):
        self.assertTrue(self.scripts)
        for path in self.scripts:
            with self.subTest(helper=str(path.relative_to(ROOT))):
                result = subprocess.run(['bash', '-n', str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_native_amd64_and_arm64_start_without_env_or_publishing(self):
        for path in self.scripts:
            for arch in ['amd64', 'arm64']:
                with self.subTest(helper=str(path.relative_to(ROOT)), arch=arch):
                    result, log = self.run_helper(path, MOCK_ARCH=arch)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertTrue('compose up' in log or 'compose run' in log, log)
                    for line in log.splitlines():
                        if line.startswith(('compose build', 'compose up', 'compose run')):
                            self.assertIn('|ENV=local|PLATFORM=linux/' + arch + '|BUILDER=default|BUILD_PLATFORMS=', line)
                            self.assertNotIn('buildx', line)
                            self.assertNotIn('--push', line)

    def test_failed_build_does_not_stop_or_replace_existing_containers(self):
        for path in self.scripts:
            with self.subTest(helper=str(path.relative_to(ROOT))):
                result, log = self.run_helper(path, MOCK_FAIL_BUILD='1')
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(line.startswith(('compose stop', 'compose rm', 'compose down', 'compose up')) for line in log.splitlines()), log)

    def test_stage_env_is_rejected_before_docker(self):
        for path in self.scripts:
            with self.subTest(helper=str(path.relative_to(ROOT))):
                result, log = self.run_helper(path, ENV='stage')
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(log, '')

    def test_remote_engine_and_incompatible_platform_fail_before_build(self):
        for path in self.scripts:
            for options in [{'MOCK_ENDPOINT': 'ssh://remote.example.invalid'},
                            {'MOCK_ARCH': 'arm64', 'MOCK_PLATFORM': 'linux/amd64'},
                            {'MOCK_ARCH': 's390x'}, {'MOCK_MISSING_NETWORK': '1'}, {'MOCK_FAIL_CONTEXT': '1'}]:
                with self.subTest(helper=str(path.relative_to(ROOT)), options=options):
                    result, log = self.run_helper(path, **options)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertNotIn('compose build|', log)
                    self.assertNotIn('compose up', log)
                    self.assertNotIn('compose run', log)


if __name__ == '__main__':
    unittest.main()
