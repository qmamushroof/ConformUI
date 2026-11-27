# usage: python render.py [--beat 2[,6]] [--voice am_michael] [--speed 1.03] [--no-assemble]
# Renders raw TTS -> post (-16 LUFS, limiter, 48k mono) -> ..\beatN.wav, then rebuilds full-voiceover.wav.
import argparse, numpy as np, soundfile as sf
from common import *
ap = argparse.ArgumentParser()
ap.add_argument("--beat", default="1,2,3,4,5,6,7,8"); ap.add_argument("--voice", default="am_michael")
ap.add_argument("--speed", type=float, default=None); ap.add_argument("--no-assemble", action="store_true")
a_ = ap.parse_args()
from kokoro import KPipeline
from post import post, stats
pipe = KPipeline(lang_code=a_.voice[0], repo_id="hexgrad/Kokoro-82M")
B = beats(); raw = os.path.join(OUT, "raw"); os.makedirs(raw, exist_ok=True)
for n in [int(x) for x in a_.beat.split(",")]:
    parts = []
    for s in re.split(r"(?<=[.!?])\s+", tts_text(B[n])):
        for _, _, a in pipe(s, voice=a_.voice, speed=(a_.speed or SPEEDS[n]), split_pattern=None):
            parts.append(a.numpy() if hasattr(a, "numpy") else a)
        parts.append(np.zeros(int(0.35*SR), dtype=np.float32))
    a = np.concatenate(parts[:-1]); rp = os.path.join(raw, f"raw{n}_{a_.voice}.wav")
    sf.write(rp, a, SR)
    out = os.path.join(OUT, f"beat{n}.wav"); post(rp, out)
    d = sf.info(out).duration
    print(f"beat{n} {d:.2f}s slot {SLOTS[n]} spare {SLOTS[n]-d:.2f} stats {stats(out)}", flush=True)
if not a_.no_assemble:
    import subprocess; subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "assemble.py")], check=True)
