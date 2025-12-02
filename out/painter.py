from PIL import Image, ImageDraw, ImageFont
from scalebar import get_scalebar_size_and_label

class Painter:
    def __init__(self, image: Image) -> None:
        self._image = image
        self.align = ""
        self.stroke = (255, 255, 255)
        self.fill = (255, 255, 255)
        self._x = 0
        self._y = 0
        (width, height) = self._image.size
        self._scale_w = width / 100
        self._scale_h = height / 100
        self._scale = min(width, height) / 100
        self.font_size(3)

    def font_size(self, size: float):
        self.font = ImageFont.truetype(font="./font.ttf", size=int(size * self._scale))

    def clear(self, red: int, green: int, blue: int):
        (width, height) = self._image.size
        draw = ImageDraw.Draw(self._image)
        draw.rectangle([(0,0), (width, height)], fill=(red, green, blue))

    def scalebar(self, prefered_width, height, micrometers_per_pixel):
        (scalebar_width, scalebar_label) = get_scalebar_size_and_label(
            prefered_width * self._scale_w,
            micrometers_per_pixel
        )
        scalebar_height = height * self._scale_h
        (x, y) = self.xy(scalebar_width, scalebar_height)
        draw = ImageDraw.Draw(self._image)
        w = scalebar_width / 5
        xx = x
        w2 = w / 2
        for i in range(5):
            draw.rectangle([xx, y, xx + w2, y + scalebar_height], fill=self.fill, width=0)
            xx += w
        draw.rectangle([x, y, x + scalebar_width, y + scalebar_height], outline=self.fill, fill=None, width=2)
        self._y += scalebar_height
        self.text(scalebar_label)

    def image(self, path, percentage_of_image_width):
        (image_w, _image_h) = self._image.size
        input = Image.open(path)
        (input_w, input_h) = input.size
        width = percentage_of_image_width * image_w * 0.01
        # We don't want to scale above 1 in order to prevent pixellisation.
        scale = min(1, width / input_w)
        if scale != 1:
            input_w = int(scale * input_w)
            input_h = int(scale * input_h)
            input = input.resize((input_w, input_h), Image.LANCZOS)
        (x, y) = self.xy(input_w, input_h)
        if input.mode == "RGBA":
            self._image.alpha_composite(input, (x, y))
        else:
            self._image.paste(input, (x, y))

    def colorramp(self, size: float, min_value: str, max_value: str):
        height = size * self._scale_h
        width = int(height / 16)
        height = int(height)
        draw = ImageDraw.Draw(self._image)
        (x, y) = self.xy(width, height)
        img = Image.open("./colorramp.jpg")
        img = img.resize((width, height), Image.LANCZOS)
        self._image.paste(img, (x, y))
        draw.rectangle([x - 1, y - 1, x + width, y + height], outline=self.fill, fill=None, width=1)
        if "L" in self.align:
            self.align = "LB"
            self._x = x
            self._y = y - width
            self.text(max_value)
            self.align = "LT"
            self._y = y + height + width
            self.text(min_value)
        else:
            self.align = "RB"
            self._x = x + width
            self._y = y - width
            self.text(max_value)
            self.align = "RT"
            self._y = y + height + width
            self.text(min_value)

    def move(self, x: float, y: float, margin=0):
        """Set the cursor at a given position.

        A negative coord means that we go backward.
        For instance after `move( -5, 3 )` the cursor will be at
        5 units of the right of the screen and 3 units of the top.

        The unit is the percentage of the shortest border (min of width and height)."""
        (width, height) = self._image.size
        margin = margin * self._scale
        self._x = int(margin + x * (width - 2 * margin) / 100)
        self._y = int(margin + y * (height - 2 * margin) / 100)
        if x < 0:
            self._x = width - self._x
        if y < 0:
            self._y = height - self._y

    def move_rel(self, dx: float, dy: float):
        (width, height) = self._image.size
        self._x = max(0, min(width - 1, int(self._x + dx * self._scale_w)))
        self._y = max(0, min(height - 1, int(self._y + dy * self._scale_h)))

    def text(self, text: str):
        draw = ImageDraw.Draw(self._image)
        bbox = draw.textbbox((0, 0), text, font=self.font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        (x, y) = self.xy(w, h)
        draw.text((int(x), int(y)), text, fill=self.fill, font=self.font)

    def progress(self, percent: float, width: float, height: float):
        """
        Paint the simulation progress bar.

        params:
          - width: width in percentage
          - height: height in percentage
        """
        w = int(self._scale_w * width)
        h = int(self._scale_h * height)
        (x, y) = self.xy(w, h)
        draw = ImageDraw.Draw(self._image)
        yc = int(y + h / 2)
        [R,G,B] = [int(x * 0.7) for x in self.fill]
        dark = (R, G, B)
        draw.line([x, yc, x + w, yc], fill=dark, width=int(h * 0.1))
        draw.line([x, yc, int(x + w * percent), yc], fill=self.fill, width=int(h * 0.2))
        # draw.line([x + w, y, x + w, y + h], fill=dark, width=int(h * 0.1))
        # draw.line([x, y, x, y + h], fill=dark, width=int(h * 0.1))

    def xy(self, w: float, h: float):
        """
        Compute real (x,y) pixel coordinates.

        Current alignement will be taken into account.

        params:
          - w: width in pixels
          - h: height in pixels
        """
        align = self.align
        x = self._x
        y = self._y
        align = align.upper()
        if "L" in align:
            x = self._x
        elif "R" in align:
            x = self._x - w
        else:
            x = self._x - w / 2
        if "T" in align:
            y = self._y
        elif "B" in align:
            y = self._y - h
        else:
            y = self._y - h / 2
        return (int(x), int(y))
