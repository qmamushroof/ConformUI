# usage: post.py in.wav out.wav
import sys, subprocess, numpy as np, soundfile as sf, pyloudnorm as pln
from common import *
def post(inp, outp):
    a, sr = sf.read(inp); a = a.astype(np.float64)
    env = np.abs(a) > 10**(-45/20)
    idx = np.where(env)[0]; a = a[idx[0]:idx[-1]+1]
    a = np.concatenate([np.zeros(int(.2*sr)), a, np.zeros(int(.2*sr))])
    tmp = outp + ".tmp.wav"; sf.write(tmp, a, sr, subtype="FLOAT")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", tmp, "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", tmp+"2.wav"], check=True)
    b, sr2 = sf.read(tmp+"2.wav")
    m = pln.Meter(sr2); l = m.integrated_loudness(b)
    b = b * 10**((-15.4-l)/20)
    sf.write(tmp, b, sr2, subtype="FLOAT")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", tmp, "-af", "alimiter=limit=0.77:attack=3:release=50:level=0:asc=0", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", outp], check=True)
    os.remove(tmp); os.remove(tmp+"2.wav")
def stats(p):
    r = subprocess.run([ffmpeg(), "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
    return I, tp
if __name__ == "__main__":
    post(sys.argv[1], sys.argv[2]); print(stats(sys.argv[2]))
