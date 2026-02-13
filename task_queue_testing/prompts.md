A backend infrastructure team has built a priority task queue system for processing asynchronous jobs in a microservices architecture. The queue handles thousands of jobs daily including email delivery, report generation, image processing, and webhook dispatching. Each task has a priority level that determines processing order, and the system supports retry logic with exponential backoff for transient failures. The queue enforces concurrency limits to prevent resource exhaustion and implements timeout detection to recover from stuck tasks. During load testing, the team discovered that high-priority tasks sometimes execute after lower-priority ones when the queue is under heavy load, retry delays do not properly increase exponentially, and tasks that timeout are not always cleaned up correctly. The implementation needs a comprehensive test suite before deployment to production.

You are a senior QA engineer writing a test suite for the TypeScript task queue located in `src/task-queue.ts`. The queue processes tasks asynchronously with priority ordering, retries failed tasks with exponential backoff, enforces a maximum concurrency limit, and tracks task status through its lifecycle. Write comprehensive tests using Jest that cover all public methods, verify business rules around task scheduling and retry behavior, and validate error handling for edge cases. The tests should be organized by feature area and include both happy path scenarios and boundary conditions.

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export type TaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "timed_out";

export interface TaskData {
    [key: string]: unknown;
}

export interface TaskConfig<T extends TaskData = TaskData> {
    handler: (data: T) => Promise<unknown>;
    data: T;
    priority?: TaskPriority;
    maxRetries?: number;
    retryBaseDelay?: number;
    timeout?: number;
}

export interface Task<T extends TaskData = TaskData> {
    id: string;
    status: TaskStatus;
    priority: TaskPriority;
    data: T;
    result?: unknown;
    error?: Error;
    attempts: number;
    maxRetries: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    timedOut: number;
    total: number;
}

export interface QueueOptions {
    maxConcurrency?: number;
    defaultTimeout?: number;
    defaultMaxRetries?: number;
    defaultRetryBaseDelay?: number;
}

type TaskCallback = (task: Task) => void;

export class TaskQueue {
    private tasks: Map<string, Task> = new Map();
    private queue: string[] = [];
    private running: Set<string> = new Set();
    private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private handlers: Map<string, (data: TaskData) => Promise<unknown>> =
        new Map();
    private paused = false;
    private disposed = false;
    private idCounter = 0;

    private maxConcurrency: number;
    private defaultTimeout: number;
    private defaultMaxRetries: number;
    private defaultRetryBaseDelay: number;

    private onCompleteCallback?: TaskCallback;
    private onFailedCallback?: TaskCallback;

    constructor(options: QueueOptions = {}) {
        this.maxConcurrency = options.maxConcurrency ?? 5;
        this.defaultTimeout = options.defaultTimeout ?? 30000;
        this.defaultMaxRetries = options.defaultMaxRetries ?? 3;
        this.defaultRetryBaseDelay = options.defaultRetryBaseDelay ?? 1000;

        if (this.maxConcurrency < 1) {
            throw new Error("maxConcurrency must be at least 1");
        }
    }

