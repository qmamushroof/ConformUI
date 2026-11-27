#!/usr/bin/env python
"""Turns the raw recordings (work\\raw-main.webm, work\\raw-mobile.webm + work\\rec-log.json from rec.cjs)
into takes\\beat2..7.mp4 and cues\\auto-beatN.json.

Waits (model running) are sped up so each beat fits its slot, with a visible "Sped up Nx" label. The labels are never hidden.
Cue times are remapped to the sped-up timeline.   Run: python scripts\\cut.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import build as B

ROOT, W, H = B.ROOT, 1920, 1080
log = json.load(open(os.path.join(ROOT, 'work', 'rec-log.json'), encoding='utf8'))
beats = {b['n']: b for b in B.parse_script()}
TRIM_START = {7: 4.0}  # seconds dropped from the start of a beat's raw footage
MOBILE_WINDOW = (8.8, 20.5)  # part of the 390 px recording that is used (consent sheet -> result)
TAIL = 0.8  # seconds kept free at the end of a slot
LABEL_FONT = 'assets/IBMPlexSans-600.ttf'


def main_events():
    return [e for e in log['events'] if not e.get('mobile')]


def split_beats():
    ev = main_events()
    marks = [(e['n'], e['t']) for e in ev if e['k'] == 'beat']
    end = [e['t'] for e in ev if e['k'] == 'end'][0]
    out = {}
    for i, (n, t) in enumerate(marks):
        t1 = marks[i + 1][1] if i + 1 < len(marks) else end
        out[n] = (t, t1)
    return out


def pieces_for(t0, t1, events):
    """Return [(a, b, kind, label)] covering [t0, t1): 'wait' pieces from wait start/end events, 'play' elsewhere."""
    waits, cur = [], None
    for e in events:
        if e['k'] == 'wait' and t0 <= e['t'] <= t1:
            if e['phase'] == 'start':
                cur = (e['t'], e.get('label', ''))
            elif cur:
                waits.append((cur[0], e['t'], cur[1])); cur = None
    pcs, t = [], t0
    for a, b, lbl in waits:
        if a > t:
            pcs.append((t, a, 'play', ''))
        pcs.append((a, b, 'wait', lbl)); t = b
    if t < t1:
        pcs.append((t, t1, 'play', ''))
    return pcs


WAIT_MAX = 40.0


def solve_speed(pcs, avail):
    """Returns (wait_speed, play_speed). Waits are sped up first (up to 40x); if the actions alone are still too long, they are sped up evenly (max 1.8x)."""
    play = sum(b - a for a, b, k, _ in pcs if k == 'play')
    wait = sum(b - a for a, b, k, _ in pcs if k == 'wait')
    if play + wait <= avail:
        return 1.0, 1.0
    if wait > 0:
        room = avail - play
        if room > 1.0:
            return max(1.0, min(WAIT_MAX, wait / room)), 1.0
    g = play / max(avail - wait / WAIT_MAX, 1.0)
    if g > 1.8:
        print('  WARNING: actions are long: %.1fs of action into %.1fs; the end is cut' % (play, avail))
    return WAIT_MAX if wait else 1.0, max(1.0, min(1.8, g))


def make_take(n, src, t0, t1, events, extra_filter=''):
    slot = beats[n]['slot']
    t0 = t0 + TRIM_START.get(n, 0.0)
    pcs = pieces_for(t0, t1, events)
    f, g = solve_speed(pcs, slot - TAIL)
    chain, labels, mapped, acc = [], [], [], 0.0
    for i, (a, b, k, lbl) in enumerate(pcs):
        sp = f if k == 'wait' else g
        flt = f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{sp:.4f},fps=30,scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={B.BG},setsar=1"
        if sp > 1.15:
            txt = f"Sped up {sp:.0f}x" + (f"  |  {lbl}" if lbl else "") if sp >= 2 else f"Sped up {sp:.1f}x"
            open(os.path.join(ROOT, 'work', f'lbl{n}_{i}.txt'), 'w', encoding='utf8').write(txt)
            flt += (f",drawtext=fontfile={LABEL_FONT}:textfile=work/lbl{n}_{i}.txt:fontsize=34:fontcolor=white:box=1:boxcolor=0x0b0d12@0.85:boxborderw=16:x=(w-tw)/2:y=40")
        chain.append(flt + f"[p{i}]")
        mapped.append((a, b, acc, sp)); acc += (b - a) / sp
        labels.append(f'[p{i}]')
    chain.append(''.join(labels) + f"concat=n={len(pcs)}:v=1:a=0,{extra_filter}format=yuv420p[v]")
    open(os.path.join(ROOT, 'work', f'cut{n}.txt'), 'w', encoding='utf8').write(';\n'.join(chain))
    out = f'takes/beat{n}.mp4'
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-/filter_complex', f'work/cut{n}.txt', '-map', '[v]', '-r', '30',
           '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', out])
    # remap cues
    cues = []
    for e in events:
        if e['k'] == 'cue' and t0 <= e['t'] <= t1:
            for a, b, st, sp in mapped:
                if a <= e['t'] < b:
                    cues.append({'t': round(st + (e['t'] - a) / sp, 2), 'rect': e['rect'], 'scale': e['scale'], 'hold': e['hold'], 'box': e['box'], 'what': e.get('what', '')})
                    break
    return out, f, acc, cues


def main():
    spans = split_beats()
    src = 'work/raw-main.webm'
    for n in range(2, 8):
        if n not in spans:
            continue
        t0, t1 = spans[n]
        evs = main_events()
        if n == 7:
            # beat 7 = export (main recording) + the mobile no-on-device take, joined
            out, f, dur, cues = make_take(7, src, t0, t1, evs)
            if os.path.exists(os.path.join(ROOT, 'work', 'raw-mobile.webm')):
                mobile_part(out, dur, cues)
        else:
            out, f, dur, cues = make_take(n, src, t0, t1, evs)
        json.dump({'cues': cues}, open(os.path.join(ROOT, 'cues', f'auto-beat{n}.json'), 'w'), indent=1)
        print(f'beat {n}: raw {t1 - t0:.1f}s -> {dur:.1f}s of {beats[n]["slot"]}s slot (wait speed x{f:.1f}); {len(cues)} cues')


def mobile_part(main_take, main_dur, main_cues):
    """Appends the 390 px no-on-device recording, centred on the dark brand background with honest labels."""
    n = 7
    slot = beats[n]['slot']
    mev = [e for e in log['events'] if e.get('mobile')]
    end = [e['t'] for e in mev if e['k'] == 'end'][0]
    # compose phone recording into a 1920x1080 frame first
    comp = 'work/mobile-comp.mp4'
    fc = (f"color=c={B.BG}:s={W}x{H}:r=30[bg];[0:v]fps=30,scale=-2:980[ph];[bg][ph]overlay=(W-w)/2:50:shortest=1,"
          f"drawtext=fontfile={LABEL_FONT}:text='Second Chrome profile':fontsize=40:fontcolor=white:x=60:y=380,"
          f"drawtext=fontfile={LABEL_FONT}:text='No on-device model':fontsize=40:fontcolor=0x93c5fd:x=60:y=440,"
          f"drawtext=fontfile={LABEL_FONT}:text='390 px wide':fontsize=34:fontcolor=0xaab2c4:x=60:y=500,format=yuv420p[v]")
    open(os.path.join(ROOT, 'work', 'mobcomp.txt'), 'w', encoding='utf8').write(fc)
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', 'work/raw-mobile.webm', '-/filter_complex', 'work/mobcomp.txt', '-map', '[v]', '-t', f'{end:.2f}',
           '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', comp])
    # speed up the cloud wait, fit the remaining time
    avail = slot - TAIL - main_dur
    end = min(end, MOBILE_WINDOW[1])
    pcs = pieces_for(MOBILE_WINDOW[0], end, mev)
    f, g = solve_speed(pcs, avail)
    chain, labels, acc = [], [], 0.0
    for i, (a, b, k, lbl) in enumerate(pcs):
        sp = f if k == 'wait' else g
        flt = f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{sp:.4f},fps=30"
        if sp > 1.15:
            txt = f"Sped up {sp:.0f}x  |  {lbl}"
            open(os.path.join(ROOT, 'work', f'mlbl{i}.txt'), 'w', encoding='utf8').write(txt)
            flt += f",drawtext=fontfile={LABEL_FONT}:textfile=work/mlbl{i}.txt:fontsize=34:fontcolor=white:box=1:boxcolor=0x0b0d12@0.85:boxborderw=16:x=(w-tw)/2:y=40"
        chain.append(flt + f"[m{i}]"); labels.append(f'[m{i}]'); acc += (b - a) / sp
    chain.append(''.join(labels) + f"concat=n={len(pcs)}:v=1:a=0[mv]")
    open(os.path.join(ROOT, 'work', 'mobcut.txt'), 'w', encoding='utf8').write(';\n'.join(chain))
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', comp, '-/filter_complex', 'work/mobcut.txt', '-map', '[mv]', '-r', '30', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', 'work/mobile-cut.mp4'])
    with open(os.path.join(ROOT, 'work', 'join7.txt'), 'w') as fh:
        fh.write(f"file '../{main_take}'\nfile 'mobile-cut.mp4'\n")
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'work/join7.txt', '-c', 'copy', 'takes/beat7.mp4'])
    print(f'  beat 7 mobile part: {acc:.1f}s (x{f:.1f} on the cloud wait)')


if __name__ == '__main__':
    main()
