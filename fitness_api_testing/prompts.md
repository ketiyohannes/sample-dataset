You are a senior QA engineer responsible for developing a comprehensive validation suite for the fitness tracking Express API implemented in app.ts. This API is written in TypeScript, persists state in a JSON data store to avoid exposing the production database, and exposes endpoints supporting user lifecycle management, workout logging, streak tracking, badge evaluation, and personalized recommendations. The existing system must be treated as production-critical infrastructure, even though it is a simplified prototype. Your task is to construct a test suite capable of verifying functional correctness, data integrity, business-rule compliance, and error handling across all exposed behaviors. The tests must interact with the API through HTTP-level integration using a realistic request pipeline rather than direct function invocation, while maintaining deterministic execution and isolation from external side effects. The suite must be structured by feature domain, enforce type safety through TypeScript usage, and provide reliable reproducibility by resetting persistent state before execution and restoring it afterward. Validation must include confirmation of correct response structures, status codes, side effects on stored data, and failure conditions across both normal and exceptional flows, ensuring that the system behaves consistently under expected usage as well as edge-case scenarios.

The validation framework must initialize using Jest configured for TypeScript and Supertest-based request handling that wraps the application without launching a network listener. Test data must be controlled through fixture-driven resets of data.json, including preservation and restoration of original state, and execution must correctly await asynchronous operations to prevent race conditions. Coverage must verify endpoint behavior across user creation, retrieval, and filtering; workout logging, querying, and completion flows; streak calculations under consecutive, interrupted, and duplicate-day conditions; badge evaluation across count-based, streak-based, and weight milestone criteria; and recommendation generation respecting equipment availability, difficulty alignment, and recency prioritization constraints. Time-sensitive logic must be validated using controlled clock manipulation to confirm correctness across timezone offsets, midnight boundaries, and daylight-saving transitions. Assertions must confirm that validation failures return appropriate error responses, that progress metrics and computed fields are accurate, and that no recommendation includes exercises incompatible with a user’s available equipment. Success is defined by full behavioral verification of all endpoints, deterministic isolation between tests, demonstrable correctness of complex business-rule outcomes, readable organization aligned to feature domains, and diagnostics that clearly expose regression causes when expectations are not met.

Below is the implementation under test:

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data.json');

interface Exercise {
    name: string;
    sets: number;
    reps: number;
    weight?: number;
    equipment?: string[];
}

interface Workout {
    id: string;
    userId: string;
    date: string;
    exercises: Exercise[];
    completedAt?: string;
    duration?: number;
}

interface Badge {
    id: string;
    name: string;
    description: string;
    earnedAt?: string;
    criteria: {
        type: 'count' | 'streak' | 'weight';
        threshold: number;
        exerciseType?: string;
    };
}

interface User {
    id: string;
    name: string;
    email: string;
    equipment: string[];
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
    currentStreak: number;
    longestStreak: number;
    totalWorkouts: number;
    lastWorkoutDate?: string;
    badges: Badge[];
    personalRecords: Record<string, number>;
}

interface Data {
    users: User[];
    workouts: Workout[];
    availableBadges: Badge[];
    exercises: { name: string; equipment: string[]; muscles: string[]; difficulty: string }[];
}

function loadData(): Data {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
}

function saveData(data: Data): void {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
}

