import { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
