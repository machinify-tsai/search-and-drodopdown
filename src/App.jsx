import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from "react";

/* ------------------------------------------------------------------ *
 * Interaction Specimens — search & dropdown micro-interaction catalog
 * ------------------------------------------------------------------ */

const SPECIES = [
  "Kestrel", "Wren", "Heron", "Swift", "Robin", "Kingfisher",
  "Lapwing", "Goldfinch", "Nuthatch", "Curlew", "Redstart",
  "Skylark", "Bittern", "Chaffinch", "Warbler", "Plover",
];

/* ----- inline icons (stroke = currentColor) ----- */
const Search = (p) => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
    <circle cx="7" cy="7" r="4.25" /><line x1="10.2" y1="10.2" x2="14" y2="14" />
  </svg>
);
const Chevron = (p) => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3.5,6 8,10.5 12.5,6" />
  </svg>
);
const Check = (p) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3,8.5 6.5,12 13,4" />
  </svg>
);
const Cross = (p) => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}>
    <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
  </svg>
);
const Plus = (p) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}>
    <line x1="8" y1="3.5" x2="8" y2="12.5" /><line x1="3.5" y1="8" x2="12.5" y2="8" />
  </svg>
);
const Arrow = (p) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="3" y1="8" x2="12" y2="8" /><polyline points="8.5,4.5 12.5,8 8.5,11.5" />
  </svg>
);
const WrapI = (p) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="3" y1="4" x2="13" y2="4" /><path d="M3 8h7.5a2 2 0 0 1 0 4H8.5" /><polyline points="9.8,10.6 8.4,12 9.8,13.4" />
  </svg>
);
const StackI = (p) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2.4" y="5" width="6.6" height="6" rx="1.3" /><path d="M10.6 6.4h1.5a1.4 1.4 0 0 1 1.4 1.4V11" />
  </svg>
);