function calculateStreak(userId: string, data: Data, newWorkoutDate?: string): { current: number; longest: number } {
    const userWorkouts = data.workouts
        .filter(w => w.userId === userId && w.completedAt)
        .map(w => new Date(w.date).toISOString().split('T')[0])
        .sort()
        .reverse();

    if (newWorkoutDate) {
        userWorkouts.unshift(new Date(newWorkoutDate).toISOString().split('T')[0]);
    }

    const uniqueDates = [...new Set(userWorkouts)];
    if (uniqueDates.length === 0) return { current: 0, longest: 0 };

    let currentStreak = 1;
    let maxStreak = 1;
    let tempStreak = 1;

    const today = new Date().toISOString().split('T')[0];
    const lastWorkout = uniqueDates[0];

    const daysSinceLastWorkout = Math.floor(
        (new Date(today).getTime() - new Date(lastWorkout).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastWorkout > 1) {
        currentStreak = 0;
    } else {
        for (let i = 1; i < uniqueDates.length; i++) {
            const prevDate = new Date(uniqueDates[i - 1]);
            const currDate = new Date(uniqueDates[i]);
            const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                tempStreak++;
                currentStreak = tempStreak;
            } else {
                maxStreak = Math.max(maxStreak, tempStreak);
                tempStreak = 1;
                break;
            }
        }
    }

    maxStreak = Math.max(maxStreak, tempStreak);
    return { current: currentStreak, longest: maxStreak };
}

function evaluateBadges(user: User, data: Data): Badge[] {
    const earnedBadges: Badge[] = [...user.badges];
    const earnedIds = new Set(earnedBadges.map(b => b.id));

    for (const badge of data.availableBadges) {
        if (earnedIds.has(badge.id)) continue;

        let qualified = false;

        switch (badge.criteria.type) {
            case 'count':
                qualified = user.totalWorkouts >= badge.criteria.threshold;
                break;
            case 'streak':
                qualified = user.currentStreak >= badge.criteria.threshold;
                break;
            case 'weight':
                if (badge.criteria.exerciseType) {
                    const pr = user.personalRecords[badge.criteria.exerciseType] || 0;
                    qualified = pr >= badge.criteria.threshold;
                }
                break;
        }

        if (qualified) {
            earnedBadges.push({
                ...badge,
                earnedAt: new Date().toISOString()
            });
        }
    }

    return earnedBadges;
}

// GET /users
app.get('/users', (req: Request, res: Response) => {
    const data = loadData();
    let users = data.users;

    if (req.query.activeOnly === 'true') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        users = users.filter(u => u.lastWorkoutDate && new Date(u.lastWorkoutDate) >= thirtyDaysAgo);
    }

    res.json(users);
});

// GET /users/:id
app.get('/users/:id', (req: Request, res: Response) => {
    const data = loadData();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
});

// POST /users
app.post('/users', (req: Request, res: Response) => {
    const data = loadData();
    const { name, email, equipment, fitnessLevel } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    if (data.users.some(u => u.email === email)) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    const newUser: User = {
        id: generateId(),
        name,
        email,
        equipment: equipment || [],
        fitnessLevel: fitnessLevel || 'beginner',
        currentStreak: 0,
        longestStreak: 0,
        totalWorkouts: 0,
        badges: [],
        personalRecords: {}
    };

    data.users.push(newUser);
    saveData(data);

    res.status(201).json(newUser);
});

// GET /workouts
app.get('/workouts', (req: Request, res: Response) => {
    const data = loadData();
    let workouts = data.workouts;

    if (req.query.userId) {
        workouts = workouts.filter(w => w.userId === req.query.userId);
    }

    if (req.query.dateFrom) {
        workouts = workouts.filter(w => new Date(w.date) >= new Date(req.query.dateFrom as string));
    }

    if (req.query.dateTo) {
        workouts = workouts.filter(w => new Date(w.date) <= new Date(req.query.dateTo as string));
    }

    if (req.query.exerciseType) {
        workouts = workouts.filter(w =>
            w.exercises.some(e => e.name.toLowerCase() === (req.query.exerciseType as string).toLowerCase())
        );
    }

    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    workouts.sort((a, b) => sortOrder * (new Date(a.date).getTime() - new Date(b.date).getTime()));

    const enrichedWorkouts = workouts.map(w => {
        const user = data.users.find(u => u.id === w.userId);
        return { ...w, userName: user?.name };
    });

    res.json(enrichedWorkouts);
});

