#!/usr/bin/env python3
"""Compile the project's intentionally restricted SCSS subset to distributable CSS.

Dart Sass is the authoritative compiler (`npm run sass`), but this zero-dependency
fallback supports the precise syntax used here: @use of partials, CSS variables,
selector nesting with `&`/`>`, nested @media and plain declarations.
Unlike a blind concatenation, this resolves nested selectors correctly. It fails
if an unknown @directive or malformed block is encountered.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'website/src/scss/main.scss'
DST = ROOT / 'website/assets/site.css'


def expand_imports(path: Path, seen: set[Path]) -> str:
    path = path.resolve()
    if path in seen:
        return ''
    seen.add(path)
    source = path.read_text(encoding='utf8')
    def repl(m):
        name = m.group(1)
        target = path.parent / (name + '.scss')
        if not target.exists():
            target = target.with_name('_' + target.name)
        if not target.exists():
            raise ValueError(f'Unable to resolve Sass partial {name} from {path}')
        return '\n' + expand_imports(target, seen) + '\n'
    return re.sub(r'@use\s+[\'\"]([\w/-]+)[\'\"]\s*;', repl, source)


def without_comments(source: str) -> str:
    return re.sub(r'/\*.*?\*/', '', source, flags=re.S)


def parse(source: str):
    root = {'prelude':'','items':[]}
    stack=[root]
    buf=[]; quote=None; escaped=False; parens=0
    for c in source:
        if quote:
            buf.append(c)
            if escaped: escaped=False
            elif c=='\\': escaped=True
            elif c==quote: quote=None
            continue
        if c in ('\"',"'"):
            quote=c;buf.append(c);continue
        if c=='(':parens+=1
        elif c==')':parens-=1
        if c in ';{}' and parens==0:
            s=''.join(buf).strip();buf=[]
            if c==';':
                if s:stack[-1]['items'].append(s+';')
            elif c=='{':
                if not s:raise SyntaxError('Selector missing before opening brace')
                block={'prelude':s,'items':[]}
                stack[-1]['items'].append(block);stack.append(block)
            else:
                if s: stack[-1]['items'].append(s+';')
                if len(stack)<2:raise SyntaxError('Unexpected }')
                stack.pop()
        else:buf.append(c)
    if len(stack)!=1:raise SyntaxError('Unclosed braces in SCSS')
    if ''.join(buf).strip():raise SyntaxError('Trailing unterminated statement: '+''.join(buf))
    return root


def combine(parents, children):
    if not parents:return children
    result=[]
    for parent in parents:
        for child in children:
            child=child.strip()
            result.append(child.replace('&',parent) if '&' in child else parent + ' ' + child)
    return result


def emit(nodes, parents=None, wrappers=None):
    parents=parents or []
    wrappers=wrappers or []
    chunks=[]; declarations=[]
    def flush():
        if declarations:
            sel=','.join(parents)
            if not sel:raise SyntaxError('Declaration outside a selector: '+str(declarations))
            statement=sel+'{' + ''.join(declarations) + '}'
            for wrapper in reversed(wrappers): statement=wrapper+'{'+statement+'}'
            chunks.append(statement)
            declarations.clear()
    for item in nodes:
        if isinstance(item,str):
            if not re.match(r'^[\w-]+\s*:',item):
                raise SyntaxError('Unexpected declaration: '+item)
            declarations.append(item)
        else:
            flush();pre=item['prelude']
            if pre.startswith('@media') or pre.startswith('@supports'):
                chunks+=emit(item['items'],parents,wrappers+[pre])
            elif pre.startswith('@'):
                raise SyntaxError('Unrecognized nested directive: '+pre)
            else:
                selectors=[x.strip() for x in pre.split(',') if x.strip()]
                chunks+=emit(item['items'],combine(parents,selectors),wrappers)
    flush();return chunks


def main():
    source=without_comments(expand_imports(SRC,set()))
    tree=parse(source)
    # Supports declarations in :root and all nested selectors.
    output='/* Generated from website/src/scss — DO NOT EDIT */\n'+'\n'.join(emit(tree['items']))+'\n'
    DST.parent.mkdir(parents=True,exist_ok=True)
    DST.write_text(output,encoding='utf8')
    print(f'Compiled SCSS -> {DST.relative_to(ROOT)} ({len(output):,} characters)')

if __name__=='__main__':main()
