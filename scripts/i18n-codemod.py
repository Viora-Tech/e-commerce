#!/usr/bin/env python3
"""Mechanical first pass for moving a component onto useCopy (see developer docs, "Admin languages").

usage: python3 scripts/i18n-codemod.py <file.tsx> <exportName> [<local>=copy] ...

For each `exportName[:local]` pair it:
  - turns `import { exportName as local }` into `import { exportName }`,
  - adds `const local = useCopy(exportName)` at the top of the default component's Hooks
    section (adding the `// Hooks` heading when missing) and the `useCopy` import,
  - when local == exportName (imported without an alias), renames uses inside the component
    body to `copy` style: pass `exportName:newLocal` to pick the new local name.

It does not touch module-scope uses (helpers, constants): those still read English and need a
`copy`/`locale` parameter by hand. Always re-read the diff.
"""
import re
import sys

path = sys.argv[1]
pairs = []
for arg in sys.argv[2:]:
    name, _, local = arg.partition(':')
    pairs.append((name, local or None))

src = open(path).read()
m = re.search(r'export default (async )?function \w+\([^)]*?\)[^{]*\{\n', src, re.S)
if not m:
    # destructured props spanning lines
    m = re.search(r'export default (async )?function \w+\((?:.|\n)*?\)(?:: [^{]+)?\s*\{\n', src)
if not m:
    sys.exit(f'{path}: no default component found')
body_start = m.end()

hooks = []
for name, local in pairs:
    alias = re.search(r'\b' + re.escape(name) + r' as (\w+)', src)
    if alias:
        cur = alias.group(1)
        src = src.replace(f'{name} as {cur}', name, 1)
        new_local = local or cur
        body_start = src.index(m.group(0)) + len(m.group(0))
        if new_local != cur:
            head, body = src[:body_start], src[body_start:]
            body = re.sub(r'(?<![\w.])' + re.escape(cur) + r'\b', new_local, body)
            src = head + body
    else:
        new_local = local or 'copy'
        body_start = src.index(m.group(0)) + len(m.group(0))
        head, body = src[:body_start], src[body_start:]
        body = re.sub(r'(?<![\w.])' + re.escape(name) + r'\b', new_local, body)
        src = head + body
    hooks.append(f'  const {new_local} = useCopy({name})\n')

body_start = src.index(m.group(0)) + len(m.group(0))
rest = src[body_start:]
if rest.startswith('  // Hooks\n'):
    src = src[:body_start] + '  // Hooks\n' + ''.join(hooks) + rest[len('  // Hooks\n'):]
else:
    src = src[:body_start] + '  // Hooks\n' + ''.join(hooks) + '\n' + rest

if "from '@/hooks/use-copy'" not in src:
    # after the last import line
    imports = list(re.finditer(r'^import .*?from .*?\n', src, re.M | re.S))
    last = imports[-1]
    src = src[:last.end()] + "import { useCopy } from '@/hooks/use-copy'\n" + src[last.end():]
elif 'useCopy' not in src.split("from '@/hooks/use-copy'")[0].split('import')[-1]:
    print(f'{path}: add useCopy to the existing @/hooks/use-copy import by hand')

open(path, 'w').write(src)
print(f'{path}: ok')
