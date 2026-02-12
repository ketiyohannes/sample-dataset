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