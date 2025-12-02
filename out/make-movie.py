import os
import sys
import json
import time
import math
import traceback

# Turn "debug" to True to get more verbose output for debugging purpose.
debug = True


# Snapshot frames names are 6-zero-padded numbers.
def pad(num, size=6):
    txt = str(num)
    while len(txt) < size:
        txt = f"0{txt}"
    return txt


class FrameDescription:
    input: str
    output: str
    step: int

    def __init__(self, input: str, output: str, step: int) -> None:
        self.input = input
        self.output = output
        self.step = step


def get_frame_descriptions(config):
    frames_count = int(config["fps"] * config["duration"])
    print("Total frames to compose:", frames_count)
    frame_descriptions = []
    first_step = config["firstStep"]
    last_step = config["lastStep"]
    print(f"First step: {first_step}, Last step: {last_step}")

    for frame_index in range(frames_count):
        print(f"Frame index: {frame_index}")
        step = (
            first_step
            if frames_count < 2
            else int(
                first_step + (last_step - first_step) * frame_index / (frames_count - 1)
            )
        )
        input = os.path.abspath(f"./output/brayns/{pad(frame_index)}.png")
        output = os.path.abspath(f"./output/final/{pad(frame_index)}.jpg")
        frame_descriptions.append(FrameDescription(input, output, step))
    return frame_descriptions


def load_config():
    try:
        with open("./config.json", "r") as fd:
            return json.load(fd)
    except Exception as ex:
        raise Exception(
            f"""Unable to load file "config.json"!

{ex}
"""
        )


def read_file_content(filename: str):
    if os.path.exists(filename) == False:
        return ""
    with open(filename, "r") as fd:
        return fd.readlines()


def grep(lines: list[str], search_text: str):
    return [line for line in lines if search_text in line]


def wait_for_brayns_images(config):
    nodes_count = int(sys.argv[1])
    path = os.path.abspath("./output/brayns")
    frames_count = int(config["fps"] * config["duration"])
    count = 0
    previous_count = -1
    while count < frames_count:
        time.sleep(1)
        count = 0
        with os.scandir(path) as entries:
            for entry in entries:
                if not entry.is_dir():
                    if entry.name[-4:] == ".png":
                        count += 1
        if count != previous_count:
            print(f"Brayns has generated {count}/{frames_count} images...")
            previous_count = count
        # Check for errors.
        # for node_index in range(nodes_count):
        #     lines = read_file_content(f"./output/logs/agent-{node_index}.log")
        #     search_result = grep(lines, "#" * 60)
        #     if len(search_result) > 0:
        #         print("===============================================")
        #         print(f"Agent #{node_index} encountered a fatal error!")
        #         print()
        #         error_lines = []
        #         waiting_for_error = True
        #         for line in lines:
        #             if ("#" * 60) in line:
        #                 waiting_for_error = not waiting_for_error
        #             if not waiting_for_error:
        #                 error_lines.append(line)
        #         print("".join(error_lines))
        #         print("-----------------------------------------------")
        #         print("All the logs are in ./output/logs folder.")
        #         print("Try to fix the issue and restart the process.")
        #         print("The images already generated will be kept.")
        #         print()
        #         sys.exit(1)


def wait_for_allocations():
    nodes_count = int(sys.argv[1])
    print(f"Waiting for {nodes_count} nodes to be allocated...")
    previous_count = -1
    nodes_ready = 0
    # while nodes_ready != nodes_count:
    #     time.sleep(1)
    #     nodes_ready = 0
    #     for node_index in range(nodes_count):
    #         search_result = grep(
    #             read_file_content(f"./output/logs/brayns-{node_index}.log"),
    #             "Server started on '0.0.0.0:5000'.",
    #         )
    #         if len(search_result) > 0:
    #             nodes_ready += 1
    #     if previous_count != nodes_ready:
    #         previous_count = nodes_ready
    #         print(f"Allocated nodes: {nodes_ready}/{nodes_count}...")


def print_box(text: str):
    print(f"+{'-' * (len(text) + 2)}+")
    print(f"| {text} |")
    print(f"+{'-' * (len(text) + 2)}+")


#########################################################################################


def start():
    try:
        start = time.time()
        print_box(f"Brayns Movie Maker (Compositor)")
        config = load_config()
        wait_for_allocations()
        print("Loading data will take some time before the actual rendering can start.")
        wait_for_brayns_images(config)
        print("Generating final video file...")
        command = f"ffmpeg -hide_banner -loglevel warning -y -framerate {config['fps']} -i \"./output/final/%06d.jpg\" -vf format=yuvj420p,fps={config['fps']} \"./output/movie.mp4\""
        os.system(command)
        print_box('File saved as: "./output/movie.mp4"')
        end = time.time()
        seconds = math.floor(end - start)
        minutes = math.floor(seconds / 60)
        seconds = seconds - 60 * minutes
        print(f"Elasped time: {minutes} min {seconds} sec")
    except Exception as ex:
        if debug:
            traceback.print_exc()
        print("#" * 60)
        print(ex)
        print("#" * 60)
        sys.exit(666)


if __name__ == "__main__":
    start()
