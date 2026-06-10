import os
import tempfile
import asyncio
import time

from faster_whisper import WhisperModel

_stt_model = None
_stt_lock = asyncio.Lock()


async def get_model():
    global _stt_model
    if _stt_model is not None:
        return _stt_model
    async with _stt_lock:
        if _stt_model is not None:
            return _stt_model
        device = os.getenv("STT_DEVICE", "cpu")
        print(f"[STT] Loading Whisper model (device={device})...")
        t0 = time.time()
        _stt_model = await asyncio.to_thread(
            WhisperModel, "small.en", device=device, compute_type="int8"
        )
        print(f"[STT] Whisper model loaded in {time.time() - t0:.1f}s")
    return _stt_model


async def transcribe_bytes(audio_bytes: bytes) -> str:
    raw_path = None
    wav_path = None
    try:
        model = await get_model()
        print(f"[STT] Received {len(audio_bytes)} bytes of audio")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".in") as tmp:
            tmp.write(audio_bytes)
            raw_path = tmp.name

        import subprocess

        def _convert():
            out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            out.close()
            last_err = ""
            for probe in [["-f", "webm"], ["-f", "matroska"], ["-f", "ogg"], []]:
                cmd = ["ffmpeg", "-y"] + probe + ["-i", raw_path,
                       "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", out.name]
                r = subprocess.run(cmd, capture_output=True)
                if r.returncode == 0:
                    return out.name
                last_err = r.stderr.decode(errors="replace")
            err = last_err[-500:]
            print(f"ffmpeg stderr (tail):\n{err}")
            raise RuntimeError(f"ffmpeg exited with code {r.returncode}")

        wav_path = await asyncio.to_thread(_convert)

        def _run():
            segments, _ = model.transcribe(
                wav_path, beam_size=1, language="en", vad_filter=True
            )
            return "".join(s.text for s in segments)

        text = await asyncio.to_thread(_run)
        return text.strip()
    except Exception as e:
        print(f"STT error: {e}")
        return "[Error transcribing audio]"
    finally:
        if raw_path and os.path.exists(raw_path):
            os.remove(raw_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)


async def transcribe_base64(b64_audio: str) -> str:
    import base64
    try:
        data = base64.b64decode(b64_audio)
        return await transcribe_bytes(data)
    except Exception as e:
        print(f"STT decode error: {e}")
        return "[Error transcribing audio]"