// POST /workouts
app.post('/workouts', (req: Request, res: Response) => {
    const data = loadData();
    const { userId, date, exercises } = req.body;

    const user = data.users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
        return res.status(400).json({ error: 'Exercises array is required' });
    }

    for (const exercise of exercises) {
        if (!exercise.name || !exercise.sets || !exercise.reps) {
            return res.status(400).json({ error: 'Each exercise must have name, sets, and reps' });
        }
    }

    const newWorkout: Workout = {
        id: generateId(),
        userId,
        date: date || new Date().toISOString(),
        exercises
    };

    data.workouts.push(newWorkout);
    saveData(data);

    res.status(201).json(newWorkout);
});

// POST /workouts/:id/complete
app.post('/workouts/:id/complete', (req: Request, res: Response) => {
    const data = loadData();
    const workout = data.workouts.find(w => w.id === req.params.id);

    if (!workout) {
        return res.status(404).json({ error: 'Workout not found' });
    }

    if (workout.completedAt) {
        return res.status(409).json({ error: 'Workout already completed' });
    }

    workout.completedAt = new Date().toISOString();

    const user = data.users.find(u => u.id === workout.userId);
    if (user) {
        user.totalWorkouts++;
        user.lastWorkoutDate = workout.date;

        // Update personal records
        for (const exercise of workout.exercises) {
            if (exercise.weight) {
                const currentPR = user.personalRecords[exercise.name] || 0;
                if (exercise.weight > currentPR) {
                    user.personalRecords[exercise.name] = exercise.weight;
                }
            }
        }

        // Recalculate streak
        const streakResult = calculateStreak(user.id, data);
        user.currentStreak = streakResult.current;
        user.longestStreak = Math.max(user.longestStreak, streakResult.longest);

        // Evaluate badges
        user.badges = evaluateBadges(user, data);
    }

    saveData(data);
    res.json(workout);
});

// GET /users/:id/badges
app.get('/users/:id/badges', (req: Request, res: Response) => {
    const data = loadData();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const badgesWithProgress = data.availableBadges.map(badge => {
        const earned = user.badges.find(b => b.id === badge.id);
        if (earned) {
            return { ...badge, earned: true, earnedAt: earned.earnedAt, progress: 100 };
        }

        let progress = 0;
        switch (badge.criteria.type) {
            case 'count':
                progress = Math.min(100, (user.totalWorkouts / badge.criteria.threshold) * 100);
                break;
            case 'streak':
                progress = Math.min(100, (user.currentStreak / badge.criteria.threshold) * 100);
                break;
            case 'weight':
                if (badge.criteria.exerciseType) {
                    const pr = user.personalRecords[badge.criteria.exerciseType] || 0;
                    progress = Math.min(100, (pr / badge.criteria.threshold) * 100);
                }
                break;
        }

        return { ...badge, earned: false, progress: Math.round(progress) };
    });

    res.json(badgesWithProgress);
});

