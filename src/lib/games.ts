import { eq, asc, desc, sql } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export type GameSortOrder = 'title-asc' | 'title-desc' | 'rating-desc';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function applySortToGamesQuery(query: ReturnType<typeof baseGamesQuery>, sort: GameSortOrder) {
    switch (sort) {
        case 'title-desc':
            return query.orderBy(desc(games.title), asc(games.id));
        case 'rating-desc':
            return query.orderBy(
                sql<number>`CASE WHEN ${games.starRating} IS NULL THEN 1 ELSE 0 END`,
                desc(games.starRating),
                asc(games.title),
                asc(games.id),
            );
        case 'title-asc':
        default:
            return query.orderBy(asc(games.title), asc(games.id));
    }
}

/** All games ordered according to the selected sort mode. */
export async function getAllGames(db: Database, sort: GameSortOrder = 'title-asc'): Promise<Game[]> {
    const rows = await applySortToGamesQuery(baseGamesQuery(db), sort);
    return rows.map(mapGame);
}

/** All game ids ordered according to the selected sort mode. */
export async function getAllGameIds(db: Database, sort: GameSortOrder = 'title-asc'): Promise<number[]> {
    const query = db.select({ id: games.id }).from(games);
    const rows = await applySortToGamesQuery(query as ReturnType<typeof baseGamesQuery>, sort);
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
