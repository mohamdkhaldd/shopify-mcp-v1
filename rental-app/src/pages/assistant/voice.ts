// تسجيل صوت للمساعد: بيتسجل WAV (١٦ كيلو، قناة واحدة) عشان يشتغل على اللاب والتابلت
// والمتصفح من غير أي فورمات خاص — وبعدين بيتبعت لـ Gemini يكتبه كلام.

export const MAX_SECONDS = 90;

export interface Recording {
  stop: () => Promise<{ data: string; mediaType: string; seconds: number }>;
  cancel: () => void;
}

export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("الجهاز ده مش بيسمح بتسجيل الصوت");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error("اسمح للبرنامج يستخدم المايك (من إعدادات الجهاز) وجرّب تاني");
  }
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination);
  const started = Date.now();
  const close = async () => {
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    await ctx.close().catch(() => {});
    return rate;
  };
  return {
    cancel: () => void close(),
    stop: async () => {
      const rate = await close();
      const seconds = (Date.now() - started) / 1000;
      const pcm = downsample(merge(chunks), rate, 16000).subarray(0, 16000 * MAX_SECONDS);
      return { data: toBase64(encodeWav(pcm, 16000)), mediaType: "audio/wav", seconds };
    },
  };
}

function merge(chunks: Float32Array[]) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return out;
}

function downsample(data: Float32Array, from: number, to: number) {
  if (from <= to) return data;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // متوسط العينات اللي في الفترة (أنضف من أخد عينة واحدة)
    const a = Math.floor(i * ratio);
    const b = Math.min(data.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += data[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

function encodeWav(pcm: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---- الرد بالصوت ----
// السيرفر بيرجّع PCM خام (audio/L16;rate=24000) — بنلفه WAV ونشغّله
let playing: HTMLAudioElement | null = null;

export function stopSpeech() {
  if (playing) {
    playing.pause();
    playing = null;
  }
}

export async function playSpeech(b64: string, mediaType: string) {
  stopSpeech();
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let blob: Blob;
  if (/L16|pcm/i.test(mediaType)) {
    const rate = Number(/rate=(\d+)/.exec(mediaType)?.[1] ?? 24000);
    // PCM ١٦ بت little-endian جاي من السيرفر
    const pcm = new Float32Array(bytes.length >> 1);
    const v = new DataView(bytes.buffer);
    for (let i = 0; i < pcm.length; i++) pcm[i] = v.getInt16(i * 2, true) / 0x8000;
    blob = new Blob([encodeWav(pcm, rate)], { type: "audio/wav" });
  } else blob = new Blob([bytes], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  playing = a;
  await new Promise<void>((resolve) => {
    a.onended = a.onerror = a.onpause = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    a.play().catch(() => resolve());
  });
  if (playing === a) playing = null;
}
