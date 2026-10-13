# rec/NNNNN_<ms>.jpg (실시간 녹화) → 60fps MP4. 사용: python encode.py <출력.mp4> <시작ms> <끝ms>
import glob, os, sys, subprocess, shutil
import imageio_ffmpeg
out, t0, t1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fs = sorted(glob.glob('rec/*.jpg')); ms = [int(f.rsplit('_', 1)[1][:-4]) for f in fs]
tmp = 'enc'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
j = 0; n = 0
for t in range(t0, t1, 1000 // 60):          # 60fps 로 다시 고름 (그 시각에 화면에 있던 프레임)
    while j + 1 < len(ms) and ms[j + 1] <= t: j += 1
    shutil.copy(fs[j], f'{tmp}/{n:05d}.jpg'); n += 1
for k in range(60):                          # 마지막 화면 1초 정지
    shutil.copy(fs[j], f'{tmp}/{n:05d}.jpg'); n += 1
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-framerate', '60', '-i', f'{tmp}/%05d.jpg',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out], check=True)
print(out, n, 'frames', os.path.getsize(out) // 1024, 'KB')