// GET /recommendations/:userId
app.get('/recommendations/:userId', (req: Request, res: Response) => {
    const data = loadData();
    const user = data.users.find(u => u.id === req.params.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Filter exercises based on user equipment
    let recommendations = data.exercises.filter(exercise => {
        if (exercise.equipment.length === 0) return true;
        return exercise.equipment.every(eq => user.equipment.includes(eq));
    });

    // Filter by fitness level
    const difficultyMap: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
    const userLevel = difficultyMap[user.fitnessLevel];
    recommendations = recommendations.filter(ex => {
        const exLevel = difficultyMap[ex.difficulty] || 1;
        return exLevel <= userLevel;
    });

    // Deprioritize recently performed exercises
    const recentWorkouts = data.workouts
        .filter(w => w.userId === user.id)
        .slice(-5);
    const recentExercises = new Set(
        recentWorkouts.flatMap(w => w.exercises.map(e => e.name.toLowerCase()))
    );

    recommendations.sort((a, b) => {
        const aRecent = recentExercises.has(a.name.toLowerCase()) ? 1 : 0;
        const bRecent = recentExercises.has(b.name.toLowerCase()) ? 1 : 0;
        return aRecent - bRecent;
    });

    res.json(recommendations);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;


The JSON data:

{
    "users": [
        {
            "id": "u1",
            "name": "Alex Thompson",
            "email": "alex@example.com",
            "equipment": [
                "dumbbells",
                "barbell",
                "bench",
                "pull-up bar"
            ],
            "fitnessLevel": "intermediate",
            "currentStreak": 5,
            "longestStreak": 14,
            "totalWorkouts": 47,
            "lastWorkoutDate": "2024-01-15",
            "badges": [
                {
                    "id": "b1",
                    "name": "First Workout",
                    "description": "Complete your first workout",
                    "earnedAt": "2023-06-01T10:00:00Z",
                    "criteria": {
                        "type": "count",
                        "threshold": 1
                    }
                },
                {
                    "id": "b3",
                    "name": "Week Warrior",
                    "description": "Maintain a 7-day streak",
                    "earnedAt": "2023-08-15T10:00:00Z",
                    "criteria": {
                        "type": "streak",
                        "threshold": 7
                    }
                }
            ],
            "personalRecords": {
                "Bench Press": 185,
                "Squat": 225,
                "Deadlift": 275
            }
        },
        {
            "id": "u2",
            "name": "Jordan Martinez",
            "email": "jordan@example.com",
            "equipment": [
                "dumbbells",
                "resistance bands"
            ],
            "fitnessLevel": "beginner",
            "currentStreak": 0,
            "longestStreak": 3,
            "totalWorkouts": 8,
            "lastWorkoutDate": "2023-12-20",
            "badges": [
                {
                    "id": "b1",
                    "name": "First Workout",
                    "description": "Complete your first workout",
                    "earnedAt": "2023-12-01T10:00:00Z",
                    "criteria": {
                        "type": "count",
                        "threshold": 1
                    }
                }
            ],
            "personalRecords": {
                "Dumbbell Curl": 25,
                "Shoulder Press": 30
            }
        },
        {
            "id": "u3",
            "name": "Sam Wilson",
            "email": "sam@example.com",
            "equipment": [
                "dumbbells",
                "barbell",
                "bench",
                "squat rack",
                "cable machine"
            ],
            "fitnessLevel": "advanced",
            "currentStreak": 12,
            "longestStreak": 30,
            "totalWorkouts": 156,
            "lastWorkoutDate": "2024-01-16",
            "badges": [
                {
                    "id": "b1",
                    "name": "First Workout",
                    "description": "Complete your first workout",
                    "earnedAt": "2022-01-05T10:00:00Z",
                    "criteria": {
                        "type": "count",
                        "threshold": 1
                    }
                },
                {
                    "id": "b2",
                    "name": "Centurion",
                    "description": "Complete 100 workouts",
                    "earnedAt": "2023-05-20T10:00:00Z",
                    "criteria": {
                        "type": "count",
                        "threshold": 100
                    }
                },
                {
                    "id": "b3",
                    "name": "Week Warrior",
                    "description": "Maintain a 7-day streak",
                    "earnedAt": "2022-02-01T10:00:00Z",
                    "criteria": {
                        "type": "streak",
                        "threshold": 7
                    }
                },
                {
                    "id": "b4",
                    "name": "Iron Will",
                    "description": "Maintain a 30-day streak",
                    "earnedAt": "2023-03-15T10:00:00Z",
                    "criteria": {
                        "type": "streak",
                        "threshold": 30
                    }
                },
                {
                    "id": "b5",
                    "name": "200 Club",
                    "description": "Bench press 200 lbs",
                    "earnedAt": "2023-06-10T10:00:00Z",
                    "criteria": {
                        "type": "weight",
                        "threshold": 200,
                        "exerciseType": "Bench Press"
                    }
                }
            ],
            "personalRecords": {
                "Bench Press": 245,
                "Squat": 315,
                "Deadlift": 405,
                "Overhead Press": 155
            }
        },
        {
            "id": "u4",
            "name": "Taylor Chen",
            "email": "taylor@example.com",
            "equipment": [],
            "fitnessLevel": "beginner",
            "currentStreak": 0,
            "longestStreak": 0,
            "totalWorkouts": 0,
            "badges": [],
            "personalRecords": {}
        }
    ],
    "workouts": [
        {
            "id": "w1",
            "userId": "u1",
            "date": "2024-01-15T08:00:00Z",
            "exercises": [
                {
                    "name": "Bench Press",
                    "sets": 4,
                    "reps": 8,
                    "weight": 155,
                    "equipment": [
                        "barbell",
                        "bench"
                    ]
                },
                {
                    "name": "Dumbbell Row",
                    "sets": 3,
                    "reps": 10,
                    "weight": 50,
                    "equipment": [
                        "dumbbells"
                    ]
                },
                {
                    "name": "Pull-ups",
                    "sets": 3,
                    "reps": 8,
                    "equipment": [
                        "pull-up bar"
                    ]
                }
            ],
            "completedAt": "2024-01-15T09:15:00Z",
            "duration": 75
        },
        {
            "id": "w2",
            "userId": "u1",
            "date": "2024-01-14T08:00:00Z",
            "exercises": [
                {
                    "name": "Squat",
                    "sets": 4,
                    "reps": 6,
                    "weight": 205,
                    "equipment": [
                        "barbell"
                    ]
                },
                {
                    "name": "Leg Press",
                    "sets": 3,
                    "reps": 12,
                    "weight": 300,
                    "equipment": [
                        "leg press machine"
                    ]
                }
            ],
            "completedAt": "2024-01-14T09:00:00Z",
            "duration": 60
        },
        {
            "id": "w3",
            "userId": "u3",
            "date": "2024-01-16T06:00:00Z",
            "exercises": [
                {
                    "name": "Deadlift",
                    "sets": 5,
                    "reps": 3,
                    "weight": 385,
                    "equipment": [
                        "barbell"
                    ]
                },
                {
                    "name": "Barbell Row",
                    "sets": 4,
                    "reps": 8,
                    "weight": 185,
                    "equipment": [
                        "barbell"
                    ]
                },
                {
                    "name": "Face Pulls",
                    "sets": 3,
                    "reps": 15,
                    "equipment": [
                        "cable machine"
                    ]
                }
            ],
            "completedAt": "2024-01-16T07:30:00Z",
            "duration": 90
        },
        {
            "id": "w4",
            "userId": "u2",
            "date": "2023-12-20T10:00:00Z",
            "exercises": [
                {
                    "name": "Dumbbell Curl",
                    "sets": 3,
                    "reps": 12,
                    "weight": 20,
                    "equipment": [
                        "dumbbells"
                    ]
                },
                {
                    "name": "Shoulder Press",
                    "sets": 3,
                    "reps": 10,
                    "weight": 25,
                    "equipment": [
                        "dumbbells"
                    ]
                }
            ],
            "completedAt": "2023-12-20T10:45:00Z",
            "duration": 45
        },
        {
            "id": "w5",
            "userId": "u1",
            "date": "2024-01-13T08:00:00Z",
            "exercises": [
                {
                    "name": "Overhead Press",
                    "sets": 4,
                    "reps": 6,
                    "weight": 95,
                    "equipment": [
                        "barbell"
                    ]
                },
                {
                    "name": "Lateral Raise",
                    "sets": 3,
                    "reps": 12,
                    "weight": 20,
                    "equipment": [
                        "dumbbells"
                    ]
                }
            ],
            "completedAt": "2024-01-13T08:50:00Z",
            "duration": 50
        },
        {
            "id": "w6",
            "userId": "u1",
            "date": "2024-01-12T08:00:00Z",
            "exercises": [
                {
                    "name": "Bench Press",
                    "sets": 4,
                    "reps": 8,
                    "weight": 150,
                    "equipment": [
                        "barbell",
                        "bench"
                    ]
                }
            ],
            "completedAt": "2024-01-12T08:45:00Z",
            "duration": 45
        },
        {
            "id": "w7",
            "userId": "u1",
            "date": "2024-01-11T08:00:00Z",
            "exercises": [
                {
                    "name": "Squat",
                    "sets": 4,
                    "reps": 8,
                    "weight": 195,
                    "equipment": [
                        "barbell"
                    ]
                }
            ],
            "completedAt": "2024-01-11T08:50:00Z",
            "duration": 50
        },
        {
            "id": "w8",
            "userId": "u3",
            "date": "2024-01-15T06:00:00Z",
            "exercises": [
                {
                    "name": "Bench Press",
                    "sets": 5,
                    "reps": 5,
                    "weight": 225,
                    "equipment": [
                        "barbell",
                        "bench"
                    ]
                },
                {
                    "name": "Incline Press",
                    "sets": 4,
                    "reps": 8,
                    "weight": 155,
                    "equipment": [
                        "barbell",
                        "bench"
                    ]
                }
            ],
            "completedAt": "2024-01-15T07:15:00Z",
            "duration": 75
        }
    ],
    "availableBadges": [
        {
            "id": "b1",
            "name": "First Workout",
            "description": "Complete your first workout",
            "criteria": {
                "type": "count",
                "threshold": 1
            }
        },
        {
            "id": "b2",
            "name": "Centurion",
            "description": "Complete 100 workouts",
            "criteria": {
                "type": "count",
                "threshold": 100
            }
        },
        {
            "id": "b3",
            "name": "Week Warrior",
            "description": "Maintain a 7-day streak",
            "criteria": {
                "type": "streak",
                "threshold": 7
            }
        },
        {
            "id": "b4",
            "name": "Iron Will",
            "description": "Maintain a 30-day streak",
            "criteria": {
                "type": "streak",
                "threshold": 30
            }
        },
        {
            "id": "b5",
            "name": "200 Club",
            "description": "Bench press 200 lbs",
            "criteria": {
                "type": "weight",
                "threshold": 200,
                "exerciseType": "Bench Press"
            }
        },
        {
            "id": "b6",
            "name": "Triple Plate",
            "description": "Squat 315 lbs",
            "criteria": {
                "type": "weight",
                "threshold": 315,
                "exerciseType": "Squat"
            }
        },
        {
            "id": "b7",
            "name": "Dedication",
            "description": "Complete 50 workouts",
            "criteria": {
                "type": "count",
                "threshold": 50
            }
        },
        {
            "id": "b8",
            "name": "Consistent",
            "description": "Maintain a 14-day streak",
            "criteria": {
                "type": "streak",
                "threshold": 14
            }
        }
    ],
    "exercises": [
        {
            "name": "Bench Press",
            "equipment": [
                "barbell",
                "bench"
            ],
            "muscles": [
                "chest",
                "triceps",
                "shoulders"
            ],
            "difficulty": "intermediate"
        },
        {
            "name": "Squat",
            "equipment": [
                "barbell"
            ],
            "muscles": [
                "quadriceps",
                "glutes",
                "hamstrings"
            ],
            "difficulty": "intermediate"
        },
        {
            "name": "Deadlift",
            "equipment": [
                "barbell"
            ],
            "muscles": [
                "back",
                "glutes",
                "hamstrings"
            ],
            "difficulty": "advanced"
        },
        {
            "name": "Pull-ups",
            "equipment": [
                "pull-up bar"
            ],
            "muscles": [
                "back",
                "biceps"
            ],
            "difficulty": "intermediate"
        },
        {
            "name": "Push-ups",
            "equipment": [],
            "muscles": [
                "chest",
                "triceps",
                "shoulders"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Dumbbell Curl",
            "equipment": [
                "dumbbells"
            ],
            "muscles": [
                "biceps"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Shoulder Press",
            "equipment": [
                "dumbbells"
            ],
            "muscles": [
                "shoulders",
                "triceps"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Dumbbell Row",
            "equipment": [
                "dumbbells"
            ],
            "muscles": [
                "back",
                "biceps"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Lunges",
            "equipment": [],
            "muscles": [
                "quadriceps",
                "glutes"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Plank",
            "equipment": [],
            "muscles": [
                "core"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Overhead Press",
            "equipment": [
                "barbell"
            ],
            "muscles": [
                "shoulders",
                "triceps"
            ],
            "difficulty": "intermediate"
        },
        {
            "name": "Barbell Row",
            "equipment": [
                "barbell"
            ],
            "muscles": [
                "back",
                "biceps"
            ],
            "difficulty": "intermediate"
        },
        {
            "name": "Face Pulls",
            "equipment": [
                "cable machine"
            ],
            "muscles": [
                "rear delts",
                "upper back"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Lateral Raise",
            "equipment": [
                "dumbbells"
            ],
            "muscles": [
                "shoulders"
            ],
            "difficulty": "beginner"
        },
        {
            "name": "Tricep Dips",
            "equipment": [],
            "muscles": [
                "triceps",
                "chest"
            ],
            "difficulty": "intermediate"
        }
    ]
}



Requirements:

Set up the test file using Jest with TypeScript configuration and Supertest for HTTP testing. Import the Express app from app.ts and define proper TypeScript interfaces for the expected response shapes. Use supertest to wrap the app without starting an actual server.

Implement beforeEach hooks that reset data.json to a known fixture state. Create a test-fixtures directory containing a baseline data file that can be copied over before each test suite. Ensure the original data file is backed up and restored after all tests complete.

Write tests for GET /users that verify the response includes all users with correct structure including id, name, email, currentStreak, longestStreak, totalWorkouts, and badges array. Test the activeOnly query parameter that filters to users with activity in the last 30 days.

Write tests for GET /users/:id that verify correct user details are returned including computed fields like currentStreak and badge count. Test that requesting a non-existent user ID returns 404 with a proper error message.

Write tests for POST /users that verify creating a new user with valid data returns 201 with the created user object including an auto-generated unique ID. Test validation errors for missing required fields, invalid email format, and duplicate email addresses returning 409.

Write tests for GET /workouts that verify the list includes all logged workouts with user information populated. Test filter parameters including userId, dateFrom, dateTo, and exerciseType. Verify sorting by date works in both ascending and descending order.

Write tests for POST /workouts that verify logging a workout returns 201 with the workout object, updates the user's totalWorkouts count, and triggers streak recalculation. Test that the exercises array is validated for required fields. Test error cases for non-existent userId returning 404.

Write tests for the streak calculation logic by creating controlled scenarios. Verify that logging workouts on consecutive days increases currentStreak, that missing a day resets the streak to 1, that longestStreak is updated when currentStreak exceeds it, and that logging multiple workouts on the same day does not double-count the streak.

Write tests for GET /users/:id/badges that verify the correct badges are returned based on user activity. Create test scenarios where a user qualifies for specific badges and verify they appear in the response. Test that badge progress is calculated correctly for badges not yet earned.

Write tests for the badge award system covering each badge type. Test count-based badges like "First Workout" awarded after 1 workout and "Centurion" after 100 workouts. Test streak-based badges like "Week Warrior" for 7-day streak. Test weight milestone badges that trigger when a user logs a personal record.

Write tests for POST /workouts/:id/complete that verify marking a workout as completed updates the completedAt timestamp, triggers badge evaluation, and updates user statistics. Test that completing an already-completed workout returns 409.

Write tests for GET /recommendations/:userId that verify recommendations are personalized based on user history, fitness level, and available equipment. Verify that exercises requiring equipment the user does not have are excluded. Test that recently performed exercises are deprioritized.

Write tests for date handling edge cases by mocking Date.now() or using a testing library like jest-date-mock. Test streak calculations when workouts span midnight, when the user is in a different timezone than the server, and when daylight saving time transitions occur.

Ensure all async operations are properly awaited and tests do not have race conditions. Use proper assertion libraries and provide meaningful failure messages that help diagnose issues.