/* ----- query highlighting: matched substring as a marker swipe ----- */
function Mark({ text, query }) {
  const q = (query || "").trim();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="sp-mark">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/* ----- a removable chip (reused for live + measurement) ----- */
function Chip({ label, onRemove, trunc, ghost, plain }) {
  return (
    <span className={`sp-chip ${trunc ? "is-trunc" : ""} ${plain ? "is-plain" : ""}`}>
      <span className="sp-chip-label">{label}</span>
      {!plain && (
        <button
          type="button"
          className="sp-chip-x"
          aria-label={`Remove ${label}`}
          tabIndex={ghost ? -1 : 0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={ghost ? undefined : onRemove}
        >
          <Cross />
        </button>
      )}
    </span>
  );
}

/* =================================================================== *
 * Combo — one configurable specimen
 *   mode:     "search" | "dropdown"
 *   select:   "none"   | "single" | "multi"
 *   creatable: boolean      (live "add new value" mode)
 *   chipMode: "wrap" | "collapse"   (multi-select chip layout)
 * =================================================================== */
function Combo({ mode, select, creatable, chipMode = "wrap", options }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [activeSource, setActiveSource] = useState(null);
  const [single, setSingle] = useState(null);
  const [multi, setMulti] = useState([]);
  const [searched, setSearched] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const innerRef = useRef(null);
  const measRef = useRef(null);
  const uid = useId().replace(/:/g, "");

  const isSearch = mode === "search";
  const trimmed = query.trim();
  const isMultiCollapse = select === "multi" && chipMode === "collapse";

  const filtered = useMemo(() => {
    if (!trimmed) return isSearch ? [] : options;
    const ql = trimmed.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(ql));
  }, [trimmed, isSearch, options]);

  const exact = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const showCreate = creatable && trimmed.length > 0 && !exact;

  const rows = useMemo(() => {
    const r = [];
    if (showCreate) r.push({ type: "create", value: trimmed });
    r.push(...filtered.map((o) => ({ type: "opt", value: o })));
    return r;
  }, [filtered, showCreate, trimmed]);

  // Trigger rule: search opens after 2 typed chars; dropdown opens on focus; pure search (select=none) never opens.
  const isPureSearch = isSearch && select === "none";
  const menuOpen = !isPureSearch && open && (isSearch ? trimmed.length >= 2 : true);
  const noResults = menuOpen && filtered.length === 0 && !showCreate;

  useEffect(() => { setActive(-1); }, [creatable]);

  /* ---- measure collapse: does the full chip set + 8ch input fit on one line? ---- */
  useLayoutEffect(() => {
    if (!isMultiCollapse) { setCollapsed(false); return; }
    const compute = () => {
      const inner = innerRef.current, meas = measRef.current;
      if (!inner || !meas) return;
      const cs = getComputedStyle(inner);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const avail = inner.clientWidth - pad;
      const needed = Math.ceil(meas.getBoundingClientRect().width);
      setCollapsed(needed > avail + 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (innerRef.current) ro.observe(innerRef.current);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(compute).catch(() => {});
    return () => ro.disconnect();
  }, [isMultiCollapse, multi, query, creatable]);

  const allSelected = select === "multi" && multi.length === options.length;
  const removeChip = (v) => setMulti((m) => m.filter((x) => x !== v));
  const clearAll = () => { setMulti([]); inputRef.current?.focus(); };
  const clearSingle = () => { setSingle(null); setQuery(""); inputRef.current?.focus(); };

  const choose = useCallback(
    (row) => {
      const v = row.value;
      if (select === "multi") {
        if (row.type === "create") setMulti((m) => (m.includes(v) ? m : [...m, v]));
        else setMulti((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));
        setQuery("");
        setActive(-1);
        inputRef.current?.focus();
      } else if (select === "single") {
        setSingle(v); setQuery(v); setOpen(false); setActive(-1);
      } else {
        setSearched(v); setQuery(v); setOpen(false); setActive(-1);
      }
    },
    [select]
  );

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!menuOpen) { setOpen(true); return; }
      setActive((a) => Math.min(rows.length - 1, a + 1));
      setActiveSource("key");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!menuOpen) return;
      setActive((a) => Math.max(0, a - 1));
      setActiveSource("key");
    } else if (e.key === "Enter") {
      if (!menuOpen) return;
      e.preventDefault();
      if (active >= 0 && rows[active]) choose(rows[active]);
      else if (showCreate && rows[0]?.type === "create") choose(rows[0]);
    } else if (e.key === "Escape") {
      setOpen(false); setActive(-1); setActiveSource(null);
    } else if (e.key === "Backspace" && select === "multi" && query === "" && multi.length) {
      setMulti((m) => m.slice(0, -1));
    }
  };

  const onBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) { setOpen(false); setActive(-1); setActiveSource(null); }
  };

  const TrailIcon = isSearch ? Search : Chevron;
  const hidden = multi.slice(1);
  const showCollapsed = isMultiCollapse && collapsed && multi.length > 0;
  const showClearAll = showCollapsed && hidden.length > 0;

  const placeholder = multi.length && isMultiCollapse && collapsed ? "" : isSearch ? "Search by" : "Select";

  const Input = (
    <input
      ref={inputRef}
      className="sp-input"
      value={query}
      placeholder={placeholder}
      aria-autocomplete="list"
      aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
      onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
      onFocus={(e) => { setOpen(true); if (select === "single" && single) e.target.select(); }}
      onKeyDown={onKeyDown}
    />
  );

  return (
    <div className="sp-field-wrap" ref={rootRef} onBlur={onBlur}>
      <div className={`sp-field ${menuOpen ? "is-open" : ""}`} role="combobox"
           aria-expanded={menuOpen} aria-haspopup="listbox" aria-controls={`${uid}-list`}>
        <div
          ref={innerRef}
          className={`sp-field-inner ${isMultiCollapse ? "sp-collapse" : ""}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
          }}
        >
          {/* hidden measurer: full chip set + reserved 8ch typing area */}
          {isMultiCollapse && (
            <div ref={measRef} className="sp-measurer" aria-hidden>
              {multi.map((v) => <Chip key={v} label={v} ghost />)}
              <span className="sp-meas-input" />
            </div>
          )}

          {/* MULTI — "All" chip when every option is selected */}
          {select === "multi" && allSelected && (
            <span className="sp-all-wrap">
              <Chip label="All" plain />
              <span className="sp-pop">{multi.join(", ")}</span>
            </span>
          )}

          {/* MULTI — wrap mode: every chip flows, field grows vertically, text wraps */}
          {select === "multi" && !allSelected && !isMultiCollapse &&
            multi.map((v) => <Chip key={v} label={v} onRemove={() => removeChip(v)} />)}

          {/* MULTI — collapse mode, fits on one line: show all chips */}
          {select === "multi" && !allSelected && isMultiCollapse && !collapsed &&
            multi.map((v) => <Chip key={v} label={v} onRemove={() => removeChip(v)} />)}

          {/* MULTI — collapse mode, overflowing: one truncated chip + +N badge */}
          {!allSelected && showCollapsed && (
            <>
              <Chip label={multi[0]} trunc onRemove={() => removeChip(multi[0])} />
              {hidden.length > 0 && (
                <span className="sp-more" tabIndex={0} aria-label={`${hidden.length} more selected`}>
                  +{hidden.length}
                  <span className="sp-pop">
                    {hidden.join(", ")}
                  </span>
                </span>
              )}
            </>
          )}

          {Input}
        </div>

        <div className="sp-trail">
          {/* clear-all X — appears with the +N badge */}
          {showClearAll && (
            <button type="button" className="sp-icon-btn sp-clear" aria-label="Clear all selected"
              title="Clear all" onMouseDown={(e) => e.preventDefault()} onClick={clearAll}>
              <Cross />
            </button>
          )}
          <span className={`sp-trail-icon ${menuOpen && !isSearch ? "is-up" : ""}`} aria-hidden="true">
            <TrailIcon />
          </span>
        </div>
      </div>

      {menuOpen && (
        <ul className="sp-menu" id={`${uid}-list`} role="listbox" onMouseLeave={() => { setActive(-1); setActiveSource(null); }}>
          {rows.map((row, i) => {
            const isActive = active === i;
            const activeClass = isActive ? (activeSource === "key" ? "is-focused" : "is-hover") : "";
            const picked = select === "multi"
              ? multi.includes(row.value)
              : (select === "single" ? single === row.value && !showCreate : searched === row.value && !showCreate);
            if (row.type === "create") {
              const createPicked = select === "single" ? single === row.value : (select === "multi" ? multi.includes(row.value) : searched === row.value);
              return (
                <li key="__create" id={`${uid}-opt-${i}`} role="option" aria-selected={createPicked}
                  className={`sp-opt sp-opt-create ${activeClass} ${createPicked ? "is-picked" : ""}`}
                  onMouseEnter={() => { setActive(i); setActiveSource("mouse"); }} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}>
                  <span className="sp-opt-label"><strong>{row.value}</strong></span>
                  <span className="sp-opt-hint">↵ ENTER</span>
                </li>
              );
            }
            return (
              <li key={row.value} id={`${uid}-opt-${i}`} role="option" aria-selected={picked}
                className={`sp-opt ${activeClass} ${picked ? "is-picked" : ""}`}
                onMouseEnter={() => { setActive(i); setActiveSource("mouse"); }} onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}>
                <span className="sp-opt-label"><Mark text={row.value} query={query} /></span>
              </li>
            );
          })}
          {noResults && (
            <li className="sp-empty" role="status">NO RESULTS</li>
          )}
        </ul>
      )}

    </div>
  );
}

/* =================================================================== *
 * DualList — transfer menu (two typable, query-highlighted panels)
 * =================================================================== */
function DualList({ options }) {
  const [selected, setSelected] = useState(["Robin", "Swift"]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const innerRef = useRef(null);
  const measRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  const available = options.filter((o) => !selected.includes(o));
  const q = query.trim().toLowerCase();
  const availShown = q ? available.filter((o) => o.toLowerCase().includes(q)) : available;
  const selShown = q ? selected.filter((o) => o.toLowerCase().includes(q)) : selected;

  const allSelected = selected.length === options.length;

  const move = (o) => setSelected((s) => [...s, o]);
  const back = (o) => setSelected((s) => s.filter((x) => x !== o));
  const selectAll = () => setSelected((s) => [...s, ...availShown.filter((o) => !s.includes(o))]);
  const deselectAll = () => setSelected((s) => s.filter((x) => !selShown.includes(x)));

  const removeChip = (v) => setSelected((s) => s.filter((x) => x !== v));
  const clearAll = () => { setSelected([]); inputRef.current?.focus(); };

  const onBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) { setOpen(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); }
  };

  useLayoutEffect(() => {
    if (selected.length === 0) { setCollapsed(false); return; }
    const compute = () => {
      const inner = innerRef.current, meas = measRef.current;
      if (!inner || !meas) return;
      const cs = getComputedStyle(inner);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const avail = inner.clientWidth - pad;
      const needed = Math.ceil(meas.getBoundingClientRect().width);
      setCollapsed(needed > avail + 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [selected, query]);

  const hidden = selected.slice(1);

  return (
    <div className="sp-field-wrap sp-dual-wrap" ref={rootRef} onBlur={onBlur}>
      <div className={`sp-field ${open ? "is-open" : ""}`} role="combobox"
           aria-expanded={open} aria-haspopup="listbox">
        <div className="sp-field-inner sp-collapse" ref={innerRef}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
          }}>
          {selected.length > 0 && (
            <div ref={measRef} className="sp-measurer" aria-hidden>
              {selected.map((v) => <Chip key={v} label={v} ghost />)}
              <span className="sp-meas-input" />
            </div>
          )}

          {allSelected ? (
            <span className="sp-all-wrap">
              <Chip label="All" plain />
              <span className="sp-pop">{selected.join(", ")}</span>
            </span>
          ) : !collapsed ? (
            selected.map((v) => <Chip key={v} label={v} onRemove={() => removeChip(v)} />)
          ) : selected.length > 0 ? (
            <>
              <Chip label={selected[0]} trunc onRemove={() => removeChip(selected[0])} />
              {hidden.length > 0 && (
                <span className="sp-more" tabIndex={0} aria-label={`${hidden.length} more selected`}>
                  +{hidden.length}
                  <span className="sp-pop">
                    {hidden.join(", ")}
                  </span>
                </span>
              )}
            </>
          ) : null}
          <input
            ref={inputRef}
            className="sp-input"
            value={query}
            placeholder={selected.length > 0 ? "" : "Data Text"}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="sp-trail">
          <button type="button" className={`sp-icon-btn ${open ? "is-up" : ""}`}
            tabIndex={-1} aria-label="Toggle menu"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}>
            <Chevron />
          </button>
        </div>
      </div>

      {open && (
        <div className="sp-dual-menu">
          <div className="sp-dual-col">
            <div className="sp-dual-header">
              <span className="sp-dual-title">Available  ({q ? `${availShown.length} of ${available.length}` : availShown.length})</span>
              <button type="button" className="sp-dual-action" disabled={availShown.length === 0} onMouseDown={(e) => e.preventDefault()} onClick={selectAll}>SELECT ALL</button>
            </div>
            <ul className="sp-dual-list" role="listbox" aria-label="Available">
              {availShown.length ? availShown.map((o) => (
                <li key={o} role="option" aria-selected={false} className="sp-dual-item"
                  onMouseDown={(e) => e.preventDefault()} onClick={() => move(o)}>
                  <span className="sp-opt-label"><Mark text={o} query={query} /></span>
                </li>
              )) : <li className="sp-empty sp-empty-sm">{q ? "NO RESULTS" : "ALL SELECTED"}</li>}
            </ul>
          </div>
          <div className="sp-dual-col">
            <div className="sp-dual-header">
              <span className="sp-dual-title">Selected  ({q ? `${selShown.length} of ${selected.length}` : selShown.length})</span>
              <button type="button" className="sp-dual-action" disabled={selShown.length === 0} onMouseDown={(e) => e.preventDefault()} onClick={deselectAll}>DESELECT ALL</button>
            </div>
            <ul className="sp-dual-list" role="listbox" aria-label="Selected">
              {selShown.length ? selShown.map((o) => (
                <li key={o} role="option" aria-selected className="sp-dual-item is-picked"
                  onMouseDown={(e) => e.preventDefault()} onClick={() => back(o)}>
                  <span className="sp-opt-label"><Mark text={o} query={query} /></span>
                </li>
              )) : <li className="sp-empty sp-empty-sm">{q ? "NO RESULTS" : "NONE SELECTED"}</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----- segmented toggle ----- */
function Toggle({ caption, value, onChange, options }) {
  return (
    <div className="sp-toggle">
      <span className="sp-toggle-cap">{caption}</span>
      <div className="sp-modes" role="tablist" aria-label={caption}>
        {options.map((o) => (
          <button key={o.id} role="tab" aria-selected={value === o.id}
            className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
            {o.icon}{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----- specimen card ----- */
function Specimen({ code, name, mode, select, trigger, children }) {
  const [creatable, setCreatable] = useState(false);
  const [chipMode, setChipMode] = useState("wrap");
  const isMulti = select === "multi";

  return (
    <article className="sp-card">
      <header className="sp-card-head">
        <div className="sp-card-id">
          <span className="sp-code">{code}</span>
          <h3 className="sp-name">{name}</h3>
        </div>
        <span className="sp-trigger">{trigger}</span>
      </header>

      {select !== "dual" && select !== "none" && (
        <div className="sp-controls">
          <Toggle caption="unknown value" value={creatable ? "create" : "none"}
            onChange={(id) => setCreatable(id === "create")}
            options={[
              { id: "none", icon: <Cross />, label: "Not accepting new value" },
              { id: "create", icon: <Check />, label: "Accept new value" },
            ]} />
          {isMulti && (
            <Toggle caption="chip layout" value={chipMode} onChange={setChipMode}
              options={[
                { id: "wrap", icon: <WrapI />, label: "Wrap" },
                { id: "collapse", icon: <StackI />, label: "Collapse +N" },
              ]} />
          )}
        </div>
      )}

      {select === "dual"
        ? children
        : <Combo mode={mode} select={select} creatable={creatable} chipMode={chipMode} options={SPECIES} />}
    </article>
  );
}

/* =================================================================== *
 * Page
 * =================================================================== */
export default function InteractionSpecimens() {
  return (
    <div className="sp-root">
      <style>{CSS}</style>

      <header className="sp-masthead">
        <p className="sp-eyebrow">Interaction Specimens · Last Updated Jul 1, 2026</p>
        <h1 className="sp-title">Search &amp; dropdown<span className="sp-title-mark">,</span> field-tested</h1>
        <ul className="sp-rules">
          <li><b>Trigger</b> — <em>Search</em> opens after 2 typed characters; <em>Dropdown</em> opens on focus</li>
          <li><b>Highlight</b> — matched substring is <mark className="sp-mark">highlighted</mark> as you type</li>
          <li><b>Selection</b> — no auto-select on top match; use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>↵</kbd> to confirm</li>
          <li><b>Unknown value</b> — when accepting new values, the typed value appears first in the menu; press <kbd>↵</kbd> to add</li>
          <li><b>Multi-select chips</b> — switch between <em>wrap</em> (grow vertically) and <em>collapse</em> (+N badge); selecting all collapses into an "All" chip</li>
          <li><b>Single select</b> — re-focus selects all text for quick replacement</li>
          <li><b>Dual list</b> — two-column transfer menu with SELECT ALL / DESELECT ALL; follows the same chip rules; search filters both columns. Deselect happens inside the panel, not via an ✕ button on the field</li>
          <li><b>Clear all</b> — context-level decision: the ✕ button on +N and "All" badges is optional. Use it when bulk clearing is safe; omit it when selections are complex or costly to rebuild</li>
          <li><b>Tooltip</b> — opens on the opposite side of the menu to avoid overlap; max-width with text wrapping</li>
          <li><b>Focus vs hover</b> — keyboard navigation shows a focus ring; mouse hover shows a green background</li>
        </ul>
        <div className="sp-keys">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select / create</span>
          <span><kbd>esc</kbd> close</span>
          <span><kbd>⌫</kbd> removes last chip</span>
          <span>hover <b>+N</b> or <b>All</b> to reveal tooltip</span>
        </div>
      </header>

      <section className="sp-grid">
        <Specimen code="S·01" name="Search" mode="search" select="none" trigger="trigger: 2 chars" />
        <Specimen code="S·02" name="Search · single select" mode="search" select="single" trigger="trigger: 2 chars" />
        <Specimen code="S·03" name="Search · multi select" mode="search" select="multi" trigger="trigger: 2 chars" />
        <Specimen code="D·01" name="Dropdown · single select" mode="dropdown" select="single" trigger="trigger: focus" />
        <Specimen code="D·02" name="Dropdown · multi select" mode="dropdown" select="multi" trigger="trigger: focus" />
        <Specimen code="D·03" name="Dropdown · dual list" select="dual" trigger="transfer menu">
          <DualList options={SPECIES} />
        </Specimen>
      </section>

      <footer className="sp-foot">
        <div className="sp-dataset">
          <span className="sp-dataset-title">Dataset</span>
          <div className="sp-dataset-list">
            {SPECIES.map((s) => <span key={s} className="sp-dataset-item">{s}</span>)}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* =================================================================== *
 * Styles — scoped under .sp-root
 * =================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Roboto+Condensed:wght@600&display=swap');

.sp-root{
  /* brand teal — surfaces & text */
  --paper:#FFFFFF; --surface:#FFFFFF; --ink:#404040; --muted:#8B8B8B;
  --ink-secondary:#6B6B6B;
  --line:#E0E0E0; --field-line:#BDBDBD;
  /* brand teal — focus / accents */
  --brand:#2F5158; --brand-hover:#273F45; --brand-weak:rgba(47,81,88,.10);
  --brand-focus:#6693A0; --brand-secondary-hover:#E1ECED;
  /* green — menu hover & selection */
  --green-fill:#EAFAF1; --green-bar:#4ECF99; --green-ink:#404040;
  /* neutral chips */
  --chip:#F0F0F0; --chip-ink:#404040; --chip-line:#E0E0E0; --chip-x:#8B8B8B;
  /* query highlight */
  --mark:#E1ECED; --mark-ink:#1F3539;
  /* error */
  --error:#C5511C; --error-border:#E66221;
  --r-field:4px; --r-chip:4px; --r-menu:4px;
  --f-disp:'Roboto',ui-sans-serif,system-ui,sans-serif;
  --f-mono:'Roboto',ui-sans-serif,system-ui,sans-serif;
  --f-ui:'Roboto',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--paper); color:var(--ink); font-family:var(--f-ui);
  min-height:100%; padding:clamp(20px,4vw,52px); -webkit-font-smoothing:antialiased;
}
.sp-root *{box-sizing:border-box;}
.sp-root mark.sp-mark{ background:transparent; color:inherit; padding:0; border-radius:0; font-weight:700; }

/* masthead */
.sp-masthead{max-width:760px; margin:0 auto clamp(28px,4vw,46px);}
.sp-eyebrow{font-family:var(--f-mono); font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--brand); margin:0 0 14px;}
.sp-title{font-family:var(--f-disp); font-weight:600; letter-spacing:-.02em; font-size:clamp(32px,5.4vw,54px); line-height:1.02; margin:0 0 18px;}
.sp-title-mark{color:var(--brand);}
.sp-rules{list-style:none; padding:0; margin:0 0 16px; display:flex; flex-direction:column; gap:6px; font-size:13px; line-height:1.5; color:var(--ink-secondary);}
.sp-rules b{font-weight:600; color:var(--ink);}
.sp-rules em{font-style:normal; font-weight:500; color:var(--ink);}
.sp-rules kbd{font-family:var(--f-mono); font-size:.82em; background:var(--surface); border:1px solid var(--field-line); border-bottom-width:2px; border-radius:5px; padding:1px 5px;}
.sp-rules mark.sp-mark{font-weight:700;}
.sp-keys{display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; color:var(--muted); letter-spacing:.02em;}
.sp-keys kbd{font-family:var(--f-mono); font-size:.9em; background:var(--surface); border:1px solid var(--field-line); border-bottom-width:2px; border-radius:4px; padding:1px 5px; color:var(--ink-secondary);}
.sp-keys b{font-weight:600; color:var(--ink-secondary);}

/* grid + card */
.sp-grid{max-width:760px; margin:0 auto; display:flex; flex-direction:column;}
.sp-card-wide{width:100%;}
.sp-card{padding:30px 0; border-bottom:1px solid var(--line);}
.sp-card:first-child{padding-top:4px;}
.sp-card:last-child{border-bottom:0; padding-bottom:8px;}
.sp-card-head{display:flex; align-items:flex-start; justify-content:space-between; gap:12px;}
.sp-card-id{display:flex; align-items:baseline; gap:10px; min-width:0;}
.sp-code{font-family:var(--f-mono); font-size:12px; color:var(--brand); background:var(--brand-weak); padding:2px 7px; border-radius:5px; letter-spacing:.04em;}
.sp-name{font-family:var(--f-disp); font-weight:600; font-size:15px; margin:0; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.sp-trigger{font-family:var(--f-mono); font-size:10.5px; letter-spacing:.05em; color:var(--muted); text-transform:uppercase; white-space:nowrap; padding-top:3px;}

/* control toggles */
.sp-controls{display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-end; margin:14px 0 2px;}
.sp-toggle{display:flex; flex-direction:column; gap:5px;}
.sp-toggle-cap{font-family:var(--f-mono); font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); padding-left:3px;}
.sp-modes{display:inline-flex; gap:3px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:3px;}
.sp-modes button{display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-family:var(--f-mono); font-size:11px; letter-spacing:.03em; color:var(--muted); background:transparent; border:0; border-radius:6px; padding:5px 10px;}
.sp-modes button.is-on{background:var(--surface); color:var(--ink); box-shadow:0 1px 2px rgba(16,24,40,.10);}
.sp-modes button svg{opacity:.85;}

/* ===== field (search + dropdown share this chrome) ===== */
.sp-field-wrap{position:relative; margin-top:12px;}
.sp-field{display:flex; align-items:flex-start; background:var(--surface); border:1px solid var(--field-line);
  border-radius:var(--r-field); transition:border-color .14s, box-shadow .14s;}
.sp-field:hover{border-color:var(--ink);}
.sp-field:focus-within{border-color:var(--brand-focus);}
.sp-field-inner{position:relative; flex:1; min-width:0; display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:4px 4px 4px 14px; min-height:40px; box-sizing:border-box;}
.sp-field-inner.sp-collapse{flex-wrap:nowrap;}
.sp-input{flex:1 1 8ch; min-width:8ch; border:0; outline:0; background:transparent; font-family:var(--f-ui); font-size:14px; color:var(--ink); padding:0; height:30px;}
.sp-input::placeholder{color:var(--muted); font-style:italic;}
.sp-root .sp-input:focus, .sp-root .sp-input:focus-visible{outline:none; box-shadow:none;}
.sp-trail{display:flex; align-items:center; gap:2px; padding:0 10px 0 4px; height:40px;}
.sp-icon-btn{display:grid; place-items:center; width:26px; height:26px; cursor:pointer; background:transparent; border:0; border-radius:50%; color:var(--ink-secondary); transition:transform .2s, color .14s, background .14s;}
.sp-icon-btn:hover{color:var(--ink); background:var(--brand-secondary-hover);}
.sp-icon-btn:active{color:var(--ink); background:#C1D9DC;}
.sp-icon-btn.is-up{transform:rotate(180deg);}
.sp-trail-icon{display:grid; place-items:center; width:26px; height:26px; color:var(--ink-secondary); transition:transform .2s;}
.sp-trail-icon.is-up{transform:rotate(180deg);}
.sp-clear{color:var(--ink);}
.sp-clear:hover{color:var(--ink); background:var(--brand-secondary-hover);}
.sp-clear:active{color:var(--ink); background:#C1D9DC;}

/* chips — neutral gray "Value x" */
.sp-chip{display:inline-flex; align-items:center; gap:4px; max-width:100%; font-size:14px; font-weight:400;
  background:var(--chip); color:var(--chip-ink); border:1px solid transparent; padding:0 4px 0 8px; border-radius:var(--r-chip); height:20px; line-height:1;}
.sp-chip.is-plain{padding:0 8px;}
.sp-chip-label{min-width:0; overflow-wrap:anywhere; word-break:break-word;}
.sp-chip.is-trunc{flex:0 1 auto; min-width:6ch;}
.sp-chip.is-trunc .sp-chip-label{display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:13ch;}
.sp-chip-x{display:grid; place-items:center; width:16px; height:16px; flex:none; cursor:pointer; border:0; border-radius:50%; background:transparent; color:var(--ink); transition:background .14s, color .14s;}
.sp-chip-x:hover{background:var(--brand-secondary-hover); color:var(--ink);}
.sp-chip-x:active{background:#C1D9DC; color:var(--ink);}
.sp-chip-x:focus-visible{outline:2px solid var(--brand); outline-offset:0;}

/* +N badge + reveal popover */
.sp-more{position:relative; display:inline-flex; align-items:center; justify-content:center; flex:none; cursor:default;
  font-family:var(--f-mono); font-size:12px; font-weight:400; color:var(--chip-ink); background:var(--chip);
  border:1px solid var(--chip-line); border-radius:var(--r-chip); padding:0 8px; height:20px; outline:none;}
.sp-pop{position:absolute; z-index:30; bottom:calc(100% + 8px); left:0; display:none;
  width:max-content; max-width:320px; padding:8px 12px; background:var(--surface); color:var(--ink);
  border-radius:6px; font-size:14px; line-height:1.4;
  box-shadow:0 3px 14px 2px rgba(0,0,0,0.12), 0 8px 10px 1px rgba(0,0,0,0.14), 0 5px 5px -3px rgba(0,0,0,0.20);}
.sp-pop::before{content:""; position:absolute; bottom:-6px; left:12px; width:12px; height:12px;
  background:var(--surface); transform:rotate(45deg);
  box-shadow:2px 2px 4px rgba(0,0,0,0.06);}
.sp-all-wrap{position:relative; display:inline-flex; align-items:center;}
.sp-all-wrap:hover .sp-pop{display:block;}
.sp-more:hover .sp-pop, .sp-more:focus-within .sp-pop{display:block;}
.sp-dual-wrap .sp-pop{bottom:auto; top:calc(100% + 8px);}
.sp-dual-wrap .sp-pop::before{bottom:auto; top:-6px; box-shadow:-2px -2px 4px rgba(0,0,0,0.06);}

/* hidden measurer */
.sp-measurer{position:absolute; left:0; top:0; visibility:hidden; pointer-events:none; display:inline-flex; flex-wrap:nowrap; gap:6px; white-space:nowrap;}
.sp-meas-input{display:inline-block; min-width:8ch; height:1px; flex:none;}

/* ===== menu ===== */
.sp-menu{position:absolute; z-index:20; left:0; right:0; top:calc(100% + 2px); list-style:none; margin:0; padding:0;
  background:var(--surface); border:none; border-radius:var(--r-menu); max-height:240px; overflow:auto;
  box-shadow:0 3px 14px 2px rgba(0,0,0,0.12), 0 8px 10px 1px rgba(0,0,0,0.14), 0 5px 5px -3px rgba(0,0,0,0.20); animation:sp-pop .14s ease;}
@keyframes sp-pop{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:none;}}
.sp-opt{position:relative; display:flex; align-items:center; gap:10px; padding:0 14px; cursor:pointer; font-size:14px; color:var(--ink); scroll-margin:6px; min-height:40px;}
.sp-opt.is-hover{background:var(--green-fill); color:var(--green-ink);}
.sp-opt.is-focused{background:var(--surface); color:var(--ink); outline:2px solid var(--brand); outline-offset:-2px;}
.sp-opt.is-picked{background:var(--green-fill); color:var(--green-ink);}
.sp-opt.is-picked.is-hover{background:#E0F7EA; color:var(--green-ink);}
.sp-opt.is-picked.is-focused{background:var(--green-fill); outline:2px solid var(--brand); outline-offset:-2px;}
.sp-opt.is-picked::before{content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--green-bar);}
.sp-opt-label{flex:1; min-width:0;}
.sp-opt-create{color:var(--brand);}
.sp-opt-create.is-hover, .sp-opt-create.is-focused, .sp-opt-create.is-picked{color:var(--brand);}
.sp-opt-create.is-hover::before, .sp-opt-create.is-focused::before{background:var(--brand);}
.sp-opt-mark{display:grid; place-items:center; width:16px; height:16px; color:var(--brand); flex:none;}
.sp-opt-create strong{color:var(--ink); font-weight:600;}
.sp-opt-hint{display:inline-flex; align-items:center; font-family:var(--f-mono); font-size:10px; font-weight:400;
  color:#000; letter-spacing:.1em; text-transform:uppercase;
  background:#E0E0E0; padding:5px 4px; border-radius:4px; white-space:nowrap; line-height:1; height:16px; box-sizing:border-box;}
.sp-empty{padding:14px; font-size:10px; text-transform:uppercase; letter-spacing:.09em; color:var(--muted);}
.sp-empty-sm{padding:12px; text-transform:none; letter-spacing:0; font-size:10px; text-align:center;}

/* status */
.sp-status{display:flex; align-items:center; gap:7px; margin:9px 2px 0; font-family:var(--f-mono); font-size:11px; color:var(--muted); letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.sp-status-dot{width:7px; height:7px; border-radius:50%; background:var(--field-line); flex:none; transition:.2s;}
.sp-status-dot[data-on="true"]{background:var(--green-bar); box-shadow:0 0 0 3px var(--green-fill);}

/* dual list dropdown */
.sp-dual-badge{position:relative; display:inline-flex; align-items:center; font-size:14px; font-weight:400; color:var(--ink);
  background:var(--chip); padding:4px 10px; border-radius:var(--r-chip); cursor:pointer; white-space:nowrap;}
.sp-dual-menu{position:absolute; z-index:20; left:0; right:0; bottom:calc(100% + 2px);
  display:grid; grid-template-columns:1fr 1fr;
  background:var(--surface); border:none; border-radius:var(--r-menu);
  box-shadow:0 3px 14px 2px rgba(0,0,0,0.12), 0 8px 10px 1px rgba(0,0,0,0.14), 0 5px 5px -3px rgba(0,0,0,0.20); animation:sp-pop-up .14s ease; overflow:hidden;}
@keyframes sp-pop-up{from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:none;}}
.sp-dual-col{display:flex; flex-direction:column; min-width:0;}
.sp-dual-col + .sp-dual-col{border-left:1px solid #BDBDBD;}
.sp-dual-header{display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:0 14px; height:40px; background:#F0F0F0;}
.sp-dual-title{font-family:var(--f-disp); font-weight:600; font-size:14px; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.sp-dual-action{font-family:var(--f-mono); font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:var(--brand); background:none; border:0; cursor:pointer; padding:0 16px; height:32px; border-radius:20px; white-space:nowrap; flex:none; text-decoration:underline;}
.sp-dual-action:hover:not(:disabled){background:#E1ECED; color:var(--brand-hover);}
.sp-dual-action:disabled{color:var(--muted); cursor:default;}
.sp-dual-list{list-style:none; margin:0; padding:0; max-height:400px; overflow:auto; flex:1;}
.sp-dual-item{display:flex; align-items:center; gap:8px; padding:0 14px; cursor:pointer; font-size:14px; color:var(--ink); min-height:40px;}
.sp-dual-item:hover{background:var(--green-fill);}
.sp-dual-item.is-picked{color:var(--ink);}
.sp-dual-item.is-picked:hover{background:var(--green-fill);}

/* footer */
.sp-foot{max-width:760px; margin:24px auto 0; text-align:center;}
.sp-foot > span{font-size:11px; color:var(--muted); letter-spacing:.03em;}
.sp-dataset{margin-bottom:20px; padding:16px; background:var(--surface); border:1px solid var(--line); border-radius:4px; text-align:left;}
.sp-dataset-title{display:block; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:10px;}
.sp-dataset-list{display:flex; flex-wrap:wrap; gap:6px;}
.sp-dataset-item{font-size:14px; color:var(--ink); background:var(--chip); padding:4px 10px; border-radius:4px;}

/* a11y / motion */
.sp-root :focus-visible{outline:2px solid var(--brand); outline-offset:2px;}
@media (prefers-reduced-motion:reduce){ .sp-root *{animation:none !important; transition:none !important;} }
`;
