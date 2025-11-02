import { useEffect, useRef } from 'react';

// ★★★ 修正点: `export default` ではなく `export function` (名前付きエクスポート) に統一 ★★★
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  // コールバックの最新版を記憶
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // インターバルを設定
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
