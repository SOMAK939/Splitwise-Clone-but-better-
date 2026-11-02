"""
make-icons.py — draws the SplitFree logo and writes every icon size the app needs.

Run from the project root:  python3 scripts/make-icons.py   (needs: pip install pillow)

The logo: a white coin split into two halves on a green background, with a ₹ in
the middle. "Split" + "rupee" at a glance.
"""
from PIL import Image, ImageDraw, ImageFont

GREEN = (15, 157, 110, 255)  # #0F9D6E, same as the app's primary color
WHITE = (255, 255, 255, 255)
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
S = 1024  # draw big, then shrink, so edges stay smooth


def coin(size: int, color, symbol_color, transparent_bg: bool, scale: float = 0.62) -> Image.Image:
    """The split coin, centred, `scale` = coin width as a share of the image."""
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0) if transparent_bg else GREEN)
    d = ImageDraw.Draw(img)
    r = int(S * scale / 2)
    c = S // 2
    gap = int(S * 0.035)  # space between the two halves
    shift = int(S * 0.03)  # halves slide apart a little, like a coin being split
    # Left half (slightly up) and right half (slightly down).
    d.pieslice([c - r - gap, c - r - shift, c + r - gap, c + r - shift], 90, 270, fill=color)
    d.pieslice([c - r + gap, c - r + shift, c + r + gap, c + r + shift], 270, 90, fill=color)
    # ₹ in the middle, in the background color so it reads as cut out of the coin.
    font = ImageFont.truetype(FONT, int(r * 1.15))
    d.text((c, c + int(S * 0.01)), '₹', font=font, fill=symbol_color, anchor='mm')
    return img.resize((size, size), Image.LANCZOS)


def rounded(img: Image.Image, radius_share: float = 0.22) -> Image.Image:
    """Round the corners (for favicons and web icons)."""
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *img.size], radius=int(img.size[0] * radius_share), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out


# App icon (square; iOS/Android round the corners themselves).
coin(1024, WHITE, GREEN, False).save('assets/images/icon.png')
# Web icons: full-bleed square works for "maskable" (Android crops it to a circle/squircle).
coin(512, WHITE, GREEN, False).save('public/icon-512.png')
coin(192, WHITE, GREEN, False).save('public/icon-192.png')
rounded(coin(48, WHITE, GREEN, False)).save('assets/images/favicon.png')
# Android adaptive icon: coin on transparent (foreground) + green layer (background).
coin(512, WHITE, GREEN, True, scale=0.5).save('assets/images/android-icon-foreground.png')
Image.new('RGBA', (512, 512), GREEN).save('assets/images/android-icon-background.png')
coin(432, WHITE, (0, 0, 0, 0), True, scale=0.5).save('assets/images/android-icon-monochrome.png')
# Splash screen logo (shown on the green splash background).
coin(228, WHITE, GREEN, True, scale=0.9).save('assets/images/splash-icon.png')

# Link preview image for WhatsApp, iMessage, etc. (1200 x 630).
og = Image.new('RGBA', (1200, 630), GREEN)
og.alpha_composite(coin(380, WHITE, GREEN, True, scale=0.9), (90, 125))
d = ImageDraw.Draw(og)
d.text((520, 230), 'SplitFree', font=ImageFont.truetype(FONT, 108), fill=WHITE, anchor='lm')
d.text((524, 340), 'Split bills with friends.', font=ImageFont.truetype(FONT.replace('ExtraBold', 'SemiBold'), 44), fill=WHITE, anchor='lm')
d.text((524, 400), 'Free forever. No ads.', font=ImageFont.truetype(FONT.replace('ExtraBold', 'SemiBold'), 44), fill=(220, 255, 238, 255), anchor='lm')
og.convert('RGB').save('public/og.png', optimize=True)
print('icons written')
