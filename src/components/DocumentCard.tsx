import { Copy, MoreHorizontal, Pencil, Share2, Star, Trash2, Download, ExternalLink } from "lucide-react";
import { useApp, type ExportFormat } from "../lib/app-context";
import { timeAgo, type DocItem } from "../lib/store";
import { AvatarStack, DocIconBadge, DocTypeIcon, Dropdown, MenuDivider, MenuItem, MenuLabel } from "./ui";
import { cn } from "../utils/cn";

export function typeLabel(t: DocItem["type"]) {
  return { doc: "Document", sheet: "Spreadsheet", slides: "Deck", pdf: "PDF", note: "Note", whiteboard: "Board" }[t];
}

export default function DocumentCard({ doc }: { doc: DocItem }) {
  const { openDoc, toggleStar, deleteDoc, duplicateDoc, renameDoc, setShareDocId, exportDoc } = useApp();
  const exportFormats: { format: ExportFormat; label: string }[] = doc.type === "sheet"
    ? [{ format: "csv", label: "CSV" }, { format: "xlsx", label: "Excel workbook" }, { format: "pdf", label: "PDF" }]
    : [{ format: "txt", label: "Plain text" }, { format: "md", label: "Markdown" }, { format: "html", label: "HTML" }, { format: "pdf", label: "PDF" }, { format: "docx", label: "Word document" }];

  return (
    <article
      onClick={() => (doc.trashed ? null : openDoc(doc.id))}
      onKeyDown={(e) => e.key === "Enter" && !doc.trashed && openDoc(doc.id)}
      tabIndex={0}
      role="button"
      aria-label={`Open ${doc.title}`}
      className="doc-card focus-ring group relative flex cursor-pointer flex-col rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <DocIconBadge type={doc.type} cover={doc.cover} />
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleStar(doc.id)}
            aria-label={doc.starred ? "Unstar" : "Star"}
            aria-pressed={doc.starred}
            className={cn(
              "focus-ring rounded-lg p-1.5 transition-all duration-200",
              doc.starred ? "text-primary" : "text-text-muted opacity-0 hover:bg-primary-light hover:text-primary-hover group-hover:opacity-100 focus:opacity-100"
            )}
          >
            <Star className={cn("h-[18px] w-[18px]", doc.starred && "fill-primary")} />
          </button>
          <Dropdown
            trigger={
              <button aria-label="Document options" className="btn-ghost focus-ring rounded-lg p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            }
            width="w-52"
          >
            {!doc.trashed ? (
              <>
                <MenuItem icon={<ExternalLink className="h-4 w-4" />} label="Open" onClick={() => openDoc(doc.id)} />
                <MenuItem icon={<Share2 className="h-4 w-4" />} label="Share…" onClick={() => setShareDocId(doc.id)} />
                <MenuItem icon={<Pencil className="h-4 w-4" />} label="Rename" onClick={() => {
                  const t = window.prompt("Rename document", doc.title);
                  if (t?.trim()) void renameDoc(doc.id, t.trim());
                }} />
                <MenuItem icon={<Copy className="h-4 w-4" />} label="Duplicate" onClick={() => duplicateDoc(doc.id)} />
                <MenuDivider />
                <MenuLabel>Export as</MenuLabel>
                {exportFormats.map(({ format, label }) => (
                  <MenuItem key={format} icon={<Download className="h-4 w-4" />} label={label} onClick={() => void exportDoc(doc.id, format)} />
                ))}
                <MenuDivider />
                <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete permanently" danger onClick={() => {
                  if (window.confirm("Delete this document permanently? This cannot be undone.")) void deleteDoc(doc.id);
                }} />
              </>
            ) : (
              <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete permanently" danger onClick={() => {
                if (window.confirm("Delete this document permanently? This cannot be undone.")) void deleteDoc(doc.id);
              }} />
            )}
          </Dropdown>
        </div>
      </div>

      <div className="mt-3.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border">
            <DocTypeIcon type={doc.type} className="h-3 w-3" /> {typeLabel(doc.type)}
          </span>
          {doc.shared && (
            <span className="inline-flex items-center rounded-md bg-primary-light px-1.5 py-0.5 text-[11px] font-bold text-primary-active ring-1 ring-orange-border/40">
              Shared
            </span>
          )}
        </div>
        <h3 className="mt-2 truncate text-[15px] font-bold tracking-tight text-text-primary">{doc.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{doc.excerpt}</p>
        {doc.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {doc.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-text-secondary">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
        <AvatarStack items={doc.collaborators} max={3} />
        <div className="text-right">
          <p className="text-[12px] font-medium text-text-secondary">{timeAgo(doc.updatedAt)}</p>
          <p className="text-[11px] text-text-muted">{doc.readMinutes} min read</p>
        </div>
      </div>
    </article>
  );
}
