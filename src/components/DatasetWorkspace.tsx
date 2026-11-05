import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import type { Dataset } from "../types";
import DatasetHeader from "./DatasetHeader";
import UseInR from "./UseInR";

export default function DatasetWorkspace({
  dataset,
  children,
}: {
  dataset: Dataset;
  children: ReactNode;
}) {
  const [tab, setTab] = useState(0);
  const id = useId();
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowLeft: 1 - tab,
      ArrowRight: 1 - tab,
      Home: 0,
      End: 1,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    const next = keys[event.key];
    setTab(next);
    const buttons =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next].focus();
  }
  return (
    <main id="main" className="detail shell">
      <DatasetHeader dataset={dataset} />
      <div
        role="tablist"
        aria-label="Dataset tools"
        className="dataset-tabs"
        onKeyDown={navigate}
      >
        {["Preview & map", "Use in R"].map((label, index) => (
          <button
            key={label}
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            aria-selected={tab === index}
            tabIndex={tab === index ? 0 : -1}
            onClick={() => setTab(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-0`}
        aria-labelledby={`${id}-tab-0`}
        hidden={tab !== 0}
      >
        {children}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-1`}
        aria-labelledby={`${id}-tab-1`}
        hidden={tab !== 1}
      >
        {tab === 1 && <UseInR dataset={dataset} />}
      </div>
    </main>
  );
}
