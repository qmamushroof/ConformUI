import sys, numpy as np, soundfile as sf
from common import *
total = np.zeros(180*48000, np.float32)
for n in range(1,9):
    a, sr = sf.read(os.path.join(OUT, f"beat{n}.wav")); assert sr == 48000
    s = STARTS[n]*sr; total[s:s+len(a)] += a.astype(np.float32)
sf.write(os.path.join(OUT, "full-voiceover.wav"), total, 48000, subtype="PCM_16")
