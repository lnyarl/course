#!/usr/bin/env python3
"""Offline structural/source verification. Optionally extract and execute C# examples."""
import argparse, json, os, re, subprocess, tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids=[]; self.links=[]; self.pre=[]; self.active=None
        self.widgets=0; self.svg=0; self.quiz=[]; self.current_quiz=None
        self.h1=0; self.chapter=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); cls=a.get('class','').split()
        if 'id' in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='body':self.chapter=a.get('data-chapter')
        if tag=='svg':self.svg+=1
        if 'widget' in cls:self.widgets+=1
        if tag in ('a','script','link'):
            link=a.get('href') or a.get('src')
            if link:self.links.append(link)
        if 'quiz' in cls:
            self.current_quiz={'answer':int(a.get('data-answer','-1')),'options':0};self.quiz.append(self.current_quiz)
        if 'opt' in cls and self.current_quiz:self.current_quiz['options']+=1
        if tag=='pre':self.active={'attrs':a,'text':''}
        if tag=='code' and self.active and a.get('data-csharp')=='true':self.active['attrs']['data-csharp']='true'
    def handle_endtag(self,tag):
        if tag=='pre' and self.active:self.pre.append(self.active);self.active=None
    def handle_data(self,text):
        if self.active:self.active['text']+=text

def run(args,cwd=None,env=None):
    result=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True)
    if result.returncode:raise AssertionError(f'{args[0]} failed:\n{result.stdout}\n{result.stderr}')
    return result.stdout

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--chapters',default='01-31');ap.add_argument('--extract',action='store_true');ap.add_argument('--dotnet');ap.add_argument('--report');args=ap.parse_args()
    selected=[]
    for part in args.chapters.split(','):
        if '-' in part:
            a,b=map(int,part.split('-'));selected.extend(range(a,b+1))
        else:selected.append(int(part))
    reports=[]
    for n in sorted(set(selected)):
        key=f'{n:02}';files=list(ROOT.glob(key+'-*.html'));assert len(files)==1,f'{key}: expected one chapter, found {len(files)}'
        file=files[0];source=file.read_text();p=Page();p.feed(source)
        assert p.chapter==key and p.h1==1,f'{key}: body ID/h1'
        assert len(p.ids)==len(set(p.ids)),f'{key}: duplicate IDs'
        assert p.widgets>=1 and p.svg>=1,f'{key}: widgets/SVG missing'
        assert len(p.quiz)>=4 and all(0<=q['answer']<q['options'] for q in p.quiz),f'{key}: quiz structure'
        assert len(re.findall(r'class=["\'][^"\']*\bexercise\b',source))>=2,f'{key}: exercises missing'
        programs=[b for b in p.pre if b['attrs'].get('data-csharp')=='true'];assert len(programs)==1,f'{key}: expected one runnable program'
        program=programs[0]['text'].strip()+'\n'
        idx=p.pre.index(programs[0]);outputs=[b for b in p.pre if b['attrs'].get('data-expected-output')=='true']
        expected=outputs[0]['text'] if outputs else (p.pre[idx+1]['text'] if idx+1<len(p.pre) else None)
        project=ROOT/'examples'/('Ch'+key);cs=project/'Program.cs'
        if args.extract:
            project.mkdir(parents=True,exist_ok=True);cs.write_text(program)
            template=(ROOT/'examples/Ch01/Ch01.csproj').read_text()
            (project/('Ch'+key+'.csproj')).write_text(template)
        assert cs.exists() and cs.read_text().strip()==program.strip(),f'{key}: C# source differs'
        for href in p.links:
            u=urlsplit(href)
            if u.scheme or u.netloc:continue
            dest=file.parent/unquote(u.path) if u.path else file
            assert dest.exists(),f'{key}: missing {dest}'
            if u.fragment and dest.suffix=='.html':
                target=p if dest==file else Page()
                if target is not p:target.feed(dest.read_text())
                assert u.fragment in target.ids,f'{key}: broken anchor {href}'
            if dest.suffix=='.js':run(['node','--check',str(dest)])
        for i,js in enumerate(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',source)):
            if js.strip():
                r=subprocess.run(['node','--check','-'],input=js,text=True,capture_output=True)
                assert r.returncode==0,f'{key}: inline JS {i}: {r.stderr}'
        row={'chapter':key,'widgets':p.widgets,'static_svg':p.svg,'quizzes':len(p.quiz),'structure':'PASS'}
        if args.dotnet:
            env=os.environ.copy();env.update(DOTNET_CLI_TELEMETRY_OPTOUT='1',DOTNET_NOLOGO='1');env.setdefault('DOTNET_CLI_HOME',str(Path(tempfile.gettempdir())/'ctfp-dotnet-home'));env.setdefault('NUGET_PACKAGES',str(Path(tempfile.gettempdir())/'ctfp-nuget'))
            stdout=run([args.dotnet,'run','--project',str(project/('Ch'+key+'.csproj')),'--configuration','Release'],env=env)
            assert expected is not None,f'{key}: expected stdout missing'
            normalize=lambda s:'\n'.join(line.rstrip() for line in s.replace('\r\n','\n').strip().split('\n'))
            assert normalize(stdout)==normalize(expected),f'{key}: stdout mismatch\nEXPECTED:\n{expected}\nACTUAL:\n{stdout}'
            row.update(csharp='PASS',stdout=stdout.strip())
        reports.append(row);print(f'{key} PASS: structure'+(' + C# output' if args.dotnet else ''),flush=True)
    if args.report:Path(args.report).write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
    print(f'PASS {len(reports)} chapters')
if __name__=='__main__':main()
