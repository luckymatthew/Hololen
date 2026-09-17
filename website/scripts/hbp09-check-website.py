"""Run the existing website validation unchanged; preserve its real exit status."""
import pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
log=root.parent/'qa-hbp09/website-tests.txt'
log.parent.mkdir(parents=True,exist_ok=True)
with log.open('w',encoding='utf-8') as output:
    result=subprocess.run(['npm','test'],cwd=root,stdout=output,stderr=subprocess.STDOUT)
lines=log.read_text(encoding='utf-8',errors='replace').splitlines()
selected=set(range(max(0,len(lines)-35),len(lines)))
for index,line in enumerate(lines):
    if re.search(r'not ok|ERR_ASSERTION|error TS\d|Error:|error during build',line):
        selected.update(range(max(0,index-3),min(len(lines),index+45)))
print('\n'.join(lines[index] for index in sorted(selected)))
print(f'Website validation exit status: {result.returncode}; complete log: {log.name}')
sys.exit(result.returncode)
