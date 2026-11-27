import re, os, sys, glob, subprocess
SCRIPT = r"C:\Users\SN-LP-64\source\repos\qmamushroof\ComformUI demo video\script\ConformUI demo script.md"
OUT = r"C:\Users\SN-LP-64\source\repos\qmamushroof\ComformUI demo video\voiceover"
SLOTS = {1:15,2:30,3:35,4:25,5:25,6:25,7:15,8:10}
STARTS = {1:0,2:15,3:45,4:80,5:105,6:130,7:155,8:170}
SR = 24000
def ffmpeg():
    g = glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\**\ffmpeg.exe"), recursive=True)
    return g[0]
def beats():
    t = open(SCRIPT, encoding="utf8").read()
    res = {}
    for m in re.finditer(r"### Beat (\d+):.*?\*\*Voice:\*\*\s*\n((?:>[^\n]*\n?)+)", t, re.S):
        res[int(m.group(1))] = " ".join(l[1:].strip() for l in m.group(2).splitlines())
    return res
RESPELL = [
 (r"ConformUI", "Conform you-eye"), (r"Re-verify", "ree-verify"), (r"CTA", "C T A"),
 (r"Gemini Nano 4", "Gemini Nano four"), (r"Gemma 4", "Gemma four"), (r"Firebase AI Logic", "Firebase A I Logic"), (r"\bJSON\b", "J S O N"), (r"\bDOM\b", "D O M"),
 (r"\bAI\b", "A I"), (r"Markdown", "Mark down"), (r"Reports export as", "Reports export, as"),]
def tts_text(s):
    s = s.replace("\u201c", '"').replace("\u201d", '"')
    for a, b in RESPELL: s = re.sub(a, b, s)
    s = s.replace('"', "")
    s = re.sub(r"\b132\b", "one thirty-two", s)
    s = s.replace("6 issues", "six issues").replace("5 issues", "five issues").replace("1 spacing", "one spacing")
    return s
# per-beat Kokoro speed (am_michael); override with render.py --speed
SPEEDS = {1:1.03, 2:1.22, 3:1.22, 4:1.03, 5:1.22, 6:1.2, 7:1.1, 8:1.03}
