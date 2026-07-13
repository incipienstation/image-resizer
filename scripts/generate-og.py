#!/usr/bin/env python3
"""Generate the Open Graph image with Python's standard library only."""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

WIDTH = 1200
HEIGHT = 630

FONT: dict[str, tuple[str, ...]] = {
    " ": ("00000",) * 7,
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "G": ("01111", "10000", "10000", "10111", "10001", "10001", "01110"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "J": ("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "W": ("10001", "10001", "10001", "10101", "10101", "11011", "10001"),
    "X": ("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "/": ("00001", "00010", "00100", "01000", "10000", "00000", "00000"),
}

pixels = bytearray(WIDTH * HEIGHT * 3)


def blend_channel(a: int, b: int, t: float) -> int:
    return max(0, min(255, round(a + (b - a) * t)))


def set_pixel(x: int, y: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
    if x < 0 or y < 0 or x >= WIDTH or y >= HEIGHT:
        return

    index = (y * WIDTH + x) * 3
    if alpha >= 1:
        pixels[index : index + 3] = bytes(color)
        return

    inverse = 1 - alpha
    pixels[index] = round(pixels[index] * inverse + color[0] * alpha)
    pixels[index + 1] = round(pixels[index + 1] * inverse + color[1] * alpha)
    pixels[index + 2] = round(pixels[index + 2] * inverse + color[2] * alpha)


def fill_rect(x: int, y: int, width: int, height: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
    for yy in range(max(0, y), min(HEIGHT, y + height)):
        for xx in range(max(0, x), min(WIDTH, x + width)):
            set_pixel(xx, yy, color, alpha)


def rounded_rect(
    x: int,
    y: int,
    width: int,
    height: int,
    radius: int,
    color: tuple[int, int, int],
    alpha: float = 1.0,
) -> None:
    radius_squared = radius * radius
    for yy in range(max(0, y), min(HEIGHT, y + height)):
        for xx in range(max(0, x), min(WIDTH, x + width)):
            dx = max(x + radius - xx, 0, xx - (x + width - radius - 1))
            dy = max(y + radius - yy, 0, yy - (y + height - radius - 1))
            if dx * dx + dy * dy <= radius_squared:
                set_pixel(xx, yy, color, alpha)


def draw_text(
    text: str,
    x: int,
    y: int,
    scale: int,
    color: tuple[int, int, int],
    spacing: int = 1,
) -> int:
    cursor = x
    for character in text.upper():
        glyph = FONT.get(character, FONT[" "])
        for row, pattern in enumerate(glyph):
            for column, bit in enumerate(pattern):
                if bit == "1":
                    fill_rect(cursor + column * scale, y + row * scale, scale, scale, color)
        cursor += (5 + spacing) * scale
    return cursor


# Background gradient.
start = (7, 10, 18)
end = (15, 23, 42)
for y in range(HEIGHT):
    for x in range(WIDTH):
        ratio = (x / (WIDTH - 1)) * 0.62 + (y / (HEIGHT - 1)) * 0.38
        set_pixel(
            x,
            y,
            (
                blend_channel(start[0], end[0], ratio),
                blend_channel(start[1], end[1], ratio),
                blend_channel(start[2], end[2], ratio),
            ),
        )

# Soft geometric glow layers.
for radius, alpha in ((300, 0.035), (230, 0.055), (160, 0.08)):
    center_x, center_y = 1000, 90
    radius_squared = radius * radius
    for yy in range(max(0, center_y - radius), min(HEIGHT, center_y + radius)):
        for xx in range(max(0, center_x - radius), min(WIDTH, center_x + radius)):
            distance_squared = (xx - center_x) ** 2 + (yy - center_y) ** 2
            if distance_squared <= radius_squared:
                set_pixel(
                    xx,
                    yy,
                    (124, 58, 237),
                    alpha * (1 - distance_squared / radius_squared),
                )

# App mark.
rounded_rect(84, 78, 112, 112, 28, (124, 58, 237))
rounded_rect(98, 92, 84, 84, 20, (37, 99, 235), 0.72)
fill_rect(116, 132, 44, 8, (255, 255, 255))
fill_rect(116, 132, 8, 30, (255, 255, 255))
fill_rect(152, 110, 8, 30, (255, 255, 255))
fill_rect(130, 110, 30, 8, (255, 255, 255))

# Main text.
draw_text("PIXEL RESIZER", 84, 232, 8, (248, 250, 252))
draw_text("LOCAL ONLY / NO UPLOAD", 88, 323, 4, (167, 139, 250))
draw_text("UP OR DOWN / KEEP RATIO", 88, 374, 3, (148, 163, 184))

# Feature badges.
badges = [
    ("PNG", 84, 506, 116),
    ("JPG", 216, 506, 132),
    ("WEBP", 364, 506, 150),
    ("32MP", 530, 506, 150),
]
for label, x, y, width in badges:
    rounded_rect(x, y, width, 54, 18, (30, 41, 59), 0.96)
    draw_text(label, x + 18, y + 16, 3, (226, 232, 240))

# Pixel motif.
rounded_rect(812, 176, 300, 300, 52, (17, 24, 39), 0.92)
for row in range(7):
    for column in range(7):
        if (row + column) % 3 == 0 or (row in (1, 5) and column in (1, 5)):
            color = (124, 58, 237) if (row + column) % 2 == 0 else (37, 99, 235)
            rounded_rect(858 + column * 30, 222 + row * 30, 20, 20, 5, color)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


raw = bytearray()
stride = WIDTH * 3
for y in range(HEIGHT):
    raw.append(0)
    start_index = y * stride
    raw.extend(pixels[start_index : start_index + stride])

png = bytearray(b"\x89PNG\r\n\x1a\n")
png.extend(png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)))
png.extend(png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9)))
png.extend(png_chunk(b"IEND", b""))

output = Path(sys.argv[1] if len(sys.argv) > 1 else "og-image.png")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(png)
print(f"Generated {output} ({WIDTH}x{HEIGHT}, {len(png)} bytes)")
