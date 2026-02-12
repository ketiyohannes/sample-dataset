Build a library hold queue app: users place holds on books; when a copy returns, the first eligible person gets it. Users can freeze a hold to skip their turn without losing position. React frontend, Node.js/Express backend, JSON file storage (no DB). One repo, frontend and backend in separate folders.

Endpoints:

POST /api/books — { title, copies } → book with id
POST /api/hold — { email, bookId } → position, holdId. One active hold per book per user; duplicate → reject "Already on hold for this book". Email must contain @ and ..
POST /api/freeze — { email, holdId } (hold skipped when eligible)
POST /api/unfreeze — { email, holdId }. If copy available, attempt assignment.
POST /api/return — { bookId } (assign copy to first eligible)
GET /api/holds/:email — user's holds
GET /api/queue/:bookId — ordered queue

Constraints:

Positions are 1-based and stable (never renumber). New holds join at end.
Frozen = stay at same position, skipped when assigning. Scan queue in position order; first non-fulfilled, non-frozen gets the copy.
All frozen when copy returns → copy stays available (no assignment). Unfreeze can trigger assignment if copy available.
No DB, UUID, or email-validation libs; use incremental ids.

Definition of Done: 

Alice(1) frozen, Bob(2), Charlie(3) → copy returns → Bob gets it. All frozen → copy returns → no one gets it; Alice unfreezes, copy available → Alice gets it. Alice holds again for same book → reject.


Requirement

Users must not place more than one active hold per book.
Duplicate hold attempts must return "Already on hold for this book" and fail.

Hold positions must be 1-based and stable.
New holds join at the end; existing positions never renumber.

Frozen holds must retain their position and be skipped when assigning copies.
Only the first non-frozen, non-fulfilled hold may receive an available copy.

If all holds are frozen, returned copies remain available.
Copies must not be assigned until a frozen hold is unfrozen.

Unfreezing a hold must trigger immediate assignment if a copy is available.
Multiple unfreezes at once must assign sequentially by queue position.

POST /api/return must increment available copies and assign to eligible holds.
No copy may be lost or assigned to multiple holds simultaneously.

Freeze and unfreeze endpoints must correctly update the frozen flag.
No other hold positions or flags may be affected by this operation.

Email validation for holds must include @ and a dot (.).
Invalid emails result in error and prevent hold creation.

GET /api/holds/:email must return all user holds with position, frozen, and fulfilled status.
Order of holds must match the queue positions accurately.

GET /api/queue/:bookId must return full queue in position order.
Frozen and fulfilled flags must be included, without renumbering.

Book creation must store { title, copies } with incremental id.
Copies must be tracked in availableCopies separately from total copies.

IDs for books and holds must be incremental integers only.
No UUIDs or external libraries may be used for ID generation.

Backend must use Node.js + Express with JSON file storage under /backend/data.
No database may be used; data integrity must be maintained under concurrent requests.

Frontend must use React and allow users to view books, place holds, freeze/unfreeze,
and see queue positions and available copies updated in real-time.

All operations must handle concurrency safely and maintain consistency.
Example: Alice(1) frozen, Bob(2), Charlie(3) → copy returns → Bob gets it; frozen holds remain until unfreeze.