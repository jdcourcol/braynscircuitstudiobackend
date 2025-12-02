import os
import sys
import json
import asyncio
import pathlib
import traceback
import websockets
from PIL import Image, ImageDraw, ImageFont
from painter import Painter

# Turn "debug" to True to get more verbose output for debugging purpose.
debug = False


def usage():
    print()
    print("Usage: python {} <hostname> [<instance>]".format(sys.argv[0]))
    print()
    print(
        '  - hostname: hostname and port of Brayns service (for instance "r1i5n29.bbp.epfl.ch:5000")'
    )
    print(
        '  - instance: index of the current instance for parallel work. (for instance "0/3")'
    )
    print(
        "       It's made of two numbers separated by a slash. The first one is a zero-based index"
    )
    print("       of the instance, and the second one is the number of instances.")
    print()
    print(
        "For example to render the movie on 2 nodes, you can use these command lines:"
    )
    print('  > python {} "r1i5n29.bbp.epfl.ch:5000" 0/2'.format(sys.argv[0]))
    print('  > python {} "r1i7n12.bbp.epfl.ch:5000" 1/2'.format(sys.argv[0]))
    print()
    print(
        "  The first instance will generate all the frames whose index modulo 2 is equal 0 (the even ones),"
    )
    print(
        "  and the second instance will generate all the frames whose index modulo 2 is equal 1 (the odd ones)."
    )
    print()
    sys.exit(1)


def log(*message: str):
    print(*message, flush=True)


def cancel_allocation():
    if len(sys.argv) < 3:
        return

    # [instance_index] = sys.argv[2].split("/")
    # os.system(f'scancel --name="BraynsAgent{instance_index}"')


def read_arguments():
    if len(sys.argv) < 2:
        usage()
    brayns_hostname = sys.argv[1]
    if len(sys.argv) < 3:
        return [brayns_hostname, 0, 1]
    [instance_index, instances_count] = sys.argv[2].split("/")
    instance_index = int(instance_index)
    instances_count = int(instances_count)
    return [brayns_hostname, instance_index, instances_count]


def fatal(*message):
    log("#" * 60)
    log(*message)
    log("#" * 60)
    cancel_allocation()
    sys.exit(1)


class BraynsService:
    running = True
    host_and_port: str
    connection: websockets.WebSocketClientProtocol = None
    counter = 0
    pending_queries = dict()

    def __init__(self, host_and_port: str) -> None:
        self.host_and_port = host_and_port
        self.connection = None

    async def exec(self, entrypoint: str, params=None):
        await self.connect()
        if debug:
            log(">>>", f"{entrypoint}({json.dumps(params, indent=4)})")
        id = self.next_id()
        future = asyncio.Future()
        self.pending_queries[id] = future
        if params is None:
            await self.connection.send(
                json.dumps({"jsonrpc": "2.0", "id": id, "method": entrypoint})
            )
        else:
            await self.connection.send(
                json.dumps(
                    {"jsonrpc": "2.0", "id": id, "method": entrypoint, "params": params}
                )
            )
        response = await future
        if debug:
            log("<<<", json.dumps(response, indent=4))
        if "result" in response:
            return response["result"]
        raise Exception(
            f"""Error while calling entrypoint "{entrypoint}"!
Params: {json.dumps(params, indent=4)}
Result: {json.dumps(response, indent=4)}
------------------------------------------------------------
{self.get_error_message(response)}
"""
        )

    def get_error_message(self, response):
        if "error" not in response:
            return "Unknown error!"
        error = response["error"]
        if "message" not in error:
            return "Invalid error format!"
        return error["message"]

    async def close(self):
        log("Closing connection...")
        self.running = False
        await self.connection.close()

    def next_id(self):
        self.counter = self.counter + 1
        return f"ID-{self.counter}"

    async def process_responses(self):
        while self.running:
            try:
                message = await self.connection.recv()
                data = json.loads(message)
                if "id" not in data:
                    if "params" in data and debug:
                        params = data["params"]
                        percent = 100 * float(params["amount"])
                        label = params["operation"]
                        log(f"Progress {percent:.1f}% - {label}")
                    continue
                id = data["id"]
                future = self.pending_queries[id]
                if future is not None:
                    future.set_result(data)
                else:
                    log(json.dumps(data, indent=4))
            except UnicodeDecodeError:
                # Just ignore binary messages.
                # They are JPEG images of the current scene.
                pass
            except websockets.exceptions.ConnectionClosedError as ex:
                msg = str(ex)
                if "1000 (OK)" not in msg:
                    # If the connection is closed with a 1000 (OK)
                    # message, that's normal.
                    fatal("We lost the connection:", msg)
            except Exception as ex:
                fatal(type(ex).__name__, ex)

    async def connect(self):
        if self.connection is not None:
            return
        log(f'Connecting Websocket to "{self.host_and_port}"...')
        self.connection = await websockets.connect(
            f"ws://{self.host_and_port}", ping_interval=None
        )
        asyncio.create_task(self.process_responses())


