#!/usr/bin/env python
"""ConformUI demo video: one-command build.

    python scripts\\build.py              -> out\\conformui-demo.mp4 + out\\captions.srt
    python scripts\\build.py --draft      -> out\\conformui-demo-draft.mp4 (ignores takes for beats 2-7: placeholders)
    python scripts\\build.py --frames     -> also extracts one frame per beat to out\\frames\\

Reads the script (slots, captions, voice, do-steps), takes\\beatN.mp4 (placeholder card when missing),
cues\\beatN.json + cues\\auto-beatN.json (zoom/highlight cues) and the voice-over beatN.wav files.
Needs: Python 3 with Pillow, ffmpeg.
"""
import glob, json, math, os, re, shutil, subprocess, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_MD = os.environ.get('DEMO_SCRIPT', os.path.join(ROOT, 'script', 'ConformUI demo script.md'))
VO_DIR = os.environ.get('DEMO_VOICEOVER', os.path.join(ROOT, 'voiceover'))
W, H, FPS = 1920, 1080, 30
FONT = {w: os.path.join(ROOT, 'assets', f'IBMPlexSans-{w}.ttf') for w in (400, 600, 700)}
BG = '0x0b0d12'


def find_tool(name):
    p = shutil.which(name)
    if p:
        return p
    for pat in (os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg*', '*', 'bin', name + '.exe'),):
        g = glob.glob(pat)
        if g:
            return g[0]
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    sys.exit(f'{name} not found. Install ffmpeg (winget install Gyan.FFmpeg) or pip install imageio-ffmpeg.')


FFMPEG = find_tool('ffmpeg')
_pr = os.path.join(os.path.dirname(FFMPEG), 'ffprobe.exe' if os.name == 'nt' else 'ffprobe')
FFPROBE = _pr if os.path.exists(_pr) else shutil.which('ffprobe')


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf8', errors='replace')
    if r.returncode:
        sys.exit('ffmpeg failed:\n' + ' '.join(cmd)[:600] + '\n' + r.stderr[-2500:])
    return r


def duration(path):
    if FFPROBE:
        r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
        try:
            return float(r.stdout.strip())
        except ValueError:
            pass
    r = subprocess.run([FFMPEG, '-i', path], capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def clean(s):
    return re.sub(r'`|\*\*', '', s).strip()


def parse_script():
    txt = open(SCRIPT_MD, encoding='utf8').read()
    beats = []
    parts = re.split(r'^### Beat (\d+): ', txt, flags=re.M)
    for i in range(1, len(parts), 2):
        n, body = int(parts[i]), parts[i + 1]
        m = re.match(r'(.*?) \((\d+):(\d+)\S(\d+):(\d+)\)', body)
        title, s0, s1 = m[1], int(m[2]) * 60 + int(m[3]), int(m[4]) * 60 + int(m[5])
        do = re.search(r'\*\*Do:\*\*\n(.*?)\n\*\*Caption:\*\*', body, re.S)[1]
        cap = re.search(r'\*\*Caption:\*\*\n(.*?)\n\*\*Voice:\*\*', body, re.S)[1]
        voice = re.search(r'\*\*Voice:\*\*\n(.*?)(?:\n---|\n### |\Z)', body, re.S)[1]
        beats.append(dict(n=n, title=title, start=s0, end=s1, slot=s1 - s0,
                          do=[clean(l) for l in do.splitlines() if l.strip()],
                          caps=[clean(l[1:]) for l in cap.splitlines() if l.strip().startswith('>')],
                          voice=' '.join(clean(l[1:]) for l in voice.splitlines() if l.strip().startswith('>'))))
    return apply_timeline(beats)


def apply_timeline(beats):
    """timeline.json overrides the script's slot lengths (intro length + seconds per beat); voice starts follow the new slots."""
    tl = {'intro': 0, 'slots': {}}
    p = os.path.join(ROOT, 'timeline.json')
    if os.path.exists(p):
        tl = json.load(open(p, encoding='utf8'))
    t = float(tl.get('intro', 0))
    out = []
    if t:
        out.append(dict(n=0, title='Intro', slot=t, start=0, end=t, do=[], caps=[], voice=''))
    for b in beats:
        b['slot'] = float(tl['slots'].get(str(b['n']), b['slot']))
        b['start'], b['end'] = t, t + b['slot']
        t += b['slot']
        out.append(b)
    return out


def font(w, size):
    return ImageFont.truetype(FONT[w], size)


def wrap_caption(text, per_line=8):
    words = text.split()
    if len(words) <= per_line:
        return [text]
    half = math.ceil(len(words) / 2)
    return [' '.join(words[:half]), ' '.join(words[half:])]


def caption_png(lines, path):
    f = font(600, 46)
    d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    widths = [d.textlength(l, font=f) for l in lines]
    lh = 62
    bw, bh = int(max(widths) + 90), int(len(lines) * lh + 30)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0 = (W - bw) // 2, H - 64 - bh
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), 16, fill=(8, 10, 16, 224))
    for i, l in enumerate(lines):
        d.text((W // 2, y0 + 15 + i * lh + lh // 2), l, font=f, fill=(255, 255, 255, 255), anchor='mm')
    img.save(path)


def caption_plan(beat):
    caps = beat['caps']
    slot = beat['slot']
    if not caps:
        return []
    t0, t1 = 0.3, slot - 0.3
    weights = [max(len(c.split()), 5) for c in caps]
    tot = sum(weights)
    plan, t = [], t0
    for c, w in zip(caps, weights):
        dur = (t1 - t0) * w / tot
        lines = wrap_caption(c)
        need = 2.0 * len(lines)
        if dur < need:
            print(f'  warn: beat {beat["n"]} caption "{c[:30]}..." shows {dur:.1f}s (< {need:.0f}s)')
        plan.append((t, t + dur, lines))
        t += dur
    return plan


def placeholder_png(beat, path):
    img = Image.new('RGB', (W, H), (15, 18, 24))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 8), fill=(37, 99, 235))
    d.text((120, 110), f'PLACEHOLDER  |  Beat {beat["n"]}: {beat["title"]}', font=font(600, 34), fill=(147, 197, 253))
    d.text((120, 190), f'Beat {beat["n"]} — record:', font=font(700, 64), fill=(255, 255, 255))
    y = 290
    size = 34
    lines = []
    while True:
        f = font(400, size)
        lines = []
        for l in beat['do']:
            ind = 40 if l.startswith('*') else 0
            for j, w in enumerate(textwrap.wrap(l.lstrip('* '), width=int(1500 / (size * 0.52)) - (ind // 18))):
                lines.append((ind + (0 if j == 0 or not re.match(r'\d+\.', l) else 34), w))
        if len(lines) * size * 1.4 < 560 or size <= 22:
            break
        size -= 2
    for ind, l in lines:
        d.text((120 + ind, y), l, font=f, fill=(226, 230, 240))
        y += size * 1.4
    d.text((120, H - 80), 'No take yet: save takes\\beat%d.mp4 and rebuild. Slot %ds. (Captions and voice are the real ones.)' % (beat['n'], beat['slot']), font=font(400, 24), fill=(120, 128, 145))
    img.save(path)


# ---------- zoom / highlight cues ----------
def ease(t0, ri, hold, ro):
    p = f'clip(min((t-{t0})/{ri},({t0 + ri + hold + ro}-t)/{ro}),0,1)'
    return f'st(0,{p});ld(0)*ld(0)*(3-2*ld(0))'


def cue_filters(cues, src, dst_prefix):
    """Returns (filter text, final label). Each cue: t (s in beat), rect [x,y,w,h] in 1920x1080, scale, hold, box."""
    out, cur = [], src
    for i, c in enumerate(sorted(cues, key=lambda c: c['t'])):
        x, y, w, h = c['rect']
        t0, ri, hold, ro = float(c['t']), float(c.get('ramp_in', 0.55)), float(c.get('hold', 2.0)), float(c.get('ramp_out', 0.55))
        s = float(c.get('scale', 1.8))
        cx, cy = x + w / 2, y + h / 2
        if c.get('box', True):
            nxt = f'{dst_prefix}b{i}'
            out.append(f"[{cur}]drawbox=x={x}:y={y}:w={w}:h={h}:color=0xFFC400@0.95:t=5:enable='between(t,{t0 + ri * 0.6:.2f},{t0 + ri + hold + ro * 0.4:.2f})'[{nxt}]")
            cur = nxt
        E = ease(t0, ri, hold, ro)
        Z = f'(1+({s}-1)*({E}))'
        sc, nxt = f'{dst_prefix}s{i}', f'{dst_prefix}z{i}'
        out.append(f"[{cur}]scale=w='trunc({W}*{Z}/2)*2':h='trunc({H}*{Z}/2)*2':eval=frame:flags=bilinear[{sc}]")
        X = f"clip(({E})*({cx}*{Z}-{W / 2}),0,iw-{W})"
        Y = f"clip(({E})*({cy}*{Z}-{H / 2}),0,ih-{H})"
        out.append(f"[{sc}]crop={W}:{H}:x='{X}':y='{Y}'[{nxt}]")
        cur = nxt
    return ';'.join(out), cur


def load_cues(n):
    cues = []
    for name in (f'auto-beat{n}.json', f'beat{n}.json'):
        p = os.path.join(ROOT, 'cues', name)
        if os.path.exists(p):
            try:
                d = json.load(open(p, encoding='utf8'))
                cues += d['cues'] if isinstance(d, dict) else d
            except Exception as e:
                sys.exit(f'bad cues file {p}: {e}')
    return [c for c in cues if 'rect' in c and 't' in c]


def build_segment(beat, use_take, work):
    n, slot = beat['n'], beat['slot']
    seg = f'work/seg{n}.mp4'
    take = os.path.join(ROOT, 'takes', f'beat{n}.mp4')
    inputs, idx = [], 0
    if use_take and os.path.exists(take):
        d = duration(take)
        note = 'take %.1fs' % d + (' (trimmed to %ds)' % slot if d > slot + 0.05 else ' (last frame held)' if d < slot - 0.05 else '')
        inputs += ['-i', f'takes/beat{n}.mp4']
        v0 = (f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG},setsar=1,"
              f"tpad=stop_mode=clone:stop_duration={slot},trim=duration={slot},setpts=PTS-STARTPTS,format=yuv420p[v0]")
    else:
        note = 'placeholder card'
        ph = f'work/placeholder{n}.png'
        placeholder_png(beat, os.path.join(ROOT, ph))
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', str(slot), '-i', ph]
        v0 = f'[0:v]setsar=1,format=yuv420p[v0]'
    cues = load_cues(n)
    chain, cur = [v0], 'v0'
    if cues:
        f, cur = cue_filters(cues, 'v0', 'q')
        chain.append(f)
    idx = 1
    for i, (a, b, lines) in enumerate(caption_plan(beat)):
        png = f'work/cap{n}_{i}.png'
        caption_png(lines, os.path.join(ROOT, png))
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', str(slot), '-i', png]
        nxt = f'c{i}'
        chain.append(f"[{cur}][{idx}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})':format=auto[{nxt}]")
        cur, idx = nxt, idx + 1
    chain.append(f"[{cur}]fade=t=in:st=0:d=0.25:color={BG},fade=t=out:st={slot - 0.25:.2f}:d=0.25:color={BG},format=yuv420p[vout]")
    open(os.path.join(ROOT, 'work', f'fc{n}.txt'), 'w', encoding='utf8').write(';\n'.join(chain))
    run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-/filter_complex', f'work/fc{n}.txt', '-map', '[vout]',
         '-t', str(slot), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', str(FPS), '-an', seg])
    print(f'  beat {n}: {note}; {len(cues)} cue(s); {len(beat["caps"])} caption card(s)')
    return seg


def mix_audio(beats, total):
    inputs, filt, labels = [], [], []
    for b in beats:
        w = os.path.join(VO_DIR, f'beat{b["n"]}.wav')
        if b['n'] == 0:
            continue
        if not os.path.exists(w):
            print(f'  warn: missing voice-over for beat {b["n"]}')
            continue
        d = duration(w)
        if d > b['slot'] + 0.01:
            print(f'  WARNING: beat {b["n"]} voice-over is {d:.1f}s, longer than its {b["slot"]}s slot: it is cut at the slot end. Shorten the text or speed it up.')
        k = len(labels)
        inputs += ['-i', w]
        ms = int(b['start'] * 1000)
        f = f'[{k}:a]aformat=sample_rates=48000:channel_layouts=mono,atrim=duration={b["slot"]},afade=t=out:st={max(b["slot"] - 0.15, 0)}:d=0.15,adelay={ms}:all=1[a{k}]'
        filt.append(f)
        labels.append(f'[a{k}]')
    filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={total},atrim=duration={total}[aout]')
    open(os.path.join(ROOT, 'work', 'audio.txt'), 'w', encoding='utf8').write(';\n'.join(filt))
    run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-/filter_complex', 'work/audio.txt', '-map', '[aout]', '-ar', '48000', '-ac', '1', 'work/mix.wav'])


def srt_time(t):
    ms = int(round(t * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def write_srt(beats, path):
    cues, n = [], 0
    for b in beats:
        if b['n'] == 0:
            continue
        w = os.path.join(VO_DIR, f'beat{b["n"]}.wav')
        d = duration(w) if os.path.exists(w) else b['slot'] - 1
        sents = [s for s in re.split(r'(?<=[.!?])\s+', b['voice']) if s]
        pieces = []
        for s in sents:  # split long sentences into subtitle-sized pieces (about 42 chars per line, 2 lines)
            words, cur = s.split(), []
            for wd in words:
                cur.append(wd)
                if len(' '.join(cur)) > 70:
                    pieces.append(' '.join(cur)); cur = []
            if cur:
                pieces.append(' '.join(cur))
        a, z = b['start'] + 0.2, b['start'] + max(d - 0.2, 0.5)
        tot = sum(len(p) for p in pieces)
        t = a
        for p in pieces:
            dur = (z - a) * len(p) / tot
            lines = textwrap.wrap(p, 42)
            n += 1
            cues.append(f'{n}\n{srt_time(t)} --> {srt_time(t + dur)}\n' + '\n'.join(lines) + '\n')
            t += dur
    open(path, 'w', encoding='utf8').write('\n'.join(cues))


def main():
    draft = '--draft' in sys.argv
    frames = '--frames' in sys.argv
    os.makedirs(os.path.join(ROOT, 'work'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    beats = parse_script()
    total = beats[-1]['end']
    assert total <= 180.001, 'timeline is longer than 3:00 (%.1fs)' % total
    print('timeline: %d segments, %.1fs total' % (len(beats), total))
    segs = []
    for b in beats:
        use_take = not (draft and 2 <= b['n'] <= 7)
        if b['n'] == 0 and not os.path.exists(os.path.join(ROOT, 'takes', 'beat0.mp4')):
            sys.exit('takes/beat0.mp4 missing: run python scripts/gen_beats.py')
        segs.append(build_segment(b, use_take, 'work'))
    open(os.path.join(ROOT, 'work', 'concat.txt'), 'w').write(''.join(f"file 'seg{b['n']}.mp4'\n" for b in beats))
    mix_audio(beats, total)
    name = 'conformui-demo-draft.mp4' if draft else 'conformui-demo.mp4'
    run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'work/concat.txt', '-i', 'work/mix.wav',
         '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(total), '-movflags', '+faststart', f'out/{name}'])
    write_srt(beats, os.path.join(ROOT, 'out', 'captions.srt'))
    d = duration(os.path.join(ROOT, 'out', name))
    print(f'out\\{name}: {d:.2f}s {W}x{H} {FPS}fps; out\\captions.srt')
    if d > 180.01:
        sys.exit('ERROR: video longer than 3:00')
    if frames:
        os.makedirs(os.path.join(ROOT, 'out', 'frames'), exist_ok=True)
        for b in beats:
            # a moment where the first caption is showing
            t = b['start'] + min(2.5, b['slot'] * 0.3)
            run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', f'out/{name}', '-frames:v', '1', f'out/frames/{name[:-4]}-beat{b["n"]}.png'])
        print('frames in out\\frames')


if __name__ == '__main__':
    main()
