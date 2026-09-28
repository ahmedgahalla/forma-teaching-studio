"""Compose a narrated feature overview from model illustrations, never app captures.

Requires Pillow and FFmpeg. Narration and render manifests live in the output folder.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def run(args):
    subprocess.run([str(arg) for arg in args], check=True)


def lines(text, font, width):
    result = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if font.getlength(candidate) > width and current:
            result.append(current)
            current = word
        else:
            current = candidate
    return result + [current]


def fonts(repo):
    folder = repo / "public/fonts"
    return {
        "brand": ImageFont.truetype(str(folder / "InstrumentSerif-Regular.ttf"), 42),
        "title": ImageFont.truetype(str(folder / "InstrumentSerif-Regular.ttf"), 84),
        "body": ImageFont.truetype(str(folder / "IBMPlexSans-Variable.ttf"), 37),
        "small": ImageFont.truetype(str(folder / "IBMPlexSans-Variable.ttf"), 28),
        "caption": ImageFont.truetype(str(folder / "IBMPlexSans-Variable.ttf"), 23),
        "mono": ImageFont.truetype(str(folder / "IBMPlexMono-Regular.ttf"), 19),
    }


def make_cards(repo, output, chapters):
    font = fonts(repo)
    cream, muted, accent = "#efe6db", "#acb8c7", "#8fc3e0"
    cards = output / "cards"
    cards.mkdir(exist_ok=True)
    render_names = {"hero": "hero-threequarter", "canine": "canine-closeup"}
    for index, chapter in enumerate(chapters, 1):
        canvas = Image.new("RGB", (1920, 1080), "#0d111b")
        draw = ImageDraw.Draw(canvas)
        draw.text((80, 44), "Nael Teaching Studio", font=font["brand"], fill=cream)
        draw.text((1260, 60), "FOR PROFESSOR NAEL", font=font["mono"], fill=accent)
        draw.text((80, 127), chapter["title"], font=font["title"], fill=cream)
        draw.text((83, 244), chapter["kicker"], font=font["small"], fill=accent)
        draw.line((80, 307, 1840, 307), fill="#2b3645", width=2)
        draw.line((1210, 348, 1210, 906), fill="#2b3645", width=2)
        for point_index, point in enumerate(chapter["points"]):
            y = 369 + point_index * 163
            draw.text((1260, y + 4), f"0{point_index + 1}", font=font["mono"], fill=accent)
            for line_index, line in enumerate(lines(point, font["body"], 514)):
                draw.text((1320, y + line_index * 48), line, font=font["body"], fill=cream)
        draw.text((103, 919), "MODEL ILLUSTRATION", font=font["mono"], fill=muted)
        draw.text((1260, 877), "EXPLORE  /  EXPLAIN  /  DISCUSS", font=font["mono"], fill=accent)
        if index == 1:
            footer = "Feature overview with model illustrations and AI narration."
        elif index == len(chapters):
            footer = "Educational prototype · Synthetic anatomy · Not for clinical use"
        else:
            footer = "Professor-led learning. A model you can question, replay and compare."
        draw.text((80, 992), footer, font=font["caption"], fill=muted)
        draw.text((1740, 993), f"{index:02} / {len(chapters):02}", font=font["mono"], fill=accent)
        for segment in range(len(chapters)):
            x = 80 + segment * 220
            draw.rounded_rectangle((x, 1049, x + 202, 1053), radius=2,
                                   fill=accent if segment < index else "#263140")

        figure = Image.new("RGB", (1120, 570), "#0d111b")
        figure_draw = ImageDraw.Draw(figure)
        for radius in range(520, 0, -4):
            strength = 1 - radius / 520
            color = (int(13 + 7 * strength), int(17 + 9 * strength), int(27 + 12 * strength))
            figure_draw.ellipse((560-radius, 285-radius*.55, 560+radius, 285+radius*.55), fill=color)
        render_name = render_names.get(chapter["render"], chapter["render"])
        model = Image.open(output / "renders" / f"{render_name}.png").convert("RGBA")
        model = model.crop(model.getchannel("A").getbbox())
        model.thumbnail((1020, 522), Image.Resampling.LANCZOS)
        figure.paste(model, ((1120-model.width)//2, (570-model.height)//2), model)
        card_path = cards / f"{index:02}.png"
        canvas.save(card_path)
        figure.save(cards / f"{index:02}-figure.png")
        canvas.paste(figure, (80, 330))
        canvas.save(cards / f"{index:02}-preview.png")
    return cards


def probe_duration(ffprobe, path):
    result = subprocess.check_output([
        str(ffprobe), "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True)
    return float(result.strip())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--cards-only", action="store_true")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    chapters = json.loads((repo / "docs/pitch/nael-pitch.json").read_text(encoding="utf-8"))["chapters"]
    audio = json.loads((output / "audio/sources.json").read_text(encoding="utf-8"))["sources"]
    cards = make_cards(repo, output, chapters)
    if args.cards_only:
        return
    clips = output / "clips"
    clips.mkdir(exist_ok=True)
    ffprobe = args.ffmpeg.with_name("ffprobe.exe" if args.ffmpeg.suffix == ".exe" else "ffprobe")
    timeline = []
    start = 0.0
    for index, (chapter, source) in enumerate(zip(chapters, audio, strict=True), 1):
        input_audio = output / "audio" / source["file"]
        duration = math.ceil((probe_duration(ffprobe, input_audio) / source["tempo"] + 1.45) * 24) / 24
        clip = clips / f"{index:02}.mp4"
        effect = (
            "[1:v]zoompan=z='min(pzoom+0.000035,1.025)':x='iw/2-iw/zoom/2':"
            "y='ih/2-ih/zoom/2':d=1:s=1120x570:fps=24[art];"
            f"[0:v][art]overlay=80:330,fade=t=in:st=0:d=0.4,"
            f"fade=t=out:st={duration-.4:.3f}:d=0.4[v]"
        )
        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
             "-loop", "1", "-framerate", "24", "-i", cards / f"{index:02}.png",
             "-loop", "1", "-framerate", "24", "-i", cards / f"{index:02}-figure.png",
             "-i", input_audio, "-filter_complex_threads", "2", "-filter_complex", effect,
             "-map", "[v]", "-map", "2:a", "-af",
             f"atempo={source['tempo']},adelay=650,apad=pad_dur=1,loudnorm=I=-16:TP=-1.5:LRA=11",
             "-t", f"{duration:.6f}", "-r", "24", "-c:v", "libx264", "-threads", "2",
             "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-ar", "48000", "-b:a", "160k", "-movflags", "+faststart", clip])
        timeline.append({"chapter": index, "title": chapter["title"], "start": start, "duration": duration})
        start += duration
        print(f"Composed chapter {index}/{len(chapters)}: {duration:.2f}s", flush=True)
    concat = clips / "concat.txt"
    concat.write_text("".join(f"file '{index:02}.mp4'\n" for index in range(1, len(chapters)+1)), encoding="utf-8")
    video = output / "Nael-Teaching-Studio-Pitch.mp4"
    run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", concat, "-c", "copy", "-movflags", "+faststart", video])
    (output / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    (output / "Pitch-script.md").write_text(
        "# Nael Teaching Studio — pitch narration\n\n"
        "Feature overview with current-model illustrations and a synthetic stock voice; not a live app recording.\n\n"
        + "\n\n".join(f"## {item['title']}\n\n{item['text']}" for item in chapters), encoding="utf-8")
    print(f"Video ready: {video} ({start:.2f}s)", flush=True)


if __name__ == "__main__":
    main()
