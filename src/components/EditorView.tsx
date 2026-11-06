import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Check, Code, Heading1, Heading2, Heading3,
  Italic, Link2, List, ListOrdered, MoreHorizontal, Quote, Redo, Share2, Star, Strikethrough,
  Underline, Undo, ChevronDown, Download, Minus, Plus, RotateCcw,
} from "lucide-react";
import { useApp } from "../lib/app-context";
import { timeAgo } from "../lib/store";
import { AvatarStack, Dropdown, MenuDivider, MenuItem, MenuLabel, Spinner } from "./ui";
import { cn } from "../utils/cn";

function ToolButton({
  icon, label, active, onClick, disabled,
}: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("tool-btn focus-ring flex h-8 w-8 items-center justify-center disabled:cursor-not-allowed disabled:opacity-35", active && "active")}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

function unwrapPlainSpans(root: ParentNode) {
  [...root.querySelectorAll("span")].reverse().forEach((span) => {
    if (span.attributes.length === 0) span.replaceWith(...span.childNodes);
  });
}

export default function EditorView({ docId }: { docId: string }) {
  const { docs, user, closeDoc, updateDoc, toggleStar, setShareDocId, saveStatus, lastSavedAt, deleteDoc, duplicateDoc, exportDoc } = useApp();
  const doc = docs.find((d) => d.id === docId);
  const canEdit = doc?.collaborators.some((collaborator) => collaborator.email === user.email && ["owner", "editor"].includes(collaborator.role)) ?? false;
  const isOwner = doc?.collaborators.some((collaborator) => collaborator.email === user.email && collaborator.role === "owner") ?? false;
  const isSpreadsheet = doc?.type === "sheet";
  const usesRichTextFallback = doc?.type === "slides" || doc?.type === "whiteboard" || doc?.type === "pdf";
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [activeMarks, setActiveMarks] = useState<Record<string, boolean>>({});
  const [selectedFontSize, setSelectedFontSize] = useState(16);
  const [wordCount, setWordCount] = useState(0);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      if (editorRef.current && editorRef.current.innerHTML !== doc.content) {
        editorRef.current.innerHTML = doc.content;
        updateCount();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onSel = () => {
      try {
        setActiveMarks({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strike: document.queryCommandState("strikeThrough"),
          ul: document.queryCommandState("insertUnorderedList"),
          ol: document.queryCommandState("insertOrderedList"),
        });
        const selection = window.getSelection();
        const anchor = selection?.anchorNode;
        if (anchor && editorRef.current?.contains(anchor)) {
          const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement;
          const computedSize = element ? Number.parseFloat(window.getComputedStyle(element).fontSize) : NaN;
          if (Number.isFinite(computedSize)) setSelectedFontSize(computedSize);
        }
      } catch { /* noop */ }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const toc = useMemo(() => {
    if (!doc || !editorRef.current) return [];
    const matches = [...doc.content.matchAll(/<h([123])>(.*?)<\/h\1>/gi)].map((m) => ({
      level: Number(m[1]),
      text: m[2].replace(/<[^>]+>/g, "").slice(0, 60),
    }));
    return matches.slice(0, 8);
  }, [doc?.content]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="text-center">
          <p className="text-[16px] font-bold text-text-primary">Document not found</p>
          <button onClick={closeDoc} className="btn-secondary mt-3 rounded-xl px-4 py-2 text-[13.5px] font-semibold">Back to Home</button>
        </div>
      </div>
    );
  }

  const updateCount = () => {
    const text = editorRef.current?.innerText ?? "";
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  };

  const scheduleSave = (content: string, nextTitle?: string) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const text = editorRef.current?.innerText ?? "";
      const firstPara = text.split("\n").find((l) => l.trim().length > 8) ?? doc.excerpt;
      updateDoc(doc.id, {
        content,
        title: nextTitle ?? title,
        excerpt: firstPara.slice(0, 140),
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        readMinutes: Math.max(1, Math.round((text.length || 1) / 1200)),
      });
    }, 700);
  };

  const exec = (cmd: string, val?: string) => {
    if (!canEdit) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    updateCount();
    if (editorRef.current) scheduleSave(editorRef.current.innerHTML);
  };

  const changeFontSize = (change: number | "reset") => {
    if (!canEdit) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const editor = editorRef.current;
    if (!selection || !range || range.collapsed || !editor?.contains(range.commonAncestorContainer)) return;

    const commonElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement;
    const selectedText = selection.toString();
    const currentSpan = [...editor.querySelectorAll<HTMLElement>("span[style*='font-size']")]
      .filter((span) =>
        span.textContent === selectedText
        && span.contains(range.startContainer)
        && span.contains(range.endContainer)
      )
      .sort((left, right) => {
        const depth = (element: Element) => {
          let count = 0;
          for (let parent = element.parentElement; parent && parent !== editor; parent = parent.parentElement) count += 1;
          return count;
        };
        return depth(left) - depth(right);
      })[0];
    if (currentSpan) {
      const inheritedSize = Number.parseFloat(window.getComputedStyle(currentSpan.parentElement ?? editor).fontSize) || 16;
      currentSpan.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
        element.style.removeProperty("font-size");
        if (!element.getAttribute("style")) element.removeAttribute("style");
      });
      unwrapPlainSpans(currentSpan);
      if (change === "reset") {
        currentSpan.style.removeProperty("font-size");
        if (!currentSpan.getAttribute("style")) currentSpan.removeAttribute("style");
        if (currentSpan.attributes.length === 0) currentSpan.replaceWith(...currentSpan.childNodes);
      } else {
        currentSpan.style.fontSize = `${Math.max(10, Math.min(48, selectedFontSize + change))}px`;
      }
      const actualSize = change === "reset"
        ? inheritedSize
        : Number.parseFloat(window.getComputedStyle(currentSpan).fontSize) || 16;
      setSelectedFontSize(actualSize);
      scheduleSave(editor.innerHTML);
      return;
    }

    const existingFontSpan = commonElement?.closest<HTMLElement>("span[style*='font-size']");
    const inheritedSize = Number.parseFloat(window.getComputedStyle(existingFontSpan?.parentElement ?? commonElement ?? editor).fontSize) || 16;
    const fragment = range.extractContents();
    fragment.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
      element.style.removeProperty("font-size");
      if (!element.getAttribute("style")) element.removeAttribute("style");
    });
    unwrapPlainSpans(fragment);
    const span = document.createElement("span");
    const nextSize = change === "reset" ? inheritedSize : Math.max(10, Math.min(48, selectedFontSize + change));
    span.style.fontSize = `${nextSize}px`;
    span.append(fragment);
    range.insertNode(span);

    const updatedRange = document.createRange();
    updatedRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(updatedRange);
    setSelectedFontSize(nextSize);
    scheduleSave(editor.innerHTML);
  };

  const insertHeading = (level: 1 | 2 | 3) => exec("formatBlock", `h${level}`);
  const insertLink = () => {
    const url = window.prompt("Enter link URL", "https://");
    if (url) exec("createLink", url);
  };
  const insertQuote = () => exec("formatBlock", "blockquote");
  const insertCode = () => {
    const sel = window.getSelection();
    if (sel && sel.toString()) exec("formatBlock", "pre");
    else {
      document.execCommand("insertHTML", false, "<code>code snippet</code>&nbsp;");
      if (editorRef.current) scheduleSave(editorRef.current.innerHTML);
    }
  };

  const onInput = () => {
    updateCount();
    if (editorRef.current) scheduleSave(editorRef.current.innerHTML);
  };

  const readMins = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Editor top bar */}
      <div className="glass z-30 border-x-0 border-t-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <button onClick={closeDoc} className="btn-ghost focus-ring flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">All docs</span>
          </button>
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              value={title}
              readOnly={!canEdit}
              onChange={(e) => {
                setTitle(e.target.value);
                if (editorRef.current) scheduleSave(editorRef.current.innerHTML, e.target.value);
              }}
              className="min-w-0 max-w-md flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-[15px] font-extrabold tracking-tight text-text-primary transition-colors hover:bg-primary-light/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-border/60"
              aria-label="Document title"
            />
            <span className="hidden items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-semibold text-text-secondary ring-1 ring-border md:flex">
              {saveStatus === "saving" ? (
                <><Spinner size={12} /> Saving…</>
              ) : saveStatus === "error" ? (
                <><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Save failed</>
              ) : (
                <><Check className="h-3.5 w-3.5 text-success" /> Saved {lastSavedAt ? timeAgo(lastSavedAt) : timeAgo(doc.updatedAt)}</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AvatarStack items={doc.collaborators} max={4} />
            <button onClick={() => toggleStar(doc.id)} aria-label="Star" aria-pressed={doc.starred}
              className={cn("focus-ring rounded-xl p-2 transition-all duration-200", doc.starred ? "text-primary" : "text-text-muted hover:bg-primary-light hover:text-primary-hover")}>
              <Star className={cn("h-[18px] w-[18px]", doc.starred && "fill-primary")} />
            </button>
            {isOwner && <Dropdown
              trigger={<button className="btn-ghost focus-ring rounded-xl p-2" aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></button>}
              width="w-52"
            >
              {canEdit && <MenuItem label="Duplicate" onClick={() => void duplicateDoc(doc.id)} />}
              <MenuItem label="Delete permanently" danger onClick={async () => {
                if (window.confirm("Delete this document permanently? This cannot be undone.") && await deleteDoc(doc.id)) closeDoc();
              }} />
            </Dropdown>}
            <Dropdown
              trigger={<button className="btn-secondary focus-ring flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold" aria-label="Export document"><Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span></button>}
              width="w-52"
            >
              <MenuLabel>Export as</MenuLabel>
              {(isSpreadsheet
                ? [{ format: "csv" as const, label: "CSV" }, { format: "xlsx" as const, label: "Excel workbook" }, { format: "pdf" as const, label: "PDF" }]
                : [{ format: "txt" as const, label: "Plain text" }, { format: "md" as const, label: "Markdown" }, { format: "html" as const, label: "HTML" }, { format: "pdf" as const, label: "PDF" }, { format: "docx" as const, label: "Word document" }]
              ).map(({ format, label }) => (
                <MenuItem key={format} label={label} onClick={() => void exportDoc(doc.id, format)} />
              ))}
            </Dropdown>
            <button onClick={() => setShareDocId(doc.id)} className="btn-primary focus-ring flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={cn("flex items-center gap-0.5 overflow-x-auto border-t border-border/70 px-4 py-1.5 sm:px-6", !canEdit && "hidden")} role="toolbar" aria-label="Formatting toolbar">
          <ToolButton icon={<Undo className="h-4 w-4" />} label="Undo" onClick={() => exec("undo")} />
          <ToolButton icon={<Redo className="h-4 w-4" />} label="Redo" onClick={() => exec("redo")} />
          <Divider />
          <Dropdown
            trigger={
              <button className="tool-btn focus-ring flex h-8 items-center gap-1 px-2.5 text-[12.5px] font-bold" aria-label="Text style">
                <Heading2 className="h-4 w-4" /> Style <ChevronDown className="h-3.5 w-3.5" />
              </button>
            }
            align="left" width="w-48"
          >
            <MenuItem icon={<Heading1 className="h-4 w-4" />} label="Heading 1" onClick={() => insertHeading(1)} />
            <MenuItem icon={<Heading2 className="h-4 w-4" />} label="Heading 2" onClick={() => insertHeading(2)} />
            <MenuItem icon={<Heading3 className="h-4 w-4" />} label="Heading 3" onClick={() => insertHeading(3)} />
            <MenuDivider />
            <MenuItem label="Body text" onClick={() => exec("formatBlock", "p")} />
            <MenuItem icon={<Quote className="h-4 w-4" />} label="Quote" onClick={insertQuote} />
          </Dropdown>
          <Divider />
          <ToolButton icon={<Bold className="h-4 w-4" />} label="Bold (Ctrl+B)" active={activeMarks.bold} onClick={() => exec("bold")} />
          <ToolButton icon={<Italic className="h-4 w-4" />} label="Italic (Ctrl+I)" active={activeMarks.italic} onClick={() => exec("italic")} />
          <ToolButton icon={<Underline className="h-4 w-4" />} label="Underline (Ctrl+U)" active={activeMarks.underline} onClick={() => exec("underline")} />
          <ToolButton icon={<Strikethrough className="h-4 w-4" />} label="Strikethrough" active={activeMarks.strike} onClick={() => exec("strikeThrough")} />
          <ToolButton icon={<Code className="h-4 w-4" />} label="Code" onClick={insertCode} />
          <Divider />
          <ToolButton icon={<Minus className="h-4 w-4" />} label="Decrease font size" disabled={selectedFontSize <= 10} onClick={() => changeFontSize(-1)} />
          <span className="min-w-[42px] text-center text-[11px] font-semibold text-text-secondary" aria-live="polite">{Math.round(selectedFontSize)} px</span>
          <ToolButton icon={<Plus className="h-4 w-4" />} label="Increase font size" disabled={selectedFontSize >= 48} onClick={() => changeFontSize(1)} />
          <ToolButton icon={<RotateCcw className="h-4 w-4" />} label="Reset font size" onClick={() => changeFontSize("reset")} />
          <Divider />
          <ToolButton icon={<AlignLeft className="h-4 w-4" />} label="Align left" onClick={() => exec("justifyLeft")} />
          <ToolButton icon={<AlignCenter className="h-4 w-4" />} label="Align center" onClick={() => exec("justifyCenter")} />
          <ToolButton icon={<AlignRight className="h-4 w-4" />} label="Align right" onClick={() => exec("justifyRight")} />
          <Divider />
          <ToolButton icon={<List className="h-4 w-4" />} label="Bullet list" active={activeMarks.ul} onClick={() => exec("insertUnorderedList")} />
          <ToolButton icon={<ListOrdered className="h-4 w-4" />} label="Numbered list" active={activeMarks.ol} onClick={() => exec("insertOrderedList")} />
          <ToolButton icon={<Quote className="h-4 w-4" />} label="Quote" onClick={insertQuote} />
          <ToolButton icon={<Link2 className="h-4 w-4" />} label="Insert link" onClick={insertLink} />
        </div>
      </div>

      {/* Canvas */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1080px] gap-6 px-4 py-6 sm:px-6 lg:py-8">
          <div className="min-w-0 flex-1">
            {isSpreadsheet && (
              <p className="mb-3 rounded-xl border border-orange-border/50 bg-primary-light px-4 py-3 text-[13px] text-primary-active" role="note">
                Basic spreadsheet: table cells are editable and autosaved. Formula calculations are not supported.
              </p>
            )}
            {usesRichTextFallback && (
              <p className="mb-3 rounded-xl border border-border bg-white px-4 py-3 text-[13px] text-text-secondary" role="note">
                {doc.type === "slides" && "This presentation is an editable text outline; slide layouts and presenting are not supported."}
                {doc.type === "whiteboard" && "This is an editable text-based board; drawing tools and freeform canvas are not supported."}
                {doc.type === "pdf" && "PDF preview is not supported; this item is shown in the rich-text editor."}
              </p>
            )}
            <div className="rounded-2xl border border-border bg-white px-6 py-8 shadow-[0_24px_64px_-24px_rgba(23,36,58,0.18)] sm:px-12 sm:py-12">
              <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-5">
                {doc.tags.map((t) => (
                  <span key={t} className="rounded-full bg-primary-light px-2.5 py-1 text-[12px] font-bold text-primary-active ring-1 ring-orange-border/40">#{t}</span>
                ))}
                <span className="ml-auto text-[12.5px] text-text-muted">By {doc.owner} · {timeAgo(doc.updatedAt)}</span>
              </div>
              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                onInput={onInput}
                spellCheck
                role="textbox"
                aria-multiline
                aria-label="Document content"
                className="editor-content min-h-[420px] text-[15.5px]"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[12.5px] text-text-muted">
              <p><span className="font-bold text-text-primary tabular-nums">{wordCount.toLocaleString()}</span> words · {readMins} min read</p>
              <p className="hidden sm:block">Press <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-border">Ctrl B</kbd> for bold · Autosaves as you type</p>
            </div>
          </div>

          {/* Outline rail */}
          <aside className="hidden w-60 shrink-0 xl:block">
            <div className="sticky top-4 rounded-2xl border border-border bg-white p-4">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-text-muted">Outline</p>
              <div className="mt-2 space-y-1">
                {toc.length === 0 && <p className="text-[13px] text-text-muted">No headings yet.</p>}
                {toc.map((h, i) => (
                  <p key={i} className={cn("truncate rounded-lg px-2 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-primary-light hover:text-primary-active",
                    h.level === 1 && "font-bold text-text-primary", h.level === 2 && "pl-4", h.level === 3 && "pl-6")}>
                    {h.text}
                  </p>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-primary-light p-3 ring-1 ring-orange-border/30">
                <p className="text-[12.5px] font-bold text-primary-active">Live collaboration</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{doc.collaborators.length} people have access to this doc.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
