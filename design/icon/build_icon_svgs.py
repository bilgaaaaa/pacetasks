# Draws the PaceTasks icon as SVGs: a lap ring (pace) that a check mark (task done) breaks through.
import math

CX, CY, R = 512, 520, 250          # ring centre and radius on a 1024 canvas
RING_W, CHECK_W = 62, 78

def pt(deg, r=R):
    a = math.radians(deg)
    return CX + r * math.cos(a), CY + r * math.sin(a)

def ring_path():
    # Open at the top right (from -72deg to -18deg), where the check's long arm leaves the ring.
    x1, y1 = pt(-12)
    x2, y2 = pt(-78)
    return f"M {x1:.1f} {y1:.1f} A {R} {R} 0 1 1 {x2:.1f} {y2:.1f}"

CHECK = "M 392 528 L 482 618 L 712 330"

def mark(ring, check):
    return (
        f'<path d="{ring_path()}" fill="none" stroke="{ring}" stroke-width="{RING_W}" stroke-linecap="round"/>'
        f'<path d="{CHECK}" fill="none" stroke="{check}" stroke-width="{CHECK_W}" stroke-linecap="round" stroke-linejoin="round"/>'
    )

def svg(body, bg=None, scale=1.0):
    back = ""
    if bg == "sage":
        back = ('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
                '<stop offset="0" stop-color="#4E8552"/><stop offset="1" stop-color="#2F5E38"/></linearGradient></defs>'
                '<rect width="1024" height="1024" fill="url(#g)"/>')
    t = f'<g transform="translate(512 512) scale({scale}) translate(-512 -512)">{body}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{back}{t}</svg>'

files = {
    "icon.svg": svg(mark("#9FC89D", "#F6F8F1"), bg="sage"),
    # Android crops the foreground to the middle two thirds, so the mark is drawn smaller.
    "adaptive-icon.svg": svg(mark("#9FC89D", "#F6F8F1"), scale=0.62),
    "monochrome-icon.svg": svg(mark("#FFFFFF", "#FFFFFF"), scale=0.62),
    "splash-icon.svg": svg(mark("#9FC89D", "#3F7446")),
    "splash-icon-dark.svg": svg(mark("#4F7A56", "#E4ECDF")),
    "notification-icon.svg": svg(mark("#FFFFFF", "#FFFFFF")),
}
for name, content in files.items():
    open(name, "w").write(content)
print("wrote", ", ".join(files))
