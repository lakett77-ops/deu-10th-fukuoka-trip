import type { PropsWithChildren } from "react";
import { X } from "lucide-react";

interface ModalProps extends PropsWithChildren {
  title: string;
  open: boolean;
  onClose: () => void;
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-white p-4 shadow-2xl sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
