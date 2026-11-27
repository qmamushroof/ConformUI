#!/usr/bin/env python
"""Generates takes\\beat1.mp4 (design vs flawed page, slow zoom on the CTA) and takes\\beat8.mp4 (logo + URLs).
Both are static renders from the repo (design image, flawed sample page screenshot via shot-flawed.cjs, app logo).
Run: python scripts\\gen_beats.py   (run node scripts\\shot-flawed.cjs first if assets\\flawed.png is missing)"""
import os, subprocess, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import build as B

ROOT, W, H = B.ROOT, 1920, 1080
DARK, LOGO = (11, 13, 18), (96, 165, 250)  # app dark-mode surface and accent
A = lambda n: os.path.join(ROOT, 'assets', n)
os.makedirs(os.path.join(ROOT, 'takes'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'work'), exist_ok=True)


def draw_logo(size, color=(37, 99, 235)):
    """Logo geometry from public/icon.svg (viewBox 64, stroke 2, square caps, miter joins), drawn rectilinear."""
    k = 8  # supersample
    s = size * k / 64.0
    img = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    paths = [[(52, 22), (52, 12), (12, 12), (12, 52), (52, 52), (52, 42)], [(23, 26), (23, 38), (35, 38), (35, 26)], [(41, 26), (41, 38)]]
    for pts in paths:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            xa, xb = sorted((x0, x1)); ya, yb = sorted((y0, y1))
            d.rectangle(((xa - 1) * s, (ya - 1) * s, (xb + 1) * s, (yb + 1) * s), fill=color + (255,))
    return img.resize((size, size), Image.LANCZOS)


