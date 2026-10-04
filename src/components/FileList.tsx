import type { ReactNode } from "react";
import { FileIcon } from "@/components/icons";
import { LINK } from "@/components/styles";

export type ListedFile = {
  id: string;
  name: string;
  /** Type and size, e.g. "PDF · 2.4 MB". */
  meta: string;
  fileName?: string;
  href?: string;
  action?: ReactNode;
};

/** Files as one bordered list, each with a View link or its own `action`. */
export function FileList({ files }: { files: ListedFile[] }) {
  return (
    <ul className="divide-y divide-line-row rounded-lg border border-line bg-white">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3 px-4 py-3">
          <FileIcon className="flex-none text-ink-secondary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{file.name}</div>
            <div className="text-tiny text-ink-muted">
              {file.fileName ? `${file.meta} · ${file.fileName}` : file.meta}
            </div>
          </div>
          {file.action ??
            (file.href && (
              <a
                href={file.href}
                target="_blank"
                aria-label={`View ${file.name}`}
                className={`flex-none text-small ${LINK}`}
              >
                View
              </a>
            ))}
        </li>
      ))}
    </ul>
  );
}
