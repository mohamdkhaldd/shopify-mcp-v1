import { useState } from "react";
import { signIn } from "../auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError("الإيميل أو الباسورد غلط");
  }

  return (
    <div className="min-h-screen bg-[#F5F7F6] flex flex-col items-center justify-center px-6 max-w-md mx-auto">
      <div className="text-xl font-extrabold text-primary-dark mb-1">دفتر البنيان</div>
      <div className="text-xs text-slate-400 mb-6">سجّل دخولك عشان تكمل</div>

      <div className="w-full bg-white rounded-2xl shadow-card p-5 space-y-3">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الإيميل</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الباسورد</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            dir="ltr"
          />
        </div>
        {error && <div className="text-xs font-bold text-rose-600">{error}</div>}
        <button
          onClick={submit}
          disabled={loading || !email || !password}
          className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </div>
    </div>
  );
}
