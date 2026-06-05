import base64
import asyncio
import traceback

import edge_tts


def clean_text(text: str) -> str:
    return text.replace("*", "").replace("#", "").replace("_", "")


async def stream_tts(text: str, voice: str):
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]


async def stream_tts_pcm(text: str, voice: str, chunk_size: int = 4096):
    """
    Stream TTS audio re-encoded as f32le PCM chunks (base64).
    Yields dicts with keys: data (b64), format, sample_rate.
    """
    ffmpeg = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-i", "pipe:0",
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ar", "24000",
        "-ac", "1",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async def _push():
        comm = edge_tts.Communicate(text, voice)
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                ffmpeg.stdin.write(chunk["data"])
                await ffmpeg.stdin.drain()
        ffmpeg.stdin.close()
        await ffmpeg.stdin.wait_closed()

    async def _read():
        while True:
            pcm = await ffmpeg.stdout.read(chunk_size)
            if not pcm:
                break
            yield {
                "data": base64.b64encode(pcm).decode("utf-8"),
                "format": "f32le",
                "sample_rate": 24000,
            }

    push_task = asyncio.create_task(_push())

    try:
        async for chunk in _read():
            yield chunk
    except Exception as e:
        push_task.cancel()
        print(f"TTS stream error: {e}")
        traceback.print_exc()
    finally:
        if ffmpeg.returncode is None:
            ffmpeg.kill()
            await ffmpeg.wait()
