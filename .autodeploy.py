#!/usr/bin/env python3
"""Auto-deploy ricsline: if origin/main has new commits, build + push dist to gh-pages."""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, http.client

REPO = '/home/hatch/workspace/ricsline'
DIST = os.path.join(REPO, 'dist')
STATE = os.path.join(REPO, '.autodeploy-state')
OWNER_REPO = 'dusmamud/ricsline'

sys.path.insert(0, '/opt/hatch/skills/skill-creator/bin')
from dynamic_credentials import add_surrogate_to_request, read_json_response

def api(method, path, body=None, retries=4):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries):
        req = urllib.request.Request('https://api.github.com' + path, data=data, method=method)
        req.add_header('Accept', 'application/vnd.github+json')
        if data: req.add_header('Content-Type', 'application/json')
        add_surrogate_to_request(req, 'custom.github', allowed_hosts=['api.github.com'])
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, read_json_response(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 429, 502, 503) and attempt < retries - 1:
                time.sleep(2 ** attempt); continue
            raise
        except (http.client.RemoteDisconnected, ConnectionError, TimeoutError):
            if attempt < retries - 1: time.sleep(2 ** attempt); continue
            raise

def sh(cmd, cwd=REPO):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()

# what did we last deploy?
last = open(STATE).read().strip() if os.path.exists(STATE) else ''
st, ref = api('GET', f'/repos/{OWNER_REPO}/git/refs/heads/main')
remote_main = ref['object']['sha']
if remote_main == last:
    print('no new commits')
    sys.exit(0)
print('new commit on main:', remote_main[:8])

# sync local source to remote main (skip if working tree is dirty — never clobber uncommitted work)
dirty = sh(['git', 'status', '--porcelain'])
if dirty:
    print('working tree dirty, skipping')
    sys.exit(0)
sh(['git', 'fetch', 'origin', 'main'])
sh(['git', 'reset', '--hard', 'origin/main'])

# build
r = subprocess.run(['npm', 'run', 'build'], cwd=REPO, capture_output=True, text=True)
if r.returncode != 0:
    print('BUILD FAILED'); print(r.stderr[-2000:]); sys.exit(1)

# push dist to gh-pages
sh(['git', 'init', '-qb', 'gh-pages'], cwd=DIST)
sh(['git', 'add', '-A'], cwd=DIST)
sh(['git', '-c', 'user.name=Muse', '-c', 'user.email=muse@ricsline.local',
    'commit', '-qm', f'Autodeploy {remote_main[:8]}'], cwd=DIST)
st, gref = api('GET', f'/repos/{OWNER_REPO}/git/refs/heads/gh-pages')
st, old_tree = api('GET', f"/repos/{OWNER_REPO}/git/trees/{gref['object']['sha']}?recursive=1")
known = {t['sha'] for t in old_tree['tree']}
files = sh(['git', 'ls-files'], cwd=DIST).splitlines()
local = {rel: sh(['git', 'hash-object', rel], cwd=DIST) for rel in files}
for rel in [r for r, s in local.items() if s not in known]:
    with open(os.path.join(DIST, rel), 'rb') as f:
        content = base64.b64encode(f.read()).decode()
    st, _ = api('POST', f'/repos/{OWNER_REPO}/git/blobs', {"content": content, "encoding": "base64"})
    assert st == 201, rel
tree = [{"path": rel, "mode": "100644", "type": "blob", "sha": sha} for rel, sha in local.items()]
st, tr = api('POST', f'/repos/{OWNER_REPO}/git/trees', {"tree": tree}); assert st == 201
st, cm = api('POST', f'/repos/{OWNER_REPO}/git/commits',
             {"message": f'Autodeploy {remote_main[:8]}', "tree": tr['sha'],
              "parents": [gref['object']['sha']]})
assert st == 201
st, _ = api('PATCH', f'/repos/{OWNER_REPO}/git/refs/heads/gh-pages', {"sha": cm['sha']})
assert st == 200
open(STATE, 'w').write(remote_main)
print('deployed', cm['sha'][:8])
