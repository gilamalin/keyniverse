/**
 * 중첩 모달 환경에서도 body 스크롤 잠금/해제가 꼬이지 않도록 참조 카운트(Reference Count)로 관리
 */
let activeLockCount = 0;
let savedOverflow = "";

export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  if (activeLockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  activeLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLockCount = Math.max(0, activeLockCount - 1);
    if (activeLockCount === 0) {
      document.body.style.overflow = savedOverflow;
    }
  };
}
