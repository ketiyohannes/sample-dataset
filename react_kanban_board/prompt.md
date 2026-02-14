Enhance the existing React Kanban (two columns: In-Progress, Completed; drag-and-drop by task name). Add the features below while preserving current behavior and data shape.


New Features
Add task — "Add Task" in column header opens modal: Title (required), Priority (Low/Medium/High). New task: name = STORY-XXXX: <Title> (XXXX random 4 digits, no duplicate names). bgcolor by priority: High #ee9090, Medium #eeed90, Low lightgreen. Add to that column. Close: submit, outside click, Escape.
Edit task — Double-click card → inline input (current title). Enter or blur = save; Escape = cancel. Empty title on save = revert. Card must not be draggable while editing.
Delete task — Hover: × top-right. Click → "Delete this task?" Yes/No. Outside click = close without delete. Do not start drag when interacting with delete.
Priority — Show priority (dot/badge) on card. Right-click → menu: Low/Medium/High. On choose, set bgcolor (same map as add) and close. Menu closes on outside click or choose; must not block drag.
Persistence — On every tasks change (add/edit/delete/move/priority), write to localStorage. On mount, read; if missing/invalid, use default seed. If localStorage throws (e.g. private), catch and continue without it.

Current Codebase:

import { useState } from "react";
import "./App.css";

function App() {
  //state with default data
  const [tasks, setTasks] = useState([
    { name: "STORY-4513: Add tooltip", category: "wip", bgcolor: "lightblue" },
    {
      name: "STORY-4547: Fix search bug",
      category: "wip",
      bgcolor: "lightgrey",
    },
    {
      name: "STORY-4525: New filter option",
      category: "complete",
      bgcolor: "lightgreen",
    },
    {
      name: "STORY-4526: Remove region filter",
      category: "complete",
      bgcolor: "#ee9090",
    },
    {
      name: "STORY-4520: Improve performance",
      category: "complete",
      bgcolor: "#eeed90",
    },
  ]);

  //this event is for the dragged task card.
  //this is required to save unique id in the dom event so that when we drop it we would know the card id
  const onDragStart = (event, id) => {
    event.dataTransfer.setData("id", id);
  };

  //fetches the card id and based on that update the status/category of that card in tasks state
  const onDrop = (event, cat) => {
    let id = event.dataTransfer.getData("id");
    let newTasks = tasks.filter((task) => {
      if (task.name === id) {
        task.category = cat;
      }
      return task;
    });

    setTasks([...newTasks]);
  };

  //method to filter tasks beased on their status
  const getTask = () => {
    const tasksToRender = {
      wip: [],
      complete: [],
    };

    tasks.forEach((t) => {
      tasksToRender[t.category].push(
        <div
          key={t.name}
          onDragStart={(e) => onDragStart(e, t.name)}
          draggable
          className="task-card"
          style={{ backgroundColor: t.bgcolor }}
        >
          {t.name}
        </div>
      );
    });

    return tasksToRender;
  };

  return (
    <div className="drag-drop-container">
      <h2 className="drag-drop-header">JIRA BOARD: Sprint 21U</h2>
      <div className="drag-drop-board">
        <div
          className="wip"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            onDrop(e, "wip");
          }}
        >
          <div className="task-header">In-PROGRESS</div>
          {getTask().wip}
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e, "complete")}
        >
          <div className="task-header">COMPLETED</div>
          {getTask().complete}
        </div>
      </div>
    </div>
  );
}

export default App;


Constraints 
No new dependencies — React + DOM only (no dnd libs, no UI libs, no uuid).
Task shape unchanged — Only name, category, bgcolor. No new top-level fields. Priority is derived from bgcolor for display; updates write back as bgcolor.
name is the only ID — Uniqueness and drag payload use name. New tasks: exactly STORY-XXXX: <Title>. Edit: change only the part after the first : keep STORY-XXXX: prefix. Duplicate check on full name.
No duplicate names — On add, if generated name exists, regenerate until unique.
Styling — Inline styles only; match existing card/column patterns.
Keyboard — Modal: Tab, Enter submit, Escape close. Context menu and edit: Escape close/cancel.

Definition of done
All five features work and work together; existing drag-and-drop is unchanged.
Every constraint is satisfied.
Empty title on edit reverts; duplicate task name cannot be created; localStorage errors do not break the app.
No console errors or warnings.

Requirement

Implementation language: React (JavaScript/JSX), CSS. No additional frameworks or libraries.

Users must add tasks only via the "Add Task" button in the column header. Add Task opens a modal with Title (required) and Priority (Low/Medium/High); no other fields.

New task name must be exactly STORY-XXXX: <Title> with XXXX a random 4-digit number. Duplicate task names must not exist; if generated name exists, regenerate until unique.

Task shape must remain { name, category, bgcolor }; no new top-level fields. Priority must be derived from bgcolor for display; priority changes must write back as bgcolor only.

Edit must be triggered by double-click on the card; only the part after the first : may change. The STORY-XXXX: prefix must never change on edit.

Empty title on save must revert to the original title; edit must not persist empty. Card must not be draggable while in edit mode; Enter or blur saves, Escape cancels.

Delete control (×) must appear on hover at top-right of each card. Clicking delete must show "Delete this task?" with Yes/No; outside click must close without deleting.

Delete interaction must not start a drag; drag must not begin when interacting with delete. Priority must be shown on each card derived from bgcolor.

Right-click must open a context menu with Low/Medium/High; choice must set bgcolor and close menu. Bgcolor map: High #ee9090, Medium #eeed90, Low lightgreen; context menu must not block or interfere with drag.

Context menu must close on outside click or on choose. Every change to tasks (add, edit, delete, move, priority) must be written to localStorage.

On mount, tasks must be read from localStorage; if missing or invalid, use the default seed. localStorage errors (e.g. private mode) must be caught; the app must not break and must continue with in-memory state.

No external libraries may be used; React and DOM only. Styling must use inline styles and match existing card/column patterns.

Modal must close on submit, outside click, or Escape; Tab, Enter submit, Escape close for keyboard. Context menu and inline edit must close or cancel on Escape.

All five features must work together; existing drag-and-drop between columns must be unchanged. 

No console errors or warnings. 