# Snapshot frames names are 6-zero-padded numbers.
def pad(num, size=6):
    txt = str(num)
    while len(txt) < size:
        txt = f"0{txt}"
    return txt


class FrameDescription:
    path: str
    path_final: str
    step: int

    def __init__(self, path: str, path_final: str, step: int) -> None:
        self.path = path
        self.step = step
        self.path_final = path_final


def get_frame_descriptions(config, instance_index, instances_count):
    frames_count = int(config["fps"] * config["duration"])
    log("Total frames to generate:", frames_count)
    frame_descriptions = []
    first_step = config.get("firstStep", 0)
    last_step = config.get("lastStep", frames_count - 1)
    for frame_index in range(frames_count):
        if frame_index % instances_count != instance_index:
            continue
        step = (
            first_step
            if frames_count < 2
            else int(
                first_step + (last_step - first_step) * frame_index / (frames_count - 1)
            )
        )
        path_brayns = os.path.abspath(f"./output/brayns/{pad(frame_index)}.png")
        path_final = os.path.abspath(f"./output/final/{pad(frame_index)}.jpg")
        if os.path.exists(path_brayns) and os.path.exists(path_final):
            # Skip frames that have already been rendered.
            continue
        frame_descriptions.append(FrameDescription(path_brayns, path_final, step))
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


async def wait_for_brayns_to_be_ready(instance_index):
    log("Waiting for Brayns to be ready...")
    # filename = os.path.abspath(f"./output/logs/brayns-{instance_index}.log")
    # log(filename)
    # while True:
    #     await asyncio.sleep(1)
    #     lines = read_file_content(filename)
    #     ready = grep(lines, "Server started on '0.0.0.0:5000'.")
    #     if len(ready) > 0:
    #         return
    return


def log_box(text: str):
    log(f"+{'-' * (len(text) + 2)}+")
    log(f"| {text} |")
    log(f"+{'-' * (len(text) + 2)}+")


#########################################################################################


