import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#282D2A] bg-[#1A1D1B] p-8 text-center">
        <p className="font-mono text-4xl font-bold tracking-tight text-[#6B9080] tabular-nums">
          404
        </p>
        <h1 className="mt-3 text-lg font-bold text-[#E4E6E1]">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-1.5 text-xs text-[#8F9691]">
          주소가 변경되었거나 삭제된 페이지입니다.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] px-4 py-2 text-xs font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
          >
            <ArrowLeft className="size-3.5" />
            <span>커뮤니티로</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
