import math
from tokenize import Exponent

# Human-friendly values to display.
# We want a list of numbers that a human can mentally multiply.
# That's why we will avoid 13, 17, etc...
SNAPPING = [1, 2, 5, 10, 20, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900]

def get_scalebar_size_and_label(
    prefered_size: float,
    micrometers_per_pixel: float
):
    """
    Compute the best width and label for the scalebar.
    """
    (radix, exponent) = clamp_to_nearest_group_of_three_digits(
        prefered_size * micrometers_per_pixel
    )
    snapped_radix = snap_to_nearest_friendly_value(radix)
    return (
        (snapped_radix * (10 ** exponent)) / micrometers_per_pixel,
        f"{snapped_radix} {get_unit(exponent)}"
    )

# Compute a `radix` between 0 and 1000
# and the `exponent` that validates
# radix * Math.pow(10, component) === value
def clamp_to_nearest_group_of_three_digits(value: float):
    GROUP_BY_THOUSANDS = 3
    exponent = int(
        math.log10(value) / GROUP_BY_THOUSANDS
    ) * GROUP_BY_THOUSANDS
    return (value * (10 ** (-exponent)), exponent)

# @returns The nearest human-friendly number to `value`.
def snap_to_nearest_friendly_value(value: float):
    nearest_target = SNAPPING[0]
    nearest_distance = abs(value - nearest_target)
    for i in range(1, len(SNAPPING)):
        target = SNAPPING[i]
        distance = abs(value - target)
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_target = target
    return nearest_target

# We choose the unit to have the less possible digits to display.
def get_unit(exponent: float) -> str:
    NANOMETER_EXPONENT = -3
    MICROMETER_EXPONENT = 0
    MILIMETER_EXPONENT = 3
    METER_EXPONENT = 6
    if exponent < NANOMETER_EXPONENT:
        return "10^{exponent} µm"
    if exponent > METER_EXPONENT:
        return "10^{exponent - METER_EXPONENT} m"
    if exponent == NANOMETER_EXPONENT:
        return "nm"
    if exponent == MICROMETER_EXPONENT:
        return "µm"
    if exponent == MILIMETER_EXPONENT:
        return "mm"
    if exponent == METER_EXPONENT:
        return "m"
    raise Exception("Exponent ({exponent}) must be a integral multiple of 3!")
