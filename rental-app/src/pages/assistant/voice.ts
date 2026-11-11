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
