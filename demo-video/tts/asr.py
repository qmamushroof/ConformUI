# usage: asr.py name=path ... ; compares with expected beat text (by filename digit)
import sys, re, json, numpy as np, soundfile as sf
from common import *
from faster_whisper import WhisperModel
from post import stats
W = WhisperModel("small.en", device="cpu", compute_type="int8")
B = beats()
def norm(s):
    s = s.lower().replace("-", " ")
    s = re.sub(r"\bconformui\b", "conform u i", s)
    s = s.replace("gemma 4", "gemma four").replace("ree verify", "reverify").replace("re verify","reverify")
    s = s.replace("re-verify","reverify").replace("judgements","judgments").replace("labelled","labeled")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    nums = {"6":"six","1":"one","132":"one thirty two","220":"two twenty","96":"ninety six"}
    return " ".join(nums.get(w,w) for w in s.split())
def wer(r, h):
    r, h = r.split(), h.split(); d = np.zeros((len(r)+1, len(h)+1), int)
    d[:,0] = range(len(r)+1); d[0,:] = range(len(h)+1)
    for i in range(1,len(r)+1):
        for j in range(1,len(h)+1):
            d[i,j] = min(d[i-1,j]+1, d[i,j-1]+1, d[i-1,j-1]+(r[i-1]!=h[j-1]))
    return d[-1,-1]/len(r)
out = {}
for arg in sys.argv[1:]:
    name, p = arg.split("=", 1); n = int(re.search(r"beat(\d)", name).group(1))
    import subprocess
    raw = subprocess.run([ffmpeg(),"-loglevel","error","-i",p,"-ar","16000","-ac","1","-f","f32le","-"],capture_output=True).stdout
    segs, _ = W.transcribe(np.frombuffer(raw,np.float32), language="en", beam_size=5, word_timestamps=True)
    segs = list(segs); txt = " ".join(s.text.strip() for s in segs)
    words = [w for s in segs for w in s.words]
    gaps = [words[i+1].start-words[i].end for i in range(len(words)-1)]
    a, sr = sf.read(p); dur = len(a)/sr
    nw = len(B[n].split())
    # short-term loudness steadiness (400ms RMS windows over speech)
    w = int(.4*sr); rms = [20*np.log10(np.sqrt(np.mean(a[i:i+w]**2))+1e-9) for i in range(0, len(a)-w, w//2)]
    rms = [x for x in rms if x > -40]
    I, tp = stats(p)
    out[name] = dict(wer=round(wer(norm(B[n]), norm(txt)),3), dur=round(dur,2), wpm=round(nw/(dur-.4)*60), maxgap=round(max(gaps),2), clip=int((np.abs(a)>=0.999).sum()), lufs=I, tp=tp, loud_sd=round(float(np.std(rms)),2), text=txt)
    print(name, json.dumps(out[name]), flush=True)
json.dump(out, open(os.environ.get("ASR_OUT","asr_out.json"),"w"), indent=1)