def beat1():
    pw, ph = 900, 650
    bg = Image.new('RGB', (W, H), (11, 13, 18))
    d = ImageDraw.Draw(bg)
    d.text((60 + pw // 2, 120), 'Design', font=B.font(700, 38), fill=(147, 197, 253), anchor='mm')
    d.text((960 + 30 + pw // 2, 120), 'Built page', font=B.font(700, 38), fill=(255, 138, 128), anchor='mm')
    d.line((960, 90, 960, 860), fill=(60, 66, 80), width=3)
    for x in (60, 990):
        d.rectangle((x - 3, 168, x + pw + 2, 168 + ph + 2), outline=(60, 66, 80), width=3)
    bg.save(A('beat1-bg.png'))
    design = Image.open(A('design.png')).convert('RGB').resize((1440, 1077), Image.LANCZOS).crop((0, 0, 1440, 1040))
    flawed = Image.open(A('flawed.png')).convert('RGB').crop((0, 0, 1440, 1040))
    design.save(A('beat1-design.png')); flawed.save(A('beat1-flawed.png'))
    # CTA centres in 1440-wide page px: design (230,419) 220x52; flawed (186,443) 132x52. Scale to panel (900/1440).
    f = pw / 1440
    def z(src, cx, cy, tag):
        # panel zoom: scale the 1440x1040 source to (900*Z, 650*Z), crop 900x650 centred on the CTA
        E = '(st(1,clip((t-0.8)/11.5,0,1));ld(1)*ld(1)*(3-2*ld(1)))'
        Z = f'(1+0.9*{E})'
        return (f"[{src}]scale=w='trunc({pw}*{Z}/2)*2':h='trunc({ph}*{Z}/2)*2':eval=frame:flags=bicubic[{tag}s];"
                f"[{tag}s]crop={pw}:{ph}:x='clip({cx * f}*{Z}-{pw / 2},0,iw-{pw})':y='clip({cy * f}*{Z}-{ph / 2},0,ih-{ph})'[{tag}]")
    fc = ';'.join([z('1:v', 230, 419, 'L'), z('2:v', 186, 443, 'R'),
                   f"[0:v][L]overlay=60:168[x];[x][R]overlay=990:168,format=yuv420p[v]"])
    open(os.path.join(ROOT, 'work', 'gen1.txt'), 'w').write(fc)
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', '15', '-i', 'assets/beat1-bg.png',
           '-loop', '1', '-framerate', '30', '-t', '15', '-i', 'assets/beat1-design.png', '-loop', '1', '-framerate', '30', '-t', '15', '-i', 'assets/beat1-flawed.png',
           '-/filter_complex', 'work/gen1.txt', '-map', '[v]', '-t', '15', '-r', '30', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', 'takes/beat1.mp4'])
    print('takes/beat1.mp4')


def beat8():
    bg = Image.new('RGB', (W, H), DARK)
    d = ImageDraw.Draw(bg)
    logo = draw_logo(300, LOGO)
    bg.paste(logo, (W // 2 - 150, 130), logo)
    d.text((W // 2, 500), 'ConformUI', font=B.font(700, 96), fill=(255, 255, 255), anchor='mm')
    d.text((W // 2, 620), 'https://conformui.web.app', font=B.font(600, 56), fill=LOGO, anchor='mm')
    d.text((W // 2, 700), 'https://github.com/qmamushroof/ConformUI', font=B.font(400, 42), fill=(170, 178, 196), anchor='mm')
    bg.save(A('beat8.png'))
    B.run([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', '10', '-i', 'assets/beat8.png',
           '-vf', 'fade=t=in:st=0:d=0.6,format=yuv420p', '-t', '10', '-r', '30', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', 'takes/beat8.mp4'])
    print('takes/beat8.mp4')


def intro(seconds=3.5, fps=30):
    """Animated brand intro: the logo draws itself, wordmark and tagline fade in. Frames are piped to ffmpeg."""
    k = 4
    size = 260
    s_ = size * k / 64.0
    paths = [[(52, 22), (52, 12), (12, 12), (12, 52), (52, 52), (52, 42)], [(23, 26), (23, 38), (35, 38), (35, 26)], [(41, 26), (41, 38)]]
    lens = [sum(abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in zip(p, p[1:])) for p in paths]
    total_len = sum(lens)
    f_word, f_tag = B.font(700, 92), B.font(400, 40)
    proc = subprocess.Popen([B.FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                             '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', os.path.join(ROOT, 'takes', 'beat0.mp4')], stdin=subprocess.PIPE, cwd=ROOT)
    def ease(x):
        x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
    for i in range(int(seconds * fps)):
        t = i / fps
        img = Image.new('RGB', (W, H), DARK)
        # logo layer (draw-on 0.2s..1.5s)
        lg = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
        d = ImageDraw.Draw(lg)
        drawn = ease((t - 0.2) / 1.3) * total_len
        for p, L in zip(paths, lens):
            for (x0, y0), (x1, y1) in zip(p, p[1:]):
                seg = abs(x1 - x0) + abs(y1 - y0)
                use = max(0.0, min(seg, drawn)); drawn -= seg
                if use <= 0:
                    continue
                ex, ey = x0 + (x1 - x0) * use / seg, y0 + (y1 - y0) * use / seg
                xa, xb = sorted((x0, ex)); ya, yb = sorted((y0, ey))
                d.rectangle(((xa - 1) * s_, (ya - 1) * s_, (xb + 1) * s_, (yb + 1) * s_), fill=LOGO + (255,))
        scale = 0.9 + 0.1 * ease(t / 1.6)
        lg = lg.resize((int(size * scale * 1.15), int(size * scale * 1.15)), Image.LANCZOS)
        img.paste(lg, (W // 2 - lg.width // 2, 300 - lg.height // 2 + 20), lg)
        d2 = ImageDraw.Draw(img)
        a = ease((t - 1.3) / 0.7)
        d2.text((W // 2, 560), 'ConformUI', font=f_word, fill=tuple(int(DARK[j] + (255 - DARK[j]) * a) for j in range(3)), anchor='mm')
        a = ease((t - 1.9) / 0.7)
        d2.text((W // 2, 650), 'Design intent as a contract.', font=f_tag, fill=tuple(int(DARK[j] + (170 + [0, 8, 26][j] - DARK[j]) * a) for j in range(3)), anchor='mm')
        proc.stdin.write(img.tobytes())
    proc.stdin.close(); proc.wait()
    print('takes/beat0.mp4 (intro)')


if __name__ == '__main__':
    if not os.path.exists(A('flawed.png')):
        sys.exit('run: node scripts\\shot-flawed.cjs first')
    intro(); beat1(); beat8()