async def start():
    try:
        [brayns_hostname, instance_index, instances_count] = read_arguments()
        log_box(f"Brayns Movie Maker: instance {instance_index + 1}/{instances_count}")
        await wait_for_brayns_to_be_ready(instance_index)
        config = load_config()
        has_simulation = config.get("firstStep") != None
        has_simulation = False
        frame_descriptions = get_frame_descriptions(
            config, instance_index, instances_count
        )
        service = BraynsService(brayns_hostname)
        exec = service.exec
        if len(frame_descriptions) == 0:
            log("Nothing to do.")
            await exec("quit")
            return
        version = await exec("get-version")
        log(
            f"Connected to Brayns Service version {version['major']}.{version['minor']}.{version['patch']} ({version['revision']})"
        )
        log("Setting renderer...")
        await exec(
            "set-renderer-interactive",
            {
                "ao_samples": 8,
                "enable_shadows": False,
                "max_ray_bounces": 3,
                "samples_per_pixel": 4,
            },
        )
        await exec("clear-lights")
        await exec("add-light-ambient", {"color": [1, 1, 1], "intensity": 0.8})
        log("Loading models...")
        for model in config["models"]:
            loader_name = model["loader"]["name"]
            loader_props = model["loader"]["properties"]
            path = model["loader"]["path"]
            print(f"Loading model: {path}")
            print(f"Loader name: {loader_name}")
            print(f"Loader properties: {loader_props}")
            print(f"Path: {path}")
            data = await exec(
                "add-model",
                {
                    "loader_name": loader_name,
                    "loader_properties": loader_props,
                    "path": path,
                },
            )
            model_id = data[0]["model_id"]
            if has_simulation and "transferFunction" in model:
                transfer_func = model["transferFunction"]
                if transfer_func is not None:
                    print(f"Setting color ramp: {transfer_func}")
                    await exec(
                        "set-color-ramp",
                        {
                            "id": model_id,
                            "color_ramp": {
                                "colors": transfer_func["colors"],
                                "range": [
                                    transfer_func["range"]["min"],
                                    transfer_func["range"]["max"],
                                ],
                            },
                        },
                    )
                await exec("enable-simulation", {"model_id": model_id, "enabled": True})
            else:
                try:
                    print(f"Disabling simulation for model: {model_id}")
                    await exec(
                        "enable-simulation", {"model_id": model_id, "enabled": False}
                    )
                except:
                    # If you are here, that means that there is no simulation at all.
                    pass
                await exec("color-model", {**model["colors"], "id": model_id})
        log("Loading meshes...")
        print(f"Loading meshes: {config['meshes']}")
        meshes_path = pathlib.Path(__file__).parent.resolve()
        for mesh in config["meshes"]:
            id = mesh["id"]
            name = f"mesh-{id}.obj"
            log(f"    Loading {name}")
            path = pathlib.Path.joinpath(meshes_path, name)
            models = await exec(
                "add-model",
                {"loader_name": "mesh", "loader_properties": {}, "path": str(path)},
            )
            model = models[0]
            model_id = model["model_id"]
            log("    Setting material...")
            await exec("set-material-ghost", {"model_id": model_id, "material": {}})
            await exec(
                "color-model",
                {
                    "id": model_id,
                    "method": "solid",
                    "values": {"color": mesh["color"]},
                },
            )
        log("Data loaded successfuly.")
        epflLogoPath = os.path.abspath("./epfl-logo.png")
        bbpLogoPath = os.path.abspath("./bbp-logo.png")
        frame_index = 0
        for frame in frame_descriptions:
            print(f"Setting camera for step {frame.step}...")
            log(f"Setting camera for step {frame.step}...")
            cameras_count = len(config["lookat"]["position"])
            idx = frame.step % cameras_count
            frame_index += 1
            position = config["lookat"]["position"][idx]
            target = config["lookat"]["target"][idx]
            up = config["lookat"]["up"][idx]
            await exec(
                "set-camera-view", {"position": position, "target": target, "up": up}
            )
            height = config["orthographic"]["height"][idx]
            await exec("set-camera-orthographic", {"height": height})
            log(f'Generating "{frame.path}"...')
            if has_simulation:
                print('snapshot with simulation')
                await exec(
                    "snapshot",
                    {
                        "image_settings": {
                            "size": config["resolution"],
                            "quality": 100,
                        },
                        "simulation_frame": frame.step,
                        "file_path": frame.path,
                    },
                )
            else:
                # No simulation.
                print('snapshot without simulation')
                await exec(
                    "snapshot",
                    {
                        "image_settings": {
                            "size": config["resolution"],
                            "quality": 100,
                        },
                        "file_path": frame.path,
                    },
                )
            # ============================================
            log(f'Compositing "{frame.path_final}"...')
            margin = 3
            [width, height] = config["resolution"]
            output = Image.new("RGBA", (width, height))
            painter = Painter(output)
            (red, green, blue, _) = config["background"]
            painter.clear(int(red * 255), int(green * 255), int(blue * 255))
            # EPFL Logo
            painter.move(0, 100, margin)
            painter.align = "LB"
            painter.image(epflLogoPath, 10)
            # BBP Logo
            painter.move(100, 100, margin)
            painter.align = "RB"
            painter.image(bbpLogoPath, 20)
            # Brayns' snapshot.
            painter.move(0, 0)
            painter.align = "LT"
            painter.image(frame.path, 100)
            # Scalebar
            painter.move(100, 0, margin)
            painter.align = "RT"
            painter.scalebar(
                20, 1, config["orthographic"]["height"][frame.step] / height
            )
            if (
                config.get("firstStep") != None
                and config.get("lastStep") != None
                and config.get("simulationTime") != None
            ):
                # Timeline
                percent = (frame.step - config["firstStep"]) / (
                    config["lastStep"] - config["firstStep"]
                )
                painter.align = "LT"
                painter.move(0, 0, margin)
                painter.progress(percent, 20, 3)
                painter.move(0, 3, margin)
                time = config["simulationTime"] * percent
                painter.text(f"{time:.1f} {config['simulationUnit']}")
                # Color Ramp
                painter.move(0, 50, margin)
                painter.align = "L"
                [min_value, max_value] = config["simulationRange"]
                painter.colorramp(33, min_value, max_value)
            # Output final image
            image = output.convert("RGB")
            image.save(frame.path_final)

    except Exception as ex:
        if debug:
            traceback.log_exc()
        fatal(ex)


if __name__ == "__main__":
    asyncio.run(start())
    log("Done.")
    cancel_allocation()
