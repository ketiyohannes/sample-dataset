Enhance the existing React quote generator. Add the features below while preserving current behavior and data shape.

Current Codebase:

// Quote.js
import React from "react";
import {quotes} from "../data/quotes";

const qt = quotes();

export default class Quote extends React.Component {
    state = {randomQuoteIndex: 0};
    
    handleChange = () => {
        this.setState({
            randomQuoteIndex: Math.round(Math.random()*30)
        })
    }
    
    render() {
        const idx = this.state.randomQuoteIndex;
        return(
            <div>
                <div className="quote-section">
                    <h2>{qt[idx].quote}</h2>
                    <h3>---{qt[idx].author}</h3>
                </div>
                <button onClick={this.handleChange}>Generate Random Quote</button>
            </div>
        )
    }
}

New Features

Favorites — Heart to favorite current quote; filled when current quote is in favorites. List: oldest first; max 10; duplicates = same quote text (any author). Heart state updates in real time when random quote changes.
Search — Filter favorites by quote text and author, case-insensitive.
Remove & Undo — Remove opens 5s Undo. One undo at a time; new remove cancels previous. At max 10, remove does not re-enable heart until undo window ends. Don’t write to localStorage on remove; write only when undo expires or user restores. Restore: original position in full list; still visible in filtered view if it matches search.
Persistence — Favorites in localStorage; undo state not persisted.

Constraints

No new dependencies — React + DOM only (no external state management, no UI libraries, no timer libraries).
Duplicate quotes (same text) cannot be favorited; max 10 favorites enforced.

Definition of done

Heart adds and shows favorites correctly; max 10 and no duplicates.
Search filters the list.
Remove shows Undo for 5 seconds; Undo restores quote; undo vs localStorage behavior is correct.
Favorites persist across refresh.
No console errors or warnings.




Requirements


Implementation language: React (JavaScript/JSX) and CSS only; no external libraries or state/timer utilities.

Existing Quote component behavior and quotes data shape must remain unchanged.

Add a heart control to favorite the currently displayed quote. Heart is filled if the current quote text exists in favorites.

Favorites must be ordered oldest first with a maximum of 10 items enforced at all times.

Duplicate favorites are not allowed based on identical quote text (author ignored).

Heart state must update instantly when the random quote changes.

Display a favorites list below the quote; order must not change due to search filtering.

Add a search input that filters favorites by quote text and author, case-insensitive.

Each favorite must have a remove control that triggers a 5-second Undo option.

Only one undo window may exist at a time; a new remove cancels the previous undo.

During an active undo window at max 10, the heart must remain disabled for new additions.

Undo must restore the quote to its original position and respect active search filters.

Favorites must persist in localStorage; load on mount, fallback to empty if invalid.

Do not write to localStorage on remove; write only after undo expires or on restore.

Undo state (timers/pending removal) must not persist across refresh; no console errors or warnings.