    enqueue<T extends TaskData>(config: TaskConfig<T>): string {
        if (this.disposed) {
            throw new Error("Cannot enqueue tasks on a disposed queue");
        }

        if (!config.handler || typeof config.handler !== "function") {
            throw new Error("Task handler must be a function");
        }

        if (config.priority !== undefined) {
            if (
                !Number.isInteger(config.priority) ||
                config.priority < 1 ||
                config.priority > 5
            ) {
                throw new Error("Priority must be an integer between 1 and 5");
            }
        }

        if (
            config.maxRetries !== undefined &&
            (config.maxRetries < 0 || !Number.isInteger(config.maxRetries))
        ) {
            throw new Error("maxRetries must be a non-negative integer");
        }

        const id = this.generateId();
        const task: Task<T> = {
            id,
            status: "pending",
            priority: config.priority ?? 3,
            data: config.data,
            attempts: 0,
            maxRetries: config.maxRetries ?? this.defaultMaxRetries,
            createdAt: new Date(),
        };

        this.tasks.set(id, task as Task);
        this.handlers.set(id, config.handler as (data: TaskData) => Promise<unknown>);
        this.insertByPriority(id);
        this.processNext();

        return id;
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    getStats(): QueueStats {
        const stats: QueueStats = {
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0,
            timedOut: 0,
            total: this.tasks.size,
        };

        for (const task of this.tasks.values()) {
            switch (task.status) {
                case "pending":
                    stats.pending++;
                    break;
                case "running":
                    stats.running++;
                    break;
                case "completed":
                    stats.completed++;
                    break;
                case "failed":
                    stats.failed++;
                    break;
                case "timed_out":
                    stats.timedOut++;
                    break;
            }
        }

        return stats;
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
        this.processNext();
    }

    clear(): void {
        const toRemove: string[] = [];
        for (const id of this.queue) {
            const task = this.tasks.get(id);
            if (task && task.status === "pending") {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            this.queue = this.queue.filter((qId) => qId !== id);
            this.tasks.delete(id);
            this.handlers.delete(id);

            const retryTimer = this.retryTimers.get(id);
            if (retryTimer) {
                clearTimeout(retryTimer);
                this.retryTimers.delete(id);
            }
        }
    }

    dispose(): void {
        this.disposed = true;
        this.paused = true;

        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        for (const timer of this.retryTimers.values()) {
            clearTimeout(timer);
        }

        this.timers.clear();
        this.retryTimers.clear();
        this.queue = [];
    }

    onTaskComplete(callback: TaskCallback): void {
        this.onCompleteCallback = callback;
    }

    onTaskFailed(callback: TaskCallback): void {
        this.onFailedCallback = callback;
    }

    private generateId(): string {
        this.idCounter++;
        return `task_${Date.now()}_${this.idCounter}`;
    }

    private insertByPriority(id: string): void {
        const task = this.tasks.get(id)!;
        let inserted = false;

        for (let i = 0; i < this.queue.length; i++) {
            const existingTask = this.tasks.get(this.queue[i]);
            if (existingTask && task.priority < existingTask.priority) {
                this.queue.splice(i, 0, id);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            this.queue.push(id);
        }
    }

    private processNext(): void {
        if (this.paused || this.disposed) return;

        while (
            this.running.size < this.maxConcurrency &&
            this.queue.length > 0
        ) {
            const id = this.queue.shift()!;
            const task = this.tasks.get(id);

            if (!task || task.status !== "pending") continue;

            this.executeTask(id);
        }
    }

    private async executeTask(id: string): Promise<void> {
        const task = this.tasks.get(id);
        const handler = this.handlers.get(id);

        if (!task || !handler) return;

        task.status = "running";
        task.startedAt = new Date();
        task.attempts++;
        this.running.add(id);

        const timeout = this.defaultTimeout;
        let timedOut = false;

        const timeoutTimer = setTimeout(() => {
            timedOut = true;
            this.running.delete(id);
            task.status = "timed_out";
            task.completedAt = new Date();

            if (task.attempts < task.maxRetries) {
                this.scheduleRetry(id);
            } else {
                task.error = new Error("Task timed out");
                this.onFailedCallback?.(task);
            }

            this.processNext();
        }, timeout);

        this.timers.set(id, timeoutTimer);

        try {
            const result = await handler(task.data);

            if (timedOut) return;

            clearTimeout(timeoutTimer);
            this.timers.delete(id);

            task.status = "completed";
            task.result = result;
            task.completedAt = new Date();
            this.running.delete(id);

            this.onCompleteCallback?.(task);
            this.processNext();
        } catch (error) {
            if (timedOut) return;

            clearTimeout(timeoutTimer);
            this.timers.delete(id);

            this.running.delete(id);
            task.error = error instanceof Error ? error : new Error(String(error));

            if (task.attempts < task.maxRetries) {
                this.scheduleRetry(id);
            } else {
                task.status = "failed";
                task.completedAt = new Date();
                this.onFailedCallback?.(task);
            }

            this.processNext();
        }
    }

    private scheduleRetry(id: string): void {
        const task = this.tasks.get(id);
        if (!task) return;

        task.status = "pending";

        const delay =
            (this.defaultRetryBaseDelay) * Math.pow(2, task.attempts - 1);

        const retryTimer = setTimeout(() => {
            this.retryTimers.delete(id);
            this.insertByPriority(id);
            this.processNext();
        }, delay);

        this.retryTimers.set(id, retryTimer);
    }
}



requirements

Set up the test file using Jest as the test framework. Import the `TaskQueue` class and related types from `src/task-queue.ts`. Configure any necessary Jest settings for async test handling with appropriate timeouts.

Write tests for `enqueue()` that verify tasks are added with correct default values, priority is assigned properly, the returned task ID is unique, and the task status is set to `pending`.
Tasks with missing or invalid fields must throw appropriate errors.

Write tests for priority ordering that verify higher-priority tasks (lower numeric value) are dequeued before lower-priority tasks.
Tasks with equal priority must be processed in FIFO order.
A high-priority task added after low-priority tasks must still process first when the queue has capacity.

Write tests for task execution that verify enqueued tasks are automatically processed by calling their handler function.
Task status must transition from `pending` to `running` to `completed`, and the result must be stored on the task.
The handler must receive the correct task data payload.

Write tests for concurrency limits that verify no more than `maxConcurrency` tasks run simultaneously.
When a running task completes, the next queued task must begin processing immediately.

Write tests for retry logic that verify failed tasks are retried and must not exceed `maxRetries` total execution attempts.
Retry delay must follow exponential backoff where delay equals `baseDelay * 2^(attempts - 1)`.
A task succeeding on a retry attempt must be marked as `completed` with the correct attempt count.
A task exhausting all retries must be marked as `failed` with the last error recorded.

Write tests for timeout handling that verify tasks exceeding `defaultTimeout` duration are cancelled and marked as `timed_out`.
Timed-out tasks must trigger a retry if retries remain.
The timeout timer must be cleared when a task completes before the timeout.

Write tests for `getTask()` that verify it returns the correct task object by ID, returns `undefined` for non-existent IDs, and reflects the current status and result.

Write tests for `getStats()` that verify it returns accurate counts for pending, running, completed, failed, and timed_out tasks.
Stats must update correctly as tasks move through their lifecycle.

Write tests for `pause()` and `resume()` that verify pausing stops new task processing while allowing running tasks to complete.
Resuming must restart processing of queued tasks.

Write tests for `clear()` that verify it removes all pending tasks, does not affect running tasks, and resets the pending count in stats.

Write tests for event callbacks (`onTaskComplete`, `onTaskFailed`) that verify the correct callback is invoked with the task details when a task completes or fails.

The test suite must contain at least 30 individual test cases.

At least 5 tests must target error conditions and edge cases such as invalid priority values, negative retry counts, zero concurrency limit, and enqueueing after queue disposal.

Tests must verify state transitions by checking task status at each lifecycle stage, not just the final status.

At least 3 tests must validate timing-related behavior including retry backoff delays and task timeouts using Jest's timer mocking capabilities.

The test suite must include at least 2 tests that verify concurrent behavior by running multiple tasks simultaneously and asserting the concurrency limit is respected.

Tests must verify that task data payloads are passed through correctly and are not mutated during processing. At least 1 test must use a complex nested object as the task payload.

The test suite must clean up resources after each test. Any test that leaves timers, promises, or queue instances running will cause test pollution and must be considered failing.